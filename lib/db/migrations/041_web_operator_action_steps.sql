-- 041_web_operator_action_steps.sql
-- Persist transparent Web Operator playbook execution state.
-- These rows are tracking metadata only; they do not grant platform API access
-- or bypass login, CAPTCHA, approval, publishing, posting, or messaging gates.

CREATE TABLE IF NOT EXISTS web_operator_action_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_id UUID NOT NULL REFERENCES web_operator_actions(id) ON DELETE CASCADE,
  operator_id UUID,
  project_id UUID,
  step_index INTEGER NOT NULL,
  step_id TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'planned',
  approval_required BOOLEAN NOT NULL DEFAULT false,
  forbidden BOOLEAN NOT NULL DEFAULT false,
  url TEXT,
  screenshot_url TEXT,
  message TEXT,
  result JSONB NOT NULL DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(action_id, step_index)
);

CREATE INDEX IF NOT EXISTS idx_woas_action_id ON web_operator_action_steps(action_id);
CREATE INDEX IF NOT EXISTS idx_woas_operator_id ON web_operator_action_steps(operator_id);
CREATE INDEX IF NOT EXISTS idx_woas_status ON web_operator_action_steps(status);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'web_operator_action_steps_status_check'
  ) THEN
    ALTER TABLE web_operator_action_steps
      ADD CONSTRAINT web_operator_action_steps_status_check
      CHECK (status IN ('planned','running','waiting_user','waiting_approval','completed','failed','skipped','blocked'));
  END IF;
END $$;
