"use client";

import { useActionState } from "react";
import { refreshQuotes } from "@/app/actions";

export function RefreshButton() {
  // state = what the action returned last time; isPending = true while it runs
  const [state, formAction, isPending] = useActionState(refreshQuotes, null);

  return (
    <form action={formAction} className="flex items-center gap-3">
      {/* Message sits before the button so the button doesn't jump when it appears.
          role="status" makes screen readers announce it */}
      <p role="status" className="text-sm text-zinc-500">
        {state?.message}
      </p>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {isPending ? "Refreshing…" : "Refresh"}
      </button>
    </form>
  );
}
