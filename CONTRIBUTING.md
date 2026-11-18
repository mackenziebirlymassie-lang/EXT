# Contributing to EXT

Contributions are welcome. Keep pull requests focused, small, and compliant with the project constraints below.

## Development Rules

1. **Zero Runtime Dependencies**: Do not add npm runtime packages or external `<script>` CDNs. Charts and icons are implemented natively in `js/charts.js` and `js/icons.js`.
2. **Android 7.0+ (Chromium 51+) Compatibility**:
   - Keep all files in `js/` strictly ES6 (ES2015): do not use `async`/`await`, optional chaining (`?.`), or nullish coalescing (`??`).
   - Do not use ES2018 object spread (`{...obj}`), `Object.entries`, `Promise.prototype.finally`, or call `querySelectorAll(...).forEach()` directly; use `PFCC.compat.pad2`, `PFCC.compat.qsa`, and `Object.assign` instead.
   - Any new CSS grid or flex `gap` layout must include `grid-gap` before `gap` and fallback margin behavior in the `@supports not (display: grid)` / `@supports not (inset: 0)` blocks in `style.css`. Never use CSS `inset: 0`.
3. **XSS & Storage Safety**:
   - Never interpolate user-supplied strings into `innerHTML`. Build elements via `document.createElement` and `textContent`.
   - Use `PFCC.utils.safeLoadJSON` and `PFCC.utils.safeSaveJSON` for all `localStorage` access.
4. **Visual Hygiene**:
   - Use inline SVG icons from `js/icons.js` instead of raw emojis.
   - Use architectural corner radii (`0px` to `8px`), never pill buttons (`20px`/`9999px`).

## Verification

Before submitting a pull request:

```bash
npm test
```

Ensure all unit and static compatibility checks pass with zero errors.
