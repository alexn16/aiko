-- 002_fixes.sql
-- Fix hardcoded country default and add performance indices

ALTER TABLE leads ALTER COLUMN country SET DEFAULT '';

-- Indices for the most common query patterns
CREATE INDEX IF NOT EXISTS idx_agents_project_id       ON agents(project_id);
CREATE INDEX IF NOT EXISTS idx_agent_logs_project_id   ON agent_logs(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_project_id        ON leads(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_leads_project_lat       ON leads(project_id) WHERE lat IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_approvals_project_id    ON approvals(project_id, status);
CREATE INDEX IF NOT EXISTS idx_approvals_lead_id       ON approvals(lead_id);
