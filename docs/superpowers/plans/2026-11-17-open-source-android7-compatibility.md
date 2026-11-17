# Open-Source Packaging & Android 7.0+ (Chromium 51+) Compatibility Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `Developer_Finance_OS` (`PFCC V2`) 100% compatible with Android 7.0+ (API Level 24 / Chromium 51+ WebView) while preserving its Obsidian Chrome visual identity on modern browsers, and package the repository for open-source release.

**Architecture:** Add a lightweight runtime compatibility bootstrap (`js/compat.js`) and refactor ES2017+/ES2020+ syntax (`async`/`await`, `?.`, `padStart`, `Object.values`, `flatMap`, `AbortController`) to clean ES6 (ES2015) so Chromium 51 parses every script without syntax errors. Layer progressive CSS (`display: flex` + margin fallbacks before `display: grid` + `@supports (gap: 1px)`, fallback `font-size` before `clamp()`, `-webkit-` prefixes, and touch-delay elimination) so Android 7.0 WebViews and modern desktop browsers both render the exact same clean layout. Add standard open-source governance and metadata (`LICENSE`, `README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `package.json`, `.gitignore`).

**Tech Stack:** Vanilla HTML5, CSS3 (Chromium 51+ progressive enhancement), ES6 (ES2015) JavaScript, Node.js (`node:test`) verification suite.

**Spec:** User requirements in session conversation (`Android 7.0+ / Chromium 51+ compatibility`, `open-source readiness`, `Obsidian Chrome clean look`).

## Global Constraints

- Target browser floor: Android 7.0+ System WebView (Chromium 51+, ES6 / ES2015 only; no `async`/`await`, no optional chaining `?.`, no nullish coalescing `??`, no unpolyfilled `String.prototype.padStart`, `Object.values`, `Array.prototype.flatMap`, `NodeList.prototype.forEach`, or `Element.prototype.closest`).
- Zero external runtime dependencies: no third-party JS CDNs, no build step required to open `index.html`.
- Visual & copy rules (`antislop`): zero em dashes (`—`), zero emojis in UI, zero pill buttons (`border-radius: 20px`/`9999px`), zero purple gradients, `JetBrains Mono` tabular typography, Obsidian Chrome default palette.
- CSS layout floor: every `display: grid` rule must have a preceding `display: -webkit-box; display: -ms-flexbox; display: flex; -ms-flex-wrap: wrap; flex-wrap: wrap;` fallback for Chromium 51–56, and every flex/grid `gap` must have margin fallbacks scoped or reset cleanly via `@supports (gap: 1px)` / `@supports (display: grid)`.

## Review Focus

- Chromium 51 parser rejection: a single `async function` or `?.` token in `js/markets.js` causes a syntax error that aborts parsing the entire file in Android 7.0 WebView; static AST/regex tests must assert zero `async`/`await`/`?.`/`??` tokens across `js/*.js`.
- `fetch` timeout without `AbortController`: Android 7.0 (Chromium 51) has `fetch` (added in Chrome 42) but lacks `AbortController` (added in Chrome 66); `fetchWithTimeout` must fall back to `Promise.race` with a timer when `AbortController` is absent.
- `webkitAudioContext.resume()` return value: early mobile WebKit implementations either lack `.resume()` or return `undefined` instead of a `Promise`; calling `.resume().catch(...)` unconditionally throws a `TypeError`.
- Double spacing when combining margin fallbacks with modern `gap`: if margin fallbacks on flex/grid children are not reset inside `@supports (gap: 8px)` or `@supports (display: grid)`, modern browsers will apply both `margin` and `gap`; CSS must reset fallback margins when `gap` is supported.
- `Element.prototype.remove` and `Element.prototype.closest` on older WebViews: `cli.js` and `state.js` use `.closest()` and `.remove()`, which must be polyfilled in `js/compat.js`.

---

### Task 1: ES6 Compatibility Bootstrap & Legacy WebView Polyfills (`js/compat.js`)

**Files:**
- Create: `js/compat.js`
- Modify: `index.html:14-27`
- Modify: `js/state.js:34-44`, `js/charts.js:36-78`, `js/audio.js:5-16`, `js/markets.js:64-175`
- Test: `tests/verify.mjs`

**Interfaces:**
- Produces: `js/compat.js` polyfilling `NodeList.prototype.forEach`, `Element.prototype.matches`, `Element.prototype.closest`, `Element.prototype.remove`, `String.prototype.padStart`, `Object.values`, and `Array.prototype.flatMap` before any other `js/*.js` script loads.
- Consumes: `window.PFCC` namespace.

- [ ] **Step 1: Add ES6 / Chromium 51 syntax & polyfill test in `tests/verify.mjs`**

```javascript
test('all JS modules use Chromium 51 (ES6) compatible syntax and polyfills', () => {
    const jsFiles = fs.readdirSync(path.join(rootDir, 'js')).filter(f => f.endsWith('.js'));
    assert.equal(jsFiles.includes('compat.js'), true, 'js/compat.js must exist');
    for (const file of jsFiles) {
        const src = fs.readFileSync(path.join(rootDir, 'js', file), 'utf8');
        assert.equal(/\basync\s+function\b|\bawait\s+/.test(src), false, `${file} contains async/await (Chrome 55+)`);
        assert.equal(/\?\./.test(src), false, `${file} contains optional chaining ?. (Chrome 80+)`);
        assert.equal(/\?\?/.test(src), false, `${file} contains nullish coalescing ?? (Chrome 80+)`);
    }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/verify.mjs`
Expected: FAIL (`js/compat.js must exist` and `markets.js contains async/await`).

- [ ] **Step 3: Create `js/compat.js`, link it first in `index.html`, and refactor `markets.js`, `audio.js`, `charts.js`, and `state.js` to pure ES6**

In `js/compat.js`, guard and polyfill `NodeList.prototype.forEach`, `Element.prototype.matches`, `Element.prototype.closest`, `Element.prototype.remove`, `String.prototype.padStart`, `Object.values`, and `Array.prototype.flatMap`.
In `js/markets.js`:
- Replace `async function fetchWithTimeout(url)` with a Promise-based helper using `AbortController` when `typeof AbortController !== 'undefined'` and a `Promise.race` timeout fallback for Chromium 51–65.
- Replace `async function fetchLivePrices()` with a Promise chain (`fetchTier1().catch(fetchTier2).catch(fetchTier3).catch(fetchTier4)`) and replace `data['pax-gold']?.usd` optional chaining with `data['pax-gold'] && data['pax-gold'].usd`.
In `js/audio.js`:
- Guard `audioCtx.resume()`: check `if (typeof audioCtx.resume === 'function') { var p = audioCtx.resume(); if (p && typeof p.catch === 'function') p.catch(function(){}); }`.
In `js/state.js` & `js/charts.js`:
- Use `('0' + n).slice(-2)` for 2-digit zero-padding.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/verify.mjs`
Expected: PASS

---

### Task 2: Android 7.0+ (Chromium 51+) CSS Grid, Flexbox Gap & WebKit Touch Fallbacks

**Files:**
- Modify: `style.css`
- Test: `tests/verify.mjs`

**Interfaces:**
- Consumes: CSS class selectors in `index.html` and `js/*.js`.
- Produces: Progressive CSS stylesheet compatible with Chromium 51+ and legacy mobile WebKit while keeping identical layout on modern browsers.

- [ ] **Step 1: Add CSS compatibility test in `tests/verify.mjs`**

```javascript
test('style.css includes Chromium 51 WebKit fallbacks and touch optimizations', () => {
    const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
    assert.equal(css.includes('-webkit-tap-highlight-color: transparent'), true, 'Missing tap highlight removal');
    assert.equal(css.includes('touch-action: manipulation'), true, 'Missing touch-action: manipulation');
    assert.equal(css.includes('-webkit-backdrop-filter'), true, 'Missing -webkit-backdrop-filter prefix');
    assert.equal(css.includes('@supports (display: grid)'), true, 'Missing @supports (display: grid) fallback reset');
    assert.equal(/\binset\s*:/.test(css), false, 'Forbidden CSS inset property found');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/verify.mjs`
Expected: FAIL (`Missing tap highlight removal`)

- [ ] **Step 3: Update `style.css` with Chromium 51+ progressive fallbacks**

1. Add `-webkit-tap-highlight-color: transparent;` and `touch-action: manipulation;` to interactive controls (`a[href], button, summary, select, label[for], input`).
2. Add `overflow-x: hidden;` before `overflow-x: clip;` on `body`, and `font-size: 1.1875rem;` before `font-size: clamp(...)` on `.brand-text h1`.
3. Add `-webkit-backdrop-filter: blur(6px);` before `backdrop-filter: blur(6px);` on `.modal-overlay`, plus `-webkit-transform`, `-webkit-transition`, and `-webkit-animation` prefixes on animated classes.
4. Provide `display: -webkit-box; display: -ms-flexbox; display: flex; -ms-flex-wrap: wrap; flex-wrap: wrap;` fallbacks with percentage `flex-basis` and margin spacing on `.metrics-grid`, `.quick-entry-row`, `.ledger-ops-grid`, `.two-col-grid`, `.forecast-grid`, `.submetrics-grid`, `.envelopes-grid`, `.vaults-grid`, `.market-ticker-container`, `.advisor-cards-grid`, and `.form-row`, and reset fallback margins inside `@supports (display: grid)` and `@supports (gap: 8px)` so modern browsers use native CSS Grid and `gap` with zero double-margins.

- [ ] **Step 4: Run test and headless Chrome CDP verification**

Run: `node --test tests/verify.mjs`
Expected: PASS

---

### Task 3: Open-Source Repository Packaging, Documentation & Community Standards

**Files:**
- Create: `LICENSE`
- Create: `README.md`
- Create: `CONTRIBUTING.md`
- Create: `SECURITY.md`
- Create: `package.json`
- Create: `.gitignore`
- Create: `.editorconfig`
- Test: `tests/verify.mjs`

**Interfaces:**
- Produces: Complete open-source repository structure ready for GitHub publication and `npm test` execution.

- [ ] **Step 1: Add open-source metadata & documentation verification test in `tests/verify.mjs`**

```javascript
test('open-source repository files exist and contain zero em dashes or emojis', () => {
    for (const file of ['LICENSE', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'package.json', '.gitignore', '.editorconfig']) {
        const p = path.join(rootDir, file);
        assert.equal(fs.existsSync(p), true, `Missing required OSS file: ${file}`);
        const content = fs.readFileSync(p, 'utf8');
        assert.equal(content.includes('\u2014'), false, `${file} contains forbidden em dash`);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.equal(pkg.license, 'MIT');
    assert.equal(pkg.scripts.test, 'node --test tests/verify.mjs');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/verify.mjs`
Expected: FAIL (`Missing required OSS file: LICENSE`)

- [ ] **Step 3: Create `LICENSE`, `package.json`, `.gitignore`, `.editorconfig`, `README.md`, `CONTRIBUTING.md`, and `SECURITY.md`, and initialize Git repository**

- `LICENSE`: Standard MIT License.
- `package.json`: `"name": "pfcc-finance-os"`, `"version": "2.0.0"`, `"license": "MIT"`, `"scripts": { "test": "node --test tests/verify.mjs" }`, zero runtime dependencies.
- `README.md`: Clear documentation covering the 4-View Workbench, keyboard shortcuts, local-first storage architecture, zero-dependency design, Android 7.0+ (Chromium 51+) support, and running tests (`npm test`). No emojis and no em dashes (`R-02`, `R-04`).
- `CONTRIBUTING.md` & `SECURITY.md`: Concise contributor guidelines (coding standards, Android 7.0 compatibility rules, running `npm test`) and local-first security/XSS reporting policy.
- Initialize `git init` if `.git` is not present.

- [ ] **Step 4: Run full test suite (`npm test`) and headless Chrome CDP click-through**

Run: `npm test`
Expected: PASS (11/11 tests passing, 0 console/runtime errors, 0 overflow across Desktop, Tablet, and Mobile).
