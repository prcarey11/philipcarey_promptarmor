import Link from "next/link";
import { listSubmissions } from "@/lib/data/queries";

export const instant = false;

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
      className={`inline-block text-xs font-medium px-2 py-0.5 rounded ${styles[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default async function QueuePage() {
  const submissions = await listSubmissions();

  return (
    <div>
      <h1 className="text-xl font-semibold mb-4">Review Queue</h1>
      {submissions.length === 0 ? (
        <p className="text-gray-500">
          No submissions yet.{" "}
          <Link href="/submissions/new" className="text-blue-600 hover:underline">
            Create one
          </Link>
          .
        </p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50 text-left text-gray-500">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Product</th>
                <th className="px-4 py-3 font-medium">Channel</th>
                <th className="px-4 py-3 font-medium">Submitter</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Age</th>
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s.id} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/submissions/${s.id}`}
                      className="text-blue-600 hover:underline font-medium"
                    >
                      {s.title}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{s.product}</td>
                  <td className="px-4 py-3 text-gray-600">{s.channel}</td>
                  <td className="px-4 py-3 text-gray-600">{s.submitter}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 text-gray-500">{timeAgo(s.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
