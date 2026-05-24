CREATE TABLE IF NOT EXISTS system_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'available',
  category TEXT NOT NULL DEFAULT 'product_system',
  required_for JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_improvement_proposals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  reason TEXT NOT NULL DEFAULT '',
  requested_by_role TEXT NOT NULL DEFAULT 'CEO',
  related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  related_strategy TEXT,
  missing_capabilities JSONB NOT NULL DEFAULT '[]',
  proposed_changes JSONB NOT NULL DEFAULT '[]',
  risk_level TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'draft',
  implementation_prompt TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_sip_status ON system_improvement_proposals(status);

-- Seed known capabilities
INSERT INTO system_capabilities (key, name, description, status, category, required_for) VALUES
('ceo_chat',            'CEO Chat',               'Conversational interface for company direction', 'available', 'product_system', '["strategy","coordination"]'),
('pm_chat',             'PM Chat',                'Project Manager conversational interface', 'available', 'product_system', '["project_management"]'),
('web_research',        'Web Research',           'Web search via Tavily/Brave/SerpAPI', 'partial', 'research', '["lead_discovery","market_research"]'),
('website_reader',      'Website Reader',         'Read and extract content from public URLs', 'available', 'research', '["lead_discovery","company_profiling"]'),
('web_operator',        'Web Operator',           'Browser automation via Playwright', 'available', 'browser', '["email_drafting","form_filling","web_automation"]'),
('lead_capture',        'Lead Capture',           'Create and store lead records', 'available', 'leads', '["outbound_campaigns"]'),
('lead_enrichment',     'Lead Enrichment',        'Enrich leads with contact/company data', 'available', 'leads', '["outbound_campaigns"]'),
('internal_comms',      'Internal Communications','Agent-to-agent messaging layer', 'available', 'automation', '["coordination","reporting"]'),
('task_tracking',       'Task Tracking',          'Agent task lifecycle management', 'available', 'automation', '["coordination","reporting"]'),
('task_outputs',        'Task Outputs',           'AI-generated deliverables from tasks', 'available', 'automation', '["reporting","deliverables"]'),
('approval_center',     'Approval Center',        'Client approval workflow for external-facing items', 'available', 'approvals', '["outreach","campaigns"]'),
('campaign_builder',    'Campaign Builder',       'Assemble approved items into campaigns', 'available', 'outreach', '["campaigns"]'),
('campaign_readiness',  'Campaign Launch Readiness','Pre-launch safety checklist', 'available', 'outreach', '["campaigns"]'),
('operating_modes',     'Operating Modes',        'Read Only / Auto-Approval / Full Access safety system', 'available', 'product_system', '["safety","automation"]'),
('email_sending',       'Email Sending',          'Send outreach emails via SMTP/SendGrid/Gmail', 'missing', 'email', '["outbound_campaigns","outreach"]'),
('reply_tracking',      'Reply Tracking',         'Monitor and classify email replies', 'missing', 'email', '["outbound_campaigns","sales_qualification"]'),
('linkedin_operator',   'LinkedIn Operator',      'Operate LinkedIn via Web Operator', 'partial', 'browser', '["linkedin_outreach","social_selling"]'),
('crm_sync',            'CRM Sync',               'Sync leads and contacts to external CRM', 'missing', 'integrations', '["crm_management"]'),
('calendar_booking',    'Calendar Booking',       'Book meetings and manage calendar', 'missing', 'integrations', '["sales_meetings"]'),
('reporting_engine',    'Reporting Engine',       'Generate structured performance reports', 'available', 'reporting', '["reporting","analytics"]'),
('ceo_reviews',         'CEO Reviews',            'Automated company-wide review generation', 'available', 'reporting', '["strategy","oversight"]'),
('pm_reports',          'PM Reports',             'Project Manager progress reports', 'available', 'reporting', '["project_management"]')
ON CONFLICT (key) DO NOTHING;
