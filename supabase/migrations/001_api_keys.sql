-- ============================================================
--  api_keys table — run this in Supabase SQL Editor
-- ============================================================

create table if not exists public.api_keys (
  id            uuid primary key default gen_random_uuid(),

  -- SHA-256 hash of the actual key (never store raw keys)
  key_hash      text not null unique,

  -- Human-readable label, e.g. "admin", "read-only", "johndoe"
  label         varchar(64) not null default 'unnamed',

  -- Whether this key is currently usable
  is_active     boolean not null default true,

  -- Optional expiry (null = never expires)
  expires_at    timestamptz,

  -- Audit fields
  created_at    timestamptz not null default now(),
  last_used_at  timestamptz
);

-- Index for fast lookups by hash
create index if not exists api_keys_key_hash_idx on public.api_keys (key_hash);

-- Row Level Security (disable public access — only service role can read)
alter table public.api_keys enable row level security;

-- No public policies → only service_role (used in server-side API) can access
-- ✅ This is safe because your Next.js API routes use SUPABASE_SERVICE_ROLE_KEY


-- ============================================================
--  How to add a new key
-- ============================================================
-- 1. Generate a random key (e.g. in Node.js):
--      crypto.randomBytes(32).toString('hex')
--    or use: openssl rand -hex 32
--
-- 2. Compute its SHA-256 hash (in Node.js):
--      const hash = crypto.createHash('sha256').update(key).digest('hex');
--
-- 3. Insert into this table:
--      insert into public.api_keys (key_hash, label)
--      values ('<hash_here>', 'admin');
--
-- 4. Give the raw key (not the hash) to the user.
--    They enter it on the login page.
-- ============================================================


-- ============================================================
--  Quick helper: insert a test key
--  Raw key:  test-key-change-me-in-production
--  SHA-256:  computed below — run in psql or Node.js to verify
-- ============================================================
-- insert into public.api_keys (key_hash, label)
-- values (
--   encode(sha256('test-key-change-me-in-production'::bytea), 'hex'),
--   'test'
-- );