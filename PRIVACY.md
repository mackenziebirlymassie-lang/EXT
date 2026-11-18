# Privacy Policy - EXT (Expense Tracker)

**Effective Date:** November 18, 2026

This Privacy Policy applies to the **EXT (Expense Tracker)** web application and Android application (`org.pfcc.financeos`).

---

## 1. Summary (Zero Server Data Collection)

EXT is a **100% local-first, offline-capable personal bookkeeping application**.
- We do **not** require account registration, login, or authentication.
- We do **not** collect, store, sell, or transmit your transactions, budgets, debts, savings vaults, receipts, or personal preferences to any developer-owned server.
- We do **not** use third-party analytics, crash-tracking SDKs, advertising SDKs, or external font CDNs.

---

## 2. On-Device Data Storage (UU PDP & GDPR Compliance)

All financial records, categories, auto-rules, and compressed receipt images are stored exclusively on your own device using browser/WebView `localStorage`.
- **Data Controller:** Because your data never leaves your device unless you manually export a JSON or CSV file, **you** remain the sole controller of your on-device personal financial data under Indonesia Law No. 27 of 2022 (**UU PDP**) and the European Union General Data Protection Regulation (**GDPR**).
- **Deletion:** You may erase all stored records at any time via **Config -> Data -> Purge All Data** or by uninstalling the application / clearing browser storage.

---

## 3. Optional Public Market Price Feeds

When enabled in **Config -> Legal**, EXT fetches read-only public cryptocurrency and gold reference rates (`BTC`, `ETH`, `SOL`, `PAXG`) from public API endpoints:
- `api.coinlore.net`
- `data-api.binance.vision`
- `api.gateio.ws`
- `api.coingecko.com`

Only standard HTTP request metadata (such as your IP address) is visible to whichever public market API responds. No ledger data or holdings quantities are ever transmitted in these requests. You can disable automatic market syncing anytime in **Config -> Legal**.

---

## 4. Direct GitHub APK Self-Updater (GitHub Flavor Only)

- **Google Play Store Build (`playstore` flavor):** Contains **no** self-update downloader and **no** `REQUEST_INSTALL_PACKAGES` permission. App updates are handled exclusively by Google Play.
- **Direct GitHub Release APK (`github` flavor):** Periodically queries `api.github.com/repos/mackenziebirlymassie-lang/EXT/releases/tags/latest` to check for newer APK builds and installs them only when you explicitly confirm.

---

## 5. Children's Privacy (COPPA)

EXT is intended for users aged **16 and older** and is not directed at children under 13.

---

## 6. Kebijakan Privasi (Bahasa Indonesia)

**Tanggal Berlaku:** 18 November 2026

1. **Penyimpanan Lokal 100% (Kepatuhan UU PDP No. 27 Tahun 2022):** Seluruh catatan transaksi, anggaran, struk gambar, brankas tabungan, dan pengaturan disimpan **sepenuhnya di perangkat Anda** (`localStorage`). Pengembang tidak mengumpulkan, menyimpan, mengakses, atau menjual data keuangan pribadi Anda ke server mana pun.
2. **Tanpa Pelacakan & Tanpa Iklan:** Aplikasi tidak menggunakan SDK analitik, pelacak iklan, atau CDN font eksternal.
3. **Feed Harga Pasar Opsional:** Jika diaktifkan di **Config -> Legal**, aplikasi mengambil harga referensi publik (`BTC`, `ETH`, `SOL`, `PAXG`) dari API publik tanpa mengirim data transaksi atau jumlah kepemilikan Anda. Fitur ini dapat dinonaktifkan kapan saja.
4. **Penghapusan Data:** Anda dapat menghapus seluruh data kapan saja melalui **Config -> Data -> Purge All Data** atau dengan menghapus aplikasi.

---

## 7. Contact

For privacy or compliance questions, open an issue in the official repository:
`https://github.com/mackenziebirlymassie-lang/EXT/issues`
