-- Extend provider_connections with catalog metadata
ALTER TABLE provider_connections
  ADD COLUMN IF NOT EXISTS provider_catalog_id TEXT,
  ADD COLUMN IF NOT EXISTS compatibility        TEXT,
  ADD COLUMN IF NOT EXISTS auth_type            TEXT,
  ADD COLUMN IF NOT EXISTS account_email        TEXT,
  ADD COLUMN IF NOT EXISTS subscription_label   TEXT,
  ADD COLUMN IF NOT EXISTS capabilities         JSONB;

-- Back-fill compatibility from type for existing rows
UPDATE provider_connections SET compatibility = CASE
  WHEN type IN ('openai_api','ollama','openai_compatible','custom','chatgpt_direct') THEN 'openai_compatible'
  WHEN type IN ('anthropic_api','anthropic_compatible','claude_direct') THEN 'anthropic_messages'
  ELSE NULL
END WHERE compatibility IS NULL;
