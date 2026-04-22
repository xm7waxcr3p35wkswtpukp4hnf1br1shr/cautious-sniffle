import { NextRequest, NextResponse } from "next/server";
import { hashKey, sq, getKeyRole } from "@/lib/supabase";

async function requireAdmin(req: NextRequest): Promise<string | null> {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return null;
  const role = await getKeyRole(token);
  return role === "admin" ? token : null;
}

const UNAUTH = NextResponse.json({ error: "Unauthorized" }, { status: 401 });
const FORBIDDEN = NextResponse.json({ error: "Forbidden" }, { status: 403 });

// GET — list all keys
export async function GET(req: NextRequest) {
  if (!await requireAdmin(req)) {
    const token = req.cookies.get("auth_token")?.value;
    return token ? FORBIDDEN : UNAUTH;
  }
  const res = await sq("api_keys?select=id,label,role,is_active,expires_at,created_at,last_used_at&order=created_at.desc");
  return NextResponse.json({ keys: await res.json() });
}

// POST — create key
export async function POST(req: NextRequest) {
  if (!await requireAdmin(req)) {
    const token = req.cookies.get("auth_token")?.value;
    return token ? FORBIDDEN : UNAUTH;
  }

  const { label, rawKey, role: newRole = "user", expiresAt } =
    (await req.json()) as { label?: string; rawKey?: string; role?: string; expiresAt?: string };

  if (!label || !rawKey) return NextResponse.json({ error: "label and rawKey are required" }, { status: 400 });
  if (rawKey.length < 8) return NextResponse.json({ error: "Key must be at least 8 characters" }, { status: 400 });

  const payload: Record<string, unknown> = { key_hash: await hashKey(rawKey), label, role: newRole };
  if (expiresAt) payload.expires_at = expiresAt;

  const res = await sq("api_keys", { method: "POST", body: JSON.stringify(payload) });
  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    const msg = err.message ?? "Failed to create key";
    return NextResponse.json({ error: msg.includes("unique") ? "Key already exists" : msg }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}

// PATCH — toggle is_active
export async function PATCH(req: NextRequest) {
  if (!await requireAdmin(req)) {
    const token = req.cookies.get("auth_token")?.value;
    return token ? FORBIDDEN : UNAUTH;
  }
  const { id, is_active } = (await req.json()) as { id?: string; is_active?: boolean };
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await sq(`api_keys?id=eq.${id}`, { method: "PATCH", body: JSON.stringify({ is_active }) });
  return NextResponse.json({ ok: true });
}

// DELETE — delete key by id
export async function DELETE(req: NextRequest) {
  if (!await requireAdmin(req)) {
    const token = req.cookies.get("auth_token")?.value;
    return token ? FORBIDDEN : UNAUTH;
  }
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await sq(`api_keys?id=eq.${id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}