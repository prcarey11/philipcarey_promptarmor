# CLAUDE.md

Take-home project, 24-hour limit. Read README.md first: it holds the product, users, and key decisions. Build only the core loop described there. Anything listed under "What I'd build next" is out of scope until the core loop works on the deployed URL. 

Domain background is in docs/RESEARCH.md; the original brief is docs/PROJECT_SPEC.md.

## Stack (do not change without asking)
- Next.js (App Router) + TypeScript
- Postgres (Supabase)
- Deployed on Vercel
- Claude API for the pre-check, using structured output only
- No real auth. A role switcher (Reviewer / Submitter) is stored in a cookie.
- DB access is server-side only via a Postgres driver (pg) using DATABASE_URL. Never use supabase-js; the Data API is disabled.

## Domain model (starting point)
- **submissions**: one ad asset (title, channel, product, submitter, current status)
- **versions**: immutable content snapshots, numbered 1..n per submission
- **flags**: location, problem, rule, fix, plus source (rule | llm | human), state (open | accepted | dismissed | resolved), dismiss_reason, version_id
- **reviews**: decision (approved | changes_requested), reviewer, version_id
- **audit_events**: actor, action, submission_id, version_id, timestamp, payload

## Invariants (never break these; each one gets a test)
1. A version's content is never updated after insert. Edits create a new version.
2. An approval references exactly one version_id. A new version is unapproved until it is reviewed.
3. Status is derived from reviews and versions, never set directly by the UI.
4. audit_events is insert-only. No update or delete paths exist anywhere.
5. The LLM never changes status or approves anything. It only creates flags with source = llm.
6. Rule-based checks run independently of the LLM. LLM output can never remove or override their flags.
7. Ad text is untrusted. It is passed to the LLM as clearly delimited data, never placed in instructions, and the response is validated against a schema. Invalid responses are discarded and logged.
8. Every flag has all four parts: location, problem, rule, fix.

## Working rules
- Use plan mode for each slice. Keep slices small and commit after each one.
- Prefer boring, explicit code. Don't add libraries without asking.
- Rule checks are plain TypeScript functions in `lib/rules/`, each with unit tests.
- When finishing a slice, list: what changed, which invariants it touches, and how they're tested.
- Seed data covers clean ads, ads with violations, and one prompt-injection ad.
- Run `npm run build` before every push. The production build type-checks the
  entire project; tests alone don't catch build failures.
- At the end of each slice, append proposed entries to DECISIONS.md in this
  format, then stop so I can edit them:
  ## <Decision>
  **Chose:** X. **Over:** Y. **Because:** one sentence. **Trade-off:** one sentence.