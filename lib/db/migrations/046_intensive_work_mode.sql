-- 046_intensive_work_mode.sql
-- Bounded local work loop state and queue.

CREATE TABLE IF NOT EXISTS intensive_work_state (
  id TEXT PRIMARY KEY DEFAULT 'default',
  enabled BOOLEAN NOT NULL DEFAULT false,
  level TEXT NOT NULL DEFAULT 'off',
  work_cycle_interval_seconds INTEGER NOT NULL DEFAULT 300,
  max_actions_per_cycle INTEGER NOT NULL DEFAULT 3,
  max_cycles_per_day INTEGER NOT NULL DEFAULT 24,
  cycles_today INTEGER NOT NULL DEFAULT 0,
  last_cycle_at TIMESTAMPTZ,
  last_reset_date DATE,
  paused_reason TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (level IN ('off','planning_only','safe_internal','browser_research','approval_required'))
);

INSERT INTO intensive_work_state (id, enabled, level)
VALUES ('default', false, 'off')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS agent_work_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NULL REFERENCES projects(id) ON DELETE SET NULL,
  task_id UUID NULL,
  assigned_agent_name TEXT NOT NULL DEFAULT 'AÏKO',
  assigned_role TEXT NOT NULL DEFAULT 'ceo',
  work_type TEXT NOT NULL,
  priority INTEGER NOT NULL DEFAULT 50,
  status TEXT NOT NULL DEFAULT 'queued',
  input JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_summary TEXT,
  output_file_id UUID NULL,
  blocked_reason TEXT,
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  requires_user_input BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (status IN ('queued','working','waiting_user','waiting_approval','blocked','done','failed','skipped'))
);

CREATE INDEX IF NOT EXISTS idx_agent_work_queue_status_priority
  ON agent_work_queue(status, priority DESC, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_agent_work_queue_project
  ON agent_work_queue(project_id, created_at DESC);
