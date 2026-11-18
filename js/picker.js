(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    let overlayEl = null;
    let sheetEl = null;
    let titleEl = null;
    let searchWrapEl = null;
    let searchInputEl = null;
    let bodyEl = null;
    let activeSelect = null;
    let openedViaKeyboard = false;

    function getSelectLabelText(selectEl) {
        if (!selectEl) return 'Select Option';
        if (selectEl.id) {
            const labels = PFCC.compat.qsa('label[for="' + selectEl.id + '"]');
            if (labels.length > 0 && labels[0].textContent) {
                return labels[0].textContent.replace(/:\s*$/, '').trim();
            }
        }
        const ariaLabel = selectEl.getAttribute('aria-label');
        if (ariaLabel) return ariaLabel;
        return 'Select Option';
    }

    function getSelectedOptionText(selectEl) {
        if (!selectEl || !selectEl.options || selectEl.options.length === 0) return '--';
        const idx = selectEl.selectedIndex >= 0 ? selectEl.selectedIndex : 0;
        const opt = selectEl.options[idx];
        return opt ? opt.textContent : '--';
    }

    function buildThemeSwatchStrip(theme) {
        const strip = PFCC.utils.createEl('span', 'picker-swatch-strip');
        const colors = [theme.bgMain, theme.accentFill, theme.accentText, theme.colorGreen];
        colors.forEach(hex => {
            const chip = PFCC.utils.createEl('span', 'picker-swatch-chip');
            chip.style.backgroundColor = hex;
            strip.appendChild(chip);
        });
        return strip;
    }

    function syncSelect(selectEl) {
        if (!selectEl || !selectEl._pickerTrigger) return;
        const trigger = selectEl._pickerTrigger;
        const val = selectEl.value;
        const label = getSelectedOptionText(selectEl);

        trigger.textContent = '';
        trigger.disabled = Boolean(selectEl.disabled);

        const content = PFCC.utils.createEl('span', 'custom-select-value');
        if (selectEl.id === 'setting-preset-theme' && PFCC.themes && PFCC.themes.OS_THEMES) {
            const themeKey = PFCC.themes.resolveThemeKey(val);
            const theme = PFCC.themes.OS_THEMES[themeKey];
            if (theme) {
                content.appendChild(buildThemeSwatchStrip(theme));
            }
        }
        const txtSpan = PFCC.utils.createEl('span', 'custom-select-label', label);
        if (selectEl.id === 'setting-font' && val) {
            txtSpan.style.fontFamily = val;
        }
        content.appendChild(txtSpan);
        trigger.appendChild(content);

        const caret = PFCC.utils.createEl('span', 'custom-select-caret');
        caret.appendChild(PFCC.icons.create('chevronDown', 14));
        trigger.appendChild(caret);
    }

    function syncAll() {
        PFCC.compat.qsa('select').forEach(sel => {
            if (!sel._pickerTrigger) {
                enhanceSelect(sel);
            } else {
                syncSelect(sel);
            }
        });
    }

    function ensureOverlay() {
        if (overlayEl) return;

        overlayEl = document.createElement('div');
        overlayEl.id = 'liquid-picker-overlay';
        overlayEl.className = 'modal-overlay liquid-picker-overlay';
        overlayEl.setAttribute('role', 'dialog');
        overlayEl.setAttribute('aria-modal', 'true');
        overlayEl.setAttribute('aria-labelledby', 'liquid-picker-title');

        sheetEl = PFCC.utils.createEl('div', 'liquid-picker-sheet window-box');
        sheetEl.setAttribute('tabindex', '-1');

        const handle = PFCC.utils.createEl('div', 'liquid-picker-handle');
        handle.setAttribute('aria-hidden', 'true');

        const header = PFCC.utils.createEl('div', 'window-header liquid-picker-header');
        titleEl = PFCC.utils.createEl('h2', 'window-title', 'Select Option');
        titleEl.id = 'liquid-picker-title';

        const closeBtn = PFCC.utils.createEl('button', 'close-btn');
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Close option picker');
        closeBtn.appendChild(PFCC.icons.create('close', 16));
        closeBtn.addEventListener('click', close);

        header.appendChild(titleEl);
        header.appendChild(closeBtn);

        searchWrapEl = PFCC.utils.createEl('div', 'liquid-picker-search-wrap');
        searchInputEl = document.createElement('input');
        searchInputEl.type = 'text';
        searchInputEl.className = 'liquid-picker-search';
        searchInputEl.placeholder = 'Filter options...';
        searchInputEl.setAttribute('aria-label', 'Filter options');
        searchInputEl.addEventListener('input', filterOptions);
        searchWrapEl.appendChild(searchInputEl);

        bodyEl = PFCC.utils.createEl('div', 'liquid-picker-body');
        bodyEl.setAttribute('role', 'listbox');

        sheetEl.appendChild(handle);
        sheetEl.appendChild(header);
        sheetEl.appendChild(searchWrapEl);
        sheetEl.appendChild(bodyEl);
        overlayEl.appendChild(sheetEl);

        overlayEl.addEventListener('click', e => {
            if (e.target === overlayEl) close();
        });

        sheetEl.addEventListener('keydown', e => {
            if (!e || typeof e.key !== 'string') return;
            if (e.key === 'Escape') {
                e.preventDefault();
                e.stopPropagation();
                close();
                return;
            }
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                const items = PFCC.compat.qsa('.liquid-picker-option', bodyEl).filter(el => !el.classList.contains('is-filtered-out'));
                if (items.length === 0) return;
                e.preventDefault();
                const curIdx = items.indexOf(document.activeElement);
                let nextIdx = 0;
                if (e.key === 'ArrowDown') nextIdx = curIdx < 0 ? 0 : (curIdx + 1) % items.length;
                else nextIdx = curIdx <= 0 ? items.length - 1 : curIdx - 1;
                items[nextIdx].focus();
            }
        });

        if (document.body) {
            document.body.appendChild(overlayEl);
        }
    }

    function filterOptions() {
        if (!bodyEl || !searchInputEl) return;
        const q = (searchInputEl.value || '').toLowerCase().trim();
        PFCC.compat.qsa('.liquid-picker-option', bodyEl).forEach(btn => {
            const hay = btn.getAttribute('data-search') || '';
            const hide = Boolean(q && hay.indexOf(q) === -1);
            btn.classList.toggle('is-filtered-out', hide);
        });
        PFCC.compat.qsa('.liquid-picker-group', bodyEl).forEach(group => {
            const visibleChild = PFCC.compat.qsa('.liquid-picker-option', group).some(b => !b.classList.contains('is-filtered-out'));
            group.classList.toggle('is-filtered-out', !visibleChild);
        });
    }

    function chooseOption(value) {
        if (!activeSelect) return;
        const prev = activeSelect.value;
        activeSelect.value = value;
        syncSelect(activeSelect);
        if (prev !== value || activeSelect.id === 'setting-preset-theme') {
            activeSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
        PFCC.audio.playClickSound();
        close();
    }

    function createOptionButton(opt, selectEl) {
        const isSelected = opt.value === selectEl.value;
        const rawText = opt.textContent || '';

        if (selectEl.id === 'setting-preset-theme' && PFCC.themes && PFCC.themes.OS_THEMES) {
            const themeKey = PFCC.themes.resolveThemeKey(opt.value);
            const theme = PFCC.themes.OS_THEMES[themeKey] || PFCC.themes.OS_THEMES.obsidian;
            const card = PFCC.utils.createEl('button', 'liquid-picker-option liquid-picker-theme-card' + (isSelected ? ' is-selected' : ''));
            card.type = 'button';
            card.setAttribute('role', 'option');
            card.setAttribute('aria-selected', String(isSelected));
            card.setAttribute('data-value', opt.value);
            card.setAttribute('data-search', (rawText + ' ' + theme.mode).toLowerCase());

            const topRow = PFCC.utils.createEl('div', 'picker-theme-top');
            topRow.appendChild(buildThemeSwatchStrip(theme));

            const modeBadge = PFCC.utils.createEl('span', 'picker-theme-mode', theme.mode.toUpperCase());
            topRow.appendChild(modeBadge);

            const bottomRow = PFCC.utils.createEl('div', 'picker-theme-bottom');
            const nameParts = rawText.split(' (');
            const nameWrap = PFCC.utils.createEl('div', 'picker-theme-meta');
            nameWrap.appendChild(PFCC.utils.createEl('span', 'picker-theme-title', nameParts[0]));
            if (nameParts[1]) {
                nameWrap.appendChild(PFCC.utils.createEl('span', 'picker-theme-sub', nameParts[1].replace(/\)$/, '')));
            }
            bottomRow.appendChild(nameWrap);

            const checkSlot = PFCC.utils.createEl('span', 'picker-option-check');
            if (isSelected) checkSlot.appendChild(PFCC.icons.create('check', 16));
            bottomRow.appendChild(checkSlot);

            card.appendChild(topRow);
            card.appendChild(bottomRow);
            card.addEventListener('click', () => chooseOption(opt.value));
            return card;
        }

        const btn = PFCC.utils.createEl('button', 'liquid-picker-option' + (isSelected ? ' is-selected' : ''));
        btn.type = 'button';
        btn.setAttribute('role', 'option');
        btn.setAttribute('aria-selected', String(isSelected));
        btn.setAttribute('data-value', opt.value);
        btn.setAttribute('data-search', rawText.toLowerCase());

        const labelWrap = PFCC.utils.createEl('span', 'picker-option-main');
        const dashSplitIdx = rawText.indexOf(' - ');
        if (dashSplitIdx > 0 && dashSplitIdx <= 6) {
            const code = rawText.slice(0, dashSplitIdx).trim();
            const desc = rawText.slice(dashSplitIdx + 3).trim();
            labelWrap.appendChild(PFCC.utils.createEl('span', 'picker-option-code', code));
            labelWrap.appendChild(PFCC.utils.createEl('span', 'picker-option-label', desc));
        } else {
            const lbl = PFCC.utils.createEl('span', 'picker-option-label', rawText);
            if (selectEl.id === 'setting-font' && opt.value) {
                lbl.style.fontFamily = opt.value;
            }
            labelWrap.appendChild(lbl);
            if (selectEl.id === 'setting-font') {
                const sample = PFCC.utils.createEl('span', 'picker-option-specimen', 'Aa 0123 $1,240');
                if (opt.value) sample.style.fontFamily = opt.value;
                labelWrap.appendChild(sample);
            }
        }
        btn.appendChild(labelWrap);

        const checkWrap = PFCC.utils.createEl('span', 'picker-option-check');
        if (isSelected) checkWrap.appendChild(PFCC.icons.create('check', 15));
        btn.appendChild(checkWrap);

        btn.addEventListener('click', () => chooseOption(opt.value));
        return btn;
    }

    function open(selectEl, viaKeyboard) {
        if (!selectEl || selectEl.disabled) return;
        ensureOverlay();
        activeSelect = selectEl;
        openedViaKeyboard = Boolean(viaKeyboard);
        if (selectEl._pickerTrigger) {
            selectEl._pickerTrigger.setAttribute('aria-expanded', 'true');
        }

        titleEl.textContent = getSelectLabelText(selectEl);
        bodyEl.textContent = '';

        const totalOptions = selectEl.options ? selectEl.options.length : 0;
        if (searchWrapEl && searchInputEl) {
            searchInputEl.value = '';
            searchWrapEl.style.display = totalOptions >= 10 ? 'block' : 'none';
        }

        const children = selectEl.children ? Array.prototype.slice.call(selectEl.children) : [];
        children.forEach(node => {
            const tag = node.tagName ? node.tagName.toUpperCase() : '';
            if (tag === 'OPTGROUP') {
                const groupWrap = PFCC.utils.createEl('div', 'liquid-picker-group');
                groupWrap.appendChild(PFCC.utils.createEl('div', 'liquid-picker-group-label', node.label || 'Options'));
                const opts = node.children ? Array.prototype.slice.call(node.children) : [];
                opts.forEach(opt => {
                    if (opt.tagName && opt.tagName.toUpperCase() === 'OPTION') {
                        groupWrap.appendChild(createOptionButton(opt, selectEl));
                    }
                });
                bodyEl.appendChild(groupWrap);
            } else if (tag === 'OPTION') {
                bodyEl.appendChild(createOptionButton(node, selectEl));
            }
        });

        overlayEl.classList.add('active');
        PFCC.audio.playClickSound();

        setTimeout(() => {
            if (!overlayEl.classList.contains('active')) return;
            const selectedBtn = PFCC.compat.qsa('.liquid-picker-option.is-selected', bodyEl)[0];
            if (selectedBtn && typeof selectedBtn.scrollIntoView === 'function') {
                selectedBtn.scrollIntoView({ block: 'nearest' });
            }
            if (openedViaKeyboard) {
                if (totalOptions >= 10 && searchInputEl) {
                    searchInputEl.focus({ preventScroll: true });
                } else if (selectedBtn) {
                    selectedBtn.focus({ preventScroll: true });
                } else if (sheetEl) {
                    sheetEl.focus({ preventScroll: true });
                }
            } else if (sheetEl) {
                sheetEl.focus({ preventScroll: true });
            }
        }, 30);
    }

    function close() {
        if (!overlayEl || !overlayEl.classList.contains('active')) return;
        overlayEl.classList.remove('active');
        const triggerToRestore = activeSelect && activeSelect._pickerTrigger ? activeSelect._pickerTrigger : null;
        const shouldRestoreFocus = openedViaKeyboard;
        if (triggerToRestore) {
            triggerToRestore.setAttribute('aria-expanded', 'false');
        }
        activeSelect = null;
        openedViaKeyboard = false;
        if (shouldRestoreFocus && triggerToRestore && typeof triggerToRestore.focus === 'function') {
            triggerToRestore.focus({ preventScroll: true });
        }
    }

    function isOpen() {
        return Boolean(overlayEl && overlayEl.classList.contains('active'));
    }

    function enhanceSelect(selectEl) {
        if (!selectEl || selectEl._pickerTrigger || !selectEl.parentNode) return;

        selectEl.classList.add('sr-only-select');
        selectEl.setAttribute('tabindex', '-1');
        selectEl.setAttribute('aria-hidden', 'true');

        const trigger = document.createElement('button');
        trigger.type = 'button';
        trigger.className = 'custom-select-trigger' + (selectEl.classList.contains('ledger-select') ? ' custom-select-trigger--compact' : '');
        if (selectEl.id) trigger.id = 'picker-trigger-' + selectEl.id;
        trigger.setAttribute('aria-haspopup', 'listbox');
        trigger.setAttribute('aria-expanded', 'false');
        trigger.setAttribute('aria-label', getSelectLabelText(selectEl));

        selectEl._pickerTrigger = trigger;
        selectEl.parentNode.insertBefore(trigger, selectEl.nextSibling);

        let lastKeyTriggerAt = 0;
        trigger.addEventListener('keydown', e => {
            if (e && (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
                lastKeyTriggerAt = Date.now();
            }
        });
        trigger.addEventListener('click', () => {
            const isKeyboardClick = (Date.now() - lastKeyTriggerAt) < 150;
            open(selectEl, isKeyboardClick);
        });
        selectEl.addEventListener('change', () => syncSelect(selectEl));

        if (selectEl.id) {
            PFCC.compat.qsa('label[for="' + selectEl.id + '"]').forEach(lbl => {
                lbl.addEventListener('click', e => {
                    e.preventDefault();
                    open(selectEl, false);
                });
            });
        }

        syncSelect(selectEl);
    }

    function enhanceAll() {
        PFCC.compat.qsa('select').forEach(enhanceSelect);
    }

    function initPicker() {
        enhanceAll();
    }

    PFCC.picker = {
        enhanceAll,
        syncSelect,
        syncAll,
        open,
        close,
        isOpen,
        initPicker
    };
})(window);
