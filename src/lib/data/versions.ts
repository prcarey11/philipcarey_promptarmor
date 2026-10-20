import { withAudit } from "../audit";

interface Version {
  id: string;
  submission_id: string;
  version_number: number;
  content: string;
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
