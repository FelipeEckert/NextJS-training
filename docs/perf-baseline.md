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

## After: animated prices

Date: 2026-10-26. Same toolchain for both rows. Each row sums the JS chunks listed for the route in `.next/diagnostics/route-bundle-stats.json` (Next's `firstLoadUncompressedJsBytes` is the same total). The gzip column gzips each chunk separately at level 9. This is not the analyzer's per-module estimate in the table above, so compare the two gzip columns only with each other.

| Route | Client JS (bytes) | Client JS, gzip (bytes) |
| --- | ---: | ---: |
| `/` before (HEAD, `de33bcc`) | 468,880 | 140,047 |
| `/` after (`AnimatedBRL` + `@number-flow/react` 0.6.2) | 486,888 | 145,809 |
| delta | +18,008 | +5,762 |

The NumberFlow path is in use (its server HTML carries the price as text and as an `aria-label`). Gate: at most about 15 KB gzip more on `/`, so +5.8 KB passes.
