-- Migration 025: Add lead_id to web_operator_actions for execution trail linking.
--
-- When a Gmail draft or send action is created for a specific lead, this column
-- allows querying "all operator actions taken for lead X" directly without
-- relying on text matching or indirect joins.
--
-- approval_items already has project_id + task_id + output_id.
-- web_operator_actions already has approval_item_id.
-- The trail is: lead → web_operator_actions(lead_id) → approval_items(approval_item_id)

ALTER TABLE web_operator_actions
  ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES leads(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_woa_lead ON web_operator_actions(lead_id);
