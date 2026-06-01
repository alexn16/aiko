-- 034_project_executive_reports.sql
-- Executive Project Reports: AI-generated read-only summaries of project status.
-- Saving a report record is the only mutation. No automation triggered.

CREATE TABLE IF NOT EXISTS project_executive_reports (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title                TEXT NOT NULL,
  summary              TEXT,
  strategy_snapshot    JSONB DEFAULT '{}',
  progress_snapshot    JSONB DEFAULT '{}',
  decisions_snapshot   JSONB DEFAULT '[]',
  risks                JSONB DEFAULT '[]',
  next_steps           JSONB DEFAULT '[]',
  generated_by_role    TEXT DEFAULT 'ceo',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_executive_reports_project_id
  ON project_executive_reports (project_id, created_at DESC);
