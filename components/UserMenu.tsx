import Link from "next/link";
import { logout } from "@/app/auth-actions";
import { getCurrentUser } from "@/lib/session";

// Reads the session cookie, so the layout renders it inside <Suspense>
export async function UserMenu() {
  const user = await getCurrentUser();

  if (!user) {
    return (
      <div className="flex items-center gap-4 text-sm">
        <Link href="/login" className="font-medium hover:underline">
          Sign in
        </Link>
        <Link href="/signup" className="font-medium hover:underline">
          Sign up
        </Link>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 text-sm">
      <span className="text-zinc-500">Signed in as {user.username}</span>
      <form action={logout}>
        <button type="submit" className="font-medium hover:underline">
          Sign out
        </button>
      </form>
    </div>
  );
}
