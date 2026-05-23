-- Project Manager Chat: per-project conversation history between client and the assigned PM

CREATE TABLE IF NOT EXISTS project_manager_chats (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id           UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  project_manager_id   UUID REFERENCES project_managers(id) ON DELETE SET NULL,
  role                 TEXT NOT NULL CHECK (role IN ('user', 'project_manager', 'system')),
  content              TEXT NOT NULL,
  metadata             JSONB DEFAULT '{}',
  created_at           TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pm_chats_project ON project_manager_chats (project_id, created_at ASC);

-- Add project_manager role to ai_role_assignments if not already present
INSERT INTO ai_role_assignments (role)
VALUES ('project_manager')
ON CONFLICT (role) DO NOTHING;
