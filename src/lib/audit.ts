import { getClient } from "./db";
import type { PoolClient } from "pg";

export interface AuditEvent {
  submissionId: string;
  versionId?: string | null;
  action: string;
  payload?: Record<string, unknown>;
}

/**
 * Runs a mutation and its audit event in a single transaction.
 * Every write path in the app goes through this function.
 */
export async function withAudit<T>(
  actor: string,
  buildAuditEvent: (result: T) => AuditEvent,
  mutation: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getClient();
  try {
    await client.query("BEGIN");
    const result = await mutation(client);
    const event = buildAuditEvent(result);
    await client.query(
      `INSERT INTO audit_events (submission_id, version_id, actor, action, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        event.submissionId,
        event.versionId ?? null,
        actor,
        event.action,
        JSON.stringify(event.payload ?? {}),
      ]
    );
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
