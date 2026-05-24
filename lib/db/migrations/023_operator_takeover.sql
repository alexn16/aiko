ALTER TABLE web_operators
  ADD COLUMN IF NOT EXISTS pending_action_type TEXT,
  ADD COLUMN IF NOT EXISTS pending_action_payload JSONB,
  ADD COLUMN IF NOT EXISTS pending_action_created_at TIMESTAMPTZ;

-- 'waiting_user' status already supported as a string — no enum change needed
-- New status values used: waiting_user, user_controlling, ready_to_resume (stored as TEXT)
