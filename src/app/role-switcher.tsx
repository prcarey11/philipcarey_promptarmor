"use client";

import { useTransition } from "react";
import { switchRole } from "./actions";

const ROLE_NAMES: Record<string, string> = {
  reviewer: "Alex Chen (Compliance)",
  submitter: "Dana Kim (Marketing)",
};

const ROLE_LABELS: Record<string, string> = {
  reviewer: "Reviewer",
  submitter: "Submitter",
};

export function RoleSwitcher({ currentRole }: { currentRole: string }) {
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value;
    const formData = new FormData();
    formData.set("role", role);
    formData.set("name", ROLE_NAMES[role] ?? role);
    startTransition(async () => {
      await switchRole(formData);
      window.location.reload();
    });
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${currentRole === "reviewer" ? "bg-blue-500" : "bg-green-500"}`} />
        <span className="text-sm text-gray-600">
          {ROLE_NAMES[currentRole]} — {ROLE_LABELS[currentRole]}
        </span>
      </div>
      <select
        value={currentRole}
        onChange={handleChange}
        disabled={isPending}
        className="text-sm border border-gray-300 rounded px-2 py-1.5 bg-white"
      >
        <option value="reviewer">Reviewer</option>
        <option value="submitter">Submitter</option>
      </select>
    </div>
  );
}
