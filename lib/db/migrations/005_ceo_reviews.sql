-- 005_ceo_reviews.sql
-- CEO supervision reviews: structured company-level analysis

CREATE TABLE IF NOT EXISTS ceo_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  summary               TEXT NOT NULL DEFAULT '',
  project_count         INTEGER DEFAULT 0,
  active_project_count  INTEGER DEFAULT 0,
  pending_approval_count INTEGER DEFAULT 0,
  blocked_project_count INTEGER DEFAULT 0,
  priority_project_id   UUID REFERENCES projects(id) ON DELETE SET NULL,
  findings              JSONB DEFAULT '[]',
  recommended_actions   JSONB DEFAULT '[]',
  created_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Track when the last review was run (add to company_memory singleton)
ALTER TABLE company_memory ADD COLUMN IF NOT EXISTS last_review_at TIMESTAMPTZ;
