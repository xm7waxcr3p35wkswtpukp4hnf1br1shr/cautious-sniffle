import { NextRequest, NextResponse } from "next/server";
import { sq, hashKey } from "@/lib/supabase";

type KeyInfo = { role: string; label: string; id: string };
type PresenceEntry = { label: string; lastSeen: number };

// In-memory presence store — resets on server restart (intentional)
const presenceMap = new Map<string, PresenceEntry>();
const ONLINE_TTL_MS = 65_000;

async function getKeyInfo(token: string): Promise<KeyInfo | null> {
  const hash = await hashKey(token);
  const res = await sq(`api_keys?key_hash=eq.${hash}&select=id,role,label,is_active&limit=1`);
  const row = ((await res.json()) as (KeyInfo & { is_active: boolean })[])?.[0];
  return row?.is_active ? { role: row.role, label: row.label, id: row.id } : null;
}

function cleanStale() {
  const cutoff = Date.now() - ONLINE_TTL_MS;
  for (const [id, entry] of presenceMap) {
    if (entry.lastSeen < cutoff) presenceMap.delete(id);
  }
}

// POST — heartbeat (all logged-in users every 30s)
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
  if (!info?.role || info.role !== "admin")
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  cleanStale();
  const now = Date.now();
  const online = Array.from(presenceMap.entries()).map(([id, { label, lastSeen }]) => ({
    id, label, lastSeenMs: now - lastSeen,
  }));
  return NextResponse.json({ online });
}