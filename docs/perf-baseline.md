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

## After: the whole visual-polish round

Date: 2026-10-27. Same toolchain. The **before** column is `e4ddd28`, the commit just before this round started (#37); the **after** column is `9e49e96`, the merge of #57. Both use the method from the section above: sum the first-load chunks in `.next/diagnostics/route-bundle-stats.json` and gzip each chunk at level 9.

### Client JavaScript per route

| Route | Before (bytes) | After (bytes) | Before, gzip | After, gzip | Delta, gzip |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/` | 468,896 | 487,876 | 140,053 | 146,567 | +6,514 |
| `/currency/[pair]` | 470,595 | 474,426 | 140,722 | 142,593 | +1,871 |
| `/wallet` | 468,652 | 471,452 | 139,919 | 141,518 | +1,599 |
| `/leaderboard` | 467,178 | 467,299 | 139,174 | 139,672 | +498 |
| `/backtest` | 467,178 | 470,115 | 139,174 | 141,043 | +1,869 |
| `/docs/api` | 467,178 | 468,260 | 139,174 | 140,231 | +1,057 |

What it bought:
- view transitions between pages and on the wallet's loading reveal;
- delta chips and new color tokens;
- the chart gradient and draw-in, plus the crosshair tooltip;
- the price flash and digit roll (NumberFlow);
- the trade form polish;
- the wallet skeleton and row stagger;
- Open Graph images and the 404 page;
- the leaderboard highlight, the sparklines and the ticker tape;
- the docs copy buttons and scroll reveal.

The largest cost is on `/` (+6.5 KB gzip), which is NumberFlow plus the ticker's pause button. Every other route grew by less than 2 KB.

### Lighthouse

Lighthouse 13.5.0 with its default mobile settings (simulated throttling), against `next start` on localhost. Each cell is the median of 3 runs, picked by performance score. `/wallet` ran signed in as a test user.

| Route | Performance | Accessibility | Best practices | LCP (ms) | TBT (ms) | CLS |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | 98 → 97 | 95 → 100 | 100 → 100 | 2,412 → 2,430 | 52 → 119 | 0 → 0 |
| `/currency/usd-brl` | 98 → 97 | 96 → 100 | 100 → 100 | 2,415 → 2,572 | 53 → 56 | 0 → 0.035 |
| `/wallet` | 98 → 98 | 96 → 100 | 100 → 100 | 2,428 → 2,424 | 60 → 57 | 0 → 0 |
| `/backtest` | 96 → 97 | 100 → 100 | 100 → 100 | 2,566 → 2,571 | 106 → 56 | 0 → 0 |
| `/docs/api` | 97 → 97 | 100 → 96 | 100 → 100 | 2,565 → 2,568 | 54 → 56 | 0 → 0 |

How to read it:
- **Performance** stayed between 96 and 98. LCP barely moved, because the large price and the headings never start hidden.
- **TBT on `/`** went from 52 to 119 ms: the ticker and NumberFlow hydrate there. That is still well under the 200 ms "good" line.
- **Accessibility went up to 100 on `/`, the currency page and the wallet.** Before, the plain green change text (`text-green-600` on white, 3.2:1) failed contrast; the delta chips fixed that.
- **`/docs/api` first dropped from 100 to 96.** Lighthouse checks contrast while the sections just below the fold are mid-fade, and partly transparent text reads as light gray.
  - #60 changed the reveal to movement only (`translate`, no `opacity`), so text is at full contrast at every point of the scroll.
  - Re-measured on that build: **performance 97, accessibility 100, best practices 100**, LCP 2,574 ms, TBT 75 ms and CLS 0, with no failing accessibility audits.
