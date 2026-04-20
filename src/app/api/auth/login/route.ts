import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/auth/login  { apiKey: string }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { apiKey?: string };
    const apiKey = (body.apiKey ?? "").trim();

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    // Look up the key in Supabase
    const { data, error } = await supabase
      .from("api_keys")
      .select("id, label, is_active, expires_at")
      .eq("key_hash", await hashKey(apiKey))
      .single();

    if (error || !data) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    if (!data.is_active) {
      return NextResponse.json({ error: "API key is inactive" }, { status: 403 });
    }

    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return NextResponse.json({ error: "API key has expired" }, { status: 403 });
    }

    // Update last_used_at
    await supabase
      .from("api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", data.id);

    // Set auth cookie (the key itself as the session token)
    const response = NextResponse.json({
      ok: true,
      label: data.label,
    });

    response.cookies.set("auth_token", apiKey, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: "/",
    });

    return response;
  } catch (err) {
    console.error("[auth/login] error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE /api/auth/login  → logout
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth_token", "", {
    maxAge: 0,
    path: "/",
  });
  return response;
}

// GET /api/auth/login  → verify current token from cookie
export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const { data } = await supabase
    .from("api_keys")
    .select("id, label, is_active")
    .eq("key_hash", await hashKey(token))
    .single();

  if (!data || !data.is_active) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    response.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
    return response;
  }

  return NextResponse.json({ authenticated: true, label: data.label });
}

async function hashKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}