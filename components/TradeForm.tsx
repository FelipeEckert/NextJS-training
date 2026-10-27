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

  // Each new result bumps this id, so the success check replays its draw-in for every order
  const [seenState, setSeenState] = useState(state);
  const [resultId, setResultId] = useState(0);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setResultId((id) => id + 1);
  }

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

      <div
        className="relative inline-grid grid-cols-2 rounded-lg border border-zinc-300 dark:border-zinc-700"
        role="group"
        aria-label="Order side"
      >
        {/* The pill sits behind the buttons and slides to the right half for Sell */}
        <span
          aria-hidden="true"
          className={`absolute inset-y-1 left-1 w-[calc(50%-0.25rem)] rounded-md bg-brand transition-transform duration-200 ease-out ${
            side === "sell" ? "translate-x-full" : ""
          }`}
        />
        {(["buy", "sell"] as const).map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={side === option}
            onClick={() => {
              if (option !== side) keyRef.current = null;
              setSide(option);
            }}
            className={`relative rounded-md px-4 py-2 font-medium transition-[color,transform] motion-safe:active:scale-[0.97] ${
              side === option ? "text-white" : ""
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

      {state?.message && (
        <div className="flex items-center gap-2">
          {state.ok && (
            <svg
              key={resultId}
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="size-5 shrink-0 text-gain"
            >
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={2.5} fill="none" />
              <path
                pathLength={1}
                className="animate-check-draw"
                d="M7.5 12.5l3 3 6-6.5"
                stroke="currentColor"
                strokeWidth={2.5}
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
          {/* role="alert" makes screen readers announce the result right away */}
          <p role="alert" className={`text-sm ${state.ok ? "text-gain" : "text-red-600"}`}>
            {state.message}
          </p>
        </div>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand shadow-md shadow-indigo-500/20 px-4 py-2 font-medium text-white transition-transform motion-safe:active:scale-[0.97] enabled:hover:brightness-110 disabled:opacity-50"
      >
        {isPending && (
          <svg aria-hidden="true" viewBox="0 0 24 24" className="size-4 motion-safe:animate-spin" fill="none">
            <path
              d="M22 12A10 10 0 1 1 12 2"
              stroke="currentColor"
              strokeWidth={3}
              strokeLinecap="round"
            />
          </svg>
        )}
        {isPending ? "Placing order…" : side === "buy" ? "Buy" : "Sell"}
      </button>
    </form>
  );
}
