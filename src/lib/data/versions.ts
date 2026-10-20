import { withAudit } from "../audit";
import { query } from "../db";

interface Version {
  id: string;
  submission_id: string;
  version_number: number;
  content: string;
  pre_check_status: string;
  created_at: Date;
}

export async function createVersion(
  actor: string,
  submissionId: string,
  content: string
): Promise<Version> {
  return withAudit(
    actor,
    (version) => ({
      submissionId,
      versionId: version.id,
      action: "version_created",
      payload: { version_number: version.version_number },
    }),
    async (client) => {
      const result = await client.query<Version>(
        `INSERT INTO versions (submission_id, version_number, content)
         VALUES ($1, (SELECT COALESCE(MAX(version_number), 0) + 1 FROM versions WHERE submission_id = $1), $2)
         RETURNING *`,
        [submissionId, content]
      );
      return result.rows[0];
    }
  );
}

export type PreCheckStatus = "pending" | "completed" | "failed" | "skipped";

export async function updatePreCheckStatus(
  versionId: string,
  status: PreCheckStatus
): Promise<void> {
  await query(
    "UPDATE versions SET pre_check_status = $2 WHERE id = $1",
    [versionId, status]
  );
}
