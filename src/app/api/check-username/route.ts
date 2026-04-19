import { NextRequest, NextResponse } from "next/server";
import { db } from "@/db";
import { usernameChecks } from "@/db/schema";

const FRAGMENT_API_KEY = process.env.FRAGMENT_API_KEY ?? "9c5d52da-e56f-42dd-8043-e115c1cf1c04";
const FRAGMENT_API_BASE = "https://api.fragment-api.com";
const FRAGMENT_BASE = "https://fragment.com/";

async function checkViaFragmentScrape(username: string): Promise<{
  status: string;
  source: string;
}> {
  try {
    const response = await fetch(FRAGMENT_BASE + "username/" + username, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246",
        "X-Aj-Referer": `${FRAGMENT_BASE}?query=${username}`,
        Accept: "application/json, text/javascript, */*; q=0.01",
        "Accept-Language": "en-US,en;q=0.5",
        "X-Requested-With": "XMLHttpRequest",
        Connection: "keep-alive",
      },
      signal: AbortSignal.timeout(8000),
    });

    let data: Record<string, unknown>;
    try {
      data = (await response.json()) as Record<string, unknown>;
    } catch {
      return { status: "Unknown", source: "fragment.com" };
    }

    if (!data || !("h" in data)) {
      return { status: "Available", source: "fragment.com" };
    }

    const hData = data.h as string;
    const statusMatch = hData.split("tm-section-header-status")[1];
    if (!statusMatch) return { status: "Unknown", source: "fragment.com" };

    const rawStatus = statusMatch.split('">')[0].trim();
    const statusMap: Record<string, string> = {
      "tm-status-taken": "Taken",
      "tm-status-avail": "For Sale",
      "tm-status-unavail": "Sold",
    };

    return { status: statusMap[rawStatus] ?? "Unknown", source: "fragment.com" };
  } catch {
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

async function checkOne(rawUsername: string): Promise<{
  username: string;
  status: string;
  name?: string | null;
  photo?: string | null;
  hasPremium?: boolean | null;
  source: string;
  error?: boolean;
}> {
  // Always normalize to lowercase — Telegram usernames are case-insensitive
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
      username,
      status: result.status,
      name: result.name ?? null,
      photo: result.photo ?? null,
      hasPremium: result.hasPremium != null ? String(result.hasPremium) : null,
    });
  } catch { /* ignore */ }

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

  if (!raw.trim()) {
    return NextResponse.json({ error: "Username is required" }, { status: 400 });
  }

  const result = await checkOne(raw);

  if (result.error) {
    return NextResponse.json(
      { error: "Invalid username format. Must start with a letter, 3–32 characters, only letters/numbers/underscores." },
      { status: 400 }
    );
  }

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { usernames: string[] };
  const usernames: string[] = body.usernames ?? [];

  if (!Array.isArray(usernames) || usernames.length === 0) {
    return NextResponse.json({ error: "usernames array is required" }, { status: 400 });
  }

  if (usernames.length > 200) {
    return NextResponse.json({ error: "Max 200 usernames per batch" }, { status: 400 });
  }

  const settled = await Promise.allSettled(usernames.map((raw) => checkOne(raw)));

  const data = settled.map((r) =>
    r.status === "fulfilled" ? r.value : { username: "?", status: "Error", source: "", error: true }
  );

  return NextResponse.json({ results: data });
}
