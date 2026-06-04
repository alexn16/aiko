-- Migration 042: Strategy Execution Planner
-- Internal planning only. These rows do not trigger Web Operator actions.

CREATE TABLE IF NOT EXISTS project_strategy_execution_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  strategy_brief_id UUID REFERENCES project_strategy_briefs(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES campaigns(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  objective TEXT NOT NULL DEFAULT '',
  recommended_channel TEXT NOT NULL DEFAULT '',
  target_audience TEXT NOT NULL DEFAULT '',
  strategy_summary TEXT NOT NULL DEFAULT '',
  required_agents JSONB NOT NULL DEFAULT '[]',
  required_skills JSONB NOT NULL DEFAULT '[]',
  required_playbooks JSONB NOT NULL DEFAULT '[]',
  required_tools JSONB NOT NULL DEFAULT '[]',
  execution_steps JSONB NOT NULL DEFAULT '[]',
  approval_gates JSONB NOT NULL DEFAULT '[]',
  missing_capabilities JSONB NOT NULL DEFAULT '[]',
  system_improvement_ids JSONB NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'needs_capabilities', 'ready_for_tasks', 'active', 'paused', 'completed', 'archived')
  ),
  created_by_role TEXT NOT NULL DEFAULT 'CEO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_psep_project
  ON project_strategy_execution_plans (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_psep_status
  ON project_strategy_execution_plans (status, created_at DESC);
