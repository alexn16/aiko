-- 001_initial.sql
-- Run with: psql $DATABASE_URL -f migrations/001_initial.sql

-- Model provider configs (one per agent slot)
CREATE TABLE IF NOT EXISTS model_configs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_slot  TEXT NOT NULL UNIQUE,
  base_url    TEXT NOT NULL,
  api_key     TEXT DEFAULT '',
  model       TEXT NOT NULL,
  context_window INTEGER DEFAULT 8192,
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  description     TEXT,
  target_market   TEXT,
  value_prop      TEXT,
  strategy        JSONB,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Agents (one row per agent per project, holds live state)
CREATE TABLE IF NOT EXISTS agents (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  role          TEXT NOT NULL,
  status        TEXT DEFAULT 'idle',
  current_task  TEXT,
  progress      INTEGER DEFAULT 0,
  latest_output TEXT,
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Full activity log (immutable)
CREATE TABLE IF NOT EXISTS agent_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id      UUID REFERENCES agents(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  action        TEXT NOT NULL,
  details       JSONB,
  screenshot_path TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Leads
CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  company_name  TEXT,
  contact_name  TEXT,
  email         TEXT,
  phone         TEXT,
  website       TEXT,
  city          TEXT,
  country       TEXT DEFAULT '',
  lat           NUMERIC(10,7),
  lng           NUMERIC(10,7),
  source        TEXT,
  source_url    TEXT,
  status        TEXT DEFAULT 'new',
  notes         TEXT,
  raw_data      JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Approval queue
CREATE TABLE IF NOT EXISTS approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  lead_id       UUID REFERENCES leads(id) ON DELETE CASCADE,
  agent_name    TEXT,
  channel       TEXT NOT NULL,
  subject       TEXT,
  body          TEXT NOT NULL,
  status        TEXT DEFAULT 'pending',
  sent_at       TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Campaigns
CREATE TABLE IF NOT EXISTS campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  channel       TEXT,
  status        TEXT DEFAULT 'active',
  stats         JSONB DEFAULT '{"sent":0,"opened":0,"replied":0,"qualified":0}',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- General settings (SMTP, etc.)
CREATE TABLE IF NOT EXISTS settings (
  id    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key   TEXT NOT NULL UNIQUE,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
