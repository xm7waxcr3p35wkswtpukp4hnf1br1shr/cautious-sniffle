import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { usernameChecks } from "@/db/schema";

const FRAGMENT_API_KEY = process.env.FRAGMENT_API_KEY;
const FRAGMENT_API_BASE = "https://api.fragment-api.com";
const FRAGMENT_BASE = "https://fragment.com/";

// Conservative concurrency — Fragment rate-limits hard above 4-5 parallel scrape requests
const CONCURRENCY = 4;

// In-memory cache to avoid duplicate requests within the same process
const resultCache = new Map<string, {
  status: string;
  name: string | null;
  photo: string | null;
  hasPremium: boolean | null;
  source: string;
  ts: number;
}>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCached(username: string) {
  const entry = resultCache.get(username);
  if (!entry) return null;
  if (Date.now() - entry.ts > CACHE_TTL_MS) { resultCache.delete(username); return null; }
  return entry;
}

function setCache(username: string, data: {
  status: string; name: string | null; photo: string | null;
  hasPremium: boolean | null; source: string;
}) {
  if (resultCache.size >= 2000) {
    const firstKey = resultCache.keys().next().value;
    if (firstKey) resultCache.delete(firstKey);
  }
  resultCache.set(username, { ...data, ts: Date.now() });
}

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
      await sleep(workerIdx * 120);
      while (idx < items.length) {
        const i = idx++;
        try {
          results[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (reason) {
          results[i] = { status: "rejected", reason };
        }
        await sleep(150 + Math.random() * 100);
      }
    }
  );
  await Promise.all(workers);
  return results;
}

/**
 * Parse Fragment HTML (from "h" field in JSON response) to determine status.
 *
 * Status classes present in HTML:
 *   tm-status-taken   → "Taken"    (registered on Telegram, not for sale)
 *   tm-status-avail   → "For Sale" (listed on Fragment auction)
 *   tm-status-unavail → "Sold"     (sold via Fragment)
 *
 * No tm-section-header-status at all → "Available" (free to register)
 * Very short / empty h → "RATE_LIMITED" (retry needed)
 */
function parseFragmentHtml(html: string): string {
  // Use regex — more robust than chained string splits
  const match = /tm-section-header-status\s+(tm-status-\w+)/.exec(html);

  if (!match) {
    // Suspiciously short — Fragment returned empty/truncated response
    if (html.length < 100) return "RATE_LIMITED";
    // Normal page with no status badge = username is free
    return "Available";
  }

  const statusMap: Record<string, string> = {
    "tm-status-taken":   "Taken",
    "tm-status-avail":   "For Sale",
    "tm-status-unavail": "Sold",
  };
  return statusMap[match[1]] ?? "Unknown";
}

async function checkViaFragmentScrape(
  username: string,
  attempt = 0
): Promise<{ status: string; source: string }> {
  const MAX_ATTEMPTS = 5;

  try {
    const response = await fetch(FRAGMENT_BASE + "username/" + username, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "X-Aj-Referer": `${FRAGMENT_BASE}?query=${username}`,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.9",
        "X-Requested-With": "XMLHttpRequest",
        Connection: "keep-alive",
        Referer: FRAGMENT_BASE,
      },
      signal: AbortSignal.timeout(15000),
    });

    if (response.status === 429 || response.status === 503) {
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.pow(2, attempt + 1) * 600 + Math.random() * 500;
        console.log(`[fragment] @${username} HTTP ${response.status}, retry ${attempt + 1} in ${Math.round(delay)}ms`);
        await sleep(delay);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    if (!response.ok) {
      if (attempt < 3) {
        await sleep(1000 + Math.random() * 500);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    const rawText = await response.text();

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      // Non-JSON = rate-limit HTML page
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.pow(2, attempt + 1) * 700 + Math.random() * 600;
        console.log(`[fragment] @${username} non-JSON (${rawText.length}c), retry ${attempt + 1}`);
        await sleep(delay);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    if (!data || typeof data.h !== "string") {
      if (attempt < 3) {
        await sleep(800 + Math.random() * 400);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    const status = parseFragmentHtml(data.h);

    if (status === "RATE_LIMITED") {
      if (attempt < MAX_ATTEMPTS) {
        const delay = Math.pow(2, attempt + 1) * 500 + Math.random() * 500;
        console.log(`[fragment] @${username} empty h, retry ${attempt + 1}`);
        await sleep(delay);
        return checkViaFragmentScrape(username, attempt + 1);
      }
      return { status: "Unknown", source: "fragment.com" };
    }

    return { status, source: "fragment.com" };

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if ((msg.includes("timeout") || msg.includes("timed out")) && attempt < MAX_ATTEMPTS) {
      await sleep(Math.pow(2, attempt) * 700 + Math.random() * 500);
      return checkViaFragmentScrape(username, attempt + 1);
    }
    console.error(`[fragment] @${username} error:`, msg);
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
      headers: { Accept: "application/json", Authorization: `JWT ${FRAGMENT_API_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 404) return { status: "Available", source: "fragment-api.com" };
    if (res.status === 400 || !res.ok) return null;
    const data = (await res.json()) as {
      username: string; photo: string | null; name: string | null; has_premium: boolean | null;
    };
    return { status: "Taken", name: data.name, photo: data.photo, hasPremium: data.has_premium, source: "fragment-api.com" };
  } catch { return null; }
}

async function checkOne(
  rawUsername: string,
  userId?: string | null
): Promise<{
  username: string; status: string; name?: string | null;
  photo?: string | null; hasPremium?: boolean | null; source: string; error?: boolean;
}> {
  const username = rawUsername.trim().replace(/^@/, "").toLowerCase();
  if (!username || !/^[a-z][a-z0-9_]{2,31}$/.test(username)) {
    return { username: username || rawUsername, status: "Invalid", source: "", error: true };
  }

  const cached = getCached(username);
  if (cached) return { username, ...cached };

  let result = await checkViaFragmentAPI(username);
  if (!result) {
    const scraped = await checkViaFragmentScrape(username);
    result = { ...scraped, name: null, photo: null, hasPremium: null };
  }

  setCache(username, {
    status: result.status, name: result.name ?? null,
    photo: result.photo ?? null, hasPremium: result.hasPremium ?? null,
    source: result.source,
  });

  db.insert(usernameChecks).values({
    userId: userId ?? null, username, status: result.status,
    name: result.name ?? null, photo: result.photo ?? null,
    hasPremium: result.hasPremium != null ? String(result.hasPremium) : null,
  }).catch(() => { /* ignore */ });

  return {
    username, status: result.status, name: result.name ?? null,
    photo: result.photo ?? null, hasPremium: result.hasPremium ?? null,
    source: result.source,
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const raw = searchParams.get("username") ?? "";
  const userId = req.headers.get("x-user-id");
  if (!raw.trim()) return NextResponse.json({ error: "Username is required" }, { status: 400 });
  const result = await checkOne(raw, userId);
  if (result.error) return NextResponse.json(
    { error: "Invalid username format. Must start with a letter, 3–32 characters, only letters/numbers/underscores." },
    { status: 400 }
  );
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { usernames: string[] };
  const usernames: string[] = body.usernames ?? [];
  const userId = req.headers.get("x-user-id");

  if (!Array.isArray(usernames) || usernames.length === 0)
    return NextResponse.json({ error: "usernames array is required" }, { status: 400 });
  if (usernames.length > 2700)
    return NextResponse.json({ error: "Max 2700 usernames per batch" }, { status: 400 });

  // Deduplicate inputs — identical usernames get one request, result is shared
  const seen = new Map<string, number>();
  const unique: string[] = [];
  const dupeMap: number[] = new Array(usernames.length);

  for (let i = 0; i < usernames.length; i++) {
    const u = (usernames[i] ?? "").trim().replace(/^@/, "").toLowerCase();
    if (seen.has(u)) {
      dupeMap[i] = seen.get(u)!;
    } else {
      seen.set(u, unique.length);
      dupeMap[i] = unique.length;
      unique.push(usernames[i]);
    }
  }

  const settled = await runWithConcurrency(unique, (raw) => checkOne(raw, userId));

  const uniqueResults = settled.map((r) =>
    r.status === "fulfilled" ? r.value
      : { username: "?", status: "Error", source: "", error: true }
  );

  const data = dupeMap.map(uIdx => uniqueResults[uIdx]);
  return NextResponse.json({ results: data });
}
