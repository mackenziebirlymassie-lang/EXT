(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function updateTimeframeUI() {
        const el = PFCC.dom;
        const tf = PFCC.state.timeframe;
        const monthNames = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];

        if (tf.mode === 'all_time') {
            el.timeframeLabel.textContent = 'All Time Records';
        } else if (tf.mode === 'last_30_days') {
            el.timeframeLabel.textContent = 'Last 30 Days';
        } else {
            el.timeframeLabel.textContent = `${monthNames[tf.month]} ${tf.year}`;
        }

        el.timeframeBtns.forEach(btn => {
            const mode = btn.getAttribute('data-timeframe');
            const active = mode === tf.mode;
            btn.classList.toggle('active', active);
            btn.setAttribute('aria-pressed', String(active));
        });
    }

    function switchWorkbenchView(viewName) {
        const valid = ['ledger', 'budget', 'treasury', 'forecast'];
        const target = valid.includes(viewName) ? viewName : 'ledger';
        PFCC.state.activeView = target;
        PFCC.utils.safeSaveJSON('appActiveView', target);

        const el = PFCC.dom;
        if (el.workbenchBtns) {
            el.workbenchBtns.forEach(btn => {
                const isMatch = btn.getAttribute('data-view') === target;
                btn.classList.toggle('active', isMatch);
                btn.setAttribute('aria-selected', String(isMatch));
            });
        }
        if (el.viewPanels) {
            el.viewPanels.forEach(panel => {
                const isMatch = panel.getAttribute('data-view-panel') === target;
                panel.classList.toggle('active', isMatch);
                panel.hidden = !isMatch;
            });
        }

        // Re-measure canvases once their container is visible
        const timeframeFiltered = PFCC.utils.getFilteredTransactionsByTimeframe(
            PFCC.state.transactions,
            PFCC.state.timeframe
        );
        if (target === 'budget') {
            PFCC.charts.updateCharts(timeframeFiltered);
        } else if (target === 'forecast') {
            PFCC.planning.updateSimulation();
        }

        if (PFCC._bootstrapped && global.innerWidth && global.innerWidth <= 640) {
            const mainEl = document.getElementById('main-workspace');
            if (mainEl && mainEl.getBoundingClientRect && mainEl.getBoundingClientRect().top < 0) {
                const reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
                mainEl.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
            }
        }
    }

    function updateValues(activeTimeframeTxs) {
        const el = PFCC.dom;
        const txs = PFCC.state.transactions;
        const formatCurrency = PFCC.utils.formatCurrency;

        if (el.balance) {
            const lifetimeBalance = txs.reduce((acc, item) => acc + item.amount, 0);
            el.balance.textContent = formatCurrency(lifetimeBalance);
        }

        const inc = activeTimeframeTxs.filter(i => i.amount > 0).reduce((acc, i) => acc + i.amount, 0);
        const exp = activeTimeframeTxs.filter(i => i.amount < 0).reduce((acc, i) => acc + Math.abs(i.amount), 0);

        if (el.incomeTotal) el.incomeTotal.textContent = '+' + formatCurrency(inc);
        if (el.expenseTotal) el.expenseTotal.textContent = '-' + formatCurrency(exp);

        const runway = PFCC.planning.calculateRunway(activeTimeframeTxs, txs);
        if (el.runwayMetric) {
            el.runwayMetric.textContent = runway.text;
            if (runway.status === 'danger') el.runwayMetric.className = 'metric-value text-red';
            else if (runway.status === 'warning') el.runwayMetric.className = 'metric-value text-warn';
            else if (runway.status === 'positive') el.runwayMetric.className = 'metric-value text-green';
            else el.runwayMetric.className = 'metric-value text-accent';
        }

        PFCC.planning.runFinancialAdvisor(inc, exp, activeTimeframeTxs, runway);
        PFCC.planning.updateFinancialRatiosStrip(activeTimeframeTxs);
    }

    function updateDOM() {
        const timeframeFiltered = PFCC.utils.getFilteredTransactionsByTimeframe(
            PFCC.state.transactions,
            PFCC.state.timeframe
        );
        updateValues(timeframeFiltered);
        PFCC.markets.updateNetWorth();
        PFCC.planning.renderEnvelopes(timeframeFiltered);
        PFCC.planning.updateSimulation();
        PFCC.charts.updateCharts(timeframeFiltered);
        PFCC.ledger.renderLedger();
        PFCC.ledger.renderSubscriptions();
        PFCC.ledger.renderIous();
        PFCC.planning.renderHeatmap();
        PFCC.planning.updateFIREAndTax();
        PFCC.planning.renderVaults();
        PFCC.planning.renderDebts();
        PFCC.utils.safeSaveJSON('appTransactions', PFCC.state.transactions);
    }

    function setToolsOpen(open) {
        const el = PFCC.dom;
        if (!el.headerActions || !el.btnToggleTools) return;
        el.headerActions.classList.toggle('tools-open', Boolean(open));
        el.btnToggleTools.classList.toggle('active', Boolean(open));
        el.btnToggleTools.setAttribute('aria-expanded', String(Boolean(open)));
    }

    function setQuickEntryCollapsed(collapsed) {
        const el = PFCC.dom;
        if (!el.quickEntryBox || !el.btnToggleQuickEntry) return;
        const isCollapsed = Boolean(collapsed);
        el.quickEntryBox.classList.toggle('qe-collapsed', isCollapsed);
        el.btnToggleQuickEntry.setAttribute('aria-expanded', String(!isCollapsed));
        el.btnToggleQuickEntry.setAttribute('aria-label', isCollapsed ? 'Expand quick entry' : 'Collapse quick entry');
        el.btnToggleQuickEntry.textContent = '';
        el.btnToggleQuickEntry.appendChild(PFCC.icons.create(isCollapsed ? 'chevronDown' : 'chevronUp', 14));
        el.btnToggleQuickEntry.appendChild(PFCC.utils.createEl('span', '', isCollapsed ? 'Add' : 'Hide'));
    }

    function initWorkbenchControls() {
        const el = PFCC.dom;
        if (el.btnToggleTools) {
            el.btnToggleTools.addEventListener('click', () => {
                const isOpen = el.headerActions && el.headerActions.classList.contains('tools-open');
                setToolsOpen(!isOpen);
                PFCC.audio.playClickSound();
            });
        }
        if (el.btnToggleQuickEntry) {
            el.btnToggleQuickEntry.addEventListener('click', () => {
                const isCollapsed = el.quickEntryBox && el.quickEntryBox.classList.contains('qe-collapsed');
                setQuickEntryCollapsed(!isCollapsed);
                PFCC.audio.playClickSound();
            });
        }
        if (!el.workbenchBtns) return;
        el.workbenchBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                PFCC.audio.playClickSound();
                switchWorkbenchView(btn.getAttribute('data-view'));
            });
        });
    }

    function initTimeframeControls() {
        const el = PFCC.dom;
        const tf = PFCC.state.timeframe;

        el.timeframeBtns.forEach(btn => {
            btn.addEventListener('click', e => {
                tf.mode = e.currentTarget.getAttribute('data-timeframe');
                if (tf.mode === 'this_month') {
                    const cur = new Date();
                    tf.year = cur.getFullYear();
                    tf.month = cur.getMonth();
                }
                PFCC.audio.playClickSound();
                updateTimeframeUI();
                updateDOM();
            });
        });

        if (el.btnPrevTimeframe) {
            el.btnPrevTimeframe.addEventListener('click', () => {
                tf.mode = 'custom_month';
                tf.month--;
                if (tf.month < 0) {
                    tf.month = 11;
                    tf.year--;
                }
                PFCC.audio.playClickSound();
                updateTimeframeUI();
                updateDOM();
            });
        }

        if (el.btnNextTimeframe) {
            el.btnNextTimeframe.addEventListener('click', () => {
                tf.mode = 'custom_month';
                tf.month++;
                if (tf.month > 11) {
                    tf.month = 0;
                    tf.year++;
                }
                PFCC.audio.playClickSound();
                updateTimeframeUI();
                updateDOM();
            });
        }
    }

    function dismissActiveOverlay() {
        const el = PFCC.dom;
        const actionModal = document.getElementById('action-dialog-modal');
        if (actionModal && actionModal.classList.contains('active')) {
            const cancel = document.getElementById('btn-action-dialog-cancel');
            if (cancel) cancel.click();
            return true;
        }
        let closed = false;
        if (el.modal && el.modal.classList.contains('active')) { PFCC.settings.closeSettings(); closed = true; }
        if (el.cliModal && el.cliModal.classList.contains('active')) { PFCC.cli.closeCli(); closed = true; }
        if (el.importModal && el.importModal.classList.contains('active')) { PFCC.importer.closeCsvImporter(); closed = true; }
        if (el.receiptModal && el.receiptModal.classList.contains('active')) { PFCC.ledger.closeReceiptLightbox(); closed = true; }
        if (el.shortcutsModal && el.shortcutsModal.classList.contains('active')) { PFCC.settings.closeShortcutsModal(); closed = true; }
        if (el.editId && el.editId.value) { PFCC.ledger.cancelEditTransaction(); closed = true; }
        return closed;
    }

    function handleBackPress() {
        if (dismissActiveOverlay()) return true;
        const el = PFCC.dom;
        if (el.entryDetailsDrawer && el.entryDetailsDrawer.classList.contains('active')) {
            PFCC.ledger.setDetailsDrawerOpen(false);
            return true;
        }
        if (PFCC.state.activeView !== 'ledger') {
            switchWorkbenchView('ledger');
            return true;
        }
        return false;
    }

    function initGlobalEvents() {
        const el = PFCC.dom;

        PFCC.compat.qsa('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', e => {
                if (e.target !== overlay) return;
                if (overlay.id === 'settings-modal') PFCC.settings.closeSettings();
                else if (overlay.id === 'cli-modal') PFCC.cli.closeCli();
                else if (overlay.id === 'import-modal') PFCC.importer.closeCsvImporter();
                else if (overlay.id === 'receipt-modal') PFCC.ledger.closeReceiptLightbox();
                else if (overlay.id === 'shortcuts-modal') PFCC.settings.closeShortcutsModal();
                else if (overlay.id === 'action-dialog-modal') {
                    const cancel = document.getElementById('btn-action-dialog-cancel');
                    if (cancel) cancel.click();
                }
            });
        });

        document.addEventListener('keydown', e => {
            if (!e || typeof e.key !== 'string') return;
            const activeEl = document.activeElement;
            const tag = activeEl ? activeEl.tagName.toLowerCase() : '';
            const isTyping = tag === 'input' || tag === 'select' || tag === 'textarea';

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                if (el.cliModal.classList.contains('active')) PFCC.cli.closeCli();
                else PFCC.cli.openCli();
                return;
            }

            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'l') {
                e.preventDefault();
                PFCC.settings.togglePrivacyMode();
                return;
            }

            if (e.altKey && ['1', '2', '3', '4'].includes(e.key)) {
                e.preventDefault();
                const map = { '1': 'ledger', '2': 'budget', '3': 'treasury', '4': 'forecast' };
                PFCC.audio.playClickSound();
                switchWorkbenchView(map[e.key]);
                return;
            }

            if (e.key === 'Escape') {
                dismissActiveOverlay();
                return;
            }

            if (!isTyping) {
                if (e.key === 'n' || e.key === 'N') {
                    e.preventDefault();
                    switchWorkbenchView('ledger');
                    setQuickEntryCollapsed(false);
                    if (el.text) {
                        el.text.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.text.focus();
                        PFCC.audio.playClickSound();
                    }
                } else if (e.key === '/') {
                    e.preventDefault();
                    switchWorkbenchView('ledger');
                    if (el.searchFilter) {
                        el.searchFilter.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        el.searchFilter.focus();
                        PFCC.audio.playClickSound();
                    }
                } else if (e.key === 'm' || e.key === 'M') {
                    e.preventDefault();
                    PFCC.audio.toggleSound();
                } else if (e.key === '?') {
                    e.preventDefault();
                    PFCC.settings.openShortcutsModal();
                }
            }
        });
    }

    function runStartupSweep() {
        const reduced = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (reduced || !document.body) return;
        document.body.classList.add('boot-animate');
        setTimeout(() => {
            document.body.classList.remove('boot-animate');
        }, 750);
    }

    function loadExternalFontsAsync() {
        if (!document.head || (global.navigator && global.navigator.onLine === false)) return;
        setTimeout(() => {
            if (document.getElementById('pfcc-google-fonts')) return;
            const link = document.createElement('link');
            link.id = 'pfcc-google-fonts';
            link.rel = 'stylesheet';
            link.href = 'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap';
            document.head.appendChild(link);
        }, 100);
    }

    function bootstrap() {
        runStartupSweep();
        PFCC.collectDom();
        PFCC.icons.hydrateStaticIcons(document);
        PFCC.settings.applySettings();
        PFCC.audio.updateSoundButton();
        initWorkbenchControls();
        initTimeframeControls();
        PFCC.ledger.initLedger();
        PFCC.planning.initPlanning();
        PFCC.charts.initCharts();
        PFCC.importer.initImporter();
        PFCC.cli.initCli();
        PFCC.settings.initSettings();
        PFCC.markets.initMarkets();
        initGlobalEvents();
        updateTimeframeUI();
        switchWorkbenchView(PFCC.state.activeView);
        updateDOM();
        loadExternalFontsAsync();
        PFCC._bootstrapped = true;
    }

    PFCC.updateDOM = updateDOM;
    PFCC.updateTimeframeUI = updateTimeframeUI;
    PFCC.switchWorkbenchView = switchWorkbenchView;
    PFCC.setQuickEntryCollapsed = setQuickEntryCollapsed;
    PFCC.handleBackPress = handleBackPress;
    PFCC.onAppUpdateAvailable = function (buildNumber, releaseTitle, downloadUrl) {
        if (!downloadUrl || !global.AndroidBridge || typeof global.AndroidBridge.startApkUpdate !== 'function') return;
        PFCC.openActionDialog({
            title: `Update Available (Build #${buildNumber})`,
            message: `${releaseTitle || 'A newer APK build'} is ready. Installing updates the app in place while preserving local ledger data.`,
            confirmLabel: 'Install Update',
            onConfirm: () => {
                PFCC.showToast('Downloading APK update...', 'info');
                global.AndroidBridge.startApkUpdate(downloadUrl);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', bootstrap);
    } else {
        bootstrap();
    }
})(window);
