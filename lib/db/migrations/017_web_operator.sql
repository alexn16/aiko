CREATE TABLE IF NOT EXISTS web_operator_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT NOT NULL DEFAULT 'idle',
  current_url TEXT,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  agent_role TEXT NOT NULL DEFAULT 'system',
  permission_mode TEXT NOT NULL DEFAULT 'read_only',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS web_operator_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES web_operator_sessions(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  agent_role TEXT NOT NULL DEFAULT 'system',
  action_type TEXT NOT NULL,
  target_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB NOT NULL DEFAULT '{}',
  screenshot_url TEXT,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  approval_item_id UUID REFERENCES approval_items(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_woa_session ON web_operator_actions(session_id);
CREATE INDEX IF NOT EXISTS idx_woa_project ON web_operator_actions(project_id);
CREATE INDEX IF NOT EXISTS idx_woa_status ON web_operator_actions(status);
CREATE INDEX IF NOT EXISTS idx_wos_status ON web_operator_sessions(status);
