import Link from "next/link";
import { logout } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/session";

// Reads the session cookie, so the layout renders it inside <Suspense>
export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <Link href="/login" className="font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="rounded-lg bg-brand px-3 py-1.5 font-medium text-white shadow-md shadow-indigo-500/20 hover:brightness-110"
        >
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="flex min-w-0 items-center gap-2">
        <span
          aria-hidden="true"
          className="grid size-7 place-items-center rounded-full bg-brand text-xs font-semibold text-white"
        >
          {user.username.slice(0, 1).toUpperCase()}
        </span>
        <span title={user.username} className="max-w-20 truncate text-zinc-600 dark:text-zinc-400">
          <span className="sr-only">Signed in as </span>
          {user.username}
        </span>
      </span>
      <Link
        href="/settings/api-keys"
        className="whitespace-nowrap font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
      >
        API keys
      </Link>
      <form action={logout}>
        <button
          type="submit"
          className="whitespace-nowrap font-medium text-zinc-600 hover:text-foreground dark:text-zinc-400"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
