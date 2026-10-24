"use client";

import { useState } from "react";
import { resetWalletAction } from "@/app/trade-actions";

const buttonClass =
  "rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900";

// Two steps, so one stray click can't wipe the whole wallet
export function ResetWalletButton() {
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className={buttonClass}>
        Reset wallet
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <form
        action={async () => {
          await resetWalletAction();
          setConfirming(false); // back to the first step once the reset has finished
        }}
        className="flex items-center gap-3"
      >
        <span className="font-medium">Reset to R$ 100,000?</span>
        <button
          type="submit"
          className="rounded-lg bg-red-600 px-3 py-1.5 font-medium text-white hover:bg-red-700"
        >
          Yes, reset
        </button>
      </form>
      <button type="button" onClick={() => setConfirming(false)} className={buttonClass}>
        Cancel
      </button>
    </div>
  );
}
