-- 044_ai_skills.sql
-- Internal AI skills produce text/files only. They do not browse, post, send,
-- publish, or create Web Operator actions.

CREATE TABLE IF NOT EXISTS ai_skills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'content',
  description TEXT NOT NULL DEFAULT '',
  input_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  output_schema JSONB NOT NULL DEFAULT '{}'::jsonb,
  safety_level TEXT NOT NULL DEFAULT 'internal_draft_only',
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_skills_skill_id ON ai_skills(skill_id);
CREATE INDEX IF NOT EXISTS idx_ai_skills_category ON ai_skills(category);

INSERT INTO ai_skills
  (skill_id, name, category, description, input_schema, output_schema, safety_level, enabled)
VALUES
  ('write_linkedin_post', 'Write LinkedIn Post', 'content', 'Draft a professional LinkedIn post for a project, product, or campaign.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('write_x_post', 'Write X/Twitter Post', 'content', 'Draft a short X/Twitter post or thread.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('write_reddit_post', 'Write Reddit Post', 'content', 'Draft a Reddit-style post that is useful and non-spammy.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('write_email', 'Write Email', 'content', 'Draft an email without sending it.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('improve_email', 'Improve Email', 'content', 'Improve pasted email copy for clarity, tone, and conversion.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('write_blog_outline', 'Write Blog Outline', 'content', 'Create a blog article outline from a strategy or brief.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('write_landing_page_copy', 'Write Landing Page Copy', 'content', 'Draft landing page hero, value proposition, or section copy.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('create_content_ideas', 'Create Content Ideas', 'content', 'Generate concise campaign or social content ideas.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('summarize_text', 'Summarize Text', 'content', 'Summarize pasted or provided text.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true),
  ('rewrite_text', 'Rewrite Text', 'content', 'Rewrite text for clarity, tone, brevity, or style.', '{"type":"object","required":["prompt"],"properties":{"prompt":{"type":"string"},"project_id":{"type":"string"}}}', '{"type":"object","properties":{"title":{"type":"string"},"content":{"type":"string"},"format":{"type":"string"}}}', 'internal_draft_only', true)
ON CONFLICT (skill_id) DO UPDATE SET
  name = EXCLUDED.name,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  input_schema = EXCLUDED.input_schema,
  output_schema = EXCLUDED.output_schema,
  safety_level = EXCLUDED.safety_level,
  enabled = EXCLUDED.enabled,
  updated_at = NOW();
