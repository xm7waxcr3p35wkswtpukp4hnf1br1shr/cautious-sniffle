import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const MAX_WORDS = 10_000;
const WORD_RE = /^[a-z][a-z0-9_]{2,31}$/;

function parseWords(text: string): string[] {
  return text
    .split(/[\n\r,;|\t]+/)
    .map(w => w.trim().toLowerCase().replace(/[^a-z0-9_]/g, ""))
    .filter(w => WORD_RE.test(w))
    .slice(0, MAX_WORDS);
}

function normalizeUrl(url: string): string {
  // Pastebin: ensure raw URL, avoid double /raw/raw/
  if (url.includes("pastebin.com/") && !url.includes("/raw/")) {
    url = url.replace("pastebin.com/", "pastebin.com/raw/");
  }
  return url.replace("/raw/raw/", "/raw/");
}

export async function GET(req: NextRequest) {
  const rawUrl = new URL(req.url).searchParams.get("url");
  if (!rawUrl) return NextResponse.json({ error: "url parameter is required" }, { status: 400 });

  try {
    const res = await fetch(normalizeUrl(rawUrl), {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; username-tool/1.0)" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) return NextResponse.json(
      { error: `Remote server returned HTTP ${res.status}` }, { status: 502 }
    );

    const words = parseWords(await res.text());
    if (!words.length) return NextResponse.json(
      { error: "No valid words found (need 3–32 chars, start with a letter, only letters/numbers/underscores)" },
      { status: 422 }
    );

    return NextResponse.json({ words, total: words.length });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("timed out") || msg.includes("timeout"))
      return NextResponse.json({ error: "Request timed out — check the URL and try again" }, { status: 504 });
    if (msg.includes("fetch"))
      return NextResponse.json({ error: "Could not reach the URL — make sure it's publicly accessible" }, { status: 502 });
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}