-- 047_blocked_reason_constraint.sql
-- Ensure blocked work items always have a blocked_reason recorded.

-- Backfill any existing rows that are blocked without a reason.
UPDATE agent_work_queue
SET blocked_reason = 'Blocked without recorded reason.'
WHERE status = 'blocked' AND blocked_reason IS NULL;

-- Add constraint so future blocked rows always have a reason.
ALTER TABLE agent_work_queue
  DROP CONSTRAINT IF EXISTS chk_blocked_reason_not_null;

ALTER TABLE agent_work_queue
  ADD CONSTRAINT chk_blocked_reason_not_null
  CHECK (status != 'blocked' OR blocked_reason IS NOT NULL);
