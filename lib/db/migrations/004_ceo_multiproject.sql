-- 004_ceo_multiproject.sql
-- CEO multi-project command system: company memory, project memory, PMs, command log

-- Add CEO-level fields to projects
ALTER TABLE projects ADD COLUMN IF NOT EXISTS goal TEXT;
ALTER TABLE projects ADD COLUMN IF NOT EXISTS assigned_pm_id UUID;

-- Company-level singleton memory (one row, always upserted)
CREATE TABLE IF NOT EXISTS company_memory (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary          TEXT DEFAULT '',
  global_priorities JSONB DEFAULT '[]',
  active_projects  JSONB DEFAULT '[]',
  blocked_items    JSONB DEFAULT '[]',
  last_updated_by  TEXT DEFAULT 'ceo',
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- Seed singleton row if not exists
INSERT INTO company_memory (summary) VALUES ('No company memory yet.')
  ON CONFLICT DO NOTHING;

-- Per-project memory (enriches strategy with CEO notes)
CREATE TABLE IF NOT EXISTS project_memory (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  notes       TEXT DEFAULT '',
  next_steps  JSONB DEFAULT '[]',
  blockers    JSONB DEFAULT '[]',
  context     JSONB DEFAULT '{}',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Per-project map (nodes = stages with leads/agents)
CREATE TABLE IF NOT EXISTS project_map (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
  nodes       JSONB DEFAULT '[]',
  edges       JSONB DEFAULT '[]',
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Project managers (human-named PM personas)
CREATE TABLE IF NOT EXISTS project_managers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL UNIQUE,
  specialty     TEXT DEFAULT '',
  status        TEXT DEFAULT 'available',
  project_id    UUID REFERENCES projects(id) ON DELETE SET NULL,
  current_focus TEXT DEFAULT '',
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- Seed the three PMs
INSERT INTO project_managers (name, specialty, status) VALUES
  ('Kenji',  'Growth & Outbound',        'available'),
  ('Mara',   'Brand & Content Strategy', 'available'),
  ('Sven',   'Data & Automation',        'available')
ON CONFLICT (name) DO NOTHING;

-- CEO command log (immutable history)
CREATE TABLE IF NOT EXISTS ceo_commands (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  command     TEXT NOT NULL,
  response    TEXT NOT NULL,
  intent      TEXT DEFAULT 'general',
  actions     JSONB DEFAULT '[]',
  project_id  UUID REFERENCES projects(id) ON DELETE SET NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
