"use client";

import { useState } from "react";
import { acceptFlag, dismissFlag } from "@/app/actions";

export function FlagActions({ flagId, submissionId }: { flagId: string; submissionId: string }) {
  const [showDismiss, setShowDismiss] = useState(false);

  if (showDismiss) {
    return (
      <form action={dismissFlag} className="flex gap-1 items-center">
        <input type="hidden" name="flagId" value={flagId} />
        <input type="hidden" name="submissionId" value={submissionId} />
        <input
          type="text"
          name="reason"
          required
          autoFocus
          placeholder="Reason for dismissing"
          className="text-xs border border-gray-300 rounded px-2 py-1 w-44"
        />
        <button
          type="submit"
          className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={() => setShowDismiss(false)}
          className="text-xs text-gray-400 px-1 hover:text-gray-600"
        >
          Cancel
        </button>
      </form>
    );
  }

  return (
    <div className="flex gap-2">
      <form action={acceptFlag.bind(null, flagId, submissionId)}>
        <button
          type="submit"
          className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200"
        >
          Accept
        </button>
      </form>
      <button
        type="button"
        onClick={() => setShowDismiss(true)}
        className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded hover:bg-gray-200"
      >
        Dismiss
      </button>
    </div>
  );
}
