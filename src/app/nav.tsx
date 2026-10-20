import Link from "next/link";
import { getRole, getActorName } from "@/lib/role";
import { switchRole } from "./actions";

export async function Nav() {
  const role = await getRole();
  const actorName = await getActorName();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-lg">
            ClearPath
          </Link>
          <Link
            href="/"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            Queue
          </Link>
          <Link
            href="/submissions/new"
            className="text-sm text-gray-600 hover:text-gray-900"
          >
            New Submission
          </Link>
        </div>
        <form action={switchRole} className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{actorName}</span>
          <input type="hidden" name="name" value={actorName} />
          <select
            name="role"
            defaultValue={role}
            className="text-sm border border-gray-300 rounded px-2 py-1"
          >
            <option value="reviewer">Reviewer</option>
            <option value="submitter">Submitter</option>
          </select>
          <button
            type="submit"
            className="text-sm bg-gray-800 text-white px-3 py-1 rounded hover:bg-gray-700"
          >
            Switch
          </button>
        </form>
      </div>
    </nav>
  );
}
