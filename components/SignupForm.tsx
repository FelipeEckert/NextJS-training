"use client";

import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { signup } from "@/app/auth-actions";

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900";

export function SignupForm() {
  const next = useSearchParams().get("next") ?? ""; // where to go after signing up
  const [state, formAction, isPending] = useActionState(signup, null);

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <input type="hidden" name="next" value={next} />

      <label className="grid gap-1 text-sm font-medium">
        Username
        <input name="username" autoComplete="username" required className={inputClass} />
      </label>

      <label className="grid gap-1 text-sm font-medium">
        Password
        <input
          type="password"
          name="password"
          autoComplete="new-password"
          required
          className={inputClass}
        />
      </label>

      {/* role="alert" makes screen readers announce the error right away */}
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white enabled:hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Creating account…" : "Create account"}
      </button>
    </form>
  );
}
