import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginForm } from "@/components/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-8">
      <h1 className="text-2xl font-bold">Sign in</h1>
      <p className="mt-2 text-sm text-zinc-500">
        Demo account: username <code>demo</code>. The password is in <code>.env.local</code>.
      </p>

      {/* The form reads ?next= from the URL, which is request data, so it streams in */}
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
