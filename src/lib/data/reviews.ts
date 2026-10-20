import { withAudit } from "../audit";
import { query } from "../db";

interface Review {
  id: string;
  version_id: string;
  reviewer: string;
  decision: string;
  created_at: Date;
}

export async function createReview(
  actor: string,
  versionId: string,
  decision: "approved" | "changes_requested"
): Promise<Review> {
  // App-level check: reviewer cannot be the submitter
  const subResult = await query<{ submitter: string; submission_id: string }>(
    `SELECT s.submitter, s.id AS submission_id FROM submissions s
     JOIN versions v ON v.submission_id = s.id
     WHERE v.id = $1`,
    [versionId]
  );
  if (subResult.rows.length === 0) {
    throw new Error(`Version not found: ${versionId}`);
  }
  if (subResult.rows[0].submitter === actor) {
    throw new Error("Reviewer cannot be the submitter");
  }

  const submissionId = subResult.rows[0].submission_id;

  return withAudit(
    actor,
    (review) => ({
      submissionId,
      action: "review_created",
      versionId,
      payload: { decision },
    }),
    async (client) => {
      const result = await client.query<Review>(
        `INSERT INTO reviews (version_id, reviewer, decision)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [versionId, actor, decision]
      );
      return result.rows[0];
    }
  );
}
