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

### Separate databases for dev/test and production
**Chose:** two Supabase projects. DATABASE_URL (local) points at the dev/test
DB; Vercel has its own DATABASE_URL pointing at prod.
**Over:** a single shared database.
**Because:** tests and local dev were polluting the demo queue with leftover
data. Separate DBs mean localhost is safe to experiment with and prod stays
clean. `scripts/reset-db.ts --target=prod` is the only way to touch prod.

### Raw pg, no ORM or query builder
**Chose:** raw SQL via the `pg` library.
**Over:** Prisma, Drizzle, or Knex.
**Because:** the schema is small, the queries are straightforward, and an ORM
adds a build step and abstraction layer that obscures what's actually happening.
Raw SQL matches the "boring, explicit" principle.
**Trade-off:** no migration tooling or type generation from schema — we type by hand.

### One `withAudit` helper wraps every write
**Chose:** a single function that runs mutation + audit INSERT in one transaction.
**Over:** ad-hoc transactions in each data function.
**Because:** if every write goes through one function, it's impossible to forget
the audit row. The helper is the only code that calls BEGIN/COMMIT.

### tsx for running TypeScript tests
**Chose:** `tsx --test` with Node's built-in test runner.
**Over:** Jest, Vitest, or `--experimental-strip-types`.
**Because:** Node's test runner needs no config. `tsx` handles imports without
requiring `.ts` extensions everywhere. One dev dependency, zero config files.

### Layered defense against prompt injection in ad text
**Chose:** four independent layers: (1) XML tag sanitization strips `<ad_content>`
from ad text before wrapping; (2) system prompt declares delimited content is
data, never instructions; (3) a deterministic rule flags instruction-like
patterns (source='rule') so they survive even if the LLM is steered; (4) forced
tool use (`tool_choice`) eliminates free-text response paths.
**Over:** relying on the system prompt alone to resist injection.
**Because:** any single layer can fail. The rule-based injection detector is the
backstop — it runs independently of the LLM, so a suppressed LLM flag still
shows up for the reviewer.

### LLM judgment categories are a fixed enum, not free text
**Chose:** the rule field on LLM flags is constrained to a closed set of
judgment categories (e.g. "UDAAP – net impression", "Prompt injection attempt").
**Over:** letting the LLM write arbitrary regulation citations.
**Because:** the LLM hallucinated § numbers when given free text. Only rule-based
checks cite regulation sections, because they're deterministic and testable.

### Pre-check status tracked per version, not inferred
**Chose:** a `pre_check_status` column on `versions` (pending/completed/failed/skipped).
**Over:** returning [] and hoping the reviewer notices.
**Because:** a silent failure (API error → empty flags) looks exactly like "AI
found nothing." The UI shows "AI pre-check unavailable — rule checks only" when
status is failed, so the reviewer knows the AI didn't run.
**Trade-off:** the immutability trigger on versions now allows updating this one
column. Content immutability is preserved; only the pre-check status can change.

### Approval blocked by open or accepted flags
**Chose:** DB trigger rejects approval if any flag is in state 'open' or 'accepted'.
**Over:** only checking accepted flags (the original design).
**Because:** open flags haven't been reviewed yet. Approving with unreviewed
flags means the reviewer skipped them — the same gap the tool is meant to close.

### Rule checks are product-aware with accurate citations
**Chose:** trigger-term rules cite §1026.24(d) for loans, §1026.16(b) for
credit cards. Stated-rate rule cites §1026.24(c). Mortgage "fixed" rule cites
§1026.24(i)(1). NMLS check is mortgage-only.
**Over:** generic citations and one-size-fits-all rules.
**Because:** a reviewer who sees "Reg Z" without a section number can't verify
the rule. Accurate citations let the reviewer confirm the flag is real.
**Trade-off:** more code paths to maintain per product type.

### Injection detection normalizes Unicode before matching
**Chose:** NFKC-normalize and strip zero-width characters before regex matching.
**Over:** matching raw text only.
**Because:** attackers can obfuscate "ignore" as full-width Unicode or insert
zero-width characters between letters. Normalization defeats both.

### Server actions check role before mutations
**Chose:** each server action verifies the role cookie before executing.
**Over:** relying only on UI hiding buttons from the wrong role.
**Because:** the UI hides are cosmetic. A crafted request can call any server
action directly. The role check is the real gate.

### Light theme only
**Chose:** force `color-scheme: light` and remove all dark-mode styles.
**Over:** supporting both themes.
**Because:** the dark theme was broken (black background, invisible header,
unreadable dropdowns) and fixing it is out of scope.

### Rotated the DB password after it appeared in tool output
A special character broke URL parsing, and part of the password was printed in
the terminal. Rotated to an alphanumeric password instead of working around it,
since the app would hit the same parsing issue on deploy.