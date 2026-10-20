import { withAudit } from "../audit";

interface CreateSubmissionInput {
  title: string;
  channel: string;
  product: string;
  content: string;
}

interface Submission {
  id: string;
  title: string;
  channel: string;
  product: string;
  submitter: string;
  created_at: Date;
}

interface Version {
  id: string;
  submission_id: string;
  version_number: number;
  content: string;
  created_at: Date;
}

export async function createSubmission(
  actor: string,
  input: CreateSubmissionInput
): Promise<{ submission: Submission; version: Version }> {
  return withAudit(
    actor,
    (result) => ({
      submissionId: result.submission.id,
      versionId: result.version.id,
      action: "submission_created",
      payload: { title: input.title, channel: input.channel, product: input.product },
    }),
    async (client) => {
      const subResult = await client.query<Submission>(
        `INSERT INTO submissions (title, channel, product, submitter)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [input.title, input.channel, input.product, actor]
      );
      const submission = subResult.rows[0];

      const verResult = await client.query<Version>(
        `INSERT INTO versions (submission_id, version_number, content)
         VALUES ($1, 1, $2)
         RETURNING *`,
        [submission.id, input.content]
      );
      const version = verResult.rows[0];

      return { submission, version };
    }
  );
}
