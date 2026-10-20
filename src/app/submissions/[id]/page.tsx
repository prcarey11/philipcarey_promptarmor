export const instant = false;

import { notFound } from "next/navigation";
import { getSubmission, getAuditLog, type FlagRow, type VersionRow, type AuditEventRow } from "@/lib/data/queries";
import { getRole } from "@/lib/role";
import { acceptFlag, dismissFlag, resolveFlag, submitReview, reviseSubmission } from "@/app/actions";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700",
    submitted: "bg-blue-100 text-blue-700",
    changes_requested: "bg-amber-100 text-amber-700",
    approved: "bg-green-100 text-green-700",
  };
  const labels: Record<string, string> = {
    draft: "Draft",
    submitted: "Submitted",
    changes_requested: "Changes Requested",
    approved: "Approved",
  };
  return (
    <span
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${styles[status] ?? "bg-gray-100"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function SourceBadge({ source }: { source: string }) {
  const styles: Record<string, string> = {
    rule: "bg-purple-100 text-purple-700",
    llm: "bg-indigo-100 text-indigo-700",
    human: "bg-gray-100 text-gray-700",
  };
  return (
    <span className={`inline-block text-xs px-1.5 py-0.5 rounded ${styles[source] ?? "bg-gray-100"}`}>
      {source}
    </span>
  );
}

export default async function SubmissionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const submission = await getSubmission(id);
  if (!submission) notFound();

  const role = await getRole();
  const auditLog = await getAuditLog(id);
  const isReviewer = role === "reviewer";

  const latestVersion: VersionRow = submission.versions[0]; // sorted DESC
  const flags: FlagRow[] = submission.flags;
  const openFlags = flags.filter((f: FlagRow) => f.state === "open");
  const acceptedFlags = flags.filter((f: FlagRow) => f.state === "accepted");
  const resolvedOrDismissed = flags.filter(
    (f: FlagRow) => f.state === "resolved" || f.state === "dismissed"
  );

  const hasAcceptedFlags = acceptedFlags.length > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-xl font-semibold">{submission.title}</h1>
          <StatusBadge status={submission.status} />
        </div>
        <p className="text-sm text-gray-500">
          {submission.product} &middot; {submission.channel} &middot; by {submission.submitter}
          &middot; Version {latestVersion.version_number}
        </p>
      </div>

      {/* Pre-check status banner */}
      {latestVersion.pre_check_status === "failed" && (
        <div className="bg-amber-50 border border-amber-200 rounded px-4 py-3 text-sm text-amber-800">
          AI pre-check unavailable for this version — rule checks only.
        </div>
      )}
      {latestVersion.pre_check_status === "pending" && (
        <div className="bg-blue-50 border border-blue-200 rounded px-4 py-3 text-sm text-blue-800">
          AI pre-check is processing...
        </div>
      )}

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <h2 className="text-sm font-medium text-gray-500 mb-2">
          Version {latestVersion.version_number} Content
        </h2>
        <pre className="text-sm whitespace-pre-wrap font-mono bg-gray-50 rounded p-3">
          {latestVersion.content}
        </pre>
      </div>

      {/* Open Flags */}
      {openFlags.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-gray-700 mb-2">
            Open Flags ({openFlags.length})
          </h2>
          <div className="space-y-2">
            {openFlags.map((flag: FlagRow) => (
              <div key={flag.id} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={flag.source} />
                      <span className="text-xs text-gray-500">{flag.location}</span>
                    </div>
                    <p className="text-sm font-medium">{flag.problem}</p>
                    <p className="text-xs text-gray-500">{flag.rule}</p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Fix:</span> {flag.fix}
                    </p>
                  </div>
                  {isReviewer && (
                    <div className="flex gap-2 shrink-0">
                      <form action={acceptFlag.bind(null, flag.id, submission.id)}>
                        <button
                          type="submit"
                          className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200"
                        >
                          Accept
                        </button>
                      </form>
                      <form action={dismissFlag} className="flex gap-1">
                        <input type="hidden" name="flagId" value={flag.id} />
                        <input type="hidden" name="submissionId" value={submission.id} />
                        <input
                          type="text"
                          name="reason"
                          required
                          placeholder="Dismiss reason"
                          className="text-xs border border-gray-300 rounded px-2 py-1 w-36"
                        />
                        <button
                          type="submit"
                          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200"
                        >
                          Dismiss
                        </button>
                      </form>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Accepted Flags (required changes) */}
      {acceptedFlags.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-amber-700 mb-2">
            Required Changes ({acceptedFlags.length})
          </h2>
          <div className="space-y-2">
            {acceptedFlags.map((flag: FlagRow) => (
              <div key={flag.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <SourceBadge source={flag.source} />
                      <span className="text-xs text-gray-500">{flag.location}</span>
                    </div>
                    <p className="text-sm font-medium">{flag.problem}</p>
                    <p className="text-sm text-gray-700">
                      <span className="font-medium">Fix:</span> {flag.fix}
                    </p>
                  </div>
                  {!isReviewer && (
                    <form action={resolveFlag.bind(null, flag.id, submission.id)}>
                      <button
                        type="submit"
                        className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                      >
                        Mark Resolved
                      </button>
                    </form>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Review Actions (reviewer) */}
      {isReviewer && submission.status !== "approved" && (
        <div className="flex gap-3">
          <form action={submitReview}>
            <input type="hidden" name="versionId" value={latestVersion.id} />
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="decision" value="changes_requested" />
            <button
              type="submit"
              className="bg-amber-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-amber-500"
            >
              Request Changes
            </button>
          </form>
          <form action={submitReview}>
            <input type="hidden" name="versionId" value={latestVersion.id} />
            <input type="hidden" name="submissionId" value={submission.id} />
            <input type="hidden" name="decision" value="approved" />
            <button
              type="submit"
              disabled={hasAcceptedFlags}
              className="bg-green-600 text-white px-4 py-2 rounded text-sm font-medium hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              title={hasAcceptedFlags ? "Resolve all accepted flags before approving" : ""}
            >
              Approve
            </button>
          </form>
        </div>
      )}

      {/* Revision Form (submitter, when changes requested) */}
      {!isReviewer && submission.status === "changes_requested" && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <h2 className="text-sm font-medium text-gray-700 mb-2">Revise Ad Copy</h2>
          <form action={reviseSubmission.bind(null, submission.id)} className="space-y-3">
            <textarea
              name="content"
              required
              rows={8}
              defaultValue={latestVersion.content}
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm font-mono"
            />
            <button
              type="submit"
              className="bg-gray-800 text-white px-4 py-2 rounded text-sm font-medium hover:bg-gray-700"
            >
              Submit Revision
            </button>
          </form>
        </div>
      )}

      {/* Resolved / Dismissed flags */}
      {resolvedOrDismissed.length > 0 && (
        <details className="group">
          <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">
            Resolved / Dismissed ({resolvedOrDismissed.length})
          </summary>
          <div className="mt-2 space-y-2">
            {resolvedOrDismissed.map((flag: FlagRow) => (
              <div key={flag.id} className="bg-gray-50 border border-gray-200 rounded-lg p-3 opacity-70">
                <div className="flex items-center gap-2 mb-1">
                  <SourceBadge source={flag.source} />
                  <span className="text-xs text-gray-500">{flag.location}</span>
                  <span className="text-xs text-gray-400">
                    ({flag.state}{flag.dismiss_reason ? `: ${flag.dismiss_reason}` : ""})
                  </span>
                </div>
                <p className="text-sm text-gray-600">{flag.problem}</p>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* Audit Log */}
      <details className="group">
        <summary className="text-sm font-medium text-gray-500 cursor-pointer hover:text-gray-700">
          Audit Log ({auditLog.length} events)
        </summary>
        <div className="mt-2 bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-gray-50 text-gray-500 text-left">
                <th className="px-3 py-2 font-medium">Time</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Details</th>
              </tr>
            </thead>
            <tbody>
              {auditLog.map((event: AuditEventRow) => (
                <tr key={event.id} className="border-b border-gray-100">
                  <td className="px-3 py-2 text-gray-500">
                    {new Date(event.created_at as unknown as string).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{event.actor}</td>
                  <td className="px-3 py-2 font-mono">{event.action}</td>
                  <td className="px-3 py-2 text-gray-500 font-mono">
                    {JSON.stringify(event.payload).slice(0, 80)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
