import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Maximum words we'll return in one response
const MAX_WORDS = 10000;

function parseWords(text: string): string[] {
  return text
    .split(/[\n\r,;|\t]+/)
    .map((w) => w.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""))
    .filter((w) => w.length >= 3 && w.length <= 32 && /^[a-z]/.test(w));
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const rawUrl = searchParams.get("url");

  if (!rawUrl) {
    return NextResponse.json({ error: "url parameter is required" }, { status: 400 });
  }

  // Normalize Pastebin URL to raw
  let fetchUrl = rawUrl;
  if (fetchUrl.includes("pastebin.com/") && !fetchUrl.includes("/raw/")) {
    fetchUrl = fetchUrl.replace("pastebin.com/", "pastebin.com/raw/");
  }
  // Avoid double /raw/raw/
  fetchUrl = fetchUrl.replace("/raw/raw/", "/raw/");

  try {
    const res = await fetch(fetchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; username-tool/1.0)",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Remote server returned HTTP ${res.status}` },
        { status: 502 }
      );
    }

    const text = await res.text();
    const words = parseWords(text).slice(0, MAX_WORDS);

    if (words.length === 0) {
      return NextResponse.json(
        {
          error:
            "No valid words found (need 3–32 chars, start with a letter, only letters/numbers/underscores)",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({ words, total: words.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // Provide friendlier messages
    if (msg.includes("timed out") || msg.includes("timeout")) {
      return NextResponse.json(
        { error: "Request timed out — check the URL and try again" },
        { status: 504 }
      );
    }
    if (msg.includes("fetch")) {
      return NextResponse.json(
        { error: "Could not reach the URL — make sure it's publicly accessible" },
        { status: 502 }
      );
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}