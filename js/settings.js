(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function applyVisualThemeTokens(presetKey, font, radius, animSpeed) {
        const theme = PFCC.themes.OS_THEMES[PFCC.themes.resolveThemeKey(presetKey)] || PFCC.themes.OS_THEMES.obsidian;
        const glass = PFCC.themes.computeLiquidGlassTokens(theme);

        document.documentElement.setAttribute('data-theme-mode', theme.mode);

        const docStyle = document.documentElement.style;
        docStyle.setProperty('--bg-main', theme.bgMain);
        docStyle.setProperty('--bg-surface', theme.bgSurface);
        docStyle.setProperty('--bg-surface-hover', theme.bgHover);
        docStyle.setProperty('--border-color', theme.border);
        docStyle.setProperty('--text-primary', theme.textMain);
        docStyle.setProperty('--text-secondary', theme.textSec);
        docStyle.setProperty('--accent-fill', theme.accentFill);
        docStyle.setProperty('--accent-text', theme.accentText);
        docStyle.setProperty('--accent-contrast', theme.accentContrast);
        docStyle.setProperty('--color-green', theme.colorGreen);
        docStyle.setProperty('--color-red', theme.colorRed);
        docStyle.setProperty('--color-warn', theme.colorWarn);
        docStyle.setProperty('--font-primary', PFCC.themes.normalizeFont(font));
        docStyle.setProperty('--ui-radius', PFCC.themes.normalizeRadius(radius));
        docStyle.setProperty('--anim-speed', animSpeed || '0.16s');

        docStyle.setProperty('--glass-surface', glass.bgSurface);
        docStyle.setProperty('--glass-elevated', glass.bgElevated);
        docStyle.setProperty('--glass-header', glass.bgHeader);
        docStyle.setProperty('--glass-control', glass.bgControl);
        docStyle.setProperty('--glass-border', glass.borderSubtle);
        docStyle.setProperty('--glass-border-accent', glass.borderAccent);
        docStyle.setProperty('--glass-specular', glass.specular);
        docStyle.setProperty('--glass-sheen', glass.sheen);
        docStyle.setProperty('--glass-sheen-soft', glass.sheenSoft);
        docStyle.setProperty('--glass-pill-bg', glass.pillBg);
        docStyle.setProperty('--glass-pill-edge', glass.pillEdge);
        docStyle.setProperty('--glass-shadow-card', glass.shadowCard);
        docStyle.setProperty('--glass-shadow-float', glass.shadowFloat);
    }

    function applySettings() {
        const el = PFCC.dom;
        const settings = PFCC.state.settings;

        if (el.displayName) el.displayName.textContent = settings.name;
        applyVisualThemeTokens(settings.preset, settings.font, settings.radius, settings.animSpeed);

        const langDict = PFCC.i18n[settings.language] || PFCC.i18n.en;
        PFCC.compat.qsa('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (langDict[key]) {
                if (element.tagName === 'INPUT' && element.hasAttribute('placeholder')) {
                    element.placeholder = langDict[key];
                } else {
                    element.textContent = langDict[key];
                }
            }
        });

        if (PFCC.picker && typeof PFCC.picker.syncAll === 'function') {
            PFCC.picker.syncAll();
        }
        if (PFCC.liquid && typeof PFCC.liquid.syncAll === 'function') {
            PFCC.liquid.syncAll();
        }
    }

    function togglePrivacyMode() {
        PFCC.state.isPrivacyActive = !PFCC.state.isPrivacyActive;
        const active = PFCC.state.isPrivacyActive;
        document.body.classList.toggle('privacy-active', active);

        const btn = PFCC.dom.btnTogglePrivacy;
        if (btn) {
            btn.textContent = '';
            btn.appendChild(PFCC.icons.create(active ? 'lock' : 'eye', 15));
            btn.appendChild(PFCC.utils.createEl('span', '', active ? 'Private' : 'Privacy'));
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        }
        PFCC.audio.playSwooshSound();
    }

    function renderRules() {
        const el = PFCC.dom;
        if (!el.rulesList) return;
        el.rulesList.textContent = '';

        if (PFCC.state.autoRules.length === 0) {
            const emptyLi = PFCC.utils.createEl('li', 'rule-item rule-empty', 'No rules defined. Add a keyword or amount rule above.');
            el.rulesList.appendChild(emptyLi);
            return;
        }

        PFCC.state.autoRules.forEach(rule => {
            const li = PFCC.utils.createEl('li', 'rule-item');
            const conditions = [];
            if (rule.keywords && rule.keywords.length > 0) conditions.push('Contains: ' + rule.keywords.join(', '));
            if (rule.amountThreshold) conditions.push('Amount >= ' + PFCC.utils.formatCurrency(rule.amountThreshold));

            const actions = [];
            if (rule.assignCategory) actions.push('Category: ' + rule.assignCategory);
            if (rule.assignTags && rule.assignTags.length > 0) actions.push(rule.assignTags.join(' '));

            const textWrap = PFCC.utils.createEl('div', 'rule-summary');
            textWrap.appendChild(PFCC.utils.createEl('span', 'rule-condition', conditions.join(' OR ')));
            textWrap.appendChild(PFCC.utils.createEl('span', 'rule-action', actions.join(' | ')));

            const delBtn = PFCC.utils.createEl('button', 'action-icon-btn delete');
            delBtn.type = 'button';
            delBtn.style.opacity = '1';
            delBtn.setAttribute('aria-label', 'Delete rule');
            delBtn.appendChild(PFCC.icons.create('close', 14));
            delBtn.addEventListener('click', () => {
                PFCC.state.autoRules = PFCC.state.autoRules.filter(r => r.id !== rule.id);
                PFCC.utils.safeSaveJSON('appAutoRules', PFCC.state.autoRules);
                renderRules();
                PFCC.audio.playWarningSound();
            });

            li.appendChild(textWrap);
            li.appendChild(delBtn);
            el.rulesList.appendChild(li);
        });
    }

    function updateLockStatusUI() {
        const el = PFCC.dom;
        const locked = !!(PFCC.state && PFCC.state.lockHash);
        if (el.lockStatusText) {
            el.lockStatusText.textContent = locked
                ? 'App Lock PIN is enabled on startup.'
                : 'No PIN configured (open access).';
        }
        if (el.btnClearPin) {
            el.btnClearPin.style.display = locked ? '' : 'none';
        }
        if (el.btnLockNow) {
            el.btnLockNow.style.display = locked ? '' : 'none';
        }
    }

    function renderCustomCategories() {
        const el = PFCC.dom;
        if (!el.customCatList) return;
        el.customCatList.textContent = '';

        const defaults = PFCC.utils.DEFAULT_CATEGORIES || ['Housing', 'Software', 'Food', 'Transport', 'Investments', 'Salary', 'Other'];
        const allCats = PFCC.utils.getAllCategories();
        const customCats = allCats.filter(c => defaults.indexOf(c) === -1);
        const budgets = (PFCC.state.settings && PFCC.state.settings.categoryBudgets) || {};

        if (customCats.length === 0) {
            const emptyLi = PFCC.utils.createEl('li', 'rule-item rule-empty', 'No custom categories yet. Add one above to organize expenses & caps.');
            el.customCatList.appendChild(emptyLi);
            return;
        }

        customCats.forEach(cat => {
            const li = PFCC.utils.createEl('li', 'rule-item');
            const summary = PFCC.utils.createEl('div', 'rule-summary');
            summary.appendChild(PFCC.utils.createEl('span', 'rule-condition', cat));
            const cap = Number(budgets[cat]) || 0;
            summary.appendChild(PFCC.utils.createEl('span', 'rule-action', cap > 0 ? 'Cap: ' + PFCC.utils.formatCurrency(cap) : 'No monthly cap'));

            const delBtn = PFCC.utils.createEl('button', 'action-icon-btn delete');
            delBtn.type = 'button';
            delBtn.style.opacity = '1';
            delBtn.setAttribute('aria-label', 'Remove category ' + cat);
            delBtn.appendChild(PFCC.icons.create('close', 14));
            delBtn.addEventListener('click', () => {
                PFCC.state.categories = PFCC.utils.getAllCategories().filter(c => c !== cat);
                PFCC.utils.safeSaveJSON('appCategories', PFCC.state.categories);
                if (PFCC.state.settings && PFCC.state.settings.categoryBudgets) {
                    delete PFCC.state.settings.categoryBudgets[cat];
                    PFCC.utils.safeSaveJSON('appSettings', PFCC.state.settings);
                }
                PFCC.utils.syncCategorySelects();
                renderCustomCategories();
                PFCC.updateDOM();
                PFCC.audio.playWarningSound();
                PFCC.showToast('Removed category "' + cat + '"', 'info');
            });

            li.appendChild(summary);
            li.appendChild(delBtn);
            el.customCatList.appendChild(li);
        });
    }

    function updateStorageMeterUI() {
        const el = PFCC.dom;
        if (!PFCC.security || typeof PFCC.security.getStorageStats !== 'function') return;
        const stats = PFCC.security.getStorageStats();

        if (el.storageQuotaBar) {
            const barWidth = Math.max(2, Math.min(100, Math.round(stats.pct)));
            el.storageQuotaBar.style.width = barWidth + '%';
            el.storageQuotaBar.classList.toggle('warn', stats.pct >= 65 && stats.pct < 85);
            el.storageQuotaBar.classList.toggle('danger', stats.pct >= 85);
        }
        if (el.storageQuotaText) {
            el.storageQuotaText.textContent = stats.totalKB + ' KB / ' + stats.quotaKB + ' KB used (' + stats.pct.toFixed(1) + '%) - Receipts: ' + stats.receiptKB + ' KB';
        }
        if (el.backupHealthBadge) {
            const last = Number(PFCC.state.lastBackupAt) || 0;
            const daysAgo = last > 0 ? Math.floor((Date.now() - last) / 86400000) : null;
            el.backupHealthBadge.classList.remove('ok', 'warn', 'danger');
            if (!last) {
                el.backupHealthBadge.textContent = 'Backup Health: Never Exported';
                el.backupHealthBadge.classList.add('warn');
            } else if (daysAgo > 30) {
                el.backupHealthBadge.textContent = 'Backup Health: Overdue (' + daysAgo + 'd ago)';
                el.backupHealthBadge.classList.add('danger');
            } else {
                const label = daysAgo === 0 ? 'Today' : (daysAgo + 'd ago');
                el.backupHealthBadge.textContent = 'Backup Health: Protected (' + label + ')';
                el.backupHealthBadge.classList.add('ok');
            }
        }
    }

    function openWrapupModal() {
        const el = PFCC.dom;
        if (!el.wrapupModal) return;
        if (PFCC.charts && typeof PFCC.charts.renderWrapupSnapshot === 'function') {
            PFCC.charts.renderWrapupSnapshot();
        }
        el.wrapupModal.classList.add('active');
        if (PFCC.audio) PFCC.audio.playSwooshSound();
    }

    function closeWrapupModal() {
        const el = PFCC.dom;
        if (el.wrapupModal) el.wrapupModal.classList.remove('active');
    }

    function openSettings() {
        const el = PFCC.dom;
        const s = PFCC.state.settings;
        PFCC.state.lastFocusedElement = document.activeElement;

        el.setName.value = s.name;
        el.setLanguage.value = s.language;
        el.setBudget.value = s.budget;
        el.setSavingsGoal.value = s.savingsGoal || 500;
        if (el.setAutoPostSubs) el.setAutoPostSubs.checked = Boolean(s.autoPostSubs);
        el.setCurrency.value = s.currency;
        el.setAnimSpeed.value = s.animSpeed || '0.16s';
        el.setPresetTheme.value = PFCC.themes.resolveThemeKey(s.preset);
        el.setFont.value = PFCC.themes.normalizeFont(s.font);
        el.setRadius.value = PFCC.themes.normalizeRadius(s.radius);
        if (el.setSoundEnabled) el.setSoundEnabled.checked = PFCC.state.soundEnabled;
        if (el.setLiveMarketsEnabled) el.setLiveMarketsEnabled.checked = PFCC.state.liveMarketsEnabled;

        if (s.categoryBudgets) {
            if (el.budgetCatSoftware) el.budgetCatSoftware.value = s.categoryBudgets.Software || '';
            if (el.budgetCatFood) el.budgetCatFood.value = s.categoryBudgets.Food || '';
            if (el.budgetCatHousing) el.budgetCatHousing.value = s.categoryBudgets.Housing || '';
            if (el.budgetCatTransport) el.budgetCatTransport.value = s.categoryBudgets.Transport || '';
        }

        if (el.holdingBtc) el.holdingBtc.value = PFCC.state.holdings.BTC || '';
        if (el.holdingEth) el.holdingEth.value = PFCC.state.holdings.ETH || '';
        if (el.holdingSol) el.holdingSol.value = PFCC.state.holdings.SOL || '';
        if (el.holdingPaxg) el.holdingPaxg.value = PFCC.state.holdings.PAXG || '';

        renderRules();
        renderCustomCategories();
        updateLockStatusUI();
        updateStorageMeterUI();
        if (el.setLockPin) el.setLockPin.value = '';
        if (PFCC.picker && typeof PFCC.picker.syncAll === 'function') {
            PFCC.picker.syncAll();
        }
        el.modal.classList.add('active');
        PFCC.audio.playSwooshSound();
        setTimeout(() => {
            if (PFCC.liquid && typeof PFCC.liquid.syncContainer === 'function') {
                const tabsWrap = el.modal ? el.modal.querySelector('.settings-tabs') : null;
                if (tabsWrap) PFCC.liquid.syncContainer(tabsWrap, false);
            }
            const dialogPanel = el.modal ? el.modal.querySelector('.modal-content') : null;
            if (dialogPanel) {
                dialogPanel.setAttribute('tabindex', '-1');
                dialogPanel.focus({ preventScroll: true });
            } else if (el.btnCloseSettings) {
                el.btnCloseSettings.focus();
            }
        }, 40);
    }

    function closeSettings() {
        const el = PFCC.dom;
        if (el.modal) el.modal.classList.remove('active');
        const s = PFCC.state.settings;
        applyVisualThemeTokens(s.preset, s.font, s.radius, s.animSpeed);
        if (PFCC.state.lastFocusedElement && typeof PFCC.state.lastFocusedElement.focus === 'function') {
            PFCC.state.lastFocusedElement.focus();
        }
    }

    function saveSettings() {
        const el = PFCC.dom;
        const s = PFCC.state.settings || {};
        const rawPin = el.setLockPin ? el.setLockPin.value.trim() : '';
        if (rawPin && rawPin.length < 4) {
            PFCC.audio.playWarningSound();
            PFCC.showToast('App Lock PIN must be at least 4 characters.', 'warning');
            return;
        }
        const selectedThemeKey = PFCC.themes.resolveThemeKey(el.setPresetTheme.value);

        PFCC.state.settings = {
            name: el.setName.value.trim() || 'User',
            budget: parseFloat(el.setBudget.value) || 0,
            savingsGoal: parseFloat(el.setSavingsGoal.value) || 0,
            autoPostSubs: el.setAutoPostSubs ? Boolean(el.setAutoPostSubs.checked) : Boolean(s.autoPostSubs),
            currency: el.setCurrency.value,
            language: el.setLanguage.value,
            animSpeed: el.setAnimSpeed.value,
            preset: selectedThemeKey,
            font: PFCC.themes.normalizeFont(el.setFont.value),
            radius: PFCC.themes.normalizeRadius(el.setRadius.value),
            categoryBudgets: Object.assign({}, (s.categoryBudgets || {}), {
                Software: parseFloat(el.budgetCatSoftware ? el.budgetCatSoftware.value : 0) || 0,
                Food: parseFloat(el.budgetCatFood ? el.budgetCatFood.value : 0) || 0,
                Housing: parseFloat(el.budgetCatHousing ? el.budgetCatHousing.value : 0) || 0,
                Transport: parseFloat(el.budgetCatTransport ? el.budgetCatTransport.value : 0) || 0
            })
        };

        if (el.holdingBtc) PFCC.state.holdings.BTC = parseFloat(el.holdingBtc.value) || 0;
        if (el.holdingEth) PFCC.state.holdings.ETH = parseFloat(el.holdingEth.value) || 0;
        if (el.holdingSol) PFCC.state.holdings.SOL = parseFloat(el.holdingSol.value) || 0;
        if (el.holdingPaxg) PFCC.state.holdings.PAXG = parseFloat(el.holdingPaxg.value) || 0;
        PFCC.utils.safeSaveJSON('appHoldings', PFCC.state.holdings);

        if (el.setSoundEnabled) {
            PFCC.state.soundEnabled = el.setSoundEnabled.checked;
            PFCC.utils.safeSaveJSON('appSoundEnabled', PFCC.state.soundEnabled);
            PFCC.audio.updateSoundButton();
        }

        if (el.setLiveMarketsEnabled) {
            const wasEnabled = PFCC.state.liveMarketsEnabled;
            PFCC.state.liveMarketsEnabled = el.setLiveMarketsEnabled.checked;
            PFCC.utils.safeSaveJSON('appLiveMarketsEnabled', PFCC.state.liveMarketsEnabled);
            if (!wasEnabled && PFCC.state.liveMarketsEnabled && PFCC.markets) {
                PFCC.markets.fetchLivePrices();
            }
        }

        PFCC.utils.safeSaveJSON('appSettings', PFCC.state.settings);
        if (rawPin && PFCC.security && typeof PFCC.security.hashPin === 'function') {
            PFCC.security.hashPin(rawPin).then(hash => {
                PFCC.state.lockHash = hash;
                PFCC.utils.safeSaveJSON('appLockHash', hash);
                updateLockStatusUI();
            });
            if (el.setLockPin) el.setLockPin.value = '';
        }
        closeSettings();
        applySettings();
        PFCC.markets.updateNetWorth();
        PFCC.updateDOM();
        PFCC.audio.playSuccessSound();
        PFCC.showToast('Configuration saved and applied.', 'success');
    }

    function openShortcutsModal() {
        const el = PFCC.dom;
        if (!el.shortcutsModal) return;
        PFCC.state.lastFocusedElement = document.activeElement;
        el.shortcutsModal.classList.add('active');
        PFCC.audio.playSwooshSound();
        setTimeout(() => { if (el.btnCloseShortcuts) el.btnCloseShortcuts.focus(); }, 40);
    }

    function closeShortcutsModal() {
        const el = PFCC.dom;
        if (el.shortcutsModal) el.shortcutsModal.classList.remove('active');
        if (PFCC.state.lastFocusedElement && typeof PFCC.state.lastFocusedElement.focus === 'function') {
            PFCC.state.lastFocusedElement.focus();
        }
    }

    function sanitizeStringArray(val) {
        if (!Array.isArray(val)) return [];
        return val.map(x => String(x || '').trim()).filter(Boolean);
    }

    function sanitizeRestoredPayload(imported) {
        const result = {};
        if (Array.isArray(imported)) {
            imported = { transactions: imported };
        } else if (!imported || typeof imported !== 'object') {
            throw new Error('Unsupported format');
        }

        const isObj = x => Boolean(x && typeof x === 'object' && !Array.isArray(x));
        if (Array.isArray(imported.transactions)) {
            result.transactions = imported.transactions.filter(isObj).map((t, i) => {
                const isXfer = Boolean(t.isTransfer);
                const xferAmt = isXfer
                    ? Math.max(0, Number(t.transferAmount !== undefined ? t.transferAmount : Math.abs(Number(t.amount) || 0)) || 0)
                    : 0;
                const cleanTx = {
                    id: String(t.id || ('tx-' + Date.now() + '-' + i)),
                    text: String(t.text || '').trim(),
                    amount: isXfer ? 0 : (Number(t.amount) || 0),
                    category: String(t.category || 'Other'),
                    date: String(t.date || PFCC.utils.getLocalDateString()),
                    tags: sanitizeStringArray(t.tags),
                    receipt: PFCC.utils.sanitizeReceiptUrl(t.receipt) || null
                };
                if (isXfer) {
                    cleanTx.isTransfer = true;
                    cleanTx.transferAmount = xferAmt;
                    if (t.toAccount) cleanTx.toAccount = String(t.toAccount);
                }
                if (t.account) cleanTx.account = String(t.account);
                return cleanTx;
            });
        }
        if (Array.isArray(imported.subscriptions)) {
            result.subscriptions = imported.subscriptions.filter(isObj).map((sub, i) => {
                const day = Number(sub.billingDay);
                const cleanSub = {
                    id: String(sub.id || ('sub-' + Date.now() + '-' + i)),
                    name: String(sub.name || 'Subscription'),
                    amount: Math.max(0, Number(sub.amount) || 0),
                    billingCycle: sub.billingCycle === 'yearly' ? 'yearly' : 'monthly',
                    category: String(sub.category || 'Other')
                };
                if (Number.isFinite(day) && day >= 1 && day <= 31) {
                    cleanSub.billingDay = Math.floor(day);
                }
                return cleanSub;
            });
        }
        if (Array.isArray(imported.ious)) {
            result.ious = imported.ious.filter(isObj).map((iou, i) => ({
                id: String(iou.id || ('iou-' + Date.now() + '-' + i)),
                person: String(iou.person || ''),
                amount: Math.max(0, Number(iou.amount) || 0),
                direction: (iou.direction === 'receivable' || iou.type === 'owed') ? 'receivable' : 'payable',
                desc: String(iou.desc || ''),
                settled: Boolean(iou.settled)
            }));
        }
        if (isObj(imported.holdings)) {
            const h = imported.holdings;
            result.holdings = {
                BTC: Math.max(0, Number(h.BTC !== undefined ? h.BTC : h.btc) || 0),
                ETH: Math.max(0, Number(h.ETH !== undefined ? h.ETH : h.eth) || 0),
                SOL: Math.max(0, Number(h.SOL !== undefined ? h.SOL : h.sol) || 0),
                PAXG: Math.max(0, Number(h.PAXG !== undefined ? h.PAXG : h.paxg) || 0)
            };
        }
        if (typeof imported.soundEnabled === 'boolean') {
            result.soundEnabled = imported.soundEnabled;
        }
        if (Array.isArray(imported.savingsVaults)) {
            result.savingsVaults = imported.savingsVaults.filter(isObj).map((v, i) => ({
                id: String(v.id || ('vault-' + Date.now() + '-' + i)),
                name: String(v.name || 'Vault'),
                target: Math.max(0, Number(v.target) || 0),
                saved: Math.max(0, Number(v.saved) || 0),
                icon: PFCC.icons.normalizeVaultIcon(v.icon)
            }));
        }
        if (Array.isArray(imported.debts)) {
            result.debts = imported.debts.filter(isObj).map((d, i) => {
                const day = Number(d.billingDay);
                const cleanDebt = {
                    id: String(d.id || ('debt-' + Date.now() + '-' + i)),
                    name: String(d.name || 'Debt'),
                    balance: Math.max(0, Number(d.balance) || 0),
                    rate: Math.max(0, Number(d.rate) || 0),
                    minPayment: Math.max(0, Number(d.minPayment) || 0)
                };
                if (Number.isFinite(day) && day >= 1 && day <= 31) {
                    cleanDebt.billingDay = Math.floor(day);
                }
                return cleanDebt;
            });
        }
        if (Array.isArray(imported.categories)) {
            const cleanedCats = sanitizeStringArray(imported.categories);
            if (cleanedCats.length > 0) result.categories = cleanedCats;
        }
        if (Array.isArray(imported.accounts)) {
            const cleanedAccounts = sanitizeStringArray(imported.accounts);
            if (cleanedAccounts.length > 0) result.accounts = cleanedAccounts;
        }
        if (Array.isArray(imported.quickPresets)) {
            result.quickPresets = imported.quickPresets.filter(isObj).map((p, i) => ({
                id: String(p.id || ('preset-' + Date.now() + '-' + i)),
                label: String(p.label || p.text || 'Preset').trim(),
                text: String(p.text || p.label || 'Entry').trim(),
                amount: Math.max(0, Number(p.amount) || 0),
                type: (p.type === 'income' || p.type === 'transfer') ? p.type : 'expense',
                category: String(p.category || 'Other'),
                tags: sanitizeStringArray(p.tags)
            }));
        }
        if (Array.isArray(imported.autoRules)) {
            result.autoRules = imported.autoRules.filter(isObj).map((r, i) => ({
                id: String(r.id || ('rule-' + Date.now() + '-' + i)),
                keywords: sanitizeStringArray(r.keywords),
                amountThreshold: Number(r.amountThreshold) || 0,
                assignCategory: String(r.assignCategory || ''),
                assignTags: sanitizeStringArray(r.assignTags)
            }));
        }
        if (isObj(imported.settings)) {
            const st = imported.settings;
            const mergedPreset = PFCC.themes.resolveThemeKey(st.preset);
            result.settings = Object.assign({}, st, {
                preset: mergedPreset,
                font: PFCC.themes.normalizeFont(st.font),
                radius: PFCC.themes.normalizeRadius(st.radius)
            });
        }
        return result;
    }

    function initSettings() {
        const el = PFCC.dom;

        if (el.btnToggleSound) el.btnToggleSound.addEventListener('click', PFCC.audio.toggleSound);
        if (el.btnTogglePrivacy) el.btnTogglePrivacy.addEventListener('click', togglePrivacyMode);
        if (el.btnSettings) el.btnSettings.addEventListener('click', openSettings);
        if (el.btnCloseSettings) el.btnCloseSettings.addEventListener('click', closeSettings);
        if (el.btnSaveSettings) el.btnSaveSettings.addEventListener('click', saveSettings);
        if (el.btnShortcuts) el.btnShortcuts.addEventListener('click', openShortcutsModal);
        if (el.btnCloseShortcuts) el.btnCloseShortcuts.addEventListener('click', closeShortcutsModal);
        if (el.btnDismissShortcuts) el.btnDismissShortcuts.addEventListener('click', closeShortcutsModal);

        if (el.btnPrint) {
            el.btnPrint.addEventListener('click', () => {
                PFCC.audio.playClickSound();
                if (typeof global.print === 'function') {
                    global.print();
                } else {
                    PFCC.showToast('Print dialog is unavailable in this WebView. Use CSV or JSON export.', 'info');
                }
            });
        }

        const androidUpdateSection = document.getElementById('android-update-section');
        const androidBuildLabel = document.getElementById('android-build-label');
        const btnCheckAndroidUpdate = document.getElementById('btn-check-android-update');
        if (androidUpdateSection && global.AndroidBridge && typeof global.AndroidBridge.checkForUpdates === 'function') {
            const selfUpdateSupported = typeof global.AndroidBridge.isSelfUpdateEnabled !== 'function' || global.AndroidBridge.isSelfUpdateEnabled();
            if (selfUpdateSupported) {
                androidUpdateSection.style.display = 'block';
                if (androidBuildLabel && typeof global.AndroidBridge.getAppBuild === 'function') {
                    androidBuildLabel.value = String(global.AndroidBridge.getAppBuild());
                }
                if (btnCheckAndroidUpdate) {
                    btnCheckAndroidUpdate.addEventListener('click', () => {
                        PFCC.audio.playClickSound();
                        PFCC.showToast('Checking GitHub releases for APK update...', 'info');
                        global.AndroidBridge.checkForUpdates(true);
                    });
                }
            }
        }

        function triggerThemePreview() {
            applyVisualThemeTokens(
                el.setPresetTheme ? el.setPresetTheme.value : PFCC.state.settings.preset,
                el.setFont ? el.setFont.value : PFCC.state.settings.font,
                el.setRadius ? el.setRadius.value : PFCC.state.settings.radius,
                el.setAnimSpeed ? el.setAnimSpeed.value : PFCC.state.settings.animSpeed
            );
            if (PFCC.liquid && typeof PFCC.liquid.syncAll === 'function') {
                PFCC.liquid.syncAll();
            }
        }

        if (el.setPresetTheme) {
            el.setPresetTheme.addEventListener('change', e => {
                const theme = PFCC.themes.OS_THEMES[e.target.value];
                if (theme) {
                    el.setFont.value = theme.font;
                    el.setRadius.value = theme.radius;
                    if (PFCC.picker && typeof PFCC.picker.syncSelect === 'function') {
                        PFCC.picker.syncSelect(el.setFont);
                        PFCC.picker.syncSelect(el.setRadius);
                    }
                    PFCC.audio.playSwooshSound();
                }
                triggerThemePreview();
            });
        }

        [el.setFont, el.setRadius, el.setAnimSpeed].forEach(ctrl => {
            if (!ctrl) return;
            ctrl.addEventListener('change', () => {
                triggerThemePreview();
            });
        });

        const settingsTabBtns = PFCC.compat.qsa('.tab-btn');
        settingsTabBtns.forEach((btn, nextIdx) => {
            btn.addEventListener('click', e => {
                const currentBtn = e.currentTarget;
                if (currentBtn.classList.contains('active')) return;
                PFCC.audio.playClickSound();
                const prevIdx = settingsTabBtns.findIndex(b => b.classList.contains('active'));
                settingsTabBtns.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                PFCC.compat.qsa('.tab-content').forEach(c => {
                    c.classList.remove('active', 'liquid-enter-next', 'liquid-enter-prev');
                });
                currentBtn.classList.add('active');
                currentBtn.setAttribute('aria-selected', 'true');
                const targetTab = document.getElementById(`tab-${currentBtn.dataset.tab}`);
                if (targetTab) {
                    targetTab.classList.add('active');
                    if (prevIdx !== -1) {
                        targetTab.classList.add(nextIdx >= prevIdx ? 'liquid-enter-next' : 'liquid-enter-prev');
                    }
                }
                if (PFCC.liquid && typeof PFCC.liquid.syncContainer === 'function') {
                    PFCC.liquid.syncContainer(currentBtn.parentNode, true);
                }
            });
        });

        if (el.btnAddRule) {
            el.btnAddRule.addEventListener('click', () => {
                const keywords = (el.ruleKeywords.value || '').split(',').map(s => s.trim()).filter(Boolean);
                const threshold = parseFloat(el.ruleAmountThreshold.value) || null;
                const cat = el.ruleAssignCategory.value;
                const tags = (el.ruleAssignTags.value || '').split(/\s+/).filter(t => t.startsWith('#'));

                if (keywords.length === 0 && !threshold) {
                    PFCC.audio.playWarningSound();
                    PFCC.showToast('Specify at least one keyword or an amount threshold.', 'error');
                    return;
                }
                if (!cat && tags.length === 0) {
                    PFCC.audio.playWarningSound();
                    PFCC.showToast('Specify a category or at least one #tag to assign.', 'error');
                    return;
                }

                PFCC.state.autoRules.push({
                    id: 'rule-' + Math.floor(Math.random() * 1000000),
                    keywords,
                    amountThreshold: threshold,
                    assignCategory: cat,
                    assignTags: tags
                });
                PFCC.utils.safeSaveJSON('appAutoRules', PFCC.state.autoRules);
                el.ruleKeywords.value = '';
                el.ruleAmountThreshold.value = '';
                el.ruleAssignCategory.value = '';
                el.ruleAssignTags.value = '';
                if (PFCC.picker && typeof PFCC.picker.syncSelect === 'function') {
                    PFCC.picker.syncSelect(el.ruleAssignCategory);
                }
                renderRules();
                PFCC.audio.playSuccessSound();
            });
        }

        if (el.btnBackup) {
            el.btnBackup.addEventListener('click', () => {
                PFCC.audio.playClickSound();
                const s = PFCC.state;
                const payload = {
                    app: 'EXT',
                    exportedAt: new Date().toISOString(),
                    transactions: s.transactions,
                    subscriptions: s.subscriptions,
                    ious: s.ious,
                    holdings: s.holdings,
                    soundEnabled: s.soundEnabled,
                    savingsVaults: s.savingsVaults,
                    debts: s.debts,
                    autoRules: s.autoRules,
                    categories: s.categories,
                    accounts: s.accounts,
                    quickPresets: s.quickPresets,
                    settings: s.settings
                };
                const jsonText = JSON.stringify(payload, null, 2);
                const passphrase = el.backupPassphrase ? el.backupPassphrase.value.trim() : '';
                const dateStamp = PFCC.utils.getLocalDateString();

                const markBackupSaved = () => {
                    s.lastBackupAt = Date.now();
                    PFCC.utils.safeSaveJSON('appLastBackupAt', s.lastBackupAt);
                    updateStorageMeterUI();
                };

                if (passphrase) {
                    if (passphrase.length < 4) {
                        PFCC.audio.playWarningSound();
                        PFCC.showToast('Use at least 4 characters for backup passphrase.', 'warning');
                        return;
                    }
                    if (!PFCC.security || typeof PFCC.security.encryptBackupJson !== 'function') {
                        PFCC.showToast('Encryption module unavailable.', 'error');
                        return;
                    }
                    PFCC.security.encryptBackupJson(jsonText, passphrase).then(encJson => {
                        PFCC.utils.downloadTextFile(
                            `ext_encrypted_backup_${dateStamp}.json`,
                            encJson,
                            'application/json;charset=utf-8'
                        );
                        markBackupSaved();
                        if (el.backupPassphrase) el.backupPassphrase.value = '';
                        PFCC.audio.playSuccessSound();
                        PFCC.showToast('AES-256 encrypted JSON backup downloaded.', 'success');
                    }).catch(err => {
                        PFCC.audio.playWarningSound();
                        PFCC.showToast((err && err.message) || 'Backup encryption failed.', 'error');
                    });
                    return;
                }

                PFCC.utils.downloadTextFile(
                    `ext_backup_${dateStamp}.json`,
                    jsonText,
                    'application/json;charset=utf-8'
                );
                markBackupSaved();
                PFCC.showToast('JSON backup downloaded.', 'success');
            });
        }

        if (el.btnRestore) {
            const applyRestoredObject = (imported) => {
                const cleaned = sanitizeRestoredPayload(imported);
                const s = PFCC.state;
                if (cleaned.transactions) s.transactions = cleaned.transactions;
                if (cleaned.subscriptions) s.subscriptions = cleaned.subscriptions;
                if (cleaned.ious) s.ious = cleaned.ious;
                if (cleaned.holdings) s.holdings = Object.assign(s.holdings, cleaned.holdings);
                if (typeof cleaned.soundEnabled === 'boolean') s.soundEnabled = cleaned.soundEnabled;
                if (cleaned.savingsVaults) s.savingsVaults = cleaned.savingsVaults;
                if (cleaned.debts) s.debts = cleaned.debts;
                if (cleaned.autoRules) s.autoRules = cleaned.autoRules;
                if (cleaned.categories) s.categories = cleaned.categories;
                if (cleaned.accounts) s.accounts = cleaned.accounts;
                if (cleaned.quickPresets) s.quickPresets = cleaned.quickPresets;
                if (cleaned.settings) s.settings = Object.assign(s.settings, cleaned.settings);

                PFCC.utils.safeSaveJSON('appTransactions', s.transactions);
                PFCC.utils.safeSaveJSON('appSubscriptions', s.subscriptions);
                PFCC.utils.safeSaveJSON('appIous', s.ious);
                PFCC.utils.safeSaveJSON('appHoldings', s.holdings);
                PFCC.utils.safeSaveJSON('appSoundEnabled', s.soundEnabled);
                PFCC.utils.safeSaveJSON('appSavingsVaults', s.savingsVaults);
                PFCC.utils.safeSaveJSON('appDebts', s.debts);
                PFCC.utils.safeSaveJSON('appAutoRules', s.autoRules);
                PFCC.utils.safeSaveJSON('appCategories', s.categories);
                PFCC.utils.safeSaveJSON('appAccounts', s.accounts);
                PFCC.utils.safeSaveJSON('appQuickPresets', s.quickPresets);
                PFCC.utils.safeSaveJSON('appSettings', s.settings);

                PFCC.utils.syncCategorySelects();
                applySettings();
                PFCC.audio.updateSoundButton();
                PFCC.updateDOM();
                renderRules();
                renderCustomCategories();
                updateStorageMeterUI();
                PFCC.audio.playSuccessSound();
                PFCC.showToast('Database restored from JSON backup.', 'success');
            };

            el.btnRestore.addEventListener('change', e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = event => {
                    try {
                        const imported = JSON.parse(event.target.result);
                        if (imported && imported.encrypted === true) {
                            if (!PFCC.security || typeof PFCC.security.decryptBackupPayload !== 'function') {
                                PFCC.showToast('Decryption module unavailable.', 'error');
                            } else {
                                PFCC.openActionDialog({
                                    title: 'Decrypt Encrypted Backup',
                                    message: 'Enter the passphrase used when this AES-256 EXT backup was exported.',
                                    confirmLabel: 'Decrypt & Restore',
                                    inputLabel: 'Backup Passphrase',
                                    inputType: 'password',
                                    inputPlaceholder: 'Enter passphrase',
                                    onConfirm: pass => {
                                        PFCC.security.decryptBackupPayload(imported, pass).then(decrypted => {
                                            try {
                                                applyRestoredObject(decrypted);
                                            } catch (applyErr) {
                                                PFCC.audio.playWarningSound();
                                                PFCC.showToast('Decrypted data was malformed.', 'error');
                                            }
                                        }).catch(() => {
                                            PFCC.audio.playWarningSound();
                                            PFCC.showToast('Decryption failed: wrong passphrase or corrupted file.', 'error');
                                        });
                                    }
                                });
                            }
                        } else {
                            applyRestoredObject(imported);
                        }
                    } catch (err) {
                        PFCC.audio.playWarningSound();
                        PFCC.showToast('Restore failed: invalid JSON backup file.', 'error');
                    }
                    e.target.value = '';
                };
                reader.readAsText(file);
            });
        }

        if (el.btnClearPin) {
            el.btnClearPin.addEventListener('click', () => {
                PFCC.state.lockHash = '';
                PFCC.utils.safeRemoveStorage('appLockHash');
                if (el.setLockPin) el.setLockPin.value = '';
                updateLockStatusUI();
                PFCC.audio.playWarningSound();
                PFCC.showToast('App Lock PIN removed.', 'info');
            });
        }

        if (el.btnAddCustomCat) {
            el.btnAddCustomCat.addEventListener('click', () => {
                const rawName = el.customCatName ? el.customCatName.value.trim() : '';
                if (!rawName) {
                    PFCC.audio.playWarningSound();
                    PFCC.showToast('Enter a category name first.', 'warning');
                    return;
                }
                const cleanName = rawName.replace(/[<>]/g, '').slice(0, 28);
                const existing = PFCC.utils.getAllCategories();
                const duplicate = existing.some(c => c.toLowerCase() === cleanName.toLowerCase());
                if (duplicate) {
                    PFCC.audio.playWarningSound();
                    PFCC.showToast('Category "' + cleanName + '" already exists.', 'warning');
                    return;
                }
                PFCC.state.categories = existing.concat([cleanName]);
                PFCC.utils.safeSaveJSON('appCategories', PFCC.state.categories);

                const limitVal = parseFloat(el.customCatLimit ? el.customCatLimit.value : 0) || 0;
                if (limitVal > 0) {
                    PFCC.state.settings.categoryBudgets = PFCC.state.settings.categoryBudgets || {};
                    PFCC.state.settings.categoryBudgets[cleanName] = limitVal;
                    PFCC.utils.safeSaveJSON('appSettings', PFCC.state.settings);
                }

                if (el.customCatName) el.customCatName.value = '';
                if (el.customCatLimit) el.customCatLimit.value = '';
                PFCC.utils.syncCategorySelects();
                renderCustomCategories();
                PFCC.updateDOM();
                PFCC.audio.playSuccessSound();
                PFCC.showToast('Added custom category "' + cleanName + '"', 'success');
            });
        }

        if (el.btnWrapup) el.btnWrapup.addEventListener('click', openWrapupModal);
        if (el.btnCloseWrapup) el.btnCloseWrapup.addEventListener('click', closeWrapupModal);
        if (el.btnDismissWrapup) el.btnDismissWrapup.addEventListener('click', closeWrapupModal);
        if (el.btnDownloadWrapup) {
            el.btnDownloadWrapup.addEventListener('click', () => {
                if (PFCC.charts && typeof PFCC.charts.downloadWrapupPng === 'function') {
                    PFCC.charts.downloadWrapupPng();
                }
            });
        }
        if (el.btnShareWrapup) {
            el.btnShareWrapup.addEventListener('click', () => {
                if (PFCC.charts && typeof PFCC.charts.shareWrapupPng === 'function') {
                    PFCC.charts.shareWrapupPng();
                }
            });
        }

        if (el.btnWipe) {
            el.btnWipe.addEventListener('click', () => {
                PFCC.audio.playWarningSound();
                PFCC.openActionDialog({
                    title: 'Purge All Local Data',
                    message: 'This permanently deletes all transactions, subscriptions, IOUs, vaults, and debts from local storage.',
                    confirmLabel: 'Purge Everything',
                    danger: true,
                    onConfirm: () => {
                        const s = PFCC.state;
                        s.transactions = [];
                        s.subscriptions = [];
                        s.ious = [];
                        s.savingsVaults = [];
                        s.debts = [];
                        PFCC.utils.safeRemoveStorage('appTransactions');
                        PFCC.utils.safeRemoveStorage('appSubscriptions');
                        PFCC.utils.safeRemoveStorage('appIous');
                        PFCC.utils.safeRemoveStorage('appSavingsVaults');
                        PFCC.utils.safeRemoveStorage('appDebts');
                        PFCC.updateDOM();
                        closeSettings();
                        PFCC.audio.playWarningSound();
                        PFCC.showToast('All local financial records purged.', 'info');
                    }
                });
            });
        }
    }

    PFCC.settings = {
        applySettings,
        togglePrivacyMode,
        renderRules,
        renderCustomCategories,
        updateStorageMeterUI,
        updateLockStatusUI,
        openWrapupModal,
        closeWrapupModal,
        sanitizeRestoredPayload,
        openSettings,
        closeSettings,
        saveSettings,
        openShortcutsModal,
        closeShortcutsModal,
        initSettings
    };
})(window);
