import { withAudit } from "../audit";

interface FlagInput {
  location: string;
  problem: string;
  rule: string;
  fix: string;
  source: "rule" | "llm" | "human";
}

interface Flag {
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

export async function createFlags(
  actor: string,
  submissionId: string,
  versionId: string,
  flags: FlagInput[]
): Promise<Flag[]> {
  if (flags.length === 0) return [];

  return withAudit(
    actor,
    () => ({
      submissionId,
      versionId,
      action: "flags_created",
      payload: { count: flags.length, sources: [...new Set(flags.map((f) => f.source))] },
    }),
    async (client) => {
      const results: Flag[] = [];
      for (const flag of flags) {
        const result = await client.query<Flag>(
          `INSERT INTO flags (submission_id, version_id, source, location, problem, rule, fix)
           VALUES ($1, $2, $3, $4, $5, $6, $7)
           RETURNING *`,
          [submissionId, versionId, flag.source, flag.location, flag.problem, flag.rule, flag.fix]
        );
        results.push(result.rows[0]);
      }
      return results;
    }
  );
}

export async function updateFlagState(
  actor: string,
  flagId: string,
  newState: "accepted" | "dismissed" | "resolved",
  dismissReason?: string
): Promise<Flag> {
  return withAudit(
    actor,
    (flag) => ({
      submissionId: flag.submission_id,
      versionId: flag.version_id,
      action: "flag_state_changed",
      payload: { flag_id: flagId, new_state: newState, dismiss_reason: dismissReason ?? null },
    }),
    async (client) => {
      const result = await client.query<Flag>(
        `UPDATE flags SET state = $2, dismiss_reason = $3, updated_at = now()
         WHERE id = $1
         RETURNING *`,
        [flagId, newState, dismissReason ?? null]
      );
      if (result.rows.length === 0) {
        throw new Error(`Flag not found: ${flagId}`);
      }
      return result.rows[0];
    }
  );
}
