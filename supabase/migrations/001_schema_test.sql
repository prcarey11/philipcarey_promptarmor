-- 001_schema_test.sql
-- Each test runs in a transaction that rolls back, leaving no data behind.
-- A successful test prints PASS; a failed test prints FAIL with details.

-- Helper: create a submission + version and return their IDs via temp table.
-- We recreate this scaffolding inside each test transaction.

-- =============================================================================
-- Test 1: Version immutability — UPDATE rejected
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver_id uuid;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'original content')
    RETURNING id INTO v_ver_id;
  BEGIN
    UPDATE versions SET content = 'changed' WHERE id = v_ver_id;
    RAISE NOTICE 'FAIL test_1_version_update: no exception raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS test_1_version_update';
  END;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 2: Version immutability — DELETE rejected
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver_id uuid;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'original content')
    RETURNING id INTO v_ver_id;
  BEGIN
    DELETE FROM versions WHERE id = v_ver_id;
    RAISE NOTICE 'FAIL test_2_version_delete: no exception raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS test_2_version_delete';
  END;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 3: Audit immutability — UPDATE rejected
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_evt_id uuid;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO audit_events (submission_id, actor, action)
    VALUES (v_sub_id, 'alice', 'submission_created')
    RETURNING id INTO v_evt_id;
  BEGIN
    UPDATE audit_events SET action = 'tampered' WHERE id = v_evt_id;
    RAISE NOTICE 'FAIL test_3_audit_update: no exception raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS test_3_audit_update';
  END;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 4: Audit immutability — DELETE rejected
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_evt_id uuid;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO audit_events (submission_id, actor, action)
    VALUES (v_sub_id, 'alice', 'submission_created')
    RETURNING id INTO v_evt_id;
  BEGIN
    DELETE FROM audit_events WHERE id = v_evt_id;
    RAISE NOTICE 'FAIL test_4_audit_delete: no exception raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS test_4_audit_delete';
  END;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 5: Flag completeness — empty location rejected
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver_id uuid;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'ad copy')
    RETURNING id INTO v_ver_id;
  BEGIN
    INSERT INTO flags (submission_id, version_id, source, location, problem, rule, fix)
      VALUES (v_sub_id, v_ver_id, 'rule', '', 'missing APR', 'Reg Z', 'add APR');
    RAISE NOTICE 'FAIL test_5_flag_empty_location: no exception raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS test_5_flag_empty_location';
  END;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 6: Dismissed flag requires non-empty dismiss_reason
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver_id uuid;
  v_flag_id uuid;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'ad copy')
    RETURNING id INTO v_ver_id;
  INSERT INTO flags (submission_id, version_id, source, location, problem, rule, fix)
    VALUES (v_sub_id, v_ver_id, 'rule', 'headline', 'missing APR', 'Reg Z', 'add APR')
    RETURNING id INTO v_flag_id;
  BEGIN
    UPDATE flags SET state = 'dismissed', dismiss_reason = NULL WHERE id = v_flag_id;
    RAISE NOTICE 'FAIL test_6_dismiss_no_reason: no exception raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS test_6_dismiss_no_reason';
  END;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 7: Review on non-latest version rejected
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver1_id uuid;
  v_ver2_id uuid;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'v1 copy')
    RETURNING id INTO v_ver1_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 2, 'v2 copy')
    RETURNING id INTO v_ver2_id;
  BEGIN
    INSERT INTO reviews (version_id, reviewer, decision)
      VALUES (v_ver1_id, 'bob', 'approved');
    RAISE NOTICE 'FAIL test_7_review_old_version: no exception raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS test_7_review_old_version';
  END;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 8: Derived status — submitted (version exists, no review)
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_status text;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'v1 copy');
  v_status := submission_status(v_sub_id);
  IF v_status = 'submitted' THEN
    RAISE NOTICE 'PASS test_8_status_submitted';
  ELSE
    RAISE NOTICE 'FAIL test_8_status_submitted: expected submitted, got %', v_status;
  END IF;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 9: Derived status — changes_requested
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver_id uuid;
  v_status text;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'v1 copy')
    RETURNING id INTO v_ver_id;
  INSERT INTO reviews (version_id, reviewer, decision)
    VALUES (v_ver_id, 'bob', 'changes_requested');
  v_status := submission_status(v_sub_id);
  IF v_status = 'changes_requested' THEN
    RAISE NOTICE 'PASS test_9_status_changes_requested';
  ELSE
    RAISE NOTICE 'FAIL test_9_status_changes_requested: expected changes_requested, got %', v_status;
  END IF;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 10: Derived status — resubmitted (new version after changes_requested)
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver1_id uuid;
  v_status text;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'v1 copy')
    RETURNING id INTO v_ver1_id;
  INSERT INTO reviews (version_id, reviewer, decision)
    VALUES (v_ver1_id, 'bob', 'changes_requested');
  -- Submitter creates v2
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 2, 'v2 copy');
  v_status := submission_status(v_sub_id);
  IF v_status = 'submitted' THEN
    RAISE NOTICE 'PASS test_10_status_resubmitted';
  ELSE
    RAISE NOTICE 'FAIL test_10_status_resubmitted: expected submitted, got %', v_status;
  END IF;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 11: Derived status — approved
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver_id uuid;
  v_status text;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'v1 copy')
    RETURNING id INTO v_ver_id;
  INSERT INTO reviews (version_id, reviewer, decision)
    VALUES (v_ver_id, 'bob', 'approved');
  v_status := submission_status(v_sub_id);
  IF v_status = 'approved' THEN
    RAISE NOTICE 'PASS test_11_status_approved';
  ELSE
    RAISE NOTICE 'FAIL test_11_status_approved: expected approved, got %', v_status;
  END IF;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 12: Derived status — new version after approval resets to submitted
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver1_id uuid;
  v_status text;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'v1 copy')
    RETURNING id INTO v_ver1_id;
  INSERT INTO reviews (version_id, reviewer, decision)
    VALUES (v_ver1_id, 'bob', 'approved');
  -- New version after approval
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 2, 'v2 copy');
  v_status := submission_status(v_sub_id);
  IF v_status = 'submitted' THEN
    RAISE NOTICE 'PASS test_12_status_new_version_after_approval';
  ELSE
    RAISE NOTICE 'FAIL test_12_status_new_version_after_approval: expected submitted, got %', v_status;
  END IF;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 13: Flag carry-forward — flag on v1 queryable via submission_id on v2
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver1_id uuid;
  v_flag_count integer;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'v1 copy')
    RETURNING id INTO v_ver1_id;
  INSERT INTO flags (submission_id, version_id, source, location, problem, rule, fix)
    VALUES (v_sub_id, v_ver1_id, 'rule', 'headline', 'missing APR', 'Reg Z', 'add APR');
  -- Create v2
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 2, 'v2 copy');
  -- Query open flags by submission_id (how UI would show them on v2)
  SELECT count(*) INTO v_flag_count
    FROM flags WHERE submission_id = v_sub_id AND state = 'open';
  IF v_flag_count = 1 THEN
    RAISE NOTICE 'PASS test_13_flag_carry_forward';
  ELSE
    RAISE NOTICE 'FAIL test_13_flag_carry_forward: expected 1 open flag, got %', v_flag_count;
  END IF;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 14: Approval blocked while accepted flags exist
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_ver_id uuid;
  v_flag_id uuid;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  INSERT INTO versions (submission_id, version_number, content)
    VALUES (v_sub_id, 1, 'v1 copy')
    RETURNING id INTO v_ver_id;
  INSERT INTO flags (submission_id, version_id, source, location, problem, rule, fix)
    VALUES (v_sub_id, v_ver_id, 'rule', 'headline', 'missing APR', 'Reg Z', 'add APR')
    RETURNING id INTO v_flag_id;
  -- Reviewer accepts the flag (required change)
  UPDATE flags SET state = 'accepted' WHERE id = v_flag_id;
  -- Try to approve — should fail
  BEGIN
    INSERT INTO reviews (version_id, reviewer, decision)
      VALUES (v_ver_id, 'bob', 'approved');
    RAISE NOTICE 'FAIL test_14_approve_blocked_accepted_flags: no exception raised';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'PASS test_14a_approve_blocked_by_accepted_flag';
  END;
  -- Now resolve the flag and approve — should succeed
  UPDATE flags SET state = 'resolved' WHERE id = v_flag_id;
  BEGIN
    INSERT INTO reviews (version_id, reviewer, decision)
      VALUES (v_ver_id, 'bob', 'approved');
    RAISE NOTICE 'PASS test_14b_approve_after_flag_resolved';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FAIL test_14b_approve_after_flag_resolved: %', SQLERRM;
  END;
END $$;
ROLLBACK;

-- =============================================================================
-- Test 15: Derived status — draft (no versions)
-- =============================================================================
BEGIN;
DO $$
DECLARE
  v_sub_id uuid;
  v_status text;
BEGIN
  INSERT INTO submissions (title, channel, product, submitter)
    VALUES ('Test Ad', 'email', 'Personal Loan', 'alice')
    RETURNING id INTO v_sub_id;
  v_status := submission_status(v_sub_id);
  IF v_status = 'draft' THEN
    RAISE NOTICE 'PASS test_15_status_draft';
  ELSE
    RAISE NOTICE 'FAIL test_15_status_draft: expected draft, got %', v_status;
  END IF;
END $$;
ROLLBACK;
