ALTER TABLE web_operators
  ADD COLUMN IF NOT EXISTS current_goal TEXT,
  ADD COLUMN IF NOT EXISTS current_workflow TEXT,
  ADD COLUMN IF NOT EXISTS last_instruction TEXT,
  ADD COLUMN IF NOT EXISTS memory_summary TEXT,
  ADD COLUMN IF NOT EXISTS requires_user_input BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS waiting_reason TEXT;
