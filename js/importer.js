(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function parseCsvText(text) {
        const lines = text.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
        if (lines.length < 2) throw new Error('CSV file must have a header row and at least one data row.');

        function parseCsvLine(line) {
            const row = [];
            let inQuotes = false;
            let token = '';
            for (let i = 0; i < line.length; i++) {
                const char = line[i];
                if (char === '"') {
                    if (inQuotes && line[i + 1] === char) {
                        token += char;
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    row.push(token.trim());
                    token = '';
                } else {
                    token += char;
                }
            }
            row.push(token.trim());
            return row;
        }

        const headers = parseCsvLine(lines[0]);
        const dataRows = lines.slice(1).map(parseCsvLine);
        return { headers, dataRows };
    }

    function normalizeCsvDate(rawDate) {
        const trimmed = String(rawDate || '').trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
        const d = new Date(trimmed);
        return !Number.isNaN(d.getTime()) ? PFCC.utils.getLocalDateString(d) : PFCC.utils.getLocalDateString();
    }

    function openCsvImporter() {
        const el = PFCC.dom;
        if (!el.importModal) return;
        PFCC.state.lastFocusedElement = document.activeElement;
        el.importModal.classList.add('active');
        PFCC.state.parsedCsvRows = [];
        if (el.importMappingSection) el.importMappingSection.style.display = 'none';
        if (el.importDropzone) el.importDropzone.style.display = 'block';
        if (el.btnCommitImport) el.btnCommitImport.disabled = true;
        PFCC.audio.playSwooshSound();
        setTimeout(() => { if (el.btnCloseImport) el.btnCloseImport.focus(); }, 40);
    }

    function closeCsvImporter() {
        const el = PFCC.dom;
        if (el.importModal) el.importModal.classList.remove('active');
        if (PFCC.state.lastFocusedElement && typeof PFCC.state.lastFocusedElement.focus === 'function') {
            PFCC.state.lastFocusedElement.focus();
        }
    }

    function renderCsvPreview() {
        const el = PFCC.dom;
        const dateIdx = parseInt(el.mapDate.value, 10);
        const descIdx = parseInt(el.mapDesc.value, 10);
        const amtIdx = parseInt(el.mapAmount.value, 10);
        const catIdx = parseInt(el.mapCategory.value, 10);

        el.importPreviewBody.textContent = '';
        let validCount = 0;

        PFCC.state.parsedCsvRows.forEach((row, rIdx) => {
            const rawDate = row[dateIdx] || PFCC.utils.getLocalDateString();
            const rawDesc = row[descIdx] || 'Imported Entry';
            const rawAmtStr = (row[amtIdx] || '').replace(/[$,]/g, '').trim();
            const rawAmt = parseFloat(rawAmtStr) || 0;
            const rawCat = catIdx >= 0 ? (row[catIdx] || 'Other') : 'Other';

            if (rawAmt === 0 && !rawDesc) return;
            validCount++;

            const tr = document.createElement('tr');
            tr.className = 'import-preview-row';

            const tdCheck = document.createElement('td');
            const chk = document.createElement('input');
            chk.type = 'checkbox';
            chk.className = 'import-row-check';
            chk.setAttribute('data-row', String(rIdx));
            chk.checked = true;
            tdCheck.appendChild(chk);

            const tdDate = PFCC.utils.createEl('td', '', rawDate);
            const tdDesc = PFCC.utils.createEl('td', '', rawDesc);

            const tdCat = document.createElement('td');
            tdCat.appendChild(PFCC.utils.createEl('span', 'ledger-badge', rawCat));

            const tdAmt = PFCC.utils.createEl(
                'td',
                `import-amt-cell ${rawAmt < 0 ? 'text-red' : 'text-green'}`,
                `${rawAmt < 0 ? '-' : '+'}${PFCC.utils.formatCurrency(Math.abs(rawAmt))}`
            );

            tr.appendChild(tdCheck);
            tr.appendChild(tdDate);
            tr.appendChild(tdDesc);
            tr.appendChild(tdCat);
            tr.appendChild(tdAmt);
            el.importPreviewBody.appendChild(tr);
        });

        el.importCount.textContent = String(validCount);
        el.btnCommitImport.disabled = validCount === 0;
    }

    function setupCsvMapping(headers, dataRows) {
        const el = PFCC.dom;
        PFCC.state.parsedCsvRows = dataRows;
        el.importDropzone.style.display = 'none';
        el.importMappingSection.style.display = 'block';

        const populateSelect = (selectEl, defaultPatterns) => {
            selectEl.textContent = '';
            headers.forEach((h, idx) => {
                const opt = document.createElement('option');
                opt.value = String(idx);
                opt.textContent = `${h} (Col ${idx + 1})`;
                selectEl.appendChild(opt);
            });
            const matched = headers.findIndex(h => defaultPatterns.some(p => h.toLowerCase().includes(p)));
            if (matched !== -1) selectEl.value = String(matched);
        };

        populateSelect(el.mapDate, ['date', 'time', 'posted', 'day']);
        populateSelect(el.mapDesc, ['desc', 'description', 'name', 'payee', 'memo', 'details']);
        populateSelect(el.mapAmount, ['amount', 'amt', 'total', 'value', 'price']);

        el.mapCategory.textContent = '';
        const autoOpt = document.createElement('option');
        autoOpt.value = '-1';
        autoOpt.textContent = 'Auto Assign / Default';
        el.mapCategory.appendChild(autoOpt);
        headers.forEach((h, idx) => {
            const opt = document.createElement('option');
            opt.value = String(idx);
            opt.textContent = `${h} (Col ${idx + 1})`;
            el.mapCategory.appendChild(opt);
        });
        const catMatched = headers.findIndex(h => ['category', 'cat', 'type'].some(p => h.toLowerCase().includes(p)));
        if (catMatched !== -1) el.mapCategory.value = String(catMatched);

        if (!PFCC.state.csvListenersBound) {
            [el.mapDate, el.mapDesc, el.mapAmount, el.mapCategory].forEach(sel => {
                sel.addEventListener('change', renderCsvPreview);
            });
            PFCC.state.csvListenersBound = true;
        }

        renderCsvPreview();
    }

    function handleCsvFile(file) {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = e => {
            try {
                const parsed = parseCsvText(e.target.result);
                setupCsvMapping(parsed.headers, parsed.dataRows);
                PFCC.audio.playSuccessSound();
            } catch (err) {
                PFCC.showToast('Failed to parse CSV: ' + err.message, 'error');
                PFCC.audio.playWarningSound();
            }
        };
        reader.readAsText(file);
    }

    function exportCsv() {
        PFCC.audio.playClickSound();
        const txs = PFCC.state.transactions;
        if (!txs.length) {
            PFCC.showToast('No transactions recorded to export.', 'info');
            return;
        }
        const rows = txs.map(t => [
            t.id,
            t.date,
            `"${(t.text || '').replace(/"/g, '""')}"`,
            `"${t.category}"`,
            Math.abs(t.amount).toFixed(2),
            t.amount < 0 ? 'Expense' : 'Income',
            `"${(t.tags || []).join(' ')}"`
        ]);
        const csvContent = ['ID,Date,Description,Category,Amount,Type,Tags', ...rows.map(r => r.join(','))].join('\r\n');
        PFCC.utils.downloadTextFile(`ledger_${PFCC.utils.getLocalDateString()}.csv`, csvContent, 'text/csv;charset=utf-8');
        PFCC.showToast(`Exported ${txs.length} transactions to CSV.`, 'success');
    }

    function initImporter() {
        const el = PFCC.dom;
        if (el.btnImportCsv) el.btnImportCsv.addEventListener('click', openCsvImporter);
        if (el.btnCloseImport) el.btnCloseImport.addEventListener('click', closeCsvImporter);
        if (el.btnCancelImport) el.btnCancelImport.addEventListener('click', closeCsvImporter);
        if (el.btnExportCsv) el.btnExportCsv.addEventListener('click', exportCsv);

        if (el.csvFileInput) {
            el.csvFileInput.addEventListener('change', e => {
                handleCsvFile(e.target.files[0]);
                e.target.value = '';
            });
        }

        if (el.importDropzone) {
            el.importDropzone.addEventListener('dragover', e => {
                e.preventDefault();
                el.importDropzone.classList.add('dragover');
            });
            el.importDropzone.addEventListener('dragleave', () => {
                el.importDropzone.classList.remove('dragover');
            });
            el.importDropzone.addEventListener('drop', e => {
                e.preventDefault();
                el.importDropzone.classList.remove('dragover');
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    handleCsvFile(e.dataTransfer.files[0]);
                }
            });
        }

        if (el.btnSelectAllImport) {
            el.btnSelectAllImport.addEventListener('click', () => {
                PFCC.compat.qsa('.import-row-check').forEach(c => { c.checked = true; });
                if (el.importMasterCheck) el.importMasterCheck.checked = true;
            });
        }

        if (el.btnDeselectAllImport) {
            el.btnDeselectAllImport.addEventListener('click', () => {
                PFCC.compat.qsa('.import-row-check').forEach(c => { c.checked = false; });
                if (el.importMasterCheck) el.importMasterCheck.checked = false;
            });
        }

        if (el.importMasterCheck) {
            el.importMasterCheck.addEventListener('change', e => {
                PFCC.compat.qsa('.import-row-check').forEach(c => { c.checked = e.target.checked; });
            });
        }

        if (el.btnCommitImport) {
            el.btnCommitImport.addEventListener('click', () => {
                const dateIdx = parseInt(el.mapDate.value, 10);
                const descIdx = parseInt(el.mapDesc.value, 10);
                const amtIdx = parseInt(el.mapAmount.value, 10);
                const catIdx = parseInt(el.mapCategory.value, 10);

                const checkedBoxes = PFCC.compat.qsa('.import-row-check:checked');
                if (checkedBoxes.length === 0) {
                    PFCC.showToast('Select at least one transaction to import.', 'error');
                    return;
                }

                let importedCount = 0;
                checkedBoxes.forEach(cb => {
                    const rIdx = parseInt(cb.getAttribute('data-row'), 10);
                    const row = PFCC.state.parsedCsvRows[rIdx];
                    if (!row) return;

                    const dateVal = normalizeCsvDate(row[dateIdx]);

                    const descVal = (row[descIdx] || 'Imported Entry').trim();
                    const rawAmt = parseFloat((row[amtIdx] || '').replace(/[$,]/g, '').trim()) || 0;
                    const catVal = catIdx >= 0 && row[catIdx] ? row[catIdx].trim() : 'Other';

                    const newTx = {
                        id: Math.floor(Math.random() * 100000000).toString(16),
                        text: descVal,
                        amount: rawAmt,
                        category: catVal,
                        date: dateVal,
                        tags: ['#imported', '#csv']
                    };
                    PFCC.utils.applyAutoRules(newTx);
                    PFCC.state.transactions.push(newTx);
                    importedCount++;
                });

                closeCsvImporter();
                PFCC.updateDOM();
                PFCC.audio.playSuccessSound();
                PFCC.showToast(`Imported ${importedCount} transactions into ledger.`, 'success');
            });
        }
    }

    PFCC.importer = {
        parseCsvText,
        normalizeCsvDate,
        openCsvImporter,
        closeCsvImporter,
        exportCsv,
        initImporter
    };
})(window);
