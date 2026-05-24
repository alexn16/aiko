-- Operating mode settings (one row per company/global)
CREATE TABLE IF NOT EXISTS operating_mode (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mode TEXT NOT NULL DEFAULT 'read_only',
  enabled_at TIMESTAMPTZ,
  enabled_by TEXT,
  paused BOOLEAN NOT NULL DEFAULT false,
  paused_at TIMESTAMPTZ,
  paused_reason TEXT,
  daily_send_limit INT NOT NULL DEFAULT 50,
  sends_today INT NOT NULL DEFAULT 0,
  last_reset_date DATE,
  confirmation_token TEXT,
  notes TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default row
INSERT INTO operating_mode (mode, paused) VALUES ('read_only', false)
ON CONFLICT DO NOTHING;

-- Mode action audit log
CREATE TABLE IF NOT EXISTS mode_action_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  mode TEXT NOT NULL,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  agent_role TEXT,
  allowed BOOLEAN NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_mode_action_log_created ON mode_action_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mode_action_log_allowed ON mode_action_log(allowed);
