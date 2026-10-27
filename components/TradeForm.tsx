"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { trade } from "@/app/trade-actions";
import { formatBRL } from "@/lib/format";

const inputClass =
  "rounded-lg border border-zinc-300 px-3 py-2 font-normal dark:border-zinc-700 dark:bg-zinc-900";

export function TradeForm({
  pair,
  code,
  cashCents,
  holding,
}: {
  pair: string;
  code: string;
  cashCents: number;
  holding: string | null; // held quantity as a decimal string
}) {
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [sellAll, setSellAll] = useState(false);
  const [state, formAction, isPending] = useActionState(trade, null);

  // One key per order: a resend of the same order reuses it, so the server can't fill it twice.
  // Generated lazily in the submit handler, never during render.
  const keyRef = useRef<string | null>(null);
  // A successful order uses up its key, so the next order gets a fresh one
  useEffect(() => {
    if (state?.ok) keyRef.current = null;
  }, [state]);

  function submit(formData: FormData) {
    keyRef.current ??= crypto.randomUUID();
    formData.set("idempotencyKey", keyRef.current);
    formAction(formData);
  }

  const sellingAll = side === "sell" && sellAll;

  return (
    <form
      action={submit}
      // Any edit makes it a different order, so it gets a new key; only an unchanged retry reuses one
      onChange={() => {
        keyRef.current = null;
      }}
      className="mt-6 grid gap-4 rounded-xl border border-zinc-200 p-4 dark:border-zinc-800"
    >
      <input type="hidden" name="pair" value={pair} />
      <input type="hidden" name="side" value={side} />

      <div className="flex gap-2" role="group" aria-label="Order side">
        {(["buy", "sell"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={side === option}
            onClick={() => {
              if (option !== side) keyRef.current = null;
              setSide(option);
            }}
            className={`rounded-lg px-4 py-2 font-medium ${
              side === option
                ? "bg-accent text-white"
                : "border border-zinc-300 dark:border-zinc-700"
            }`}
          >
            {option === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      <p className="text-sm text-zinc-500 tabular-nums">Cash: {formatBRL(cashCents / 100)}</p>
      <p className="text-sm text-zinc-500 tabular-nums">
        {holding ? `You hold: ${holding} ${code}` : "You hold none"}
      </p>

      <label className="grid gap-1 text-sm font-medium">
        {side === "buy" ? "Amount (R$)" : `Quantity (${code})`}
        <input
          name="amount"
          inputMode="decimal"
          required
          disabled={sellingAll}
          className={inputClass}
        />
      </label>

      {side === "sell" && (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="all"
            checked={sellAll}
            onChange={(event) => setSellAll(event.target.checked)}
          />
          Sell all
        </label>
      )}

      {/* role="alert" makes screen readers announce the result right away */}
      {state?.message && (
        <p role="alert" className={`text-sm ${state.ok ? "text-green-600" : "text-red-600"}`}>
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded-lg bg-accent px-4 py-2 font-medium text-white hover:bg-accent-hover disabled:opacity-50"
      >
        {isPending ? "Placing order…" : side === "buy" ? "Buy" : "Sell"}
      </button>
    </form>
  );
}
