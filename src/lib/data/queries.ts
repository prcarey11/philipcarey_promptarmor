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

export interface VersionRow {
  id: string;
  submission_id: string;
  version_number: number;
  content: string;
  pre_check_status: string;
  created_at: Date;
}

export interface FlagRow {
  id: string;
  submission_id: string;
  version_id: string;
  source: string;
  state: string;
  location: string;
  problem: string;
  rule: string;
  fix: string;
  dismiss_reason: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface AuditEventRow {
  id: string;
  submission_id: string;
  version_id: string | null;
  actor: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: Date;
}

export interface SubmissionDetail extends SubmissionRow {
  versions: VersionRow[];
  flags: FlagRow[];
}

export async function listSubmissions(): Promise<SubmissionRow[]> {
  const result = await query<SubmissionRow>(
    `SELECT * FROM submission_queue ORDER BY created_at DESC`
  );
  return result.rows;
}

export async function getSubmission(id: string): Promise<SubmissionDetail | null> {
  const subResult = await query<SubmissionRow>(
    `SELECT s.*, submission_status(s.id) AS status FROM submissions s WHERE s.id = $1`,
    [id]
  );
  if (subResult.rows.length === 0) return null;
  const submission = subResult.rows[0];

  const versionsResult = await query<VersionRow>(
    `SELECT * FROM versions WHERE submission_id = $1 ORDER BY version_number DESC`,
    [id]
  );

  const flagsResult = await query<FlagRow>(
    `SELECT * FROM flags WHERE submission_id = $1 ORDER BY created_at`,
    [id]
  );

  return {
    ...submission,
    versions: versionsResult.rows,
    flags: flagsResult.rows,
  };
}

export async function getSubmissionVersions(submissionId: string): Promise<VersionRow[]> {
  const result = await query<VersionRow>(
    `SELECT * FROM versions WHERE submission_id = $1 ORDER BY version_number`,
    [submissionId]
  );
  return result.rows;
}

export async function getAuditLog(submissionId: string): Promise<AuditEventRow[]> {
  const result = await query<AuditEventRow>(
    `SELECT * FROM audit_events WHERE submission_id = $1 ORDER BY created_at`,
    [submissionId]
  );
  return result.rows;
}
