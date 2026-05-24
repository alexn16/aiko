-- 024_leads_extension.sql
-- Extend leads table with fields needed for Web Operator lead extraction

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT,
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS score INT,
  ADD COLUMN IF NOT EXISTS source_text TEXT,
  ADD COLUMN IF NOT EXISTS source_action_id UUID REFERENCES web_operator_actions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS source_output_id UUID REFERENCES agent_task_outputs(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS created_by_role TEXT NOT NULL DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Migrate old 'new' status to 'discovered'
UPDATE leads SET status = 'discovered' WHERE status = 'new';

CREATE INDEX IF NOT EXISTS idx_leads_project ON leads(project_id);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads(status);
CREATE INDEX IF NOT EXISTS idx_leads_source_action ON leads(source_action_id);
