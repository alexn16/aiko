-- Migration 036: Custom agents
-- Stores agent definitions created by the CEO or user.
-- Custom agents are specs only — they do not execute web actions directly.
-- All external actions must be delegated to the Web Operator.

CREATE TABLE IF NOT EXISTS custom_agents (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT        NOT NULL,
  description     TEXT,
  purpose         TEXT        NOT NULL,
  capabilities    JSONB       NOT NULL DEFAULT '[]',
  constraints     JSONB       NOT NULL DEFAULT '["must_delegate_to_web_operator","inherits_operating_mode","cannot_bypass_approvals","cannot_send_emails_directly","cannot_access_secrets"]',
  status          TEXT        NOT NULL DEFAULT 'draft'  CHECK (status IN ('draft', 'active', 'archived')),
  brain_provider_id UUID      REFERENCES provider_connections(id) ON DELETE SET NULL,
  created_by_role TEXT        NOT NULL DEFAULT 'ceo',
  project_id      UUID        REFERENCES projects(id) ON DELETE SET NULL,
  metadata        JSONB       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_custom_agents_project_id
  ON custom_agents (project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_custom_agents_status
  ON custom_agents (status, created_at DESC);
