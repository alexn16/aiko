CREATE TABLE IF NOT EXISTS agent_messages (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id     UUID REFERENCES projects(id) ON DELETE CASCADE,
  from_agent_id  UUID REFERENCES agents(id) ON DELETE SET NULL,
  from_role      TEXT NOT NULL,
  to_agent_id    UUID REFERENCES agents(id) ON DELETE SET NULL,
  to_role        TEXT NOT NULL,
  message_type   TEXT NOT NULL DEFAULT 'update',  -- update|request|handoff|blocker|approval_request|report|instruction|review
  subject        TEXT NOT NULL DEFAULT '',
  content        TEXT NOT NULL,
  status         TEXT NOT NULL DEFAULT 'sent',    -- sent|read|acknowledged|resolved
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_agent_messages_project ON agent_messages(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_to_role ON agent_messages(to_role, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agent_messages_type ON agent_messages(message_type, created_at DESC);
