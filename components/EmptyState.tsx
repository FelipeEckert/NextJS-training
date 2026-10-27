import Link from "next/link";
import type { ReactNode } from "react";

type Props = { title: string; children?: ReactNode; action?: { href: string; label: string } };

export function EmptyState({ title, children, action }: Props) {
  return (
    <div className="mt-4 rounded-xl border border-dashed border-zinc-300 px-6 py-8 text-center dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      {children && <p className="mt-1 text-sm text-zinc-500">{children}</p>}
      {action && (
        <Link
          href={action.href}
          className="mt-4 inline-block rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:brightness-110"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
