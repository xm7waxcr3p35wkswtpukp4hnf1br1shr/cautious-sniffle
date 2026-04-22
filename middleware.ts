import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth", "/_next", "/fonts", "/favicon.ico", "/api/health"];

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Simple in-memory cache for role lookups to avoid redundant Supabase calls
// within the same Edge runtime instance (TTL: 60s)
const roleCache = new Map<string, { role: string; exp: number }>();

async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function getRole(token: string): Promise<string | null> {
  const cached = roleCache.get(token);
  if (cached && cached.exp > Date.now()) return cached.role;

  try {
    const hash = await hashKey(token);
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/api_keys?key_hash=eq.${hash}&select=role,is_active,expires_at&limit=1`,
      { headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` } }
    );
    const rows = (await res.json()) as { role: string; is_active: boolean; expires_at: string | null }[];
    const row = rows?.[0];
    if (!row || !row.is_active) return null;
    if (row.expires_at && new Date(row.expires_at) < new Date()) return null;

    roleCache.set(token, { role: row.role, exp: Date.now() + 60_000 });
    // Prevent unbounded growth
    if (roleCache.size > 500) roleCache.delete(roleCache.keys().next().value!);
    return row.role;
  } catch {
    return null;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) return NextResponse.next();

  const token = req.cookies.get("auth_token")?.value;
  if (!token) return redirectToLogin(req, pathname);

  const role = await getRole(token);
  if (!role) {
    const res = redirectToLogin(req, pathname);
    res.cookies.set("auth_token", "", { maxAge: 0, path: "/" });
    return res;
  }

  if (pathname.startsWith("/admin") && role !== "admin") {
    return NextResponse.redirect(new URL("/", req.url));
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest, from: string) {
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("from", from);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};