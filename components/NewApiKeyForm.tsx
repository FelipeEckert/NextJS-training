"use client";

import { useActionState, useState } from "react";
import { createKeyAction } from "@/app/api-key-actions";

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 dark:border-zinc-700 dark:bg-zinc-900";

export function NewApiKeyForm() {
  const [state, formAction, isPending] = useActionState(createKeyAction, null);
  const key = state?.key;
  // Tied to the key it applies to, so a new key starts back at "idle"
  const [copy, setCopy] = useState<{ key: string; status: "done" | "failed" } | null>(null);
  const copyStatus = copy && copy.key === key ? copy.status : "idle";

  async function copyKey(value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopy({ key: value, status: "done" });
    } catch {
      setCopy({ key: value, status: "failed" }); // clipboard access can be denied
    }
  }

  return (
    <div className="mt-4 grid gap-4">
      <form action={formAction} className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1 text-sm font-medium">
          Name
          <input name="name" required maxLength={50} placeholder="my-bot" className={inputClass} />
        </label>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-lg bg-accent px-4 py-2 font-medium text-white enabled:hover:bg-accent-hover disabled:opacity-50"
        >
          {isPending ? "Creating…" : "Create key"}
        </button>
      </form>

      {/* role="alert" makes screen readers announce the error right away */}
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      {key && (
        <div role="status" className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="text-sm font-medium">Copy it now — you won&apos;t see it again.</p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <code className="break-all rounded bg-zinc-100 px-2 py-1 text-sm dark:bg-zinc-900">
              {key}
            </code>
            <button
              type="button"
              onClick={() => copyKey(key)}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              {copyStatus === "done" ? "Copied" : "Copy"}
            </button>
          </div>
          {copyStatus === "failed" && (
            <p className="mt-2 text-sm text-red-600">
              Couldn&apos;t copy — select the key and copy it manually.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
