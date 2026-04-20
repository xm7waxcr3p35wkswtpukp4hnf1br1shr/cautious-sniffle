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

async function getRole(token: string): Promise<string | null> {
  const hash = await hashKey(token);
  const res = await sq(`api_keys?key_hash=eq.${hash}&select=role,is_active&limit=1`);
  const rows = (await res.json()) as { role: string; is_active: boolean }[];
  const row = rows?.[0];
  if (!row || !row.is_active) return null;
  return row.role;
}

// GET — list all keys
export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRole(token);
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const res = await sq("api_keys?select=id,label,role,is_active,expires_at,created_at,last_used_at&order=created_at.desc");
  const rows = await res.json();
  return NextResponse.json({ keys: rows });
}

// POST — create key
export async function POST(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRole(token);
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as {
    label?: string;
    rawKey?: string;
    role?: string;
    expiresAt?: string;
  };
  const { label, rawKey, role: newRole = "user", expiresAt } = body;

  if (!label || !rawKey)
    return NextResponse.json({ error: "label and rawKey are required" }, { status: 400 });
  if (rawKey.length < 8)
    return NextResponse.json({ error: "Key must be at least 8 characters" }, { status: 400 });

  const hash = await hashKey(rawKey);
  const payload: Record<string, unknown> = { key_hash: hash, label, role: newRole };
  if (expiresAt) payload.expires_at = expiresAt;

  const res = await sq("api_keys", { method: "POST", body: JSON.stringify(payload) });

  if (!res.ok) {
    const err = (await res.json()) as { message?: string };
    const msg = err.message ?? "Failed to create key";
    if (msg.includes("unique")) return NextResponse.json({ error: "Key already exists" }, { status: 409 });
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}

// PATCH — toggle is_active
export async function PATCH(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRole(token);
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = (await req.json()) as { id?: string; is_active?: boolean };
  if (!body.id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await sq(`api_keys?id=eq.${body.id}`, {
    method: "PATCH",
    body: JSON.stringify({ is_active: body.is_active }),
  });

  return NextResponse.json({ ok: true });
}

// DELETE — delete key by id
export async function DELETE(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = await getRole(token);
  if (role !== "admin") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await sq(`api_keys?id=eq.${id}`, { method: "DELETE" });
  return NextResponse.json({ ok: true });
}