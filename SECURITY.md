# Security Policy

## Local-First Architecture

PFCC V2 stores all financial transactions, settings, and receipt attachments locally in browser `localStorage`. No user financial data is transmitted to a project backend. External network requests are limited to read-only public cryptocurrency and gold price feeds (`CoinLore`, `Binance Vision`, `Gate.io`, `CoinGecko`) when syncing market prices.

## Reporting a Vulnerability

If you discover a cross-site scripting (XSS) vector, unsafe CSV/JSON parsing bug, or other security issue:

1. Do not open a public issue with exploit details before a fix is ready.
2. Share a minimal reproduction and affected file path with the repository maintainers privately via GitHub Security Advisories.
3. Include expected vs. actual behavior so a regression test can be added to `tests/verify.mjs`.
