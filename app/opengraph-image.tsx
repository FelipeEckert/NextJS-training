import { ImageResponse } from "next/og";

export const alt = "Exchange Rates: paper-trade currencies in Brazilian reais";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const BACKGROUND = "#09090b";
const TEXT = "#fafafa";
const MUTED = "#a1a1aa";

export default function Image() {
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

        <div style={{ display: "flex", flexDirection: "column", flex: 1, justifyContent: "center" }}>
          <div style={{ display: "flex", fontSize: 72, fontWeight: 700 }}>
            Paper-trade currencies in BRL
          </div>
          <div style={{ display: "flex", marginTop: 24, fontSize: 32, color: MUTED }}>
            Live quotes · Wallet · Leaderboard · Backtester · Bot API
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
