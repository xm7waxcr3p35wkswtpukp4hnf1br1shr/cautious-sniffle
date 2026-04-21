import { NextRequest, NextResponse } from "next/server";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sq(path: string, options?: RequestInit) {
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      Prefer: "return=representation",
      ...(options?.headers ?? {}),
    },
  });
}

async function getKeyInfo(token: string): Promise<{ role: string; label: string; id: string } | null> {
  const hash = await hashKey(token);
  const res = await sq(`api_keys?key_hash=eq.${hash}&select=id,role,label,is_active&limit=1`);
  const rows = (await res.json()) as { id: string; role: string; label: string; is_active: boolean }[];
  const row = rows?.[0];
  if (!row || !row.is_active) return null;
  return { role: row.role, label: row.label, id: row.id };
}

// In-memory presence store: keyId → { label, lastSeen }
// This resets on server restart, which is fine for "who's online now"
const presenceMap = new Map<string, { label: string; lastSeen: number }>();
const ONLINE_THRESHOLD_MS = 65_000; // 65 seconds

function cleanStale() {
  const now = Date.now();
  for (const [id, entry] of presenceMap.entries()) {
    if (now - entry.lastSeen > ONLINE_THRESHOLD_MS) {
      presenceMap.delete(id);
    }
  }
}

// POST — heartbeat (called by all logged-in users every 30s)
export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });

  const info = await getKeyInfo(token);
  if (!info) return NextResponse.json({ ok: false }, { status: 401 });

  presenceMap.set(info.id, { label: info.label, lastSeen: Date.now() });
  cleanStale();

  return NextResponse.json({ ok: true });
}

// GET — list online users (admin only)
export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const info = await getKeyInfo(token);
  if (!info || info.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  cleanStale();

  const online = Array.from(presenceMap.entries()).map(([id, { label, lastSeen }]) => ({
    id,
    label,
    lastSeenMs: Date.now() - lastSeen,
  }));

  return NextResponse.json({ online });
}