import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { tryDemo } from "@/app/auth-actions";
import { AuthShell } from "@/components/AuthShell";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <AuthShell title="Sign in" subtitle="Welcome back. Your wallet is right where you left it.">
      {/* The form reads ?next= from the URL, which is request data, so it streams in */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <div className="mt-6 flex items-center gap-3 text-xs text-zinc-500">
        <span aria-hidden="true" className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
        or
        <span aria-hidden="true" className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
      </div>

      <form action={tryDemo} className="mt-4">
        <button
          type="submit"
          className="w-full rounded-lg border border-zinc-300 px-4 py-2 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Try the demo
        </button>
      </form>

      <p className="mt-6 text-sm text-zinc-500">
        No account yet?{" "}
        <Link href="/signup" className="font-medium hover:underline">
          Create an account
        </Link>
      </p>
    </AuthShell>
  );
}
