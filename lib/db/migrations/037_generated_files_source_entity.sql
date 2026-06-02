-- Migration 037: Add source entity tracking to generated_files
-- Links a generated file back to the entity that produced it
-- (e.g. an executive report, a campaign, a custom agent task).

ALTER TABLE generated_files
  ADD COLUMN IF NOT EXISTS source_entity_type TEXT,   -- e.g. 'executive_report'
  ADD COLUMN IF NOT EXISTS source_entity_id   TEXT;   -- UUID of the source entity

CREATE INDEX IF NOT EXISTS idx_generated_files_source_entity
  ON generated_files (source_entity_type, source_entity_id)
  WHERE source_entity_type IS NOT NULL;
