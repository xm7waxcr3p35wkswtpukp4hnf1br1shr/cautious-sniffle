// Shared utilities used across API routes
// Eliminates the duplicated hashKey + supabaseQuery in every route file

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export async function hashKey(key: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

export async function sq(path: string, options?: RequestInit) {
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

export async function getKeyRole(token: string): Promise<string | null> {
  const hash = await hashKey(token);
  const res = await sq(`api_keys?key_hash=eq.${hash}&select=role,is_active,expires_at&limit=1`);
  const rows = (await res.json()) as { role: string; is_active: boolean; expires_at: string | null }[];
  const row = rows?.[0];
  if (!row || !row.is_active) return null;
  if (row.expires_at && new Date(row.expires_at) < new Date()) return null;
  return row.role;
}