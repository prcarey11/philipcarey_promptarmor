import { query } from "../db";

export interface SubmissionRow {
  id: string;
  title: string;
  channel: string;
  product: string;
  submitter: string;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export async function listSubmissions(): Promise<SubmissionRow[]> {
  const result = await query<SubmissionRow>(
    `SELECT * FROM submission_queue ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getSubmission(id: string) {
  const subResult = await query(
    `SELECT s.*, submission_status(s.id) AS status FROM submissions s WHERE s.id = $1`,
    [id]
  );
  if (subResult.rows.length === 0) return null;
  const submission = subResult.rows[0];

  const versionsResult = await query(
    `SELECT * FROM versions WHERE submission_id = $1 ORDER BY version_number DESC`,
    [id]
  );

  const flagsResult = await query(
    `SELECT * FROM flags WHERE submission_id = $1 ORDER BY created_at`,
    [id]
  );

  return {
    ...submission,
    versions: versionsResult.rows,
    flags: flagsResult.rows,
  };
}

export async function getSubmissionVersions(submissionId: string) {
  const result = await query(
    `SELECT * FROM versions WHERE submission_id = $1 ORDER BY version_number`,
    [submissionId]
  );
  return result.rows;
}

export async function getAuditLog(submissionId: string) {
  const result = await query(
    `SELECT * FROM audit_events WHERE submission_id = $1 ORDER BY created_at`,
    [submissionId]
  );
  return result.rows;
}
