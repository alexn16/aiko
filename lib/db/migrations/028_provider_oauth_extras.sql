-- 028_provider_oauth_extras.sql
-- Adds account_email to provider_connections and a unique index
-- that allows one OAuth connection per (user, catalog provider).

ALTER TABLE provider_connections
  ADD COLUMN IF NOT EXISTS account_email TEXT;

-- One OAuth provider per user (e.g., one ChatGPT connection, one Claude connection).
-- Also guards API-key providers: one user can only have one connection per catalog entry.
CREATE UNIQUE INDEX IF NOT EXISTS provider_conn_user_catalog_uniq
  ON provider_connections (user_id, provider_catalog_id)
  WHERE user_id IS NOT NULL AND provider_catalog_id IS NOT NULL;
