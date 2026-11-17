(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function openCli() {
        const el = PFCC.dom;
        if (!el.cliModal) return;
        PFCC.state.lastFocusedElement = document.activeElement;
        el.cliModal.classList.add('active');
        el.cliInput.value = '';
        el.cliFeedback.className = 'cmd-feedback';
        el.cliFeedback.textContent = 'Press Enter to execute or Esc to dismiss.';
        setTimeout(() => el.cliInput.focus(), 40);
    }

    function closeCli() {
        const el = PFCC.dom;
        if (el.cliModal) el.cliModal.classList.remove('active');
        if (PFCC.state.lastFocusedElement && typeof PFCC.state.lastFocusedElement.focus === 'function') {
            PFCC.state.lastFocusedElement.focus();
        }
    }

    function showCliFeedback(msg, type) {
        const el = PFCC.dom;
        el.cliFeedback.className = `cmd-feedback ${type || 'success'}`;
        el.cliFeedback.textContent = msg;
    }

    function executeCliCommand(rawCmd) {
        if (!rawCmd) return;
        const parts = rawCmd.split(/\s+/);
        const cmd = parts[0].toLowerCase();
        const args = parts.slice(1);
        const state = PFCC.state;
        const formatCurrency = PFCC.utils.formatCurrency;

        try {
            if (cmd === '/add' || cmd === '/expense') {
                const amt = parseFloat(args[0]);
                if (Number.isNaN(amt) || amt <= 0) throw new Error('Usage: /add <amount> <description> [category]');
                const cat = args.length > 2 ? args[args.length - 1] : 'Other';
                const desc = args.length > 2 ? args.slice(1, -1).join(' ') : (args[1] || 'Expense');
                const t = {
                    id: Math.floor(Math.random() * 100000000).toString(16),
                    text: desc,
                    amount: -Math.abs(amt),
                    category: cat,
                    date: PFCC.utils.getLocalDateString(),
                    tags: ['#cli']
                };
                PFCC.utils.applyAutoRules(t);
                state.transactions.push(t);
                PFCC.audio.playSuccessSound();
                PFCC.updateDOM();
                showCliFeedback(`Added expense: ${formatCurrency(amt)} "${desc}" [${t.category}]`, 'success');
            } else if (cmd === '/income') {
                const amt = parseFloat(args[0]);
                if (Number.isNaN(amt) || amt <= 0) throw new Error('Usage: /income <amount> <description> [category]');
                const cat = args.length > 2 ? args[args.length - 1] : 'Salary';
                const desc = args.length > 2 ? args.slice(1, -1).join(' ') : (args[1] || 'Income');
                const t = {
                    id: Math.floor(Math.random() * 100000000).toString(16),
                    text: desc,
                    amount: Math.abs(amt),
                    category: cat,
                    date: PFCC.utils.getLocalDateString(),
                    tags: ['#cli']
                };
                PFCC.utils.applyAutoRules(t);
                state.transactions.push(t);
                PFCC.audio.playSuccessSound();
                PFCC.updateDOM();
                showCliFeedback(`Added income: +${formatCurrency(amt)} "${desc}" [${t.category}]`, 'success');
            } else if (cmd === '/holding') {
                const sym = (args[0] || '').toUpperCase();
                const qty = parseFloat(args[1]);
                if (!['BTC', 'ETH', 'SOL', 'PAXG'].includes(sym) || Number.isNaN(qty) || qty < 0) {
                    throw new Error('Usage: /holding <BTC|ETH|SOL|PAXG> <quantity>');
                }
                state.holdings[sym] = qty;
                PFCC.utils.safeSaveJSON('appHoldings', state.holdings);
                PFCC.markets.updateNetWorth();
                PFCC.audio.playSuccessSound();
                showCliFeedback(`Holding updated: ${qty} ${sym}`, 'success');
            } else if (cmd === '/iou') {
                const person = args[0];
                const amt = parseFloat(args[1]);
                const desc = args.slice(2).join(' ') || 'Split expense';
                if (!person || Number.isNaN(amt) || amt <= 0) throw new Error('Usage: /iou <person> <amount> [reason]');
                state.ious.push({
                    id: 'iou-' + Math.floor(Math.random() * 10000000),
                    person,
                    amount: amt,
                    direction: 'receivable',
                    desc,
                    settled: false
                });
                PFCC.utils.safeSaveJSON('appIous', state.ious);
                PFCC.ledger.renderIous();
                PFCC.audio.playSuccessSound();
                showCliFeedback(`IOU created: ${person} owes you ${formatCurrency(amt)} for "${desc}"`, 'success');
            } else if (cmd === '/privacy') {
                PFCC.settings.togglePrivacyMode();
                showCliFeedback(`Privacy mode ${state.isPrivacyActive ? 'ENABLED' : 'DISABLED'}`, 'success');
            } else if (cmd === '/sound') {
                PFCC.audio.toggleSound();
                showCliFeedback(`Audio FX ${state.soundEnabled ? 'ENABLED' : 'DISABLED'}`, 'success');
            } else if (cmd === '/import') {
                closeCli();
                PFCC.importer.openCsvImporter();
            } else if (cmd === '/forecast') {
                closeCli();
                if (typeof PFCC.switchWorkbenchView === 'function') PFCC.switchWorkbenchView('forecast');
            } else if (cmd === '/view') {
                const target = (args[0] || '').toLowerCase();
                if (!['ledger', 'budget', 'treasury', 'forecast'].includes(target)) {
                    throw new Error('Usage: /view <ledger|budget|treasury|forecast>');
                }
                closeCli();
                if (typeof PFCC.switchWorkbenchView === 'function') PFCC.switchWorkbenchView(target);
            } else if (cmd === '/theme') {
                const rawName = args[0] ? args[0].toLowerCase() : '';
                const themeKey = PFCC.themes.OS_THEMES[rawName] ? rawName : null;
                if (!themeKey) {
                    throw new Error(`Unknown theme. Choose: ${Object.keys(PFCC.themes.OS_THEMES).join(', ')}`);
                }
                const theme = PFCC.themes.OS_THEMES[themeKey];
                state.settings.preset = themeKey;
                state.settings.font = theme.font;
                state.settings.radius = theme.radius;
                PFCC.utils.safeSaveJSON('appSettings', state.settings);
                PFCC.settings.applySettings();
                PFCC.updateDOM();
                PFCC.audio.playSwooshSound();
                showCliFeedback(`Switched to theme "${themeKey}"`, 'success');
            } else if (cmd === '/budget') {
                const b = parseFloat(args[0]);
                if (Number.isNaN(b) || b < 0) throw new Error('Usage: /budget <amount>');
                state.settings.budget = b;
                PFCC.utils.safeSaveJSON('appSettings', state.settings);
                PFCC.audio.playSuccessSound();
                PFCC.updateDOM();
                showCliFeedback(`Monthly budget updated to ${formatCurrency(b)}`, 'success');
            } else if (cmd === '/goal') {
                const g = parseFloat(args[0]);
                if (Number.isNaN(g) || g < 0) throw new Error('Usage: /goal <amount>');
                state.settings.savingsGoal = g;
                PFCC.utils.safeSaveJSON('appSettings', state.settings);
                PFCC.audio.playSuccessSound();
                PFCC.updateDOM();
                showCliFeedback(`Savings target updated to ${formatCurrency(g)}`, 'success');
            } else if (cmd === '/sub') {
                const name = args[0];
                const amt = parseFloat(args[1]);
                const cat = args[2] || 'Software';
                if (!name || Number.isNaN(amt) || amt <= 0) throw new Error('Usage: /sub <name> <amount> [category]');
                state.subscriptions.push({
                    id: 'sub-' + Math.floor(Math.random() * 100000),
                    name,
                    amount: amt,
                    billingCycle: 'monthly',
                    category: cat
                });
                PFCC.utils.safeSaveJSON('appSubscriptions', state.subscriptions);
                PFCC.updateDOM();
                PFCC.audio.playSuccessSound();
                showCliFeedback(`Added subscription "${name}" (${formatCurrency(amt)}/mo)`, 'success');
            } else if (cmd === '/vault') {
                const name = args[0];
                const target = parseFloat(args[1]);
                const saved = parseFloat(args[2]) || 0;
                if (!name || Number.isNaN(target) || target <= 0) throw new Error('Usage: /vault <name> <targetAmount> [initialSaved]');
                state.savingsVaults.push({
                    id: 'vault-' + Math.floor(Math.random() * 1000000),
                    name,
                    target,
                    saved,
                    icon: 'target'
                });
                PFCC.utils.safeSaveJSON('appSavingsVaults', state.savingsVaults);
                PFCC.planning.renderVaults();
                PFCC.audio.playSuccessSound();
                showCliFeedback(`Savings Vault "${name}" (${formatCurrency(saved)} / ${formatCurrency(target)}) created`, 'success');
            } else if (cmd === '/debt') {
                const name = args[0];
                const balance = parseFloat(args[1]);
                const minPayment = parseFloat(args[2]) || 50;
                const rate = parseFloat(args[3]) || 0;
                if (!name || Number.isNaN(balance) || balance <= 0) throw new Error('Usage: /debt <name> <balance> [minPayment] [apr%]');
                state.debts.push({
                    id: 'debt-' + Math.floor(Math.random() * 1000000),
                    name,
                    balance,
                    rate,
                    minPayment
                });
                PFCC.utils.safeSaveJSON('appDebts', state.debts);
                PFCC.planning.renderDebts();
                PFCC.audio.playSuccessSound();
                showCliFeedback(`Debt "${name}" (${formatCurrency(balance)}, min ${formatCurrency(minPayment)}/mo) logged`, 'success');
            } else if (cmd === '/rule') {
                const keyword = args[0];
                const cat = args[1] || 'Other';
                if (!keyword) throw new Error('Usage: /rule <keyword> [category]');
                state.autoRules.push({
                    id: 'rule-' + Math.floor(Math.random() * 1000000),
                    keywords: [keyword],
                    amountThreshold: null,
                    assignCategory: cat,
                    assignTags: ['#' + keyword.toLowerCase().replace(/[^a-z0-9]/g, '')]
                });
                PFCC.utils.safeSaveJSON('appAutoRules', state.autoRules);
                PFCC.settings.renderRules();
                PFCC.audio.playSuccessSound();
                showCliFeedback(`Auto-rule added: "${keyword}" -> [${cat}]`, 'success');
            } else if (cmd === '/fire') {
                closeCli();
                if (typeof PFCC.switchWorkbenchView === 'function') PFCC.switchWorkbenchView('treasury');
                const fireSec = document.querySelector('.fire-section');
                if (fireSec) fireSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (cmd === '/heatmap') {
                closeCli();
                if (typeof PFCC.switchWorkbenchView === 'function') PFCC.switchWorkbenchView('treasury');
                const heatSec = document.querySelector('.heatmap-section');
                if (heatSec) heatSec.scrollIntoView({ behavior: 'smooth', block: 'center' });
            } else if (cmd === '/export') {
                PFCC.importer.exportCsv();
                showCliFeedback('Export triggered.', 'success');
            } else if (cmd === '/help') {
                showCliFeedback('Commands: /add, /income, /view <ledger|budget|treasury|forecast>, /holding, /iou, /vault, /debt, /rule, /theme, /budget, /goal, /fire, /heatmap, /privacy, /sound, /import, /export', 'success');
            } else {
                throw new Error(`Unknown command "${cmd}". Type /help for assistance.`);
            }
        } catch (err) {
            PFCC.audio.playWarningSound();
            showCliFeedback(err.message, 'error');
        }
    }

    function initCli() {
        const el = PFCC.dom;
        if (el.btnOpenCli) el.btnOpenCli.addEventListener('click', openCli);
        if (el.btnCloseCli) el.btnCloseCli.addEventListener('click', closeCli);

        if (el.cliHints) {
            el.cliHints.addEventListener('click', e => {
                const item = e.target.closest('.cmd-item');
                if (item) {
                    el.cliInput.value = item.getAttribute('data-cmd');
                    el.cliInput.focus();
                }
            });
        }

        if (el.cliInput) {
            el.cliInput.addEventListener('keydown', e => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    executeCliCommand(el.cliInput.value.trim());
                }
            });
        }
    }

    PFCC.cli = {
        openCli,
        closeCli,
        executeCliCommand,
        initCli
    };
})(window);
