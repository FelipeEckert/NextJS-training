import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AuthShell } from "@/components/AuthShell";
import { SignupForm } from "@/components/SignupForm";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <AuthShell title="Create an account" subtitle="Start with R$ 100,000 of virtual cash. No card needed.">
      {/* The form reads ?next= from the URL, which is request data, so it streams in */}
      <Suspense fallback={null}>
        <SignupForm />
      </Suspense>

      <p className="mt-6 text-sm text-zinc-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
