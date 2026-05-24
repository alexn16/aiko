CREATE TABLE IF NOT EXISTS campaign_launch_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'not_ready',
  readiness_score INT NOT NULL DEFAULT 0,
  checks JSONB NOT NULL DEFAULT '[]',
  blockers JSONB NOT NULL DEFAULT '[]',
  warnings JSONB NOT NULL DEFAULT '[]',
  recommended_actions JSONB NOT NULL DEFAULT '[]',
  summary TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_launch_checks_campaign ON campaign_launch_checks(campaign_id);
CREATE INDEX IF NOT EXISTS idx_launch_checks_status ON campaign_launch_checks(status);
