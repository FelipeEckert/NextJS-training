import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { SignupForm } from "@/components/SignupForm";

export const metadata: Metadata = { title: "Create an account" };

export default function SignupPage() {
  return (
    <main className="mx-auto w-full max-w-sm p-8">
      <h1 className="text-2xl font-bold">Create an account</h1>

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
    </main>
  );
}
