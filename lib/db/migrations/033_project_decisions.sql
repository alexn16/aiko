-- 033_project_decisions.sql
-- Decision Log: internal memory of important project decisions.
-- Read-only except explicit record calls. Does not trigger any automation.

CREATE TABLE IF NOT EXISTS project_decisions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  decision_type        TEXT NOT NULL,
  title                TEXT NOT NULL,
  summary              TEXT,
  decided_by_role      TEXT,                 -- 'ceo' | 'user' | 'system'
  decided_by_user_id   UUID,
  related_entity_type  TEXT,                 -- 'lead' | 'approval_item' | 'web_operator' | etc.
  related_entity_id    UUID,
  metadata             JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_decisions_project_id
  ON project_decisions (project_id, created_at DESC);

-- Idempotency index: one-per-type decisions (e.g. project_created, strategy_brief_created)
-- enforced in application layer via recordDecisionIfNotExists()
