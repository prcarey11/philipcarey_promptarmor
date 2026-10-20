## Decisions

### Status is derived, not stored
**Chose:** computing status from the latest version's most recent review.
**Over:** a status column the app updates.
**Because:** a stored status can drift from reality, which is exactly the
stale-Excel-tracker problem. If there's no column, there's nothing to get wrong.
**Trade-off:** computed on every read; fine at this volume.

### Invariants enforced in the database where possible
**Chose:** triggers and CHECK constraints for immutability, the four-part flag,
latest-version-only reviews, and no approval with outstanding required changes.
**Over:** enforcing these only in app code.
**Because:** these are the rules that must be 100% right. The DB holds them
even if app code has a bug.
**Trade-off:** logic split across SQL and TypeScript.

### Illegal writes raise errors, not silent no-ops
**Chose:** triggers that RAISE EXCEPTION.
**Over:** Postgres rules (DO INSTEAD NOTHING).
**Because:** a silently ignored write hides bugs, and tests can't assert it failed.

### Audit rows written in app transactions, not DB triggers
**Chose:** one helper that wraps each mutation and its audit insert in a single transaction.
**Over:** a trigger that reads the actor from a session variable.
**Because:** session variables are fragile with serverless connection pooling,
and the helper is easier to reason about and test.
**Trade-off:** the DB doesn't guarantee the audit row; tests do.

### Flags belong to the submission, not the version
**Chose:** flags.submission_id as owner, version_id as "raised on."
**Over:** flags scoped to a single version.
**Because:** reviewers lose track of whether round-1 comments were fixed in
round 2. Open flags carry forward until resolved.

### All DB access is server-side; Supabase Data API disabled
**Chose:** a Postgres driver on the server.
**Over:** supabase-js from the browser.
**Because:** with the REST API on, anyone with the public key could insert an
approval directly. The only write path is app code that enforces the rules.

### One hosted database for dev, tests, and demo
**Chose:** a single Supabase project.
**Over:** local Docker plus separate staging and production.
**Because:** 24-hour limit; one environment means fewer deploy surprises.
**Trade-off:** tests share the demo DB, mitigated by per-test rollback.
In a real project I'd separate them.

### Rotated the DB password after it appeared in tool output
A special character broke URL parsing, and part of the password was printed in
the terminal. Rotated to an alphanumeric password instead of working around it,
since the app would hit the same parsing issue on deploy.