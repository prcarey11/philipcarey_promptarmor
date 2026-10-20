-- 002_pre_check_status.sql
-- Track whether the LLM pre-check completed, failed, or was skipped.
-- Modifies the version immutability trigger to allow updating ONLY this column.

ALTER TABLE versions
  ADD COLUMN pre_check_status text NOT NULL DEFAULT 'pending'
  CHECK (pre_check_status IN ('pending', 'completed', 'failed', 'skipped'));

-- Replace the immutability trigger: allow pre_check_status updates, block everything else.
CREATE OR REPLACE FUNCTION reject_version_mutation() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'versions are immutable: DELETE not allowed';
  END IF;

  -- Allow updating ONLY pre_check_status
  IF TG_OP = 'UPDATE' THEN
    IF OLD.id IS DISTINCT FROM NEW.id
      OR OLD.submission_id IS DISTINCT FROM NEW.submission_id
      OR OLD.version_number IS DISTINCT FROM NEW.version_number
      OR OLD.content IS DISTINCT FROM NEW.content
      OR OLD.created_at IS DISTINCT FROM NEW.created_at
    THEN
      RAISE EXCEPTION 'versions are immutable: only pre_check_status can be updated';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
