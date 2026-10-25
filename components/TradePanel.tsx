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
      <p className="mt-6">
        <Link href={`/login?next=/currency/${pair}`} className="font-medium hover:underline">
          Sign in to trade
        </Link>
      </p>
    );
  }

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
