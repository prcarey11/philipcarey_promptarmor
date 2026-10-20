import Link from "next/link";
import { getRole } from "@/lib/role";
import { RoleSwitcher } from "./role-switcher";

export async function Nav() {
  const role = await getRole();

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href="/" className="font-semibold text-lg">
            ClearPath
          </Link>
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">
            Queue
          </Link>
          <Link href="/submissions/new" className="text-sm text-gray-600 hover:text-gray-900">
            New Submission
          </Link>
        </div>
        <RoleSwitcher currentRole={role} />
      </div>
    </nav>
  );
}
