-- Migration 013: Extend campaigns table and add campaign_items
-- Safe to run multiple times (IF NOT EXISTS / ADD COLUMN IF NOT EXISTS)

ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS objective TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS audience TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS channel TEXT NOT NULL DEFAULT 'mixed';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS owner_role TEXT NOT NULL DEFAULT 'Project Manager';
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS strategy_summary TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS success_metric TEXT;
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Ensure status column exists (it does in existing schema, but guard anyway)
-- status already exists with default 'active'

-- campaign_items
CREATE TABLE IF NOT EXISTS campaign_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  approval_item_id UUID REFERENCES approval_items(id) ON DELETE SET NULL,
  output_id UUID REFERENCES agent_task_outputs(id) ON DELETE SET NULL,
  task_id UUID REFERENCES agent_tasks(id) ON DELETE SET NULL,
  item_type TEXT NOT NULL DEFAULT 'outreach_draft',
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  sequence_order INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_campaign_items_campaign ON campaign_items(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_items_approval ON campaign_items(approval_item_id);
