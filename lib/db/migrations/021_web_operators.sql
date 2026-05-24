-- Named operators
CREATE TABLE IF NOT EXISTS web_operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL DEFAULT 'Web Operator',
  status TEXT NOT NULL DEFAULT 'idle',
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  browser_profile_key TEXT NOT NULL UNIQUE,
  current_session_id UUID REFERENCES web_operator_sessions(id) ON DELETE SET NULL,
  current_url TEXT,
  current_task TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Extend sessions and actions
ALTER TABLE web_operator_sessions
  ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES web_operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS browser_profile_key TEXT;

ALTER TABLE web_operator_actions
  ADD COLUMN IF NOT EXISTS operator_id UUID REFERENCES web_operators(id) ON DELETE SET NULL;

-- Seed default operator
INSERT INTO web_operators (name, role, status, browser_profile_key)
VALUES ('Default', 'Web Operator', 'idle', 'default')
ON CONFLICT (name) DO NOTHING;

CREATE INDEX IF NOT EXISTS idx_web_operators_status ON web_operators(status);
CREATE INDEX IF NOT EXISTS idx_wos_operator ON web_operator_sessions(operator_id);
CREATE INDEX IF NOT EXISTS idx_woa_operator ON web_operator_actions(operator_id);
