-- 040_web_operator_playbooks.sql
-- Playbooks are safe, transparent workflow plans layered on top of Web
-- Operator Skills. They do not add native platform APIs or bypass login,
-- CAPTCHA, approval gates, or browser-only execution trails.

CREATE TABLE IF NOT EXISTS web_operator_playbooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playbook_id TEXT NOT NULL UNIQUE,
  skill_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  trigger_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_gates JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE web_operator_actions
  ADD COLUMN IF NOT EXISTS playbook_id TEXT,
  ADD COLUMN IF NOT EXISTS playbook_name TEXT,
  ADD COLUMN IF NOT EXISTS playbook_plan JSONB;

CREATE INDEX IF NOT EXISTS idx_web_operator_playbooks_playbook_id ON web_operator_playbooks(playbook_id);
CREATE INDEX IF NOT EXISTS idx_web_operator_playbooks_skill_id ON web_operator_playbooks(skill_id);
CREATE INDEX IF NOT EXISTS idx_woa_playbook_id ON web_operator_actions(playbook_id);

INSERT INTO web_operator_playbooks
  (playbook_id, skill_id, name, description, trigger_patterns, steps, approval_gates, forbidden_steps, output_schema, status)
VALUES
  (
    'canva_instagram_draft',
    'canva_design',
    'Canva Instagram Draft',
    'Open Canva directly and prepare only a safe draft design preview. Publishing, sharing, and final downloads remain approval-gated.',
    '["canva","instagram","draft","post","design"]',
    '["open_canva","wait_for_manual_login_if_needed","create_design_draft","add_user_requested_text","capture_preview","save_draft_result"]',
    '["download_final_asset","share_design","publish_design"]',
    '["publish_without_approval","use_unlicensed_assets_without_review"]',
    '{"type":"object","properties":{"draft_url":{"type":"string"},"preview_screenshot":{"type":"string"},"summary":{"type":"string"}}}',
    'active'
  ),
  (
    'facebook_group_research',
    'facebook_research',
    'Facebook Group Research',
    'Open Facebook group search directly, pause for login/security, and summarize visible group results only.',
    '["facebook","group","groups","research"]',
    '["open_facebook_group_search_url","wait_for_manual_login_if_needed","read_visible_group_results","collect_group_names_urls_member_counts_if_visible","summarize_findings"]',
    '["join_group","post","comment","send_message"]',
    '["scrape_private_profiles","mass_message","bypass_login"]',
    '{"type":"object","properties":{"groups":{"type":"array"},"summary":{"type":"string"},"limitations":{"type":"string"}}}',
    'active'
  ),
  (
    'linkedin_company_research',
    'linkedin_research',
    'LinkedIn Company Research',
    'Open LinkedIn company search directly and summarize visible public company information.',
    '["linkedin","company","companies","research"]',
    '["open_linkedin_company_search_url","wait_for_manual_login_if_needed","read_visible_company_results","collect_company_names_urls_descriptions_if_visible","summarize_findings"]',
    '["send_connection_request","send_message","post"]',
    '["mass_automation","scrape_private_data","bypass_login"]',
    '{"type":"object","properties":{"companies":{"type":"array"},"summary":{"type":"string"},"limitations":{"type":"string"}}}',
    'active'
  ),
  (
    'gmail_open_and_check',
    'gmail_workflow',
    'Gmail Open and Check',
    'Open Gmail directly, pause for manual login if needed, and read only visible inbox or reply status requested by the user.',
    '["gmail","open","check","inbox","reply"]',
    '["open_gmail","wait_for_manual_login_if_needed","read_visible_mail_context","summarize_visible_status"]',
    '["send_email","send_gmail_draft","delete_email","forward_email"]',
    '["open_attachments_unless_approved","store_password","bypass_login"]',
    '{"type":"object","properties":{"status":{"type":"string"},"summary":{"type":"string"}}}',
    'active'
  ),
  (
    'gmail_prepare_draft',
    'gmail_workflow',
    'Gmail Prepare Draft',
    'Open Gmail directly, pause for manual login if needed, and prepare a draft without sending it.',
    '["gmail","draft","prepare","write","email","mail"]',
    '["open_gmail","wait_for_manual_login_if_needed","create_email_draft","fill_requested_content","save_draft_result"]',
    '["send_email","send_gmail_draft"]',
    '["send_without_approval","store_password","bypass_login"]',
    '{"type":"object","properties":{"draft_created":{"type":"boolean"},"subject":{"type":"string"},"recipient":{"type":"string"},"summary":{"type":"string"}}}',
    'active'
  ),
  (
    'general_site_research',
    'general_web_research',
    'General Site Research',
    'Open or search public websites with conservative read-only browser steps and summarize visible public content.',
    '["research","open","read","website","site"]',
    '["open_or_search_public_site","wait_for_manual_login_if_needed","read_visible_public_content","summarize_findings"]',
    '["submit_form","create_account"]',
    '["bypass_paywall","solve_captcha","scrape_private_data","post_without_approval"]',
    '{"type":"object","properties":{"summary":{"type":"string"},"sources":{"type":"array"},"limitations":{"type":"string"}}}',
    'active'
  )
ON CONFLICT (playbook_id) DO UPDATE SET
  skill_id = EXCLUDED.skill_id,
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger_patterns = EXCLUDED.trigger_patterns,
  steps = EXCLUDED.steps,
  approval_gates = EXCLUDED.approval_gates,
  forbidden_steps = EXCLUDED.forbidden_steps,
  output_schema = EXCLUDED.output_schema,
  status = EXCLUDED.status,
  updated_at = NOW();
