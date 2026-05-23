CREATE TABLE IF NOT EXISTS approval_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  output_id UUID REFERENCES agent_task_outputs(id) ON DELETE SET NULL,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'outreach_draft',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'pending',
  requested_by_role TEXT NOT NULL DEFAULT 'system',
  reviewed_by_user_id TEXT,
  review_note TEXT,
  decision_reason TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_approval_items_project ON approval_items(project_id);
CREATE INDEX IF NOT EXISTS idx_approval_items_status ON approval_items(status);
CREATE INDEX IF NOT EXISTS idx_approval_items_output ON approval_items(output_id);
