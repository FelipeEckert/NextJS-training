import { connection } from "next/server";
import Link from "next/link";
import { TradeForm } from "@/components/TradeForm";
import { formatDecimal, QTY_SCALE } from "@/lib/money";
import { getCurrentUser } from "@/lib/session";
import { getWallet } from "@/lib/trading";

export async function TradePanel({ pair, code }: { pair: string; code: string }) {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="mt-6 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800">
        <p className="font-medium">Trade {code} with virtual cash</p>
        <p className="mt-1 text-sm text-zinc-500">Every account starts with R$ 100,000. Live prices, no real money.</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href={`/login?next=/currency/${pair}`}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white shadow-md shadow-indigo-500/20 hover:brightness-110"
          >
            Sign in to trade
          </Link>
          <Link
            href="/signup"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Create account
          </Link>
        </div>
      </div>
    );
  }

  await connection(); // the DB driver draws random bytes; defer them to request time
  const wallet = await getWallet(user.id);
  const position = wallet.positions.find((p) => p.pair === pair);
  // key: a different pair must not inherit this form's last result or idempotency key
  return (
    <TradeForm
      key={pair}
      pair={pair}
      code={code}
      cashCents={wallet.cashCents}
      holding={position ? formatDecimal(position.quantity, QTY_SCALE) : null}
    />
  );
}
