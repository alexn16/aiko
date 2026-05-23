CREATE TABLE IF NOT EXISTS agent_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  owner_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  owner_role TEXT NOT NULL,
  assigned_by_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  assigned_by_role TEXT NOT NULL DEFAULT 'system',
  source_message_id UUID REFERENCES agent_messages(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'planned',
  priority TEXT NOT NULL DEFAULT 'normal',
  task_type TEXT NOT NULL DEFAULT 'project_map',
  output JSONB DEFAULT '{}',
  due_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_project ON agent_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_status ON agent_tasks(status);
CREATE INDEX IF NOT EXISTS idx_agent_tasks_owner_role ON agent_tasks(owner_role);
