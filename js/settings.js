(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function applySettings() {
        const el = PFCC.dom;
        const settings = PFCC.state.settings;
        const theme = PFCC.themes.OS_THEMES[PFCC.themes.resolveThemeKey(settings.preset)] || PFCC.themes.OS_THEMES.obsidian;

        if (el.displayName) el.displayName.textContent = settings.name;
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
        docStyle.setProperty('--font-primary', PFCC.themes.normalizeFont(settings.font));
        docStyle.setProperty('--ui-radius', PFCC.themes.normalizeRadius(settings.radius));
        docStyle.setProperty('--anim-speed', settings.animSpeed || '0.16s');

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

    function openSettings() {
        const el = PFCC.dom;
        const s = PFCC.state.settings;
        PFCC.state.lastFocusedElement = document.activeElement;

        el.setName.value = s.name;
        el.setLanguage.value = s.language;
        el.setBudget.value = s.budget;
        el.setSavingsGoal.value = s.savingsGoal || 500;
        el.setCurrency.value = s.currency;
        el.setAnimSpeed.value = s.animSpeed || '0.16s';
        el.setPresetTheme.value = PFCC.themes.resolveThemeKey(s.preset);
        el.setFont.value = PFCC.themes.normalizeFont(s.font);
        el.setRadius.value = PFCC.themes.normalizeRadius(s.radius);
        if (el.setSoundEnabled) el.setSoundEnabled.checked = PFCC.state.soundEnabled;

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
        el.modal.classList.add('active');
        PFCC.audio.playSwooshSound();
        setTimeout(() => { if (el.btnCloseSettings) el.btnCloseSettings.focus(); }, 40);
    }

    function closeSettings() {
        const el = PFCC.dom;
        if (el.modal) el.modal.classList.remove('active');
        if (PFCC.state.lastFocusedElement && typeof PFCC.state.lastFocusedElement.focus === 'function') {
            PFCC.state.lastFocusedElement.focus();
        }
    }

    function saveSettings() {
        const el = PFCC.dom;
        const selectedThemeKey = PFCC.themes.resolveThemeKey(el.setPresetTheme.value);

        PFCC.state.settings = {
            name: el.setName.value.trim() || 'User',
            budget: parseFloat(el.setBudget.value) || 0,
            savingsGoal: parseFloat(el.setSavingsGoal.value) || 0,
            currency: el.setCurrency.value,
            language: el.setLanguage.value,
            animSpeed: el.setAnimSpeed.value,
            preset: selectedThemeKey,
            font: PFCC.themes.normalizeFont(el.setFont.value),
            radius: PFCC.themes.normalizeRadius(el.setRadius.value),
            categoryBudgets: {
                Software: parseFloat(el.budgetCatSoftware ? el.budgetCatSoftware.value : 0) || 0,
                Food: parseFloat(el.budgetCatFood ? el.budgetCatFood.value : 0) || 0,
                Housing: parseFloat(el.budgetCatHousing ? el.budgetCatHousing.value : 0) || 0,
                Transport: parseFloat(el.budgetCatTransport ? el.budgetCatTransport.value : 0) || 0
            }
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

        PFCC.utils.safeSaveJSON('appSettings', PFCC.state.settings);
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
            result.transactions = imported.transactions.filter(isObj).map((t, i) => ({
                id: String(t.id || ('tx-' + Date.now() + '-' + i)),
                text: String(t.text || '').trim(),
                amount: Number(t.amount) || 0,
                category: String(t.category || 'Other'),
                date: String(t.date || PFCC.utils.getLocalDateString()),
                tags: sanitizeStringArray(t.tags),
                receipt: PFCC.utils.sanitizeReceiptUrl(t.receipt) || null
            }));
        }
        if (Array.isArray(imported.subscriptions)) {
            result.subscriptions = imported.subscriptions.filter(isObj).map((sub, i) => ({
                id: String(sub.id || ('sub-' + Date.now() + '-' + i)),
                name: String(sub.name || 'Subscription'),
                amount: Math.max(0, Number(sub.amount) || 0),
                billingCycle: sub.billingCycle === 'yearly' ? 'yearly' : 'monthly',
                category: String(sub.category || 'Other')
            }));
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
            result.debts = imported.debts.filter(isObj).map((d, i) => ({
                id: String(d.id || ('debt-' + Date.now() + '-' + i)),
                name: String(d.name || 'Debt'),
                balance: Math.max(0, Number(d.balance) || 0),
                rate: Math.max(0, Number(d.rate) || 0),
                minPayment: Math.max(0, Number(d.minPayment) || 0)
            }));
        }
        if (Array.isArray(imported.autoRules)) {
            result.autoRules = imported.autoRules.filter(isObj).map((r, i) => ({
                id: String(r.id || ('rule-' + Date.now() + '-' + i)),
                keywords: sanitizeStringArray(r.keywords),
                amountThreshold: Number(r.amountThreshold) || 0,
                assignCategory: String(r.assignCategory || 'Other'),
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

        if (el.setPresetTheme) {
            el.setPresetTheme.addEventListener('change', e => {
                const theme = PFCC.themes.OS_THEMES[e.target.value];
                if (theme) {
                    el.setFont.value = theme.font;
                    el.setRadius.value = theme.radius;
                    PFCC.audio.playSwooshSound();
                }
            });
        }

        PFCC.compat.qsa('.tab-btn').forEach(btn => {
            btn.addEventListener('click', e => {
                PFCC.audio.playClickSound();
                const currentBtn = e.currentTarget;
                PFCC.compat.qsa('.tab-btn').forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-selected', 'false');
                });
                PFCC.compat.qsa('.tab-content').forEach(c => c.classList.remove('active'));
                currentBtn.classList.add('active');
                currentBtn.setAttribute('aria-selected', 'true');
                const targetTab = document.getElementById(`tab-${currentBtn.dataset.tab}`);
                if (targetTab) targetTab.classList.add('active');
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
                renderRules();
                PFCC.audio.playSuccessSound();
            });
        }

        if (el.btnBackup) {
            el.btnBackup.addEventListener('click', () => {
                PFCC.audio.playClickSound();
                const s = PFCC.state;
                const payload = {
                    app: 'Developer_Finance_OS',
                    exportedAt: new Date().toISOString(),
                    transactions: s.transactions,
                    subscriptions: s.subscriptions,
                    ious: s.ious,
                    holdings: s.holdings,
                    soundEnabled: s.soundEnabled,
                    savingsVaults: s.savingsVaults,
                    debts: s.debts,
                    autoRules: s.autoRules,
                    settings: s.settings
                };
                PFCC.utils.downloadTextFile(
                    `finance_os_backup_${PFCC.utils.getLocalDateString()}.json`,
                    JSON.stringify(payload, null, 2),
                    'application/json;charset=utf-8'
                );
                PFCC.showToast('JSON backup downloaded.', 'success');
            });
        }

        if (el.btnRestore) {
            el.btnRestore.addEventListener('change', e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = event => {
                    try {
                        const imported = JSON.parse(event.target.result);
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
                        if (cleaned.settings) s.settings = Object.assign(s.settings, cleaned.settings);

                        PFCC.utils.safeSaveJSON('appTransactions', s.transactions);
                        PFCC.utils.safeSaveJSON('appSubscriptions', s.subscriptions);
                        PFCC.utils.safeSaveJSON('appIous', s.ious);
                        PFCC.utils.safeSaveJSON('appHoldings', s.holdings);
                        PFCC.utils.safeSaveJSON('appSoundEnabled', s.soundEnabled);
                        PFCC.utils.safeSaveJSON('appSavingsVaults', s.savingsVaults);
                        PFCC.utils.safeSaveJSON('appDebts', s.debts);
                        PFCC.utils.safeSaveJSON('appAutoRules', s.autoRules);
                        PFCC.utils.safeSaveJSON('appSettings', s.settings);

                        applySettings();
                        PFCC.audio.updateSoundButton();
                        PFCC.updateDOM();
                        renderRules();
                        PFCC.audio.playSuccessSound();
                        PFCC.showToast('Database restored from JSON backup.', 'success');
                    } catch (err) {
                        PFCC.audio.playWarningSound();
                        PFCC.showToast('Restore failed: invalid JSON backup file.', 'error');
                    }
                    e.target.value = '';
                };
                reader.readAsText(file);
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
        sanitizeRestoredPayload,
        openSettings,
        closeSettings,
        saveSettings,
        openShortcutsModal,
        closeShortcutsModal,
        initSettings
    };
})(window);
