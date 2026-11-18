(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function safeLoadJSON(key, fallback) {
        try {
            const raw = global.localStorage ? global.localStorage.getItem(key) : null;
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return parsed === null || parsed === undefined ? fallback : parsed;
        } catch (err) {
            return fallback;
        }
    }

    function safeSaveJSON(key, value) {
        try {
            if (!global.localStorage) return true;
            global.localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (err) {
            if (typeof PFCC.showToast === 'function') {
                PFCC.showToast('Storage limit reached. Remove large receipt images or back up and clear old entries.', 'error');
            }
            return false;
        }
    }

    function safeRemoveStorage(key) {
        try {
            if (global.localStorage) global.localStorage.removeItem(key);
        } catch (err) {
            // Ignore storage access errors
        }
    }

    function pad2(n) {
        const s = String(n);
        return s.length < 2 ? '0' + s : s;
    }

    function getLocalDateString(d) {
        const dateObj = d || new Date();
        const year = dateObj.getFullYear();
        const month = pad2(dateObj.getMonth() + 1);
        const day = pad2(dateObj.getDate());
        return `${year}-${month}-${day}`;
    }

    function createEl(tag, className, text) {
        const node = document.createElement(tag);
        if (className) node.className = className;
        if (text !== undefined && text !== null) node.textContent = String(text);
        return node;
    }

    function hexToRgba(hex, alpha) {
        const a = alpha === undefined ? 1 : alpha;
        if (!hex || typeof hex !== 'string' || !hex.startsWith('#')) return `rgba(83, 104, 120, ${a})`;
        let clean = hex.slice(1);
        if (clean.length === 3) clean = clean.split('').map(c => c + c).join('');
        const num = parseInt(clean, 16);
        if (Number.isNaN(num)) return `rgba(83, 104, 120, ${a})`;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${a})`;
    }

    const defaultTheme = PFCC.themes.OS_THEMES.obsidian;
    const rawSettings = safeLoadJSON('appSettings', {});
    const resolvedPreset = PFCC.themes.resolveThemeKey(rawSettings.preset);
    const baseTheme = PFCC.themes.OS_THEMES[resolvedPreset] || defaultTheme;

    const settings = Object.assign({
        name: 'Developer',
        budget: 2500,
        savingsGoal: 500,
        currency: 'USD',
        language: 'en',
        animSpeed: '0.16s',
        preset: resolvedPreset,
        font: defaultTheme.font,
        radius: defaultTheme.radius,
        categoryBudgets: { Software: 150, Food: 400, Housing: 1000, Transport: 150 }
    }, rawSettings, {
        preset: resolvedPreset,
        font: PFCC.themes.normalizeFont(rawSettings.font || baseTheme.font),
        radius: PFCC.themes.normalizeRadius(rawSettings.radius || baseTheme.radius)
    });

    if (!settings.categoryBudgets || typeof settings.categoryBudgets !== 'object') {
        settings.categoryBudgets = { Software: 150, Food: 400, Housing: 1000, Transport: 150 };
    }

    const cachedMarket = safeLoadJSON('appCachedPrices', null);
    const loadedVaults = safeLoadJSON('appSavingsVaults', [
        { id: 'vault-1', name: 'Workstation Laptop', target: 3500, saved: 1200, icon: 'laptop' },
        { id: 'vault-2', name: 'Emergency Buffer', target: 12000, saved: 4500, icon: 'shield' }
    ]);

    loadedVaults.forEach(v => {
        v.icon = PFCC.icons.normalizeVaultIcon(v.icon);
    });

    const DEFAULT_CATEGORIES = ['Housing', 'Software', 'Food', 'Transport', 'Investments', 'Salary', 'Other'];
    const CATEGORY_LABELS = {
        Housing: 'Housing & Utilities',
        Software: 'Software & Tech',
        Food: 'Food & Dining',
        Transport: 'Transportation',
        Investments: 'Investments',
        Salary: 'Salary & Wages',
        Other: 'Other'
    };

    const loadedCategoriesRaw = safeLoadJSON('appCategories', null);
    const loadedCategories = (Array.isArray(loadedCategoriesRaw) && loadedCategoriesRaw.length > 0)
        ? loadedCategoriesRaw.filter(c => typeof c === 'string' && c.trim().length > 0).map(c => c.trim())
        : DEFAULT_CATEGORIES.slice();

    const loadedPresetsRaw = safeLoadJSON('appQuickPresets', null);
    const loadedPresets = Array.isArray(loadedPresetsRaw)
        ? loadedPresetsRaw
        : [
            { id: 'pre-1', text: 'Coffee', amount: 4.5, type: 'expense', category: 'Food' },
            { id: 'pre-2', text: 'Lunch', amount: 12, type: 'expense', category: 'Food' },
            { id: 'pre-3', text: 'Rideshare', amount: 8, type: 'expense', category: 'Transport' }
        ];

    const savedView = safeLoadJSON('appActiveView', 'ledger');
    const validViews = ['ledger', 'budget', 'treasury', 'forecast'];

    const now = new Date();

    PFCC.state = {
        transactions: safeLoadJSON('appTransactions', []),
        subscriptions: safeLoadJSON('appSubscriptions', [
            { id: 'sub-1', name: 'Code Assistant Pro', amount: 10.00, billingCycle: 'monthly', billingDay: 5, category: 'Software' },
            { id: 'sub-2', name: 'VPS Cloud Server', amount: 24.00, billingCycle: 'monthly', billingDay: 15, category: 'Housing' }
        ]),
        ious: safeLoadJSON('appIous', [
            { id: 'iou-1', person: 'Alice', amount: 45.00, direction: 'receivable', desc: 'Team lunch split', settled: false },
            { id: 'iou-2', person: 'Bob', amount: 20.00, direction: 'payable', desc: 'Cloud server fee', settled: false }
        ]),
        holdings: safeLoadJSON('appHoldings', { BTC: 0, ETH: 0, SOL: 0, PAXG: 0 }),
        cachedMarket,
        livePrices: (cachedMarket && cachedMarket.prices) ? cachedMarket.prices : { BTC: 83850, ETH: 2705, SOL: 119.5, PAXG: 4151 },
        liveChanges: (cachedMarket && cachedMarket.changes) ? cachedMarket.changes : { BTC: 0, ETH: 0, SOL: 0, PAXG: 0 },
        isPrivacyActive: false,
        soundEnabled: safeLoadJSON('appSoundEnabled', true) !== false,
        liveMarketsEnabled: safeLoadJSON('appLiveMarketsEnabled', true) !== false,
        lockHash: safeLoadJSON('appLockHash', ''),
        lastBackupAt: safeLoadJSON('appLastBackupAt', 0),
        categories: loadedCategories,
        quickPresets: loadedPresets,
        selectedLedgerIds: [],
        bulkSelectActive: false,
        parsedCsvRows: [],
        csvListenersBound: false,
        savingsVaults: loadedVaults,
        debts: safeLoadJSON('appDebts', []),
        debtStrategy: 'snowball',
        autoRules: safeLoadJSON('appAutoRules', [
            { id: 'rule-1', keywords: ['Cloud Hosting', 'VPS Server', 'Domain Renewal'], amountThreshold: null, assignCategory: 'Software', assignTags: ['#devops', '#cloud'] },
            { id: 'rule-2', keywords: ['Rideshare', 'Metro Transit', 'City Taxi'], amountThreshold: null, assignCategory: 'Transport', assignTags: ['#transport'] },
            { id: 'rule-3', keywords: [], amountThreshold: 500, assignCategory: '', assignTags: ['#major'] }
        ]),
        settings,
        activeView: validViews.includes(savedView) ? savedView : 'ledger',
        activeUpperChart: 'pace',
        forecastYears: 3,
        timeframe: {
            mode: 'this_month',
            year: now.getFullYear(),
            month: now.getMonth()
        },
        ledgerFilter: {
            type: 'all',
            category: 'all',
            sort: 'date_desc'
        },
        lastFocusedElement: null
    };

    function isTransferTx(t) {
        return Boolean(t && (t.isTransfer || t.type === 'transfer'));
    }

    function getExpenseAmount(t) {
        if (!t || isTransferTx(t)) return 0;
        return t.amount < 0 ? Math.abs(t.amount) : 0;
    }

    function getIncomeAmount(t) {
        if (!t || isTransferTx(t)) return 0;
        return t.amount > 0 ? t.amount : 0;
    }

    function getTransferAmount(t) {
        if (!isTransferTx(t)) return 0;
        const raw = t.transferAmount !== undefined ? t.transferAmount : t.amount;
        return Math.abs(Number(raw) || 0);
    }

    function formatCategoryLabel(cat) {
        return CATEGORY_LABELS[cat] || cat;
    }

    function getAllCategories() {
        const list = (PFCC.state && Array.isArray(PFCC.state.categories) && PFCC.state.categories.length > 0)
            ? PFCC.state.categories
            : DEFAULT_CATEGORIES;
        return list.slice();
    }

    function syncCategorySelects() {
        const cats = getAllCategories();
        const selectSpecs = [
            { id: 'category', prefixOpt: null },
            { id: 'ledger-category-filter', prefixOpt: { value: 'all', text: 'All Categories' } },
            { id: 'sub-category', prefixOpt: null },
            { id: 'rule-assign-category', prefixOpt: { value: '', text: 'Keep original' } },
            { id: 'bulk-category-select', prefixOpt: null }
        ];

        selectSpecs.forEach(spec => {
            const sel = document.getElementById(spec.id);
            if (!sel || typeof document.createElement !== 'function') return;
            const prevVal = sel.value;
            sel.textContent = '';
            if (spec.prefixOpt) {
                const pOpt = document.createElement('option');
                pOpt.value = spec.prefixOpt.value;
                pOpt.textContent = spec.prefixOpt.text;
                sel.appendChild(pOpt);
            }
            cats.forEach(cat => {
                const opt = document.createElement('option');
                opt.value = cat;
                opt.textContent = formatCategoryLabel(cat);
                sel.appendChild(opt);
            });
            if (prevVal && (cats.includes(prevVal) || (spec.prefixOpt && prevVal === spec.prefixOpt.value))) {
                sel.value = prevVal;
            }
            if (PFCC.picker && typeof PFCC.picker.syncSelect === 'function') {
                PFCC.picker.syncSelect(sel);
            }
        });
    }

    function formatCurrency(val) {
        const num = Number(val) || 0;
        try {
            return new Intl.NumberFormat(undefined, {
                style: 'currency',
                currency: PFCC.state.settings.currency
            }).format(num);
        } catch (err) {
            return `${PFCC.state.settings.currency} ${num.toFixed(2)}`;
        }
    }

    function applyAutoRules(transaction, rulesList) {
        const rules = rulesList || PFCC.state.autoRules;
        if (!rules || rules.length === 0) return transaction;
        const desc = (transaction.text || '').toLowerCase();
        const amt = Math.abs(transaction.amount);

        for (const rule of rules) {
            let matches = false;
            if (rule.keywords && rule.keywords.length > 0) {
                matches = rule.keywords.some(kw => kw && desc.includes(kw.toLowerCase()));
            }
            if (rule.amountThreshold && amt >= rule.amountThreshold) {
                matches = true;
            }
            if (matches) {
                if (rule.assignCategory) transaction.category = rule.assignCategory;
                if (rule.assignTags && rule.assignTags.length > 0) {
                    if (!transaction.tags) transaction.tags = [];
                    rule.assignTags.forEach(tag => {
                        if (!transaction.tags.includes(tag)) transaction.tags.push(tag);
                    });
                }
            }
        }
        return transaction;
    }

    function getFilteredTransactionsByTimeframe(txList, tf) {
        if (!tf || tf.mode === 'all_time') return txList;
        if (tf.mode === 'last_30_days') {
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - 30);
            const cutoffStr = getLocalDateString(cutoff);
            return txList.filter(t => t.date >= cutoffStr);
        }
        const prefix = `${tf.year}-${pad2(tf.month + 1)}`;
        return txList.filter(t => t.date && t.date.startsWith(prefix));
    }

    // Computes chronological running balance across all transactions
    function computeRunningBalanceMap(txList) {
        const indexed = txList.map((tx, idx) => ({ tx, idx }));
        indexed.sort((a, b) => {
            const da = a.tx.date || '';
            const db = b.tx.date || '';
            if (da !== db) return da < db ? -1 : 1;
            return a.idx - b.idx;
        });

        const map = new Map();
        let running = 0;
        indexed.forEach(({ tx }) => {
            running += Number(tx.amount) || 0;
            map.set(tx.id, running);
        });
        return map;
    }

    function showToast(message, type, opts) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const kind = type || 'info';
        const options = opts || {};
        const toast = createEl('div', `toast-item toast-${kind}`);
        toast.setAttribute('role', kind === 'error' ? 'alert' : 'status');

        const iconName = kind === 'error' ? 'alert' : (kind === 'success' ? 'check' : 'activity');
        toast.appendChild(PFCC.icons.create(iconName, 15));
        toast.appendChild(createEl('span', 'toast-message', message));

        if (options.actionLabel && typeof options.onAction === 'function') {
            const actBtn = createEl('button', 'btn btn-outline btn-sm toast-action-btn', options.actionLabel);
            actBtn.type = 'button';
            actBtn.addEventListener('click', () => {
                options.onAction();
                if (toast.parentNode) toast.remove();
            });
            toast.appendChild(actBtn);
        }

        const dismissBtn = createEl('button', 'toast-close');
        dismissBtn.type = 'button';
        dismissBtn.setAttribute('aria-label', 'Dismiss notification');
        dismissBtn.appendChild(PFCC.icons.create('close', 14));
        dismissBtn.addEventListener('click', () => toast.remove());
        toast.appendChild(dismissBtn);

        while (container.children.length >= 2) {
            container.firstChild.remove();
        }
        container.appendChild(toast);
        setTimeout(() => {
            if (toast.parentNode) toast.remove();
        }, options.durationMs || (options.actionLabel ? 5000 : 3200));
    }

    function openActionDialog(opts) {
        const overlay = document.getElementById('action-dialog-modal');
        if (!overlay) return;
        const titleEl = document.getElementById('action-dialog-title');
        const bodyEl = document.getElementById('action-dialog-message');
        const inputWrap = document.getElementById('action-dialog-input-wrap');
        const inputLabel = document.getElementById('action-dialog-input-label');
        const inputEl = document.getElementById('action-dialog-input');
        const confirmBtn = document.getElementById('btn-action-dialog-confirm');
        const cancelBtn = document.getElementById('btn-action-dialog-cancel');
        const closeBtn = document.getElementById('btn-close-action-dialog');

        PFCC.state.lastFocusedElement = document.activeElement;
        titleEl.textContent = opts.title || 'Confirm Action';
        bodyEl.textContent = opts.message || '';
        confirmBtn.textContent = opts.confirmLabel || 'Confirm';
        confirmBtn.className = opts.danger ? 'btn btn-danger' : 'btn btn-primary btn-inline-auto';

        const inputType = opts.inputType || 'number';
        if (opts.input) {
            inputWrap.style.display = 'block';
            inputLabel.textContent = opts.inputLabel || 'Amount';
            inputEl.type = inputType;
            inputEl.placeholder = opts.placeholder || '';
            inputEl.value = opts.defaultValue !== undefined ? String(opts.defaultValue) : '';
            if (inputType === 'number') {
                inputEl.min = opts.min !== undefined ? String(opts.min) : '0';
                inputEl.step = opts.step || '0.01';
            } else {
                inputEl.removeAttribute('min');
                inputEl.removeAttribute('step');
            }
        } else {
            inputWrap.style.display = 'none';
            inputEl.type = 'number';
            inputEl.value = '';
        }

        const cleanup = () => {
            overlay.classList.remove('active');
            confirmBtn.onclick = null;
            cancelBtn.onclick = null;
            closeBtn.onclick = null;
            if (PFCC.state.lastFocusedElement && typeof PFCC.state.lastFocusedElement.focus === 'function') {
                PFCC.state.lastFocusedElement.focus();
            }
        };

        confirmBtn.onclick = () => {
            if (opts.input) {
                if (inputType === 'number') {
                    const val = parseFloat(inputEl.value);
                    if (Number.isNaN(val) || val <= 0) {
                        showToast('Please enter a valid positive number.', 'error');
                        inputEl.focus();
                        return;
                    }
                    cleanup();
                    if (opts.onConfirm) opts.onConfirm(val);
                } else {
                    const strVal = (inputEl.value || '').trim();
                    if (!strVal) {
                        showToast('Please enter a value.', 'error');
                        inputEl.focus();
                        return;
                    }
                    cleanup();
                    if (opts.onConfirm) opts.onConfirm(strVal);
                }
            } else {
                cleanup();
                if (opts.onConfirm) opts.onConfirm(true);
            }
        };

        cancelBtn.onclick = cleanup;
        closeBtn.onclick = cleanup;

        overlay.classList.add('active');
        setTimeout(() => {
            if (opts.input) inputEl.focus();
            else confirmBtn.focus();
        }, 40);
    }

    function collectDom() {
        const g = id => document.getElementById(id);
        PFCC.dom = {
            netWorthMetric: g('net-worth-metric'),
            netWorthSub: g('net-worth-sub'),
            balance: g('balance'),
            incomeTotal: g('income-total'),
            expenseTotal: g('expense-total'),
            runwayMetric: g('runway-metric'),
            healthSub: g('health-sub'),

            // Workbench views
            workbenchBtns: PFCC.compat.qsa('.workbench-tab'),
            viewPanels: PFCC.compat.qsa('.workbench-view'),

            // Ratios strip & Advisor & Envelopes
            ratioSavingsRate: g('ratio-savings-rate'),
            ratioFixedBurn: g('ratio-fixed-burn'),
            ratioTaxCoverage: g('ratio-tax-coverage'),
            ratioSurvivalRunway: g('ratio-survival-runway'),
            goalProgress: g('goal-progress'),
            budgetStatusTag: g('budget-status-tag'),
            budgetPercentageText: g('budget-percentage-text'),
            budgetProgressBar: g('budget-progress-bar'),
            advisorCards: g('advisor-cards'),
            envelopesGrid: g('envelopes-grid'),
            btnAdjustEnvelopes: g('btn-adjust-envelopes'),
            categoryBreakdownList: g('category-breakdown-list'),

            // Timeframe
            btnPrevTimeframe: g('btn-prev-timeframe'),
            btnNextTimeframe: g('btn-next-timeframe'),
            timeframeLabel: g('timeframe-label'),
            timeframeBtns: PFCC.compat.qsa('.timeframe-btn'),

            // Quick Entry & Ledger
            formHeaderTitle: g('form-header-title'),
            editId: g('edit-id'),
            editBanner: g('edit-banner'),
            btnCancelEditBanner: g('btn-cancel-edit-banner'),
            btnSubmitTx: g('btn-submit-tx'),
            btnCancelEdit: g('btn-cancel-edit'),
            btnToggleEntryDetails: g('btn-toggle-entry-details'),
            entryDetailsDrawer: g('entry-details-drawer'),
            form: g('transaction-form'),
            text: g('text'),
            amount: g('amount'),
            type: g('type'),
            category: g('category'),
            date: g('date'),
            tags: g('tags'),
            receiptFile: g('receipt-file'),
            receiptData: g('receipt-data'),
            btnClearReceipt: g('btn-clear-receipt'),
            quickPresetsBar: g('quick-presets-bar'),
            fxForeignAmount: g('fx-foreign-amount'),
            fxRate: g('fx-rate'),
            fxCurrency: g('fx-currency'),

            list: g('list'),
            ledgerCountBadge: g('ledger-count-badge'),
            searchFilter: g('search-filter'),
            filterBtns: PFCC.compat.qsa('.filter-btn'),
            ledgerCatFilter: g('ledger-category-filter'),
            ledgerSort: g('ledger-sort'),
            btnToggleBulkSelect: g('btn-toggle-bulk-select'),
            bulkActionBar: g('bulk-action-bar'),
            bulkSelectedCount: g('bulk-selected-count'),
            bulkCategorySelect: g('bulk-category-select'),
            btnBulkApplyCat: g('btn-bulk-apply-cat'),
            btnBulkAddTag: g('btn-bulk-add-tag'),
            btnBulkDelete: g('btn-bulk-delete'),
            upcomingBillsBanner: g('upcoming-bills-banner'),

            // Subscriptions & IOUs
            tabBtnSubs: g('tab-btn-subs'),
            tabBtnIous: g('tab-btn-ious'),
            subsView: g('subs-view'),
            iousView: g('ious-view'),
            subList: g('sub-list'),
            subBurnBadge: g('sub-burn-badge'),
            btnToggleSubForm: g('btn-toggle-sub-form'),
            subFormDrawer: g('sub-form-drawer'),
            subForm: g('subscription-form'),
            subName: g('sub-name'),
            subAmount: g('sub-amount'),
            subCycle: g('sub-cycle'),
            subBillingDay: g('sub-billing-day'),
            subCategory: g('sub-category'),
            btnCancelSub: g('btn-cancel-sub'),

            iouList: g('iou-list'),
            iouSummaryBadge: g('iou-summary-badge'),
            btnToggleIouForm: g('btn-toggle-iou-form'),
            iouFormDrawer: g('iou-form-drawer'),
            iouForm: g('iou-form'),
            iouPerson: g('iou-person'),
            iouAmount: g('iou-amount'),
            iouDirection: g('iou-direction'),
            iouDesc: g('iou-desc'),
            btnCancelIou: g('btn-cancel-iou'),

            // Forecast Lab
            simIncomeShift: g('sim-income-shift'),
            simIncomeShiftVal: g('sim-income-shift-val'),
            simExpenseShift: g('sim-expense-shift'),
            simExpenseShiftVal: g('sim-expense-shift-val'),
            simAnnualGrowth: g('sim-annual-growth'),
            simAnnualGrowthVal: g('sim-annual-growth-val'),
            simHorizonBtns: PFCC.compat.qsa('.horizon-btn'),
            simNewNet: g('sim-new-net'),
            simRunway: g('sim-runway'),
            sim1yr: g('sim-1yr'),
            simHorizonVal: g('sim-horizon-val'),
            simHorizonLabel: g('sim-horizon-label'),
            btnResetSim: g('btn-reset-simulation'),
            forecastChartCanvas: g('forecastChart'),

            // Markets & Charts
            btnSync: g('btn-sync-markets'),
            marketStatusBadge: g('market-status-badge'),
            chartMainTitle: g('chart-main-title'),
            chartTabBtns: PFCC.compat.qsa('.chart-tab-btn'),
            trendChartCanvas: g('trendChart'),
            chartTooltip: g('chart-tooltip'),

            // Header Actions
            headerActions: g('header-actions'),
            btnToggleTools: g('btn-toggle-tools'),
            displayName: g('display-name'),
            btnToggleSound: g('btn-toggle-sound'),
            btnTogglePrivacy: g('btn-toggle-privacy'),
            btnWrapup: g('btn-wrapup'),
            wrapupModal: g('wrapup-modal'),
            btnCloseWrapup: g('btn-close-wrapup'),
            btnDismissWrapup: g('btn-dismiss-wrapup'),
            btnDownloadWrapup: g('btn-download-wrapup'),
            wrapupSummaryGrid: g('wrapup-summary-grid'),
            wrapupCanvas: g('wrapupCanvas'),
            appLockOverlay: g('app-lock-overlay'),
            lockPinInput: g('lock-pin-input'),
            btnUnlockPin: g('btn-unlock-pin'),
            btnUnlockBiometric: g('btn-unlock-biometric'),
            lockErrorMsg: g('lock-error-msg'),
            btnLockNow: g('btn-lock-now'),
            btnExportCsv: g('btn-export-csv'),
            btnPrint: g('btn-print-report'),
            btnSettings: g('btn-settings'),
            btnShortcuts: g('btn-shortcuts'),
            quickEntryBox: document.querySelector('.quick-entry-box'),
            btnToggleQuickEntry: g('btn-toggle-quick-entry'),

            // CLI Modal
            cliModal: g('cli-modal'),
            btnOpenCli: g('btn-open-cli'),
            btnCloseCli: g('btn-close-cli'),
            cliInput: g('cli-input'),
            cliHints: g('cli-hints'),
            cliFeedback: g('cli-feedback'),

            // Settings Modal
            modal: g('settings-modal'),
            btnCloseSettings: g('btn-close-settings'),
            btnSaveSettings: g('btn-save-settings'),
            setName: g('setting-name'),
            setLanguage: g('setting-language'),
            setBudget: g('setting-budget'),
            setSavingsGoal: g('setting-savings-goal'),
            setCurrency: g('setting-currency'),
            setAnimSpeed: g('setting-anim-speed'),
            setPresetTheme: g('setting-preset-theme'),
            setFont: g('setting-font'),
            setRadius: g('setting-radius'),
            setSoundEnabled: g('setting-sound-enabled'),
            setLiveMarketsEnabled: g('setting-live-markets-enabled'),
            setLockPin: g('setting-lock-pin'),
            btnClearPin: g('btn-clear-pin'),
            lockStatusText: g('lock-status-text'),
            customCatName: g('custom-cat-name'),
            customCatLimit: g('custom-cat-limit'),
            btnAddCustomCat: g('btn-add-custom-cat'),
            customCatList: g('custom-cat-list'),
            backupPassphrase: g('backup-passphrase'),
            storageQuotaBar: g('storage-quota-bar'),
            storageQuotaText: g('storage-quota-text'),
            backupHealthBadge: g('backup-health-badge'),
            budgetCatSoftware: g('budget-cat-Software'),
            budgetCatFood: g('budget-cat-Food'),
            budgetCatHousing: g('budget-cat-Housing'),
            budgetCatTransport: g('budget-cat-Transport'),
            holdingBtc: g('holding-btc'),
            holdingEth: g('holding-eth'),
            holdingSol: g('holding-sol'),
            holdingPaxg: g('holding-paxg'),
            btnBackup: g('btn-backup'),
            btnRestore: g('btn-restore'),
            btnWipe: g('btn-wipe'),

            // CSV Import Modal
            importModal: g('import-modal'),
            btnImportCsv: g('btn-import-csv'),
            btnCloseImport: g('btn-close-import'),
            btnCancelImport: g('btn-cancel-import'),
            btnCommitImport: g('btn-commit-import'),
            importDropzone: g('import-dropzone'),
            csvFileInput: g('csv-file-input'),
            importMappingSection: g('import-mapping-section'),
            mapDate: g('map-date'),
            mapDesc: g('map-desc'),
            mapAmount: g('map-amount'),
            mapCategory: g('map-category'),
            importCount: g('import-count'),
            importPreviewBody: g('import-preview-body'),
            btnSelectAllImport: g('btn-select-all-import'),
            btnDeselectAllImport: g('btn-deselect-all-import'),
            importMasterCheck: g('import-master-check'),

            // Receipt & Shortcuts Modals
            receiptModal: g('receipt-modal'),
            btnCloseReceipt: g('btn-close-receipt'),
            btnDismissReceipt: g('btn-dismiss-receipt'),
            receiptPreviewImg: g('receipt-preview-img'),
            receiptMetaInfo: g('receipt-meta-info'),
            btnDownloadReceipt: g('btn-download-receipt'),
            shortcutsModal: g('shortcuts-modal'),
            btnCloseShortcuts: g('btn-close-shortcuts'),
            btnDismissShortcuts: g('btn-dismiss-shortcuts'),

            // Heatmap, FIRE & Tax
            heatmapGrid: g('heatmap-grid'),
            heatmapYearLabel: g('heatmap-year-label'),
            heatmapTooltip: g('heatmap-tooltip'),
            fireTarget: g('fire-target'),
            fireProgress: g('fire-progress'),
            fireYear: g('fire-year'),
            fireProgressBar: g('fire-progress-bar'),
            apocalypseRunway: g('apocalypse-runway'),
            taxRate: g('tax-rate'),
            taxLocked: g('tax-locked'),
            safeToSpend: g('safe-to-spend'),

            // Vaults & Debts
            vaultsGrid: g('vaults-grid'),
            btnAddVault: g('btn-add-vault'),
            vaultFormDrawer: g('vault-form-drawer'),
            vaultForm: g('vault-form'),
            vaultName: g('vault-name'),
            vaultTarget: g('vault-target'),
            vaultSaved: g('vault-saved'),
            vaultIcon: g('vault-icon'),
            btnCancelVault: g('btn-cancel-vault'),

            debtList: g('debt-list'),
            btnAddDebt: g('btn-add-debt'),
            debtFormDrawer: g('debt-form-drawer'),
            debtForm: g('debt-form'),
            debtName: g('debt-name'),
            debtBalance: g('debt-balance'),
            debtRate: g('debt-rate'),
            debtMinPayment: g('debt-min-payment'),
            debtBillingDay: g('debt-billing-day'),
            btnCancelDebt: g('btn-cancel-debt'),
            totalDebtBadge: g('total-debt-badge'),
            debtSummaryMetrics: g('debt-summary-metrics'),

            // Rules
            ruleKeywords: g('rule-keywords'),
            ruleAmountThreshold: g('rule-amount-threshold'),
            ruleAssignCategory: g('rule-assign-category'),
            ruleAssignTags: g('rule-assign-tags'),
            btnAddRule: g('btn-add-rule'),
            rulesList: g('rules-list')
        };
    }

    function sanitizeReceiptUrl(url) {
        if (typeof url !== 'string') return '';
        const trimmed = url.trim();
        return /^data:image\/(?!svg\+xml)/i.test(trimmed) ? trimmed : '';
    }

    function downloadTextFile(filename, textContent, mimeType) {
        const mime = mimeType || 'text/plain;charset=utf-8';
        if (global.AndroidBridge && typeof global.AndroidBridge.saveFile === 'function') {
            global.AndroidBridge.saveFile(filename, textContent, mime);
            return;
        }
        const ua = (global.navigator && global.navigator.userAgent) || '';
        const isFileOrWebView = (global.location && global.location.protocol === 'file:') || /;\s*wv\)|Version\/\d+\.\d+\s+Chrome\//.test(ua);
        const link = document.createElement('a');
        link.style.display = 'none';
        link.download = filename;

        if (!isFileOrWebView && typeof global.Blob === 'function' && global.URL && typeof global.URL.createObjectURL === 'function') {
            const blob = new Blob([textContent], { type: mime });
            const objUrl = global.URL.createObjectURL(blob);
            link.href = objUrl;
            if (document.body) document.body.appendChild(link);
            link.click();
            setTimeout(() => {
                link.remove();
                global.URL.revokeObjectURL(objUrl);
            }, 1000);
        } else {
            link.href = 'data:' + mime + ',' + encodeURIComponent(textContent);
            if (document.body) document.body.appendChild(link);
            link.click();
            setTimeout(() => link.remove(), 300);
        }
    }

    PFCC.utils = {
        safeLoadJSON,
        safeSaveJSON,
        safeRemoveStorage,
        getLocalDateString,
        createEl,
        hexToRgba,
        formatCurrency,
        applyAutoRules,
        getFilteredTransactionsByTimeframe,
        computeRunningBalanceMap,
        isTransferTx,
        getExpenseAmount,
        getIncomeAmount,
        getTransferAmount,
        formatCategoryLabel,
        getAllCategories,
        syncCategorySelects,
        sanitizeReceiptUrl,
        downloadTextFile
    };
    PFCC.showToast = showToast;
    PFCC.openActionDialog = openActionDialog;
    PFCC.collectDom = collectDom;
})(window);
