import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { revokeKeyAction } from "@/app/api-key-actions";
import { NewApiKeyForm } from "@/components/NewApiKeyForm";
import { listApiKeys } from "@/lib/api-keys";
import { getCurrentUser } from "@/lib/session";
import { DEMO_USERNAME } from "@/lib/users";

export const metadata: Metadata = { title: "API keys" };

export default function ApiKeysPage() {
  return (
    <main className="mx-auto w-full max-w-5xl p-8">
      <h1 className="text-3xl font-bold">API keys</h1>
      <Suspense fallback={<p className="mt-6 text-zinc-500">Loading your API keys…</p>}>
        <ApiKeysDetails />
      </Suspense>
    </main>
  );
}

async function ApiKeysDetails() {
  // Defense in depth: the proxy already redirected visitors without a cookie (see app/wallet/page.tsx)
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/settings/api-keys");

  await connection(); // the DB driver draws random bytes; defer them to request time
  const keys = await listApiKeys(user.id);
  const isDemo = user.username === DEMO_USERNAME;

  return (
    <>
      <p className="mt-2 text-zinc-500">
        Keys let your own bot trade on your account. Read the{" "}
        <Link href="/docs/api" className="font-medium underline">
          API docs
        </Link>{" "}
        to get started.
      </p>

      <h2 className="mt-10 text-xl font-semibold">New key</h2>
      {isDemo ? (
        <p className="mt-4 text-zinc-500">
          The shared demo account can&apos;t create API keys — create your own account.
        </p>
      ) : (
        <NewApiKeyForm />
      )}

      <h2 className="mt-10 text-xl font-semibold">Your keys</h2>
      {keys.length === 0 ? (
        <p className="mt-4 text-zinc-500">No API keys yet.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-left text-sm tabular-nums">
            <thead className="text-zinc-500">
              <tr>
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Key</th>
                <th className="py-2 pr-4 font-medium">Created</th>
                <th className="py-2 pr-4 font-medium">Last used</th>
                <th className="py-2 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {keys.map((key) => (
                <tr key={key.id} className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="py-2 pr-4 font-medium">{key.name}</td>
                  <td className="py-2 pr-4 font-mono">{key.prefix}…</td>
                  <td className="py-2 pr-4">{formatDate(key.createdAt)}</td>
                  <td className="py-2 pr-4">{key.lastUsedAt ? formatDate(key.lastUsedAt) : "Never"}</td>
                  <td className="py-2">
                    <form action={revokeKeyAction}>
                      <input type="hidden" name="id" value={key.id} />
                      <button
                        type="submit"
                        aria-label={`Revoke ${key.name}`}
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                      >
                        Revoke
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function formatDate(date: Date) {
  return date.toLocaleDateString("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
