import Link from "next/link";
import { logout } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/session";

// Reads the session cookie, so the layout renders it inside <Suspense>
export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <Link href="/login" className="text-sm font-medium hover:underline">
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-500">Signed in as {user}</span>
      <form action={logout}>
        <button type="submit" className="font-medium hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
