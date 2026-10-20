import { describe, it, after, before } from "node:test";
import assert from "node:assert/strict";

// Safety: tests must use TEST_DATABASE_URL, and it must differ from DATABASE_URL
if (!process.env.TEST_DATABASE_URL) {
  console.error("TEST_DATABASE_URL is not set. Aborting.");
  process.exit(1);
}
if (process.env.TEST_DATABASE_URL === process.env.DATABASE_URL) {
  console.error("TEST_DATABASE_URL must differ from DATABASE_URL. Aborting.");
  process.exit(1);
}
process.env.NODE_ENV = "test";

import { pool, query } from "../db";
import { createSubmission } from "../data/submissions";
import { createVersion, updatePreCheckStatus } from "../data/versions";
import { createFlags, updateFlagState } from "../data/flags";
import { createReview } from "../data/reviews";
import { listSubmissions, getSubmission } from "../data/queries";

// Track all submission IDs created during tests so we can clean up.
const createdSubmissionIds: string[] = [];

async function cleanup(submissionId: string) {
  // Disable immutability triggers to allow test cleanup
  await query("ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_delete");
  await query("ALTER TABLE versions DISABLE TRIGGER versions_no_delete");
  // Delete in FK order
  await query("DELETE FROM audit_events WHERE submission_id = $1", [submissionId]);
  await query("DELETE FROM reviews WHERE version_id IN (SELECT id FROM versions WHERE submission_id = $1)", [submissionId]);
  await query("DELETE FROM flags WHERE submission_id = $1", [submissionId]);
  await query("DELETE FROM versions WHERE submission_id = $1", [submissionId]);
  await query("DELETE FROM submissions WHERE id = $1", [submissionId]);
  // Re-enable triggers
  await query("ALTER TABLE versions ENABLE TRIGGER versions_no_delete");
  await query("ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_delete");
}

after(async () => {
  for (const id of createdSubmissionIds) {
    await cleanup(id);
  }
  await pool.end();
});

async function makeSubmission(actor = "alice") {
  const { submission, version } = await createSubmission(actor, {
    title: "Test Ad",
    channel: "email",
    product: "Personal Loan",
    content: "Get a great rate today!",
  });
  createdSubmissionIds.push(submission.id);
  return { submission, version };
}

describe("createSubmission", () => {
  it("creates submission + version 1 + audit_event", async () => {
    const { submission, version } = await makeSubmission();

    assert.equal(submission.title, "Test Ad");
    assert.equal(submission.submitter, "alice");
    assert.equal(version.version_number, 1);
    assert.equal(version.submission_id, submission.id);

    const audit = await query(
      "SELECT * FROM audit_events WHERE submission_id = $1 AND action = 'submission_created'",
      [submission.id]
    );
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].actor, "alice");
  });
});

describe("createVersion", () => {
  it("increments version_number + audit_event", async () => {
    const { submission } = await makeSubmission();

    const v2 = await createVersion("alice", submission.id, "Updated copy");
    assert.equal(v2.version_number, 2);
    assert.equal(v2.submission_id, submission.id);

    const audit = await query(
      "SELECT * FROM audit_events WHERE submission_id = $1 AND action = 'version_created'",
      [submission.id]
    );
    assert.equal(audit.rows.length, 1);
  });
});

describe("createFlags", () => {
  it("inserts flags with all four parts + audit_event", async () => {
    const { submission, version } = await makeSubmission();

    const flags = await createFlags("bob", submission.id, version.id, [
      {
        source: "rule",
        location: "headline",
        problem: "missing APR disclosure",
        rule: "Reg Z §1026.24(d)",
        fix: "Add APR near the rate",
      },
    ]);
    assert.equal(flags.length, 1);
    assert.equal(flags[0].location, "headline");
    assert.equal(flags[0].state, "open");

    const audit = await query(
      "SELECT * FROM audit_events WHERE submission_id = $1 AND action = 'flags_created'",
      [submission.id]
    );
    assert.equal(audit.rows.length, 1);
  });
});

describe("updateFlagState", () => {
  it("changes state + audit_event", async () => {
    const { submission, version } = await makeSubmission();
    const [flag] = await createFlags("bob", submission.id, version.id, [
      { source: "rule", location: "CTA", problem: "deceptive", rule: "UDAAP", fix: "reword" },
    ]);

    const updated = await updateFlagState("bob", flag.id, "accepted");
    assert.equal(updated.state, "accepted");

    const audit = await query(
      "SELECT * FROM audit_events WHERE submission_id = $1 AND action = 'flag_state_changed'",
      [submission.id]
    );
    assert.equal(audit.rows.length, 1);
  });

  it("rejects dismiss without reason (DB constraint)", async () => {
    const { submission, version } = await makeSubmission();
    const [flag] = await createFlags("bob", submission.id, version.id, [
      { source: "llm", location: "footer", problem: "vague", rule: "UDAAP", fix: "clarify" },
    ]);

    await assert.rejects(
      () => updateFlagState("bob", flag.id, "dismissed"),
      (err: Error) => err.message.includes("violates check constraint") || err.message.includes("check")
    );
  });
});

describe("createReview", () => {
  it("succeeds on latest version + audit_event", async () => {
    const { submission, version } = await makeSubmission();

    const review = await createReview("bob", version.id, "changes_requested");
    assert.equal(review.decision, "changes_requested");
    assert.equal(review.reviewer, "bob");

    const audit = await query(
      "SELECT * FROM audit_events WHERE submission_id = $1 AND action = 'review_created'",
      [submission.id]
    );
    assert.equal(audit.rows.length, 1);
  });

  it("rejects reviewer === submitter (app-level)", async () => {
    const { version } = await makeSubmission("alice");

    await assert.rejects(
      () => createReview("alice", version.id, "approved"),
      (err: Error) => err.message.includes("Reviewer cannot be the submitter")
    );
  });

  it("rejects approval with accepted flags (DB trigger)", async () => {
    const { submission, version } = await makeSubmission();
    const [flag] = await createFlags("bob", submission.id, version.id, [
      { source: "rule", location: "headline", problem: "trigger term", rule: "Reg Z", fix: "add disclosures" },
    ]);
    await updateFlagState("bob", flag.id, "accepted");

    await assert.rejects(
      () => createReview("bob", version.id, "approved"),
      (err: Error) => err.message.includes("unresolved flag")
    );
  });
});

describe("listSubmissions", () => {
  it("returns derived status correctly", async () => {
    const { submission, version } = await makeSubmission();

    // Initially: submitted
    let list = await listSubmissions();
    let entry = list.find((s) => s.id === submission.id)!;
    assert.equal(entry.status, "submitted");

    // After changes_requested
    await createReview("bob", version.id, "changes_requested");
    list = await listSubmissions();
    entry = list.find((s) => s.id === submission.id)!;
    assert.equal(entry.status, "changes_requested");

    // After new version: back to submitted
    const v2 = await createVersion("alice", submission.id, "revised copy");
    list = await listSubmissions();
    entry = list.find((s) => s.id === submission.id)!;
    assert.equal(entry.status, "submitted");

    // After approval of v2
    await createReview("bob", v2.id, "approved");
    list = await listSubmissions();
    entry = list.find((s) => s.id === submission.id)!;
    assert.equal(entry.status, "approved");

    // After new version post-approval: back to submitted
    const v3 = await createVersion("alice", submission.id, "post-approval edit");
    list = await listSubmissions();
    entry = list.find((s) => s.id === submission.id)!;
    assert.equal(entry.status, "submitted");
  });
});

describe("getSubmission", () => {
  it("returns flags across versions (carry-forward)", async () => {
    const { submission, version } = await makeSubmission();
    await createFlags("bob", submission.id, version.id, [
      { source: "rule", location: "headline", problem: "missing APR", rule: "Reg Z", fix: "add APR" },
    ]);

    // Create v2
    await createVersion("alice", submission.id, "v2 copy");

    const result = await getSubmission(submission.id);
    assert.ok(result);
    assert.equal(result.versions.length, 2);
    // Flag raised on v1 is still present via submission_id
    assert.equal(result.flags.length, 1);
    assert.equal(result.flags[0].version_id, version.id);
  });
});

describe("updatePreCheckStatus", () => {
  it("writes an audit event with actor=system", async () => {
    const { submission, version } = await makeSubmission();
    await updatePreCheckStatus(version.id, "completed");

    const audit = await query(
      "SELECT * FROM audit_events WHERE submission_id = $1 AND action = 'pre_check_status_updated'",
      [submission.id]
    );
    assert.equal(audit.rows.length, 1);
    assert.equal(audit.rows[0].actor, "system");
    assert.equal(audit.rows[0].payload.status, "completed");
  });
});
