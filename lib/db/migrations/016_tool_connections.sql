CREATE TABLE IF NOT EXISTS tool_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_type TEXT NOT NULL,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_configured',
  config JSONB NOT NULL DEFAULT '{}',
  encrypted_secret TEXT,
  last_tested_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tool_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  agent_role TEXT NOT NULL DEFAULT 'system',
  tool_type TEXT NOT NULL,
  action TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  input JSONB NOT NULL DEFAULT '{}',
  output JSONB NOT NULL DEFAULT '{}',
  error TEXT,
  permission_mode TEXT NOT NULL DEFAULT 'read_only',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tool_runs_project ON tool_runs(project_id);
CREATE INDEX IF NOT EXISTS idx_tool_runs_status ON tool_runs(status);
CREATE INDEX IF NOT EXISTS idx_tool_runs_tool_type ON tool_runs(tool_type);
CREATE INDEX IF NOT EXISTS idx_tool_runs_created ON tool_runs(created_at DESC);

-- Seed default tool connection stubs
INSERT INTO tool_connections (tool_type, name, status) VALUES
  ('web_search', 'Web Search', 'not_configured'),
  ('website_reader', 'Website Reader', 'connected'),
  ('email', 'Email', 'not_configured')
ON CONFLICT DO NOTHING;
