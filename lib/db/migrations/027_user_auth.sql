-- 027_user_auth.sql
-- Users table + per-user provider connections + OAuth token fields

-- ── Users ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email       TEXT NOT NULL UNIQUE,
  name        TEXT,
  google_sub  TEXT UNIQUE,              -- Google OAuth subject identifier
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ── Provider connections: add user scoping and OAuth token storage ────────────

ALTER TABLE provider_connections
  ADD COLUMN IF NOT EXISTS user_id              UUID REFERENCES users(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS oauth_access_token  TEXT,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS token_expires_at    TIMESTAMPTZ;

-- ── AI role assignments: migrate from global-only to per-user ─────────────────
-- The old table had role TEXT PRIMARY KEY (single global assignment per role).
-- We add user_id and replace the PK with a surrogate, keeping backward compat.

-- Step 1: Drop the old single-column primary key
ALTER TABLE ai_role_assignments DROP CONSTRAINT IF EXISTS ai_role_assignments_pkey;

-- Step 2: Add surrogate id and user_id
ALTER TABLE ai_role_assignments
  ADD COLUMN IF NOT EXISTS id      UUID DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE CASCADE;

-- Step 3: Populate id for any existing rows that don't have it yet
UPDATE ai_role_assignments SET id = gen_random_uuid() WHERE id IS NULL;

-- Step 4: Make id the new primary key
ALTER TABLE ai_role_assignments ALTER COLUMN id SET NOT NULL;
ALTER TABLE ai_role_assignments ADD PRIMARY KEY (id);

-- Step 5: Unique constraint — one assignment per role for global (user_id NULL)
--         and one per (user_id, role) for user-scoped rows
CREATE UNIQUE INDEX IF NOT EXISTS ai_role_asgn_global_uniq
  ON ai_role_assignments (role) WHERE user_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ai_role_asgn_user_uniq
  ON ai_role_assignments (user_id, role) WHERE user_id IS NOT NULL;
