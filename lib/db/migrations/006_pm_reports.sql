-- 006_pm_reports.sql
-- Project Manager reports: structured per-project status reports sent upward to CEO

CREATE TABLE IF NOT EXISTS project_manager_reports (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id               UUID REFERENCES projects(id) ON DELETE CASCADE,
  project_manager_id       UUID REFERENCES project_managers(id) ON DELETE SET NULL,
  status                   TEXT NOT NULL DEFAULT 'attention',
  summary                  TEXT NOT NULL DEFAULT '',
  progress                 INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  blockers                 JSONB DEFAULT '[]',
  completed_work           JSONB DEFAULT '[]',
  current_focus            TEXT DEFAULT '',
  recommended_next_actions JSONB DEFAULT '[]',
  needs_client_approval    BOOLEAN DEFAULT FALSE,
  created_at               TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_reports_project ON project_manager_reports (project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pm_reports_pm     ON project_manager_reports (project_manager_id, created_at DESC);
