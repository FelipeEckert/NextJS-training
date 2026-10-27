import { ImageResponse } from "next/og";
import { notFound } from "next/navigation";
import { sliceRange, summarize } from "@/lib/analysis";
import { buildLinePath } from "@/lib/chart";
import { findCurrency } from "@/lib/currencies";
import { formatBRL } from "@/lib/format";
import { getHistory } from "@/lib/history";

export const alt = "Currency price in Brazilian reais";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKGROUND = "#09090b";
const TEXT = "#fafafa";
const MUTED = "#a1a1aa";
const GREEN = "#16a34a";
const RED = "#dc2626";

export default async function Image({ params }: { params: Promise<{ pair: string }> }) {
  const { pair } = await params;

  // The proxy already rejects unknown pairs; this check narrows the type
  const currency = findCurrency(pair);
  if (!currency) notFound();

  // Always pass currency.pair, never the raw URL value
  const history = await getHistory(currency.pair);
  const latest = history.at(-1);
  const points = sliceRange(history, "1M");
  const summary = summarize(points);

  // Rounded the same way as the currency page, so the card and the page always agree
  const percent = summary ? Number(summary.changePct.toFixed(2)) : 0;
  const sign = percent > 0 ? "+" : "";
  const color = percent > 0 ? GREEN : percent < 0 ? RED : MUTED;
  const closes = points.map((p) => p.close);

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: "100%",
          height: "100%",
          background: BACKGROUND,
          color: TEXT,
          padding: 72,
        }}
      >
        <div style={{ display: "flex", fontSize: 32, color: MUTED }}>Exchange Rates</div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 64, fontWeight: 700 }}>{currency.label}</div>
          {latest && summary ? (
            <div style={{ display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", fontSize: 96, fontWeight: 700 }}>
                {formatBRL(latest.close)}
              </div>
              <div style={{ display: "flex", fontSize: 32, color }}>
                {`${sign}${percent.toFixed(2)}% · 30 days`}
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", fontSize: 48, color: MUTED }}>No price data</div>
          )}
        </div>

        {summary && (
          <svg width={1056} height={180} viewBox="0 0 1056 180">
            <path
              d={buildLinePath(closes, 1056, 180)}
              fill="none"
              stroke={color}
              strokeWidth={6}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>
    ),
    { ...size },
  );
}
