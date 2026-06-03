-- 038_auth_profiles.sql
-- Treat provider_connections as OpenClaw-style auth profiles without creating
-- a second table. Existing rows keep working while the UI/API can use the
-- clearer auth profile vocabulary.

ALTER TABLE provider_connections
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS auth_method TEXT,
  ADD COLUMN IF NOT EXISTS oauth_access_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS oauth_refresh_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS local_token_reference TEXT;

-- Back-fill profile display/auth metadata from legacy fields.
UPDATE provider_connections
SET display_name = COALESCE(display_name, name),
    auth_method = COALESCE(auth_method, auth_type,
      CASE
        WHEN type = 'ollama' THEN 'local'
        WHEN type IN ('chatgpt_direct','claude_direct') THEN 'oauth'
        WHEN api_key_encrypted IS NOT NULL AND api_key_encrypted <> '' THEN 'api_key'
        ELSE 'none'
      END),
    oauth_access_token_encrypted = COALESCE(oauth_access_token_encrypted, oauth_access_token),
    oauth_refresh_token_encrypted = COALESCE(oauth_refresh_token_encrypted, oauth_refresh_token)
WHERE display_name IS NULL
   OR auth_method IS NULL
   OR (oauth_access_token_encrypted IS NULL AND oauth_access_token IS NOT NULL)
   OR (oauth_refresh_token_encrypted IS NULL AND oauth_refresh_token IS NOT NULL);

-- Normalize legacy disconnected/unavailable names to the auth-profile statuses
-- while preserving connected/error/needs_reauth rows.
UPDATE provider_connections
SET status = CASE status
  WHEN 'disconnected' THEN 'not_connected'
  WHEN 'unavailable' THEN 'not_configured'
  ELSE status
END
WHERE status IN ('disconnected', 'unavailable');
