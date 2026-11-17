(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function calculateNetWorth() {
        const state = PFCC.state;
        const lifetimeBalance = state.transactions.reduce((acc, item) => acc + item.amount, 0);
        let assetsVal = 0;
        Object.keys(state.holdings).forEach(sym => {
            const qty = parseFloat(state.holdings[sym]) || 0;
            const price = state.livePrices[sym] || 0;
            assetsVal += qty * price;
        });
        return {
            fiat: lifetimeBalance,
            assets: assetsVal,
            total: lifetimeBalance + assetsVal
        };
    }

    function updateNetWorth() {
        const el = PFCC.dom;
        if (!el || !el.netWorthMetric) return;
        const nw = calculateNetWorth();
        el.netWorthMetric.textContent = PFCC.utils.formatCurrency(nw.total);
        if (el.netWorthSub) {
            el.netWorthSub.textContent = `Fiat: ${PFCC.utils.formatCurrency(nw.fiat)} | Assets: ${PFCC.utils.formatCurrency(nw.assets)}`;
        }
        ['PAXG', 'BTC', 'ETH', 'SOL'].forEach(sym => {
            const holdEl = document.getElementById(`holding-val-${sym}`);
            if (holdEl) {
                const qty = parseFloat(PFCC.state.holdings[sym]) || 0;
                const price = PFCC.state.livePrices[sym] || 0;
                holdEl.textContent = qty > 0
                    ? `${qty} ${sym} = ${PFCC.utils.formatCurrency(qty * price)}`
                    : `0 ${sym} held`;
            }
        });
    }

    function updateAssetCard(sym, newPrice, change) {
        const card = document.getElementById(`asset-${sym}`);
        if (!card) return;
        const priceEl = card.querySelector('.asset-price');
        const changeEl = card.querySelector('.asset-change');
        const oldPrice = parseFloat(priceEl.getAttribute('data-price') || '0');

        priceEl.textContent = `$${newPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
        priceEl.setAttribute('data-price', String(newPrice));
        changeEl.textContent = `${change > 0 ? '+' : ''}${change.toFixed(2)}%`;
        changeEl.className = `asset-change ${change >= 0 ? 'text-green' : 'text-red'}`;

        PFCC.state.livePrices[sym] = newPrice;
        PFCC.state.liveChanges[sym] = change;

        if (oldPrice !== 0 && oldPrice !== newPrice) {
            card.classList.add(newPrice > oldPrice ? 'flash-up' : 'flash-down');
            setTimeout(() => card.classList.remove('flash-up', 'flash-down'), 400);
        }
        updateNetWorth();
    }

    function setMarketStatus(status, titleText) {
        const badge = PFCC.dom && PFCC.dom.marketStatusBadge;
        if (!badge) return;
        badge.className = `status-badge status-${status.toLowerCase()}`;
        badge.textContent = '';
        badge.appendChild(PFCC.utils.createEl('span', 'status-dot'));
        badge.appendChild(PFCC.utils.createEl('span', '', status));
        if (titleText) badge.title = titleText;
    }

    function fetchWithTimeout(url) {
        if (typeof global.fetch !== 'function') {
            return Promise.reject(new Error('Fetch API unavailable'));
        }
        if (typeof global.AbortController !== 'undefined') {
            const controller = new global.AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            return global.fetch(url, { signal: controller.signal }).then(res => {
                clearTimeout(timeoutId);
                return res;
            }, err => {
                clearTimeout(timeoutId);
                throw err;
            });
        }
        // Fallback timeout race for Android 7.0 / Chromium 51-65 without AbortController
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => reject(new Error('Request timed out')), 5000);
            global.fetch(url).then(res => {
                clearTimeout(timer);
                resolve(res);
            }, err => {
                clearTimeout(timer);
                reject(err);
            });
        });
    }

    function fetchJsonOk(url) {
        return fetchWithTimeout(url).then(res => {
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            return res.json();
        });
    }

    function tryCoinLore() {
        return fetchJsonOk('https://api.coinlore.net/api/ticker/?id=90,80,48543,42227').then(data => {
            const map = { '90': 'BTC', '80': 'ETH', '48543': 'SOL', '42227': 'PAXG' };
            data.forEach(item => {
                const sym = map[item.id] || item.symbol;
                if (sym && item.price_usd !== undefined) {
                    updateAssetCard(sym, parseFloat(item.price_usd), parseFloat(item.percent_change_24h) || 0);
                }
            });
            return 'CoinLore API';
        });
    }

    function tryBinanceVision() {
        return fetchJsonOk('https://data-api.binance.vision/api/v3/ticker/24hr?symbols=%5B%22BTCUSDT%22,%22ETHUSDT%22,%22PAXGUSDT%22,%22SOLUSDT%22%5D').then(data => {
            const assets = { BTCUSDT: 'BTC', ETHUSDT: 'ETH', PAXGUSDT: 'PAXG', SOLUSDT: 'SOL' };
            data.forEach(item => {
                const sym = assets[item.symbol];
                if (sym) {
                    updateAssetCard(sym, parseFloat(item.lastPrice), parseFloat(item.priceChangePercent) || 0);
                }
            });
            return 'Binance Vision';
        });
    }

    function tryGateIo() {
        return fetchJsonOk('https://api.gateio.ws/api/v4/spot/tickers').then(data => {
            const assets = { BTC_USDT: 'BTC', ETH_USDT: 'ETH', SOL_USDT: 'SOL', PAXG_USDT: 'PAXG' };
            data.forEach(item => {
                const sym = assets[item.currency_pair];
                if (sym && item.last !== undefined) {
                    updateAssetCard(sym, parseFloat(item.last), parseFloat(item.change_percentage) || 0);
                }
            });
            return 'Gate.io Spot';
        });
    }

    function tryCoinGecko() {
        return fetchJsonOk('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,pax-gold,solana&vs_currencies=usd&include_24hr_change=true').then(data => {
            const paxg = data && data['pax-gold'];
            const btc = data && data.bitcoin;
            const eth = data && data.ethereum;
            const sol = data && data.solana;
            const mapping = {
                PAXG: { price: paxg ? paxg.usd : undefined, change: paxg ? paxg.usd_24h_change : 0 },
                BTC: { price: btc ? btc.usd : undefined, change: btc ? btc.usd_24h_change : 0 },
                ETH: { price: eth ? eth.usd : undefined, change: eth ? eth.usd_24h_change : 0 },
                SOL: { price: sol ? sol.usd : undefined, change: sol ? sol.usd_24h_change : 0 }
            };
            Object.keys(mapping).forEach(sym => {
                const item = mapping[sym];
                if (item && item.price !== undefined) {
                    updateAssetCard(sym, item.price, item.change || 0);
                }
            });
            return 'CoinGecko';
        });
    }

    function fetchLivePrices() {
        const el = PFCC.dom;
        if (el.btnSync) {
            el.btnSync.classList.add('is-loading');
            el.btnSync.disabled = true;
        }
        setMarketStatus('SYNCING', 'Fetching live market rates...');

        return tryCoinLore()
            .catch(tryBinanceVision)
            .catch(tryGateIo)
            .catch(tryCoinGecko)
            .then(activeSource => {
                const payload = {
                    prices: PFCC.state.livePrices,
                    changes: PFCC.state.liveChanges,
                    timestamp: Date.now(),
                    source: activeSource
                };
                PFCC.state.cachedMarket = payload;
                PFCC.utils.safeSaveJSON('appCachedPrices', payload);
                setMarketStatus('LIVE', `Connected to ${activeSource} at ${new Date().toLocaleTimeString()}`);
            })
            .catch(() => {
                const cached = PFCC.state.cachedMarket;
                const hasCached = cached && cached.timestamp;
                setMarketStatus(
                    hasCached ? 'CACHED' : 'OFFLINE',
                    hasCached
                        ? `Network offline. Showing cached rates from ${new Date(cached.timestamp).toLocaleTimeString()}.`
                        : 'All market sources unreachable. Showing baseline rates.'
                );
                ['PAXG', 'BTC', 'ETH', 'SOL'].forEach(sym => {
                    if (PFCC.state.livePrices[sym]) {
                        updateAssetCard(sym, PFCC.state.livePrices[sym], PFCC.state.liveChanges[sym] || 0);
                    }
                });
            })
            .then(() => {
                if (el.btnSync) {
                    setTimeout(() => {
                        el.btnSync.classList.remove('is-loading');
                        el.btnSync.disabled = false;
                    }, 350);
                }
            });
    }

    function initMarkets() {
        ['PAXG', 'BTC', 'ETH', 'SOL'].forEach(sym => {
            if (PFCC.state.livePrices[sym]) {
                updateAssetCard(sym, PFCC.state.livePrices[sym], PFCC.state.liveChanges[sym] || 0);
            }
        });
        if (PFCC.dom.btnSync) {
            PFCC.dom.btnSync.addEventListener('click', () => {
                PFCC.audio.playClickSound();
                fetchLivePrices();
            });
        }
        fetchLivePrices();
        setInterval(fetchLivePrices, 30000);
    }

    PFCC.markets = {
        calculateNetWorth,
        updateNetWorth,
        updateAssetCard,
        fetchLivePrices,
        initMarkets
    };
})(window);
