-- Migration 043: richer implementation prompt metadata
-- Metadata is documentation/planning only. It does not approve or execute proposals.

ALTER TABLE system_improvement_proposals
  ADD COLUMN IF NOT EXISTS proposal_metadata JSONB NOT NULL DEFAULT '{}';
