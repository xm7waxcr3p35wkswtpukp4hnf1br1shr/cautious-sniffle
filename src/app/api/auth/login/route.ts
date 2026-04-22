import { NextRequest, NextResponse } from "next/server";
import { hashKey, sq } from "@/lib/supabase";

// POST /api/auth/login  { apiKey: string }
export async function POST(req: NextRequest) {
  try {
    const { apiKey = "" } = (await req.json()) as { apiKey?: string };
    const key = apiKey.trim();
    if (!key) return NextResponse.json({ error: "API key is required" }, { status: 400 });

    const hash = await hashKey(key);
    const res = await sq(`api_keys?key_hash=eq.${hash}&select=id,label,is_active,expires_at&limit=1`);
    const row = ((await res.json()) as { id: string; label: string; is_active: boolean; expires_at: string | null }[])?.[0];

    if (!row) return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    if (!row.is_active) return NextResponse.json({ error: "API key is inactive" }, { status: 403 });
    if (row.expires_at && new Date(row.expires_at) < new Date())
      return NextResponse.json({ error: "API key has expired" }, { status: 403 });

    // Fire-and-forget last_used_at update
    sq(`api_keys?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    }).catch(() => {});

    const response = NextResponse.json({ ok: true, label: row.label });
    response.cookies.set("auth_token", key, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30,
      path: "/",
    });
    return response;
  } catch (err) {
    console.error("[auth/login] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/auth/login — logout
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
  return response;
}

// GET /api/auth/login — check session
export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;
  if (!token) return NextResponse.json({ authenticated: false }, { status: 401 });

  const hash = await hashKey(token);
  const res = await sq(`api_keys?key_hash=eq.${hash}&select=id,label,is_active&limit=1`);
  const row = ((await res.json()) as { id: string; label: string; is_active: boolean }[])?.[0];

  if (!row?.is_active) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    response.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
    return response;
  }

  return NextResponse.json({ authenticated: true, label: row.label });
}