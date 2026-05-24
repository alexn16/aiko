-- Migration 018: Web Operator delegation columns
-- Adds source_task_id and requested_by_role to web_operator_actions

ALTER TABLE web_operator_actions
  ADD COLUMN IF NOT EXISTS source_task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_by_role TEXT;

CREATE INDEX IF NOT EXISTS idx_woa_source_task ON web_operator_actions(source_task_id);
CREATE INDEX IF NOT EXISTS idx_woa_requested_by ON web_operator_actions(requested_by_role);
