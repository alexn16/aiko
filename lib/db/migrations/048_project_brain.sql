-- 048_project_brain.sql
-- Rich owner-editable project context document.
-- Injected into all AI Skill prompts when project_id is set.

CREATE TABLE IF NOT EXISTS project_brain_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL UNIQUE REFERENCES projects(id) ON DELETE CASCADE,
  one_liner TEXT,
  positioning TEXT,
  target_audience TEXT,
  problem TEXT,
  solution TEXT,
  key_features JSONB NOT NULL DEFAULT '[]'::jsonb,
  differentiators JSONB NOT NULL DEFAULT '[]'::jsonb,
  tone_of_voice TEXT,
  proof_points JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_claims JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_goal TEXT,
  preferred_channels JSONB NOT NULL DEFAULT '[]'::jsonb,
  owner_notes TEXT,
  source_summary TEXT,
  completeness_score INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_brain_project_id
  ON project_brain_documents(project_id);
