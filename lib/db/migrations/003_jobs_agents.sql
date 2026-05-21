-- 003_jobs_agents.sql
-- Dynamic agent hiring + job evaluation flow

-- Custom prompt and creator tracking on agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS system_prompt TEXT;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS created_by TEXT DEFAULT 'system';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS hired_at TIMESTAMPTZ DEFAULT NOW();

-- Jobs table: evaluation → approval → execution
CREATE TABLE IF NOT EXISTS jobs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  instruction   TEXT NOT NULL,
  status        TEXT DEFAULT 'evaluating',
  -- evaluating | awaiting_approval | running | complete | cancelled
  evaluation    JSONB,
  -- { complexity, agents_needed, estimated_tokens, cost_range, plan, new_agents_proposed }
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_jobs_project_id ON jobs(project_id, created_at DESC);
