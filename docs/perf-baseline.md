# Client JavaScript baseline

Date: 2026-10-26. Next.js 16.4.2 (Turbopack), React 19.3.0.

Command: `npx next build`, then `npx next analyze --output --snapshot before`, then `npx next analyze export --snapshot before`. The snapshot is written to `.next/diagnostics/analyze`.

Client JavaScript each route loads (bootstrap chunks plus render-dependent chunks). Bytes are uncompressed. The gzip column is the sum of per-module gzip sizes from the analyzer, an estimate of transfer size. Next's own `firstLoadUncompressedJsBytes` (`.next/diagnostics/route-bundle-stats.json`) is kept as a cross-check; it runs about 1.4 KB higher per route because the analyzer's module sizes leave out the chunk runtime wrapper.

| Route | Client JS (bytes) | Client JS, gzip est. (bytes) | Next `firstLoadUncompressedJsBytes` |
| --- | ---: | ---: | ---: |
| `/` | 467,510 | 176,953 | 468,896 |
| `/currency/[pair]` | 469,209 | 177,660 | 470,595 |
| `/wallet` | 467,266 | 176,603 | 468,652 |
| `/leaderboard` | 465,749 | 175,865 | 467,178 |
| `/backtest` | 465,749 | 175,865 | 467,178 |
| `/docs/api` | 465,749 | 175,865 | 467,178 |

This is the "before" number for the visual-polish round.
