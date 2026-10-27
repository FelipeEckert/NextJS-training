"use client";

import NumberFlow from "@number-flow/react";
import { useEffect, useRef } from "react";
import { brlFormatOptions } from "@/lib/format";

// Rolls the digits to the new price and flashes green (up) or red (down) when the value changes
export function AnimatedBRL({ value }: { value: number }) {
  const previous = useRef(value);
  const flashRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const flash = flashRef.current;
    if (!flash || previous.current === value) return;

    // Removing the class and reading offsetWidth restarts the animation even on back-to-back changes
    flash.classList.remove("animate-flash-up", "animate-flash-down");
    void flash.offsetWidth;
    flash.classList.add(value > previous.current ? "animate-flash-up" : "animate-flash-down");
    previous.current = value;
  }, [value]);

  return (
    <span ref={flashRef} className="rounded-md px-1 -mx-1">
      <NumberFlow value={value} locales="en-US" format={brlFormatOptions(value)} />
    </span>
  );
}
