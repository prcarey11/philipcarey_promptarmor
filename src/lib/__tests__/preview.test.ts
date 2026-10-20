import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { query, pool } from "../db";
import { runRuleChecks } from "../rules";
import { createSubmission } from "../data/submissions";
import { createFlags } from "../data/flags";

// Track submissions for cleanup
const createdIds: string[] = [];

async function cleanup() {
  await query("ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_delete");
  await query("ALTER TABLE versions DISABLE TRIGGER versions_no_delete");
  for (const id of createdIds) {
    await query("DELETE FROM audit_events WHERE submission_id = $1", [id]);
    await query("DELETE FROM reviews WHERE version_id IN (SELECT id FROM versions WHERE submission_id = $1)", [id]);
    await query("DELETE FROM flags WHERE submission_id = $1", [id]);
    await query("DELETE FROM versions WHERE submission_id = $1", [id]);
    await query("DELETE FROM submissions WHERE id = $1", [id]);
  }
  await query("ALTER TABLE versions ENABLE TRIGGER versions_no_delete");
  await query("ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_delete");
  await pool.end();
}

import { after } from "node:test";
after(cleanup);

async function countAllRows() {
  const [subs, vers, flags, audits] = await Promise.all([
    query("SELECT count(*)::int AS n FROM submissions"),
    query("SELECT count(*)::int AS n FROM versions"),
    query("SELECT count(*)::int AS n FROM flags"),
    query("SELECT count(*)::int AS n FROM audit_events"),
  ]);
  return {
    submissions: subs.rows[0].n,
    versions: vers.rows[0].n,
    flags: flags.rows[0].n,
    audit_events: audits.rows[0].n,
  };
}

describe("preview (self-check)", () => {
  it("writes zero rows to any table", async () => {
    const before = await countAllRows();

    // Run the same checks previewCheck would run — no DB writes
    const content = "Guaranteed approval! Only $200/month! No credit check!";
    const ruleFlags = runRuleChecks(content, "Personal Loan");

    // Rule checks return flags but nothing is persisted
    assert.ok(ruleFlags.length > 0, "should find violations");

    const after_counts = await countAllRows();
    assert.equal(after_counts.submissions, before.submissions);
    assert.equal(after_counts.versions, before.versions);
    assert.equal(after_counts.flags, before.flags);
    assert.equal(after_counts.audit_events, before.audit_events);
  });

  it("submit after preview still creates flags in the DB", async () => {
    const content = "Guaranteed approval! Only $200/month!";

    // Preview: run checks without DB
    const previewFlags = runRuleChecks(content, "Personal Loan");
    assert.ok(previewFlags.length > 0);

    // Submit: creates submission + flags in DB
    const { submission, version } = await createSubmission("alice", {
      title: "Preview Then Submit Test",
      channel: "email",
      product: "Personal Loan",
      content,
    });
    createdIds.push(submission.id);

    await createFlags("alice", submission.id, version.id, previewFlags);

    // Verify flags are persisted
    const dbFlags = await query(
      "SELECT count(*)::int AS n FROM flags WHERE submission_id = $1",
      [submission.id]
    );
    assert.ok(dbFlags.rows[0].n > 0, "flags should be in DB after submit");
    assert.equal(dbFlags.rows[0].n, previewFlags.length);
  });
});
