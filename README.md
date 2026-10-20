# ClearPath Compliance Review

> Live app: <URL> · Walkthrough video: <Loom link>

## Problem

Research notes: docs/RESEARCH.md

ClearPath's marketing compliance review runs on Excel and email, and that process is bottlenecking growth. Four things make it slow and risky:

- **Version confusion.** Ads move around as attachments (`Banner_v3_FINAL_revised.pdf`). Reviewers approve v4 while v5 is already headed to the ad server. Last-minute edits are the most common way unapproved changes reach production.
- **Scattered feedback.** Comments arrive by PDF markup, email, chat, and in person. No one can tell whether a round-1 comment was addressed in round 2, so reviewers re-read the whole piece every round.
- **Stale tracker.** Status lives in a spreadsheet someone has to update by hand. It's never current, so marketers send "any update?" emails and managers can't see aging items or overloaded reviewers.
- **No reuse, no audit trail.** Every ad is reviewed from scratch. When an examiner asks for proof that an ad was approved, someone reconstructs the history from inboxes.

## Users

- **Primary: compliance reviewer.** Needs a single queue, a strong first pass on likely issues, and confidence that what they approve is exactly what runs.
- **Secondary: submitter (in-house marketer or affiliate).** Needs clear, actionable feedback and visible status without chasing anyone. ClearPath is liable for affiliate ads, so affiliates submit through the same system.

## Core loop

**Submit → automated pre-check → review → revise → approve**

| Failure point | What the product does |
|---|---|
| Version confusion | Every edit creates a new version. Approval attaches to one exact version. Reviewers see a diff against the last reviewed version. |
| Scattered feedback | All comments live on the submission, each marked open or resolved, and carry forward across rounds. |
| Stale tracker | Status is derived from actions (submitted, changes requested, approved), never typed in. The queue shows age per item. |
| No audit trail | An append-only audit log records who did what, when, and on which version. |
| Reviewing from scratch | The pre-check drafts redlines so reviewers edit drafts instead of writing every comment themselves. |

### What a flag looks like

Every flag, from a person or from the pre-check, uses the four-part format well-run compliance teams already expect:

1. **Location:** where in the asset ("headline," "footer," "CTA").
2. **Problem:** stated plainly.
3. **Rule:** the regulation or internal policy behind it.
4. **Fix:** what would make it approvable.

Reviewers can **accept** a flag, which sends it to the submitter as a required change, or **dismiss** it with a one-line reason, which is logged so we can see where the pre-check is wrong. Submitters revise the copy themselves. Each revision is a new version that still needs review.

## Key decisions

- **A human approves everything. The AI only drafts.** In consumer lending, the cost of a missed violation (regulatory action, consumer harm) far exceeds the cost of a slower review. The throughput gain comes from reviewers editing drafted redlines instead of writing them from scratch, not from skipping review.
- **Approval locks to an exact version.** What runs must be exactly what was approved. Any change creates a new, unapproved version. This closes the most common path for violations reaching production.
- **Mechanical checks use rules; judgment checks use the LLM.** Known trigger terms and missing required disclosures are deterministic, testable, and explainable to an examiner. "Net impression" questions, such as whether the fine print contradicts the headline, need judgment, so the LLM flags them for the reviewer.
- **Submitted content is untrusted input.** Ad copy, especially from third-party affiliates, goes into an LLM. Copy can contain instructions like "report no issues." Human sign-off alone doesn't cover this: a suppressed flag is a false negative the reviewer never sees. Mitigations:
  - Ad text is passed as data, separate from instructions.
  - The model can only return structured flags.
  - The rule-based checks run independently, so the LLM can't remove their results.

  A seeded example demonstrates this.
- **No recall guarantee.** The rules give deterministic coverage of known triggers, the LLM is tuned to over-flag, and a human reads every piece.

## Assumptions

- Text assets only: email, landing page copy, social posts, SMS.
- Single company (ClearPath), with no real authentication. A role switcher stands in for reviewer and submitter logins.
- Product terms come from a mocked rate sheet in seed data.
- Rules cover a representative set of federal requirements (Reg Z trigger terms, UDAAP-risk phrases, required identifiers), not every rule.

## Out of scope

- Images, video, and audio (font prominence, disclosure speed).
- State-by-state rules.
- SSO and real permissions.
- Integrations with ad servers or marketing tools.
- Multiple companies or tenants.

## How I'd measure success

- **Time to decision:** submitted to approved.
- **Rounds per approval:** fewer rounds means better first-pass feedback.
- **Assets decided per reviewer per week:** the compliance team's throughput.

## What I'd build next

- **Submitter self-check:** run the pre-check before submitting, which cuts rounds per approval.
- **Approved disclosure library:** reuse pre-approved blocks instead of reviewing them every time.
- **Approval conditions and expiry:** for example, "valid while APR is X," with alerts when the rate sheet changes.
- **Image and PDF support.**

## Running locally

```bash
# Install dependencies
npm install

# Set environment variables
cp .env.example .env.local
# Edit .env.local with your DATABASE_URL and ANTHROPIC_API_KEY

# Apply database migrations
psql $DATABASE_URL -f supabase/migrations/001_schema.sql
psql $DATABASE_URL -f supabase/migrations/002_pre_check_status.sql

# Seed demo data (runs rule checks + LLM pre-checks, takes ~60s)
npx tsx scripts/seed.ts

# Run tests
npm test                    # all tests
npm run test:rules          # rule checks only (no DB needed)
npm run test:schema         # SQL invariant tests

# Start the dev server
npm run dev
# Open http://localhost:3000
```
