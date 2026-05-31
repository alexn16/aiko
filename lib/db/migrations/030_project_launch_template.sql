-- Migration 030: project launch templates
-- Created automatically when the CEO creates a new project.
-- Guidance only — does not trigger any automation.

CREATE TABLE IF NOT EXISTS project_launch_templates (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id              UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  status                  TEXT NOT NULL DEFAULT 'draft'
                            CHECK (status IN ('draft','ready','in_progress','completed','archived')),
  target_audience_hint    TEXT,
  campaign_goal           TEXT,
  recommended_operator_id UUID REFERENCES web_operators(id) ON DELETE SET NULL,
  checklist               JSONB NOT NULL DEFAULT '[]',
  created_by_role         TEXT NOT NULL DEFAULT 'CEO',
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One active template per project (draft/ready/in_progress)
CREATE UNIQUE INDEX IF NOT EXISTS idx_plt_project_active
  ON project_launch_templates (project_id)
  WHERE status NOT IN ('completed', 'archived');

CREATE INDEX IF NOT EXISTS idx_plt_project ON project_launch_templates (project_id);
