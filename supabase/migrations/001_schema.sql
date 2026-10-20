-- 001_schema.sql
-- Core schema for ClearPath compliance review.
-- See DECISIONS.md for invariant enforcement rationale.

-- =============================================================================
-- Types
-- =============================================================================

CREATE TYPE channel_type AS ENUM (
  'email', 'landing_page', 'social', 'sms'
);

CREATE TYPE flag_source AS ENUM ('rule', 'llm', 'human');

CREATE TYPE flag_state AS ENUM ('open', 'accepted', 'dismissed', 'resolved');

CREATE TYPE review_decision AS ENUM ('approved', 'changes_requested');

-- =============================================================================
-- Tables
-- =============================================================================

CREATE TABLE submissions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text         NOT NULL,
  channel       channel_type NOT NULL,
  product       text         NOT NULL,
  submitter     text         NOT NULL,
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now()
);

CREATE TABLE versions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid        NOT NULL REFERENCES submissions(id),
  version_number  integer     NOT NULL,
  content         text        NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),

  UNIQUE (submission_id, version_number)
);

CREATE TABLE flags (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid        NOT NULL REFERENCES submissions(id),
  version_id      uuid        NOT NULL REFERENCES versions(id),
  source          flag_source NOT NULL,
  state           flag_state  NOT NULL DEFAULT 'open',
  location        text        NOT NULL CHECK (location <> ''),
  problem         text        NOT NULL CHECK (problem <> ''),
  rule            text        NOT NULL CHECK (rule <> ''),
  fix             text        NOT NULL CHECK (fix <> ''),
  dismiss_reason  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CHECK (state <> 'dismissed' OR (dismiss_reason IS NOT NULL AND dismiss_reason <> ''))
);

CREATE TABLE reviews (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  version_id  uuid            NOT NULL REFERENCES versions(id),
  reviewer    text            NOT NULL,
  decision    review_decision NOT NULL,
  created_at  timestamptz     NOT NULL DEFAULT now()
);

CREATE TABLE audit_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id   uuid        NOT NULL REFERENCES submissions(id),
  version_id      uuid        REFERENCES versions(id),
  actor           text        NOT NULL,
  action          text        NOT NULL,
  payload         jsonb       NOT NULL DEFAULT '{}',
  created_at      timestamptz NOT NULL DEFAULT now()
);

-- =============================================================================
-- Triggers: version immutability
-- =============================================================================

CREATE OR REPLACE FUNCTION reject_version_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'versions are immutable: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER versions_no_update
  BEFORE UPDATE ON versions FOR EACH ROW
  EXECUTE FUNCTION reject_version_mutation();

CREATE TRIGGER versions_no_delete
  BEFORE DELETE ON versions FOR EACH ROW
  EXECUTE FUNCTION reject_version_mutation();

-- =============================================================================
-- Triggers: audit_events insert-only
-- =============================================================================

CREATE OR REPLACE FUNCTION reject_audit_event_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is insert-only: % not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_events_no_update
  BEFORE UPDATE ON audit_events FOR EACH ROW
  EXECUTE FUNCTION reject_audit_event_mutation();

CREATE TRIGGER audit_events_no_delete
  BEFORE DELETE ON audit_events FOR EACH ROW
  EXECUTE FUNCTION reject_audit_event_mutation();

-- =============================================================================
-- Triggers: review constraints
-- =============================================================================

CREATE OR REPLACE FUNCTION enforce_review_constraints() RETURNS trigger AS $$
DECLARE
  v_submission_id uuid;
  v_max_number integer;
  v_this_number integer;
  v_accepted_count integer;
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
    SELECT count(*) INTO v_accepted_count
    FROM flags f
    WHERE f.submission_id = v_submission_id AND f.state = 'accepted';

    IF v_accepted_count > 0 THEN
      RAISE EXCEPTION 'cannot approve: % accepted flag(s) not yet resolved', v_accepted_count;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER reviews_enforce_constraints
  BEFORE INSERT ON reviews FOR EACH ROW
  EXECUTE FUNCTION enforce_review_constraints();

-- =============================================================================
-- Derived status function
-- =============================================================================

CREATE OR REPLACE FUNCTION submission_status(p_submission_id uuid)
RETURNS text AS $$
DECLARE
  v_latest_version_id uuid;
  v_latest_decision review_decision;
BEGIN
  SELECT id INTO v_latest_version_id
  FROM versions
  WHERE submission_id = p_submission_id
  ORDER BY version_number DESC
  LIMIT 1;

  IF v_latest_version_id IS NULL THEN
    RETURN 'draft';
  END IF;

  SELECT decision INTO v_latest_decision
  FROM reviews
  WHERE version_id = v_latest_version_id
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_latest_decision IS NULL THEN
    RETURN 'submitted';
  END IF;

  RETURN v_latest_decision::text;
END;
$$ LANGUAGE plpgsql STABLE;

-- =============================================================================
-- Queue view
-- =============================================================================

CREATE VIEW submission_queue AS
SELECT s.*, submission_status(s.id) AS status
FROM submissions s;
