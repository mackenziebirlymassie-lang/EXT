(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function openReceiptLightbox(t) {
        const el = PFCC.dom;
        if (!el.receiptModal || !t || !t.receipt) return;
        const safeSrc = PFCC.utils.sanitizeReceiptUrl(t.receipt);
        if (!safeSrc) {
            PFCC.showToast('Receipt blocked: only local image data URIs are permitted.', 'error');
            return;
        }
        PFCC.state.lastFocusedElement = document.activeElement;
        el.receiptPreviewImg.src = safeSrc;
        el.receiptMetaInfo.textContent = '';
        el.receiptMetaInfo.appendChild(PFCC.utils.createEl('strong', '', t.text));
        el.receiptMetaInfo.appendChild(document.createTextNode(` | ${PFCC.utils.formatCurrency(Math.abs(t.amount))} | ${t.date}`));
        el.btnDownloadReceipt.href = safeSrc;
        el.btnDownloadReceipt.download = `receipt_${t.date}_${(t.text || 'doc').replace(/\s+/g, '_')}.jpg`;
        el.receiptModal.classList.add('active');
        PFCC.audio.playSwooshSound();
        setTimeout(() => { if (el.btnCloseReceipt) el.btnCloseReceipt.focus(); }, 40);
    }

    function closeReceiptLightbox() {
        const el = PFCC.dom;
        if (el.receiptModal) el.receiptModal.classList.remove('active');
        if (PFCC.state.lastFocusedElement && typeof PFCC.state.lastFocusedElement.focus === 'function') {
            PFCC.state.lastFocusedElement.focus();
        }
    }

    function setDetailsDrawerOpen(open) {
        const el = PFCC.dom;
        if (!el.entryDetailsDrawer || !el.btnToggleEntryDetails) return;
        el.entryDetailsDrawer.classList.toggle('active', open);
        el.btnToggleEntryDetails.setAttribute('aria-expanded', String(open));
    }

    function startEditTransaction(t) {
        const el = PFCC.dom;
        if (typeof PFCC.switchWorkbenchView === 'function') PFCC.switchWorkbenchView('ledger');
        if (typeof PFCC.setQuickEntryCollapsed === 'function') PFCC.setQuickEntryCollapsed(false);
        else if (el.quickEntryBox) el.quickEntryBox.classList.remove('qe-collapsed');
        const isXfer = PFCC.utils.isTransferTx(t);
        el.editId.value = t.id;
        el.text.value = t.text;
        el.amount.value = isXfer ? PFCC.utils.getTransferAmount(t) : Math.abs(t.amount);
        el.type.value = isXfer ? 'transfer' : (t.amount < 0 ? 'expense' : 'income');
        el.category.value = t.category;
        if (PFCC.picker && typeof PFCC.picker.syncSelect === 'function') {
            PFCC.picker.syncSelect(el.type);
            PFCC.picker.syncSelect(el.category);
        }
        el.date.value = t.date;
        el.tags.value = (t.tags || []).join(' ');

        if (t.receipt) {
            el.receiptData.value = t.receipt;
            if (el.btnClearReceipt) el.btnClearReceipt.style.display = 'inline-flex';
        } else {
            el.receiptData.value = '';
            if (el.receiptFile) el.receiptFile.value = '';
            if (el.btnClearReceipt) el.btnClearReceipt.style.display = 'none';
        }

        setDetailsDrawerOpen(true);
        el.editBanner.style.display = 'flex';
        el.btnCancelEdit.style.display = 'inline-flex';
        if (el.btnSubmitTx && el.btnSubmitTx.parentNode) el.btnSubmitTx.parentNode.classList.add('is-editing');
        el.btnSubmitTx.textContent = 'Update';
        el.formHeaderTitle.textContent = 'Update Record';

        el.form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.text.focus();
        PFCC.audio.playClickSound();
    }

    function cancelEditTransaction() {
        const el = PFCC.dom;
        const langDict = PFCC.i18n[PFCC.state.settings.language] || PFCC.i18n.en;
        el.editId.value = '';
        el.editBanner.style.display = 'none';
        el.btnCancelEdit.style.display = 'none';
        if (el.btnSubmitTx && el.btnSubmitTx.parentNode) el.btnSubmitTx.parentNode.classList.remove('is-editing');
        el.btnSubmitTx.textContent = langDict.btn_commit || 'Commit';
        el.formHeaderTitle.textContent = langDict.commit_transaction || 'Quick Entry';
        el.text.value = '';
        el.amount.value = '';
        el.tags.value = '';
        if (el.fxForeignAmount) el.fxForeignAmount.value = '';
        if (el.fxRate) el.fxRate.value = '';
        if (el.receiptFile) el.receiptFile.value = '';
        if (el.receiptData) el.receiptData.value = '';
        if (el.btnClearReceipt) el.btnClearReceipt.style.display = 'none';
        el.date.value = PFCC.utils.getLocalDateString();
        setDetailsDrawerOpen(false);
        PFCC.audio.playClickSound();
    }

    function handleTransactionSubmit(e) {
        e.preventDefault();
        const el = PFCC.dom;
        const rawAmount = parseFloat(el.amount.value);
        const textVal = el.text.value.trim();
        if (!textVal || Number.isNaN(rawAmount) || rawAmount <= 0 || !el.date.value) return;

        const parsedTags = (el.tags.value || '')
            .split(/[\s,]+/)
            .map(tag => tag.trim())
            .filter(tag => tag.length > 0)
            .map(tag => tag.startsWith('#') ? tag : `#${tag}`);

        const fxAmt = el.fxForeignAmount ? parseFloat(el.fxForeignAmount.value) : NaN;
        const fxRateVal = el.fxRate ? parseFloat(el.fxRate.value) : NaN;
        const fxCur = el.fxCurrency ? (el.fxCurrency.value || 'USD').toUpperCase() : 'USD';
        if (!Number.isNaN(fxAmt) && fxAmt > 0 && !Number.isNaN(fxRateVal) && fxRateVal > 0) {
            const fxTag = `#fx:${fxAmt}_${fxCur}@${fxRateVal}`;
            if (!parsedTags.includes(fxTag)) parsedTags.push(fxTag);
        }

        const txType = el.type.value;
        const isTransfer = txType === 'transfer';
        const isExpense = txType === 'expense';
        const computedAmount = isTransfer ? 0 : (isExpense ? -Math.abs(rawAmount) : Math.abs(rawAmount));
        const receiptVal = el.receiptData ? el.receiptData.value : '';

        if (el.editId.value) {
            const targetId = el.editId.value;
            const index = PFCC.state.transactions.findIndex(t => t.id === targetId);
            if (index !== -1) {
                PFCC.state.transactions[index].text = textVal;
                PFCC.state.transactions[index].amount = computedAmount;
                PFCC.state.transactions[index].isTransfer = isTransfer;
                PFCC.state.transactions[index].transferAmount = isTransfer ? Math.abs(rawAmount) : undefined;
                PFCC.state.transactions[index].category = el.category.value;
                PFCC.state.transactions[index].date = el.date.value;
                PFCC.state.transactions[index].tags = parsedTags;
                PFCC.state.transactions[index].receipt = receiptVal || null;
            }
            cancelEditTransaction();
            PFCC.showToast('Transaction updated.', 'success');
        } else {
            const t = {
                id: Math.floor(Math.random() * 100000000).toString(16),
                text: textVal,
                amount: computedAmount,
                isTransfer,
                transferAmount: isTransfer ? Math.abs(rawAmount) : undefined,
                category: el.category.value,
                date: el.date.value,
                tags: parsedTags,
                receipt: receiptVal || null
            };
            PFCC.utils.applyAutoRules(t);
            PFCC.state.transactions.push(t);
            el.text.value = '';
            el.amount.value = '';
            el.tags.value = '';
            if (el.fxForeignAmount) el.fxForeignAmount.value = '';
            if (el.fxRate) el.fxRate.value = '';
            if (el.receiptFile) el.receiptFile.value = '';
            if (el.receiptData) el.receiptData.value = '';
            if (el.btnClearReceipt) el.btnClearReceipt.style.display = 'none';
            el.text.focus();
            PFCC.showToast(isTransfer ? 'Transfer logged (excluded from burn).' : 'Transaction committed.', 'success');
        }

        PFCC.audio.playSuccessSound();
        PFCC.updateDOM();
    }

    function removeTransaction(id) {
        const idx = PFCC.state.transactions.findIndex(t => t.id === id);
        if (idx === -1) return;
        const removedTx = Object.assign({}, PFCC.state.transactions[idx]);
        PFCC.state.transactions = PFCC.state.transactions.filter(t => t.id !== id);
        PFCC.state.selectedLedgerIds = (PFCC.state.selectedLedgerIds || []).filter(sid => sid !== id);
        if (PFCC.dom.editId && PFCC.dom.editId.value === id) cancelEditTransaction();
        PFCC.audio.playWarningSound();
        PFCC.updateDOM();
        PFCC.showToast(`Removed "${removedTx.text}".`, 'info', {
            actionLabel: 'Undo',
            onAction: () => {
                PFCC.state.transactions.splice(Math.min(idx, PFCC.state.transactions.length), 0, removedTx);
                PFCC.audio.playSuccessSound();
                PFCC.updateDOM();
            }
        });
    }

    function renderQuickPresets() {
        const el = PFCC.dom;
        if (!el.quickPresetsBar) return;
        el.quickPresetsBar.textContent = '';

        (PFCC.state.quickPresets || []).forEach(preset => {
            const chip = PFCC.utils.createEl('div', 'preset-chip');
            const applyBtn = PFCC.utils.createEl('button', 'preset-apply-btn');
            applyBtn.type = 'button';
            const sign = preset.type === 'income' ? '+' : (preset.type === 'transfer' ? '' : '-');
            applyBtn.textContent = `${preset.text} ${sign}${PFCC.utils.formatCurrency(preset.amount)}`;
            applyBtn.addEventListener('click', () => {
                if (typeof PFCC.setQuickEntryCollapsed === 'function') PFCC.setQuickEntryCollapsed(false);
                if (el.text) el.text.value = preset.text || '';
                if (el.amount) el.amount.value = preset.amount || '';
                if (el.type) el.type.value = preset.type || 'expense';
                if (el.category) el.category.value = preset.category || 'Other';
                if (PFCC.picker && typeof PFCC.picker.syncSelect === 'function') {
                    PFCC.picker.syncSelect(el.type);
                    PFCC.picker.syncSelect(el.category);
                }
                PFCC.audio.playClickSound();
                if (el.btnSubmitTx) el.btnSubmitTx.focus();
            });

            const rmBtn = PFCC.utils.createEl('button', 'preset-remove-btn');
            rmBtn.type = 'button';
            rmBtn.setAttribute('aria-label', `Remove preset ${preset.text}`);
            rmBtn.appendChild(PFCC.icons.create('close', 11));
            rmBtn.addEventListener('click', e => {
                e.stopPropagation();
                PFCC.state.quickPresets = (PFCC.state.quickPresets || []).filter(p => p.id !== preset.id);
                PFCC.utils.safeSaveJSON('appQuickPresets', PFCC.state.quickPresets);
                renderQuickPresets();
            });

            chip.appendChild(applyBtn);
            chip.appendChild(rmBtn);
            el.quickPresetsBar.appendChild(chip);
        });

        const addPresetBtn = PFCC.utils.createEl('button', 'btn btn-outline btn-sm preset-save-btn', '+ Save Preset');
        addPresetBtn.type = 'button';
        addPresetBtn.title = 'Save current Quick Entry fields as a 1-tap preset';
        addPresetBtn.addEventListener('click', () => {
            const txt = el.text ? el.text.value.trim() : '';
            const amt = el.amount ? parseFloat(el.amount.value) : NaN;
            if (!txt || Number.isNaN(amt) || amt <= 0) {
                PFCC.audio.playWarningSound();
                PFCC.showToast('Enter Description and Amount first to save a preset.', 'info');
                return;
            }
            PFCC.state.quickPresets.push({
                id: 'pre-' + Math.floor(Math.random() * 1000000),
                text: txt,
                amount: Math.abs(amt),
                type: el.type ? el.type.value : 'expense',
                category: el.category ? el.category.value : 'Other'
            });
            PFCC.utils.safeSaveJSON('appQuickPresets', PFCC.state.quickPresets);
            renderQuickPresets();
            PFCC.audio.playSuccessSound();
            PFCC.showToast(`Saved "${txt}" quick preset.`, 'success');
        });
        el.quickPresetsBar.appendChild(addPresetBtn);
    }

    function updateBulkBarUI() {
        const el = PFCC.dom;
        const count = (PFCC.state.selectedLedgerIds || []).length;
        if (el.bulkSelectedCount) el.bulkSelectedCount.textContent = `${count} selected`;
        if (el.bulkActionBar) {
            el.bulkActionBar.style.display = PFCC.state.bulkSelectActive ? 'flex' : 'none';
        }
        if (el.btnToggleBulkSelect) {
            el.btnToggleBulkSelect.classList.toggle('active', Boolean(PFCC.state.bulkSelectActive));
            el.btnToggleBulkSelect.setAttribute('aria-pressed', String(Boolean(PFCC.state.bulkSelectActive)));
        }
        const wrap = document.querySelector('.ledger-table-wrap');
        if (wrap) wrap.classList.toggle('ledger-bulk-mode', Boolean(PFCC.state.bulkSelectActive));
    }

    function bindRowSwipeActions(tr, t) {
        let startX = 0;
        let startY = 0;
        let tracking = false;

        tr.addEventListener('touchstart', e => {
            if (!e.touches || !e.touches[0]) return;
            const targetTag = e.target && e.target.tagName ? e.target.tagName.toUpperCase() : '';
            if (targetTag === 'BUTTON' || targetTag === 'INPUT' || (e.target && e.target.closest && e.target.closest('button'))) {
                tracking = false;
                return;
            }
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            tracking = true;
        }, { passive: true });

        tr.addEventListener('touchmove', e => {
            if (!tracking || !e.touches || !e.touches[0]) return;
            const dx = e.touches[0].clientX - startX;
            const dy = e.touches[0].clientY - startY;
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 14) {
                tracking = false;
                tr.style.webkitTransform = '';
                tr.style.transform = '';
                return;
            }
            if (Math.abs(dx) > 12) {
                const clamped = Math.max(-88, Math.min(88, dx));
                const tx = `translate3d(${clamped}px, 0, 0)`;
                tr.style.webkitTransform = tx;
                tr.style.transform = tx;
            }
        }, { passive: true });

        tr.addEventListener('touchend', e => {
            if (!tracking) return;
            tracking = false;
            tr.style.webkitTransform = '';
            tr.style.transform = '';
            const endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : startX;
            const dx = endX - startX;
            if (dx > 68) {
                startEditTransaction(t);
            } else if (dx < -68) {
                removeTransaction(t.id);
            }
        }, { passive: true });
    }

    function addTransactionRow(t, runningBal) {
        const el = PFCC.dom;
        const isTransfer = PFCC.utils.isTransferTx(t);
        const isExpense = !isTransfer && t.amount < 0;
        const displayAmt = isTransfer ? PFCC.utils.getTransferAmount(t) : Math.abs(t.amount);
        const tr = document.createElement('tr');
        tr.className = 'ledger-row';

        const tdDate = PFCC.utils.createEl('td', 'col-date', t.date);
        tdDate.setAttribute('data-label', 'Date');

        const tdDesc = PFCC.utils.createEl('td', 'col-desc');
        tdDesc.setAttribute('data-label', 'Description');

        const descRow = PFCC.utils.createEl('div', 'ledger-desc-line');
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.className = 'ledger-bulk-check';
        chk.checked = (PFCC.state.selectedLedgerIds || []).includes(t.id);
        chk.setAttribute('aria-label', `Select ${t.text}`);
        chk.addEventListener('change', () => {
            const list = PFCC.state.selectedLedgerIds || [];
            if (chk.checked) {
                if (!list.includes(t.id)) list.push(t.id);
            } else {
                PFCC.state.selectedLedgerIds = list.filter(id => id !== t.id);
            }
            updateBulkBarUI();
        });
        descRow.appendChild(chk);
        descRow.appendChild(PFCC.utils.createEl('span', 'ledger-desc', t.text));
        tdDesc.appendChild(descRow);

        if (t.tags && t.tags.length > 0) {
            const tagRow = PFCC.utils.createEl('div', 'ledger-tags-inline');
            t.tags.forEach(tag => tagRow.appendChild(PFCC.utils.createEl('span', 'ledger-tag', tag)));
            tdDesc.appendChild(tagRow);
        }

        const tdCat = PFCC.utils.createEl('td', 'col-cat');
        tdCat.setAttribute('data-label', 'Category');
        if (isTransfer) {
            tdCat.appendChild(PFCC.utils.createEl('span', 'ledger-badge ledger-badge-transfer', 'Transfer'));
        } else {
            tdCat.appendChild(PFCC.utils.createEl('span', 'ledger-badge', PFCC.utils.formatCategoryLabel(t.category)));
        }

        const deltaCls = isTransfer ? 'transfer' : (isExpense ? 'minus' : 'plus');
        const deltaPrefix = isTransfer ? 'XFER ' : (isExpense ? '-' : '+');
        const tdDelta = PFCC.utils.createEl(
            'td',
            `col-delta ledger-amount ${deltaCls}`,
            `${deltaPrefix}${PFCC.utils.formatCurrency(displayAmt)}`
        );
        tdDelta.setAttribute('data-label', 'Delta');

        const tdBal = PFCC.utils.createEl(
            'td',
            'col-balance ledger-running-bal',
            PFCC.utils.formatCurrency(runningBal)
        );
        tdBal.setAttribute('data-label', 'Balance');

        const tdAct = PFCC.utils.createEl('td', 'col-actions');
        tdAct.setAttribute('data-label', 'Actions');
        const actionsDiv = PFCC.utils.createEl('div', 'ledger-actions');

        if (t.receipt) {
            const receiptBtn = PFCC.utils.createEl('button', 'receipt-icon-btn');
            receiptBtn.type = 'button';
            receiptBtn.setAttribute('aria-label', `View receipt for ${t.text}`);
            receiptBtn.title = 'View attached receipt';
            receiptBtn.appendChild(PFCC.icons.create('paperclip', 14));
            receiptBtn.addEventListener('click', e => {
                e.stopPropagation();
                openReceiptLightbox(t);
            });
            actionsDiv.appendChild(receiptBtn);
        }

        const editBtn = PFCC.utils.createEl('button', 'action-icon-btn');
        editBtn.type = 'button';
        editBtn.setAttribute('aria-label', `Edit transaction: ${t.text}`);
        editBtn.title = 'Edit transaction';
        editBtn.appendChild(PFCC.icons.create('edit', 14));
        editBtn.addEventListener('click', () => startEditTransaction(t));

        const delBtn = PFCC.utils.createEl('button', 'action-icon-btn delete');
        delBtn.type = 'button';
        delBtn.setAttribute('aria-label', `Delete transaction: ${t.text}`);
        delBtn.title = 'Delete transaction';
        delBtn.appendChild(PFCC.icons.create('close', 14));
        delBtn.addEventListener('click', () => removeTransaction(t.id));

        actionsDiv.appendChild(editBtn);
        actionsDiv.appendChild(delBtn);
        tdAct.appendChild(actionsDiv);

        tr.appendChild(tdDate);
        tr.appendChild(tdDesc);
        tr.appendChild(tdCat);
        tr.appendChild(tdDelta);
        tr.appendChild(tdBal);
        tr.appendChild(tdAct);
        bindRowSwipeActions(tr, t);
        el.list.appendChild(tr);
    }

    function renderLedger() {
        const el = PFCC.dom;
        const state = PFCC.state;
        const timeframeFiltered = PFCC.utils.getFilteredTransactionsByTimeframe(state.transactions, state.timeframe);
        const runningMap = PFCC.utils.computeRunningBalanceMap(state.transactions);
        const searchTerm = (el.searchFilter ? el.searchFilter.value : '').trim().toLowerCase();

        const activeData = timeframeFiltered.filter(t => {
            const isXfer = PFCC.utils.isTransferTx(t);
            if (state.ledgerFilter.type === 'expense' && (isXfer || t.amount >= 0)) return false;
            if (state.ledgerFilter.type === 'income' && (isXfer || t.amount <= 0)) return false;
            if (state.ledgerFilter.type === 'transfer' && !isXfer) return false;
            if (state.ledgerFilter.category !== 'all' && t.category !== state.ledgerFilter.category) return false;

            if (searchTerm) {
                const inText = t.text && t.text.toLowerCase().includes(searchTerm);
                const inCat = t.category && t.category.toLowerCase().includes(searchTerm);
                const inDate = t.date && t.date.includes(searchTerm);
                const inTags = (t.tags || []).some(tag => tag.toLowerCase().includes(searchTerm));
                if (!inText && !inCat && !inDate && !inTags) return false;
            }
            return true;
        });

        activeData.sort((a, b) => {
            if (state.ledgerFilter.sort === 'date_asc') return new Date(a.date) - new Date(b.date);
            if (state.ledgerFilter.sort === 'amount_desc') return Math.abs(b.amount) - Math.abs(a.amount);
            if (state.ledgerFilter.sort === 'amount_asc') return Math.abs(a.amount) - Math.abs(b.amount);
            return new Date(b.date) - new Date(a.date);
        });

        if (el.ledgerCountBadge) {
            el.ledgerCountBadge.textContent = `${activeData.length} ${activeData.length === 1 ? 'entry' : 'entries'}`;
        }

        el.list.textContent = '';
        if (activeData.length === 0) {
            const langDict = PFCC.i18n[state.settings.language] || PFCC.i18n.en;
            const tr = document.createElement('tr');
            const td = document.createElement('td');
            td.colSpan = 6;
            const emptyBox = PFCC.utils.createEl('div', 'ledger-empty');
            const iconWrap = PFCC.utils.createEl('span', 'ledger-empty-icon');
            iconWrap.appendChild(PFCC.icons.create('folder', 26));
            emptyBox.appendChild(iconWrap);
            emptyBox.appendChild(PFCC.utils.createEl('strong', '', langDict.no_entries || 'No transactions found'));
            emptyBox.appendChild(PFCC.utils.createEl(
                'p',
                'empty-hint',
                searchTerm
                    ? 'No entries match your search filter. Clear the filter to view all records.'
                    : (langDict.empty_hint || 'Commit a transaction above to start tracking.')
            ));
            td.appendChild(emptyBox);
            tr.appendChild(td);
            el.list.appendChild(tr);
            return;
        }

        activeData.forEach(t => addTransactionRow(t, runningMap.get(t.id) || 0));
        updateBulkBarUI();
    }

    function renderUpcomingBillsBanner() {
        const el = PFCC.dom;
        if (!el.upcomingBillsBanner || !PFCC.planning || typeof PFCC.planning.getUpcomingCommitments !== 'function') return;
        const upcoming = PFCC.planning.getUpcomingCommitments(7);
        el.upcomingBillsBanner.textContent = '';
        if (upcoming.length === 0) {
            el.upcomingBillsBanner.style.display = 'none';
            return;
        }
        el.upcomingBillsBanner.style.display = 'flex';
        const first = upcoming[0];
        const dueLabel = first.daysAway === 0 ? 'Due today' : (first.daysAway === 1 ? 'Due tomorrow' : `Due in ${first.daysAway}d`);

        const info = PFCC.utils.createEl('div', 'upcoming-bills-info');
        info.appendChild(PFCC.icons.create('calendar', 14));
        const extraTxt = upcoming.length > 1 ? ` (+${upcoming.length - 1} more in 7d)` : '';
        info.appendChild(PFCC.utils.createEl('span', '', `${first.name} (${PFCC.utils.formatCurrency(first.amount)}) - ${dueLabel}${extraTxt}`));

        const commitBtn = PFCC.utils.createEl('button', 'btn btn-outline btn-sm', 'Commit');
        commitBtn.type = 'button';
        commitBtn.addEventListener('click', () => {
            const t = {
                id: Math.floor(Math.random() * 100000000).toString(16),
                text: first.name,
                amount: -Math.abs(first.amount),
                category: first.category || 'Other',
                date: PFCC.utils.getLocalDateString(),
                tags: ['#upcoming', first.kind === 'debt' ? '#debt' : '#subscription']
            };
            PFCC.utils.applyAutoRules(t);
            PFCC.state.transactions.push(t);
            PFCC.audio.playSuccessSound();
            PFCC.updateDOM();
            PFCC.showToast(`Committed ${first.name} (${PFCC.utils.formatCurrency(first.amount)}) to ledger.`, 'success');
        });

        el.upcomingBillsBanner.appendChild(info);
        el.upcomingBillsBanner.appendChild(commitBtn);
    }

    function renderSubscriptions() {
        const el = PFCC.dom;
        if (!el.subList) return;
        renderUpcomingBillsBanner();
        el.subList.textContent = '';
        let monthlyBurn = 0;

        if (PFCC.state.subscriptions.length === 0) {
            const emptyLi = PFCC.utils.createEl('li', 'ledger-empty');
            const iconWrap = PFCC.utils.createEl('span', 'ledger-empty-icon');
            iconWrap.appendChild(PFCC.icons.create('repeat', 24));
            emptyLi.appendChild(iconWrap);
            emptyLi.appendChild(PFCC.utils.createEl('p', 'empty-hint', 'No recurring subscriptions tracked. Use "+ Add Sub" to log SaaS or utility bills.'));
            el.subList.appendChild(emptyLi);
        }

        PFCC.state.subscriptions.forEach(sub => {
            const normalizedMonthly = sub.billingCycle === 'yearly' ? (sub.amount / 12) : sub.amount;
            monthlyBurn += normalizedMonthly;

            const li = PFCC.utils.createEl('li', 'sub-item');
            const info = PFCC.utils.createEl('div', 'sub-info');

            const nameSpan = PFCC.utils.createEl('div', 'sub-name');
            nameSpan.appendChild(PFCC.utils.createEl('span', '', sub.name));
            nameSpan.appendChild(PFCC.utils.createEl('span', 'ledger-badge', sub.category));

            const meta = PFCC.utils.createEl(
                'div',
                'sub-meta',
                `${sub.billingCycle.toUpperCase()} | ${PFCC.utils.formatCurrency(sub.amount)} (${PFCC.utils.formatCurrency(normalizedMonthly)}/mo)${sub.billingDay ? ' | Day ' + sub.billingDay : ''}`
            );

            info.appendChild(nameSpan);
            info.appendChild(meta);

            const actions = PFCC.utils.createEl('div', 'sub-actions');
            const commitBtn = PFCC.utils.createEl('button', 'btn btn-outline btn-sm', 'Commit');
            commitBtn.type = 'button';
            commitBtn.title = 'Commit to ledger as an expense today';
            commitBtn.addEventListener('click', () => {
                const t = {
                    id: Math.floor(Math.random() * 100000000).toString(16),
                    text: `${sub.name} (Recurring Subscription)`,
                    amount: -Math.abs(sub.amount),
                    category: sub.category,
                    date: PFCC.utils.getLocalDateString(),
                    tags: ['#subscription', '#saas']
                };
                PFCC.utils.applyAutoRules(t);
                PFCC.state.transactions.push(t);
                PFCC.audio.playSuccessSound();
                PFCC.updateDOM();
                PFCC.showToast(`Committed ${sub.name} (${PFCC.utils.formatCurrency(sub.amount)}) to ledger.`, 'success');
            });

            const delBtn = PFCC.utils.createEl('button', 'action-icon-btn delete');
            delBtn.type = 'button';
            delBtn.style.opacity = '1';
            delBtn.setAttribute('aria-label', `Delete subscription ${sub.name}`);
            delBtn.appendChild(PFCC.icons.create('close', 14));
            delBtn.addEventListener('click', () => {
                const backupSub = Object.assign({}, sub);
                PFCC.state.subscriptions = PFCC.state.subscriptions.filter(s => s.id !== sub.id);
                PFCC.utils.safeSaveJSON('appSubscriptions', PFCC.state.subscriptions);
                PFCC.audio.playWarningSound();
                PFCC.updateDOM();
                PFCC.showToast(`Removed subscription "${backupSub.name}".`, 'info', {
                    actionLabel: 'Undo',
                    onAction: () => {
                        PFCC.state.subscriptions.push(backupSub);
                        PFCC.utils.safeSaveJSON('appSubscriptions', PFCC.state.subscriptions);
                        PFCC.audio.playSuccessSound();
                        PFCC.updateDOM();
                    }
                });
            });

            actions.appendChild(commitBtn);
            actions.appendChild(delBtn);

            li.appendChild(info);
            li.appendChild(actions);
            el.subList.appendChild(li);
        });

        if (el.subBurnBadge) {
            el.subBurnBadge.textContent = `Burn: ${PFCC.utils.formatCurrency(monthlyBurn)}/mo`;
        }
    }

    function renderIous() {
        const el = PFCC.dom;
        if (!el.iouList) return;
        el.iouList.textContent = '';
        let totalReceivables = 0;
        let totalPayables = 0;

        if (PFCC.state.ious.length === 0) {
            const emptyLi = PFCC.utils.createEl('li', 'ledger-empty');
            const iconWrap = PFCC.utils.createEl('span', 'ledger-empty-icon');
            iconWrap.appendChild(PFCC.icons.create('users', 24));
            emptyLi.appendChild(iconWrap);
            emptyLi.appendChild(PFCC.utils.createEl('p', 'empty-hint', 'No split expenses or IOUs recorded. Use "+ Add IOU" to track shared bills.'));
            el.iouList.appendChild(emptyLi);
        }

        PFCC.state.ious.forEach(iou => {
            if (!iou.settled) {
                if (iou.direction === 'receivable') totalReceivables += iou.amount;
                else totalPayables += iou.amount;
            }

            const li = PFCC.utils.createEl('li', `iou-item ${iou.settled ? 'settled' : ''}`);
            const info = PFCC.utils.createEl('div', 'sub-info');

            const nameSpan = PFCC.utils.createEl('div', 'sub-name');
            nameSpan.appendChild(PFCC.utils.createEl('span', '', iou.person));
            const badgeClass = iou.settled ? 'settled' : iou.direction;
            const badgeText = iou.settled ? 'SETTLED' : (iou.direction === 'receivable' ? 'OWED TO YOU' : 'YOU OWE');
            nameSpan.appendChild(PFCC.utils.createEl('span', `iou-badge ${badgeClass}`, badgeText));

            const meta = PFCC.utils.createEl('div', 'sub-meta iou-desc', `${iou.desc} | ${PFCC.utils.formatCurrency(iou.amount)}`);
            info.appendChild(nameSpan);
            info.appendChild(meta);

            const actions = PFCC.utils.createEl('div', 'sub-actions');

            if (!iou.settled) {
                const settleBtn = PFCC.utils.createEl('button', 'btn btn-outline btn-sm');
                settleBtn.type = 'button';
                settleBtn.title = 'Mark as settled and add balancing entry to ledger';
                settleBtn.appendChild(PFCC.icons.create('check', 13));
                settleBtn.appendChild(PFCC.utils.createEl('span', '', 'Settle'));
                settleBtn.addEventListener('click', () => {
                    iou.settled = true;
                    const balancingTx = {
                        id: Math.floor(Math.random() * 100000000).toString(16),
                        text: `IOU Settled: ${iou.person} (${iou.desc})`,
                        amount: iou.direction === 'receivable' ? iou.amount : -iou.amount,
                        category: 'Other',
                        date: PFCC.utils.getLocalDateString(),
                        tags: ['#iou', '#settled']
                    };
                    PFCC.state.transactions.push(balancingTx);
                    PFCC.utils.safeSaveJSON('appIous', PFCC.state.ious);
                    PFCC.audio.playSuccessSound();
                    PFCC.updateDOM();
                    PFCC.showToast(`Settled IOU with ${iou.person}.`, 'success');
                });
                actions.appendChild(settleBtn);
            }

            const delBtn = PFCC.utils.createEl('button', 'action-icon-btn delete');
            delBtn.type = 'button';
            delBtn.style.opacity = '1';
            delBtn.setAttribute('aria-label', `Delete IOU for ${iou.person}`);
            delBtn.appendChild(PFCC.icons.create('close', 14));
            delBtn.addEventListener('click', () => {
                const backupIou = Object.assign({}, iou);
                PFCC.state.ious = PFCC.state.ious.filter(i => i.id !== iou.id);
                PFCC.utils.safeSaveJSON('appIous', PFCC.state.ious);
                PFCC.audio.playWarningSound();
                renderIous();
                PFCC.showToast(`Removed IOU with ${backupIou.person}.`, 'info', {
                    actionLabel: 'Undo',
                    onAction: () => {
                        PFCC.state.ious.push(backupIou);
                        PFCC.utils.safeSaveJSON('appIous', PFCC.state.ious);
                        PFCC.audio.playSuccessSound();
                        renderIous();
                    }
                });
            });
            actions.appendChild(delBtn);

            li.appendChild(info);
            li.appendChild(actions);
            el.iouList.appendChild(li);
        });

        const netIou = totalReceivables - totalPayables;
        if (el.iouSummaryBadge) {
            el.iouSummaryBadge.textContent = `Net: ${netIou >= 0 ? '+' : ''}${PFCC.utils.formatCurrency(netIou)}`;
            el.iouSummaryBadge.className = `status-badge ${netIou >= 0 ? 'badge-positive' : 'badge-negative'}`;
        }
    }

    function initLedger() {
        const el = PFCC.dom;
        if (el.date) el.date.value = PFCC.utils.getLocalDateString();

        if (el.btnToggleEntryDetails && el.entryDetailsDrawer) {
            el.btnToggleEntryDetails.addEventListener('click', () => {
                const isOpen = el.entryDetailsDrawer.classList.contains('active');
                setDetailsDrawerOpen(!isOpen);
                PFCC.audio.playClickSound();
            });
        }

        if (el.form) el.form.addEventListener('submit', handleTransactionSubmit);
        if (el.btnCancelEdit) el.btnCancelEdit.addEventListener('click', cancelEditTransaction);
        if (el.btnCancelEditBanner) el.btnCancelEditBanner.addEventListener('click', cancelEditTransaction);

        el.filterBtns.forEach(btn => {
            btn.addEventListener('click', e => {
                el.filterBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                if (PFCC.liquid && typeof PFCC.liquid.syncContainer === 'function') {
                    PFCC.liquid.syncContainer(e.currentTarget.parentNode, true);
                }
                PFCC.state.ledgerFilter.type = e.currentTarget.getAttribute('data-type');
                PFCC.audio.playClickSound();
                renderLedger();
            });
        });

        if (el.ledgerCatFilter) {
            el.ledgerCatFilter.addEventListener('change', e => {
                PFCC.state.ledgerFilter.category = e.target.value;
                PFCC.audio.playClickSound();
                renderLedger();
            });
        }

        if (el.ledgerSort) {
            el.ledgerSort.addEventListener('change', e => {
                PFCC.state.ledgerFilter.sort = e.target.value;
                PFCC.audio.playClickSound();
                renderLedger();
            });
        }

        if (el.searchFilter) {
            el.searchFilter.addEventListener('input', () => renderLedger());
        }

        function syncFxAmount() {
            if (!el.fxForeignAmount || !el.fxRate || !el.amount) return;
            const fa = parseFloat(el.fxForeignAmount.value);
            const r = parseFloat(el.fxRate.value);
            if (!Number.isNaN(fa) && fa > 0 && !Number.isNaN(r) && r > 0) {
                el.amount.value = (fa * r).toFixed(2);
            }
        }
        if (el.fxForeignAmount) el.fxForeignAmount.addEventListener('input', syncFxAmount);
        if (el.fxRate) el.fxRate.addEventListener('input', syncFxAmount);

        if (el.btnToggleBulkSelect) {
            el.btnToggleBulkSelect.addEventListener('click', () => {
                PFCC.state.bulkSelectActive = !PFCC.state.bulkSelectActive;
                if (!PFCC.state.bulkSelectActive) PFCC.state.selectedLedgerIds = [];
                updateBulkBarUI();
                renderLedger();
                PFCC.audio.playClickSound();
            });
        }
        if (el.btnBulkApplyCat) {
            el.btnBulkApplyCat.addEventListener('click', () => {
                const ids = PFCC.state.selectedLedgerIds || [];
                const targetCat = el.bulkCategorySelect ? el.bulkCategorySelect.value : '';
                if (!ids.length || !targetCat) {
                    PFCC.showToast('Select at least one entry first.', 'info');
                    return;
                }
                PFCC.state.transactions.forEach(t => {
                    if (ids.includes(t.id)) t.category = targetCat;
                });
                PFCC.state.selectedLedgerIds = [];
                PFCC.state.bulkSelectActive = false;
                PFCC.audio.playSuccessSound();
                PFCC.updateDOM();
                PFCC.showToast(`Updated category to ${PFCC.utils.formatCategoryLabel(targetCat)} for ${ids.length} entries.`, 'success');
            });
        }
        if (el.btnBulkAddTag) {
            el.btnBulkAddTag.addEventListener('click', () => {
                const ids = PFCC.state.selectedLedgerIds || [];
                if (!ids.length) {
                    PFCC.showToast('Select at least one entry first.', 'info');
                    return;
                }
                PFCC.openActionDialog({
                    title: 'Bulk Add #Tag',
                    message: `Add a tag across ${ids.length} selected transaction(s):`,
                    input: true,
                    inputType: 'text',
                    inputLabel: 'Tag Name',
                    placeholder: 'e.g. #reconciled',
                    confirmLabel: 'Apply Tag',
                    onConfirm: rawTag => {
                        const cleanTag = rawTag.startsWith('#') ? rawTag : ('#' + rawTag.replace(/\s+/g, ''));
                        PFCC.state.transactions.forEach(t => {
                            if (ids.includes(t.id)) {
                                if (!t.tags) t.tags = [];
                                if (!t.tags.includes(cleanTag)) t.tags.push(cleanTag);
                            }
                        });
                        PFCC.state.selectedLedgerIds = [];
                        PFCC.state.bulkSelectActive = false;
                        PFCC.audio.playSuccessSound();
                        PFCC.updateDOM();
                        PFCC.showToast(`Tagged ${ids.length} entries with ${cleanTag}.`, 'success');
                    }
                });
            });
        }
        if (el.btnBulkDelete) {
            el.btnBulkDelete.addEventListener('click', () => {
                const ids = PFCC.state.selectedLedgerIds || [];
                if (!ids.length) {
                    PFCC.showToast('Select at least one entry first.', 'info');
                    return;
                }
                const removedBatch = PFCC.state.transactions.filter(t => ids.includes(t.id)).map(t => Object.assign({}, t));
                PFCC.state.transactions = PFCC.state.transactions.filter(t => !ids.includes(t.id));
                PFCC.state.selectedLedgerIds = [];
                PFCC.state.bulkSelectActive = false;
                PFCC.audio.playWarningSound();
                PFCC.updateDOM();
                PFCC.showToast(`Removed ${removedBatch.length} entries.`, 'info', {
                    actionLabel: 'Undo',
                    onAction: () => {
                        PFCC.state.transactions = PFCC.state.transactions.concat(removedBatch);
                        PFCC.audio.playSuccessSound();
                        PFCC.updateDOM();
                    }
                });
            });
        }

        if (el.btnCloseReceipt) el.btnCloseReceipt.addEventListener('click', closeReceiptLightbox);
        if (el.btnDismissReceipt) el.btnDismissReceipt.addEventListener('click', closeReceiptLightbox);
        if (el.btnDownloadReceipt) {
            el.btnDownloadReceipt.addEventListener('click', e => {
                if (global.AndroidBridge && typeof global.AndroidBridge.saveBase64 === 'function') {
                    e.preventDefault();
                    global.AndroidBridge.saveBase64(
                        el.btnDownloadReceipt.download || 'receipt.jpg',
                        el.btnDownloadReceipt.href || ''
                    );
                }
            });
        }

        if (el.receiptFile) {
            el.receiptFile.addEventListener('change', e => {
                const file = e.target.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = event => {
                    const img = new Image();
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        let width = img.width;
                        let height = img.height;
                        const maxDim = 800;
                        if (width > height && width > maxDim) {
                            height = Math.round((height * maxDim) / width);
                            width = maxDim;
                        } else if (height > maxDim) {
                            width = Math.round((width * maxDim) / height);
                            height = maxDim;
                        }
                        canvas.width = width;
                        canvas.height = height;
                        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
                        el.receiptData.value = canvas.toDataURL('image/jpeg', 0.7);
                        if (el.btnClearReceipt) el.btnClearReceipt.style.display = 'inline-flex';
                        PFCC.audio.playClickSound();
                    };
                    img.src = event.target.result;
                };
                reader.readAsDataURL(file);
            });
        }

        if (el.btnClearReceipt) {
            el.btnClearReceipt.addEventListener('click', () => {
                if (el.receiptFile) el.receiptFile.value = '';
                if (el.receiptData) el.receiptData.value = '';
                el.btnClearReceipt.style.display = 'none';
                PFCC.audio.playClickSound();
            });
        }

        if (el.tabBtnSubs && el.tabBtnIous) {
            el.tabBtnSubs.addEventListener('click', () => {
                el.tabBtnSubs.classList.add('active');
                el.tabBtnIous.classList.remove('active');
                el.subsView.style.display = 'block';
                el.iousView.style.display = 'none';
                el.subsView.classList.remove('liquid-enter-next', 'liquid-enter-prev');
                if (el.subsView.offsetWidth >= 0) el.subsView.classList.add('liquid-enter-prev');
                el.subBurnBadge.style.display = 'inline-flex';
                el.iouSummaryBadge.style.display = 'none';
                el.btnToggleSubForm.style.display = 'inline-flex';
                el.btnToggleIouForm.style.display = 'none';
                if (PFCC.liquid && typeof PFCC.liquid.syncContainer === 'function') {
                    PFCC.liquid.syncContainer(el.tabBtnSubs.parentNode, true);
                }
                PFCC.audio.playClickSound();
            });

            el.tabBtnIous.addEventListener('click', () => {
                el.tabBtnIous.classList.add('active');
                el.tabBtnSubs.classList.remove('active');
                el.iousView.style.display = 'block';
                el.subsView.style.display = 'none';
                el.iousView.classList.remove('liquid-enter-next', 'liquid-enter-prev');
                if (el.iousView.offsetWidth >= 0) el.iousView.classList.add('liquid-enter-next');
                el.iouSummaryBadge.style.display = 'inline-flex';
                el.subBurnBadge.style.display = 'none';
                el.btnToggleIouForm.style.display = 'inline-flex';
                el.btnToggleSubForm.style.display = 'none';
                renderIous();
                if (PFCC.liquid && typeof PFCC.liquid.syncContainer === 'function') {
                    PFCC.liquid.syncContainer(el.tabBtnIous.parentNode, true);
                }
                PFCC.audio.playClickSound();
            });
        }

        if (el.btnToggleSubForm) {
            el.btnToggleSubForm.addEventListener('click', () => {
                el.subFormDrawer.classList.toggle('active');
                if (el.subFormDrawer.classList.contains('active')) el.subName.focus();
                PFCC.audio.playClickSound();
            });
        }
        if (el.btnCancelSub) {
            el.btnCancelSub.addEventListener('click', () => el.subFormDrawer.classList.remove('active'));
        }
        if (el.subForm) {
            el.subForm.addEventListener('submit', e => {
                e.preventDefault();
                const name = el.subName.value.trim();
                const amount = parseFloat(el.subAmount.value);
                const billingDayRaw = el.subBillingDay ? parseInt(el.subBillingDay.value, 10) : NaN;
                const billingDay = (!Number.isNaN(billingDayRaw) && billingDayRaw >= 1 && billingDayRaw <= 31) ? billingDayRaw : null;
                if (!name || Number.isNaN(amount) || amount <= 0) return;

                PFCC.state.subscriptions.push({
                    id: 'sub-' + Math.floor(Math.random() * 10000000),
                    name,
                    amount,
                    billingCycle: el.subCycle.value,
                    billingDay,
                    category: el.subCategory.value
                });
                PFCC.utils.safeSaveJSON('appSubscriptions', PFCC.state.subscriptions);
                el.subName.value = '';
                el.subAmount.value = '';
                if (el.subBillingDay) el.subBillingDay.value = '';
                el.subFormDrawer.classList.remove('active');
                PFCC.audio.playSuccessSound();
                PFCC.updateDOM();
            });
        }

        if (el.btnToggleIouForm) {
            el.btnToggleIouForm.addEventListener('click', () => {
                el.iouFormDrawer.classList.toggle('active');
                if (el.iouFormDrawer.classList.contains('active')) el.iouPerson.focus();
                PFCC.audio.playClickSound();
            });
        }
        if (el.btnCancelIou) {
            el.btnCancelIou.addEventListener('click', () => {
                el.iouFormDrawer.classList.remove('active');
                PFCC.audio.playClickSound();
            });
        }
        if (el.iouForm) {
            el.iouForm.addEventListener('submit', e => {
                e.preventDefault();
                const person = el.iouPerson.value.trim();
                const amount = parseFloat(el.iouAmount.value);
                const desc = el.iouDesc.value.trim();
                if (!person || Number.isNaN(amount) || amount <= 0 || !desc) return;

                PFCC.state.ious.push({
                    id: 'iou-' + Math.floor(Math.random() * 10000000),
                    person,
                    amount,
                    direction: el.iouDirection.value,
                    desc,
                    settled: false
                });
                PFCC.utils.safeSaveJSON('appIous', PFCC.state.ious);
                renderIous();
                el.iouPerson.value = '';
                el.iouAmount.value = '';
                el.iouDesc.value = '';
                el.iouFormDrawer.classList.remove('active');
                PFCC.audio.playSuccessSound();
            });
        }
    }

    PFCC.ledger = {
        openReceiptLightbox,
        closeReceiptLightbox,
        setDetailsDrawerOpen,
        startEditTransaction,
        cancelEditTransaction,
        removeTransaction,
        renderQuickPresets,
        renderLedger,
        renderSubscriptions,
        renderIous,
        initLedger
    };
})(window);
