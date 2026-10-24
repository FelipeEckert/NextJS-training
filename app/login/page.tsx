import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { tryDemo } from "@/app/auth-actions";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>

      {/* The form reads ?next= from the URL, which is request data, so it streams in */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>

      <form action={tryDemo} className="mt-6">
        <button
          type="submit"
          className="w-full rounded-lg border border-zinc-300 px-4 py-2 font-medium dark:border-zinc-700"
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
    </main>
  );
}
