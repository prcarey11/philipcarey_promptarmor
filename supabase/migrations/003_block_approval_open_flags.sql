-- 003_block_approval_open_flags.sql
-- Approval is blocked if any flag is 'open' OR 'accepted' (not just accepted).

CREATE OR REPLACE FUNCTION enforce_review_constraints() RETURNS trigger AS $$
DECLARE
  v_submission_id uuid;
  v_max_number integer;
  v_this_number integer;
  v_unresolved_count integer;
BEGIN
  SELECT v.submission_id, v.version_number
    INTO v_submission_id, v_this_number
    FROM versions v WHERE v.id = NEW.version_id;

  SELECT MAX(v2.version_number)
    INTO v_max_number
    FROM versions v2 WHERE v2.submission_id = v_submission_id;

  IF v_this_number <> v_max_number THEN
    RAISE EXCEPTION 'reviews can only target the latest version (got %, latest is %)',
      v_this_number, v_max_number;
  END IF;

  IF NEW.decision = 'approved' THEN
    SELECT count(*) INTO v_unresolved_count
    FROM flags f
    WHERE f.submission_id = v_submission_id AND f.state IN ('open', 'accepted');

    IF v_unresolved_count > 0 THEN
      RAISE EXCEPTION 'cannot approve: % unresolved flag(s) (open or accepted)', v_unresolved_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
