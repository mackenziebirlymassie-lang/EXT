# PFCC V2 (Developer_Finance_OS)

Local-first personal treasury, cashflow ledger, and runway console built with vanilla HTML5, CSS3, and ES6 JavaScript. Designed with zero build step, zero third-party runtime JavaScript dependencies, Obsidian Chrome tabular typography (`JetBrains Mono`), and verified compatibility down to Android 7.0+ (API Level 24 / Chromium 51+ WebView).

## Why PFCC V2

- **100% Local-First & Private**: All ledgers, recurring commitments, rules, receipts, and preferences stay on your device (`localStorage`). No accounts, telemetry, or cloud sync servers required.
- **Zero Runtime Dependencies**: Custom Hi-DPI `<canvas>` charts ([js/charts.js](js/charts.js)), inline SVG icon engine ([js/icons.js](js/icons.js)), CSV parser ([js/importer.js](js/importer.js)), and Web Audio feedback ([js/audio.js](js/audio.js)) run offline without Chart.js or icon CDNs.
- **Native-Ready Android 7.0+ Shell**: Ships with a zero-bloat Android `WebView` project in [android/](android/) supporting native file pickers, Storage Access Framework exports, and hardware back-button modal handling.

## Core Architecture (4-View Workbench)

Switch views via header tabs or keyboard (`Alt+1` through `Alt+4`):

1. **01 Ledger & Ops**
   - **1-Row Quick Entry**: Rapid date, type, description, category, and amount entry with expandable `#tags` and client-side compressed image receipts (`max 800px` JPEG).
   - **Tabular Running Balance Ledger**: Chronological balance tracking per row, type/category/sort filtering, full-text search, inline editing, and lightbox receipt viewer.
   - **Commitments Panel**: Toggleable **Subscriptions & SaaS** (monthly/yearly burn calculation + one-click ledger commit) and **Split & IOUs** (receivables/payables settlement).
2. **02 Budget & Burn**
   - **Operating Ratios**: Live Savings Rate, Fixed Burn Ratio, Tax Reserve Coverage, and Survival Runway metrics.
   - **Interactive Hi-DPI Charts**: Switch between **Budget Pace** (Cumulative Spend vs. Linear Budget Target) and **6-Month Cash Flow** (Income vs. Expense bars).
   - **Allocation & Envelopes**: Ranked category spend breakdown and per-category monthly spending limits.
3. **03 Treasury & FIRE**
   - **Multi-Source Market Ticker**: Tracks `PAXG`, `BTC`, `ETH`, and `SOL` with automatic multi-provider failover and cached offline state.
   - **Freelancer Tax Reserve & Safe-to-Spend**: Configurable reserve percentage locked against liquid cashflow.
   - **Savings Vaults, Debt Payoff & Activity Heatmap**: Progress vaults, Snowball vs. Avalanche debt payoff timelines, and annual daily cashflow density grid.
4. **04 Forecast Lab**
   - Multi-variable net worth compounding simulator across `1Y`, `3Y`, `5Y`, and `10Y` horizons (`0%` to custom CAGR) with baseline vs. simulated trajectory plotting.

## Power-User Tools & Themes

- **Command Palette (`Ctrl+K` / `Cmd+K`)**: Quick navigation, privacy toggle, CSV/JSON actions, and inline ledger entry commands.
- **Privacy Blur (`Ctrl+L` / `Cmd+L`)**: Instant `-webkit-filter` / `filter: blur(8px)` masking across balances and metrics.
- **CSV Import / Export & Auto-Rules**: Column-mapped bank CSV importer (`McDonald's` apostrophe-safe, timezone-safe `YYYY-MM-DD` dates) plus keyword/amount auto-categorization rules.
- **5 Curated Palettes**: Obsidian Chrome (default), Classic Crimson, Electric Tundra, Neon Petal, and Alabaster Daylight.
- **7 Languages**: `en`, `fr`, `es`, `de`, `id`, `ja`, `zh` plus multi-currency `Intl.NumberFormat` output.

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl+K` / `Cmd+K` | Toggle CLI Command Palette |
| `Ctrl+L` / `Cmd+L` | Toggle Privacy Blur Mode |
| `Alt+1` .. `Alt+4` | Switch Workbench Views (`Ledger`, `Budget`, `Treasury`, `Forecast`) |
| `N` | Focus Quick Entry Description (outside inputs) |
| `/` | Focus Ledger Search Filter (outside inputs) |
| `M` | Toggle Web Audio UI Synth Sound (outside inputs) |
| `?` | Open Keyboard Shortcuts Reference |
| `Esc` | Close active modal, dialog, lightbox, or cancel edit |

## Project Structure

```text
.
├── index.html                  # App shell, 4-view workbench, modals, classic deferred scripts
├── style.css                   # Obsidian Chrome tokens + Chromium 51-86 grid/flex/blur fallbacks
├── favicon.svg                 # Vector brand mark
├── js/
│   ├── compat.js               # Chromium 51+ polyfills (pad2, qsa, matches, closest, remove, values)
│   ├── icons.js                # Zero-dependency inline SVG sprite helper
│   ├── i18n.js                 # 7-language dictionary and DOM translation bindings
│   ├── themes.js               # 5 colorways + legacy setting/icon normalizers
│   ├── state.js                # State store, localStorage resilience, SAF/data-URI file downloader
│   ├── audio.js                # Web Audio API synth tones with webkitAudioContext fallback
│   ├── markets.js              # Promise-based multi-source crypto/gold feed with 5s timeout fallback
│   ├── charts.js               # Hi-DPI Canvas trend, pace, and forecast trajectory renderers
│   ├── ledger.js               # Transaction CRUD, running balance table, subscriptions, IOUs, receipts
│   ├── planning.js             # Budget envelopes, ratios, advisor, FIRE/tax, vaults, debt payoff, simulator
│   ├── importer.js             # Stateful CSV parser, column mapper, timezone-safe YYYY-MM-DD normalizer
│   ├── cli.js                  # Command palette parser and modal controls
│   ├── settings.js             # Preferences, JSON backup/restore sanitizer, rule builder, shortcuts modal
│   └── main.js                 # Bootstrap sequence, global shortcuts, Android back-button handler
├── android/                    # Pure Android SDK (minSdk 24, targetSdk 35) native WebView APK wrapper
├── scripts/sync-android.mjs    # Copies root web assets into android/app/src/main/assets/www/
├── tests/verify.mjs            # Automated unit, compatibility, XSS/sanitizer, and scaffold tests
└── .github/workflows/          # GitHub Actions workflow building debug APKs and release artifacts
```

## Quick Start (Desktop & Web)

Because PFCC V2 uses classic deferred `<script>` tags with zero bundlers:

1. Clone this repository and open [index.html](index.html) directly in any browser (`file://`), or serve locally:

```bash
npx serve .
```

2. All data persists locally in `localStorage`. Export snapshots anytime via **Config -> Data -> Backup Database (JSON)** or **CSV Export**.

## Browser & Android 7.0+ Compatibility

- Modern desktop and mobile browsers (Chrome, Firefox, Safari, Edge).
- **Android 7.0+ (API Level 24 / Chromium 51+ WebView)**:
  - All modules in `js/` use strict ES6 (ES2015) syntax only (zero `async`/`await`, optional chaining, nullish coalescing, or object spread), backed by [js/compat.js](js/compat.js) and a `Promise`-based 5s timeout fallback in [js/markets.js](js/markets.js).
  - [style.css](style.css) pairs `@supports not (display: grid)` and `@supports not (inset: 0)` flex/margin fallbacks, `grid-gap` declarations, `-webkit-filter` / `-webkit-user-select` prefixes, and pre-`min()` fallbacks with modern CSS Grid and `gap`.

## Building an Android APK

A zero-dependency native Android `WebView` wrapper lives in [android/](android/) (`org.pfcc.financeos`, `minSdk 24` through `targetSdk 35`):

1. Sync web files into Android assets:

```bash
npm run android:sync
```

2. Build locally using **Android Studio** (open the `android/` directory and select **Build -> Build APK(s)**) or Gradle 8.9 + Android SDK 35 on CLI:

```bash
cd android
gradle assembleDebug
```

Gradle also triggers `syncWebAssets` automatically before `preBuild`, outputting `android/app/build/outputs/apk/debug/app-debug.apk`.
3. **Cloud Builds & Releases**: GitHub Actions ([android-apk.yml](.github/workflows/android-apk.yml)) runs `npm test`, `npm run android:sync`, and `gradle assembleDebug` on every push to `main` and automatically attaches the compiled APK to `v*` tag releases.

## Testing

Requires Node.js 20+:

```bash
npm test
```

## Security & Contributing

- Security model & local data handling: [SECURITY.md](SECURITY.md)
- Contribution & Chromium 51+ coding rules: [CONTRIBUTING.md](CONTRIBUTING.md)

## License

MIT. See [LICENSE](LICENSE).
