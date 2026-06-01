-- Migration 032: add operator recommendation fields to project_strategy_briefs
-- These columns are guidance only — no automation is triggered.

ALTER TABLE project_strategy_briefs
  ADD COLUMN IF NOT EXISTS recommended_operator_id   UUID REFERENCES web_operators(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS recommended_operator_name TEXT,
  ADD COLUMN IF NOT EXISTS operator_reason           TEXT;
