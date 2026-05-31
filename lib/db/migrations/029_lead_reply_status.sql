-- Migration 029: add reply-status fields to leads table
-- Populated by Web Operator gmail_check_reply actions (browser-only, no Gmail API).

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS last_checked_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_reply_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reply_summary    TEXT;

-- Index for "leads not checked recently" queries
CREATE INDEX IF NOT EXISTS idx_leads_last_checked ON leads (last_checked_at);
