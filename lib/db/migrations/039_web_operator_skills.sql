-- 039_web_operator_skills.sql
-- Skill profiles define how Web Operators may work on external websites.
-- They do not add native platform APIs; all external work still goes through
-- browser actions, operating mode checks, approvals, and execution trails.

CREATE TABLE IF NOT EXISTS web_operator_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  website_pattern TEXT,
  description TEXT NOT NULL DEFAULT '',
  allowed_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  approval_required_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  forbidden_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
  login_policy TEXT NOT NULL DEFAULT 'manual_login_only',
  output_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE web_operator_actions
  ADD COLUMN IF NOT EXISTS skill_id TEXT,
  ADD COLUMN IF NOT EXISTS skill_name TEXT,
  ADD COLUMN IF NOT EXISTS skill_decision JSONB;

CREATE INDEX IF NOT EXISTS idx_web_operator_skills_skill_id ON web_operator_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_woa_skill_id ON web_operator_actions(skill_id);

INSERT INTO web_operator_skills
  (skill_id, name, website_pattern, description, allowed_actions, approval_required_actions, forbidden_actions, login_policy, output_types, status)
VALUES
  ('general_web_research', 'General web research', '*', 'Manual, human-like public web research through browser actions.', '["search","open_url","read_page","collect_public_info","summarize"]', '["submit_form","create_account"]', '["bypass_paywall","solve_captcha","scrape_private_data"]', 'manual_login_if_needed_no_bypass', '["research_brief","lead_list","note"]', 'active'),
  ('gmail_workflow', 'Gmail workflow', 'mail.google.com|gmail.com', 'Browser-only Gmail workflow. User login/takeover is expected; sends require approval.', '["open_gmail","create_draft","create_email_draft","search_mail","search_gmail","check_reply","check_gmail_reply"]', '["send_email","send_gmail_draft"]', '["delete_email","forward_without_approval","open_attachments_unless_approved"]', 'manual_login_only_no_password_storage', '["outreach_draft","reply_check","approval_item"]', 'active'),
  ('canva_design', 'Canva design', 'canva.com', 'Canva browser workflow for safe design drafts. Publishing/sharing/downloading final assets require approval.', '["open_canva","open_url","create_design_draft","edit_text","upload_user_approved_assets","export_design"]', '["publish_design","share_design","download_final_asset"]', '["use_unlicensed_assets_without_review","publish_without_approval"]', 'manual_login_only_no_bypass', '["design_draft","approval_item","generated_file"]', 'active'),
  ('facebook_research', 'Facebook research', 'facebook.com', 'Public Facebook research via browser. Messaging, comments, group joins, and posts require approval.', '["search_pages","search_groups","read_public_posts","collect_public_leads","search","open_url"]', '["send_message","post_comment","join_group","create_post","post"]', '["mass_messaging","scraping_private_profiles","bypass_login"]', 'manual_login_only_no_bypass', '["research_brief","lead_list","approval_item"]', 'active'),
  ('linkedin_research', 'LinkedIn research', 'linkedin.com', 'Public LinkedIn company/profile research via browser. Outreach and posts require approval.', '["search_companies","read_public_profiles","collect_company_info","search","open_url"]', '["send_connection_request","send_message","post"]', '["mass_automation","scraping_private_data"]', 'manual_login_only_no_bypass', '["research_brief","lead_list","approval_item"]', 'active'),
  ('instagram_research', 'Instagram research', 'instagram.com', 'Public Instagram research via browser with manual login as needed.', '["search_profiles","read_public_posts","collect_public_info","search","open_url"]', '["send_message","post_comment","follow_account","create_post"]', '["mass_messaging","scraping_private_profiles","bypass_login"]', 'manual_login_only_no_bypass', '["research_brief","lead_list","approval_item"]', 'active'),
  ('website_reader', 'Website reader', '*', 'Read a specific website page and summarize public content.', '["open_url","read_page","summarize","collect_public_info"]', '["submit_form"]', '["bypass_paywall","solve_captcha","scrape_private_data"]', 'manual_login_if_needed_no_bypass', '["research_brief","note"]', 'active')
ON CONFLICT (skill_id) DO UPDATE SET
  name = EXCLUDED.name,
  website_pattern = EXCLUDED.website_pattern,
  description = EXCLUDED.description,
  allowed_actions = EXCLUDED.allowed_actions,
  approval_required_actions = EXCLUDED.approval_required_actions,
  forbidden_actions = EXCLUDED.forbidden_actions,
  login_policy = EXCLUDED.login_policy,
  output_types = EXCLUDED.output_types,
  status = EXCLUDED.status,
  updated_at = NOW();
