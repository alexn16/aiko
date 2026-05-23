-- Provider connections: each row is one configured AI brain
CREATE TABLE IF NOT EXISTS provider_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name             TEXT NOT NULL,
  type             TEXT NOT NULL,           -- openai_api | anthropic_api | ollama | openai_compatible | chatgpt_direct | claude_direct | custom
  status           TEXT NOT NULL DEFAULT 'disconnected', -- connected | disconnected | error | unavailable
  base_url         TEXT,
  model            TEXT,
  api_key_encrypted TEXT,                   -- stored as plain text for now; encrypt at rest in prod
  supports_chat    BOOLEAN DEFAULT true,
  supports_tools   BOOLEAN DEFAULT false,
  supports_streaming BOOLEAN DEFAULT true,
  last_tested_at   TIMESTAMPTZ,
  last_error       TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Role → provider mapping (which provider runs each agent role)
CREATE TABLE IF NOT EXISTS ai_role_assignments (
  role         TEXT PRIMARY KEY,            -- ceo | research | copywriting | review | qa | local_fallback
  provider_id  UUID REFERENCES provider_connections(id) ON DELETE SET NULL,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default role rows so they always exist
INSERT INTO ai_role_assignments (role) VALUES
  ('ceo'), ('research'), ('copywriting'), ('review'), ('qa'), ('local_fallback')
ON CONFLICT (role) DO NOTHING;
