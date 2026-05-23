CREATE TABLE IF NOT EXISTS agent_task_outputs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID REFERENCES agent_tasks(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  agent_role TEXT NOT NULL DEFAULT 'system',
  output_type TEXT NOT NULL DEFAULT 'note',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  structured_data JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  requires_approval BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_outputs_task ON agent_task_outputs(task_id);
CREATE INDEX IF NOT EXISTS idx_task_outputs_project ON agent_task_outputs(project_id);
CREATE INDEX IF NOT EXISTS idx_task_outputs_status ON agent_task_outputs(status);
