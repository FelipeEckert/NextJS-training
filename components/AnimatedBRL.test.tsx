import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AnimatedBRL } from "./AnimatedBRL";
import { formatBRL } from "@/lib/format";

describe("AnimatedBRL", () => {
  // NumberFlow puts the formatted price in aria-label and in light-DOM text, so the server HTML carries it
  it.each([5.3712, 430268, 0.006512, 0])("server HTML carries formatBRL(%s) as text", (value) => {
    const html = renderToString(<AnimatedBRL value={value} />);
    expect(html).toContain(`aria-label="${formatBRL(value)}"`);
    expect(html).toContain(`<span>${formatBRL(value)}</span>`);
  });
});
