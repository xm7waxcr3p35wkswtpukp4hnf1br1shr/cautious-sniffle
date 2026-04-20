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

async function supabaseQuery(path: string, options?: RequestInit) {
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

// POST /api/auth/login  { apiKey: string }
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { apiKey?: string };
    const apiKey = (body.apiKey ?? "").trim();

    if (!apiKey) {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    const hash = await hashKey(apiKey);

    const res = await supabaseQuery(
      `api_keys?key_hash=eq.${hash}&select=id,label,is_active,expires_at&limit=1`
    );

    const rows = (await res.json()) as {
      id: string;
      label: string;
      is_active: boolean;
      expires_at: string | null;
    }[];

    const row = rows?.[0];

    if (!row) {
      return NextResponse.json({ error: "Invalid API key" }, { status: 401 });
    }

    if (!row.is_active) {
      return NextResponse.json({ error: "API key is inactive" }, { status: 403 });
    }

    if (row.expires_at && new Date(row.expires_at) < new Date()) {
      return NextResponse.json({ error: "API key has expired" }, { status: 403 });
    }

    await supabaseQuery(`api_keys?id=eq.${row.id}`, {
      method: "PATCH",
      body: JSON.stringify({ last_used_at: new Date().toISOString() }),
    });

    const response = NextResponse.json({ ok: true, label: row.label });

    response.cookies.set("auth_token", apiKey, {
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

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
  return response;
}

export async function GET(req: NextRequest) {
  const token = req.cookies.get("auth_token")?.value;

  if (!token) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const hash = await hashKey(token);

  const res = await supabaseQuery(
    `api_keys?key_hash=eq.${hash}&select=id,label,is_active&limit=1`
  );

  const rows = (await res.json()) as {
    id: string;
    label: string;
    is_active: boolean;
  }[];

  const row = rows?.[0];

  if (!row || !row.is_active) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    response.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
    return response;
  }

  return NextResponse.json({ authenticated: true, label: row.label });
}
