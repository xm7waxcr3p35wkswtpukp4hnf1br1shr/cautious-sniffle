import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { usernameChecks } from "@/db/schema";

const FRAGMENT_API_KEY = process.env.FRAGMENT_API_KEY;
const FRAGMENT_API_BASE = "https://api.fragment-api.com";
const FRAGMENT_BASE = "https://fragment.com/";

// Reduced concurrency to avoid Fragment scrape rate-limiting
// Fragment rate-limits aggressively above ~5 parallel requests from the same IP
const CONCURRENCY = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithConcurrency<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let idx = 0;

  const workers = Array.from(
    { length: Math.min(CONCURRENCY, items.length) },
    async (_, workerIdx) => {
      // Stagger worker startup to avoid thundering herd
      await sleep(workerIdx * 80);
      while (idx < items.length) {
        const i = idx++;
        try {
          results[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
        // Small delay between each request per worker
        await sleep(100 + Math.random() * 80);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

/**
 * Scrapes fragment.com for a username status.
 *
 * Fragment status mapping from the HTML response:
 *   tm-status-taken  → "Taken"      (username registered on Telegram, not on auction)
 *   tm-status-avail  → "For Sale"   (username is on the Fragment auction, available to buy)
 *   tm-status-unavail→ "Sold"       (username was sold via Fragment)
 *
 * If the username page has NO tm-section-header-status element, it means the username
 * is completely free (Available to register for free on Telegram).
 *
 * If we get a rate-limit or parse error, we retry with exponential backoff.
 */
async function checkViaFragmentScrape(
  username: string,
  attempt = 0
): Promise<{ status: string; source: string }> {
  const MAX_ATTEMPTS = 5;

  try {
    const response = await fetch(FRAGMENT_BASE + "username/" + username, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "X-Aj-Referer": `${FRAGMENT_BASE}?query=${username}`,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        Connection: "keep-alive",
        Referer: FRAGMENT_BASE,
      },
      signal: AbortSignal.timeout(15000),
    });

    // Rate limit — retry with exponential backoff
    if (response.status === 429 || response.status === 503) {
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.pow(2, attempt + 1) * 400 + Math.random() * 500;
        console.log(`[fragment] @${username} rate-limited (${response.status}), retry ${attempt + 1} in ${Math.round(delay)}ms`);
        await sleep(delay);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    if (!response.ok) {
      if (attempt < 2) {
        await sleep(1000 + Math.random() * 500);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    let data: Record<string, unknown>;
    try {
      const text = await response.text();
      data = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // JSON parse failed — Fragment returned an HTML rate-limit/block page
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.pow(2, attempt + 1) * 500 + Math.random() * 600;
        console.log(`[fragment] @${username} JSON parse failed, retry ${attempt + 1} in ${Math.round(delay)}ms`);
        await sleep(delay);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    // Unexpected response shape — could be a different kind of rate limit page
    if (!data || typeof data !== "object" || !("h" in data)) {
      if (attempt < 3) {
        await sleep(800 + Math.random() * 400);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    const hData = data.h as string;
    if (typeof hData !== "string") {
      return { status: "Unknown", source: "fragment.com" };
    }

    // Check if the status element exists at all
    if (!hData.includes("tm-section-header-status")) {
      // No status badge → username is completely free to register
      return { status: "Available", source: "fragment.com" };
    }

    const afterStatus = hData.split("tm-section-header-status")[1];
    if (!afterStatus) {
      return { status: "Unknown", source: "fragment.com" };
    }

    // Extract the class name that follows tm-section-header-status
    const rawStatus = afterStatus.split('">')[0].trim();

    const statusMap: Record<string, string> = {
      "tm-status-taken": "Taken",
      "tm-status-avail": "For Sale",
      "tm-status-unavail": "Sold",
    };

    const mapped = statusMap[rawStatus];
    if (mapped) return { status: mapped, source: "fragment.com" };

    // Unknown class — could be a new status from Fragment
    return { status: "Unknown", source: "fragment.com" };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if ((msg.includes("timeout") || msg.includes("timed out")) && attempt < MAX_ATTEMPTS) {
      const delay = Math.pow(2, attempt) * 600 + Math.random() * 400;
      await sleep(delay);
      return checkViaFragmentScrape(username, attempt + 1);
    }
    console.error(`[fragment] @${username} error:`, err);
    return { status: "Unknown", source: "fragment.com" };
  }
}

async function checkViaFragmentAPI(username: string): Promise<{
  status: string;
  name?: string | null;
  photo?: string | null;
  hasPremium?: boolean | null;
  source: string;
} | null> {
  if (!FRAGMENT_API_KEY) return null;

  try {
    const res = await fetch(`${FRAGMENT_API_BASE}/v1/misc/user/${username}/`, {
      headers: {
        Accept: "application/json",
        Authorization: `JWT ${FRAGMENT_API_KEY}`,
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) return { status: "Available", source: "fragment-api.com" };
    if (res.status === 400) return null;
    if (!res.ok) return null;

    const data = (await res.json()) as {
      username: string;
      photo: string | null;
      name: string | null;
      has_premium: boolean | null;
    };

    return {
      status: "Taken",
      name: data.name,
      photo: data.photo,
      hasPremium: data.has_premium,
      source: "fragment-api.com",
    };
  } catch {
    return null;
  }
}

async function checkOne(
  rawUsername: string,
  userId?: string | null
): Promise<{
  username: string;
  status: string;
  name?: string | null;
  photo?: string | null;
  hasPremium?: boolean | null;
  source: string;
  error?: boolean;
}> {
  const username = rawUsername.trim().replace(/^@/, "").toLowerCase();

  if (!username || !/^[a-z][a-z0-9_]{2,31}$/.test(username)) {
    return { username: username || rawUsername, status: "Invalid", source: "", error: true };
  }

  let result = await checkViaFragmentAPI(username);
  if (!result) {
    const scraped = await checkViaFragmentScrape(username);
    result = { ...scraped, name: null, photo: null, hasPremium: null };
  }

  try {
    await db.insert(usernameChecks).values({
      userId: userId ?? null,
      username,
      status: result.status,
      name: result.name ?? null,
      photo: result.photo ?? null,
      hasPremium: result.hasPremium != null ? String(result.hasPremium) : null,
    });
  } catch {
    // ignore DB insert errors
  }

  return {
    username,
    status: result.status,
    name: result.name ?? null,
    photo: result.photo ?? null,
    hasPremium: result.hasPremium ?? null,
    source: result.source,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("username") ?? "";
  const userId = req.headers.get("x-user-id");

  if (!raw.trim()) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const result = await checkOne(raw, userId);

  if (result.error) {
    return NextResponse.json(
      {
        error:
          "Invalid username format. Must start with a letter, 3–32 characters, only letters/numbers/underscores.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { usernames: string[] };
  const usernames: string[] = body.usernames ?? [];
  const userId = req.headers.get("x-user-id");

  if (!Array.isArray(usernames) || usernames.length === 0) {
    return NextResponse.json({ error: "usernames array is required" }, { status: 400 });
  }

  if (usernames.length > 2700) {
    return NextResponse.json({ error: "Max 2700 usernames per batch" }, { status: 400 });
  }

  const settled = await runWithConcurrency(
    usernames,
    (raw) => checkOne(raw, userId)
  );

  const data = settled.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : { username: "?", status: "Error", source: "", error: true }
  );

  return NextResponse.json({ results: data });
}
