(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    const TRACK_DEFS = [
        { trackSel: '.workbench-tabs', itemSel: '.workbench-tab.active', variant: 'dock' },
        { trackSel: '.settings-tabs', itemSel: '.tab-btn.active', variant: 'tabline' },
        { trackSel: '.segmented-group', itemSel: '.segment-btn.active', variant: 'segment' },
        { trackSel: '.chart-toggle-group', itemSel: '.chart-tab-btn.active', variant: 'segment' },
        { trackSel: '.panel-tab-group', itemSel: '.panel-tab-btn.active', variant: 'segment' }
    ];

    function findMatchingDef(container) {
        if (!container || !container.classList) return null;
        for (let i = 0; i < TRACK_DEFS.length; i++) {
            const cls = TRACK_DEFS[i].trackSel.slice(1);
            if (container.classList.contains(cls)) return TRACK_DEFS[i];
        }
        return null;
    }

    function ensureIndicator(container, variant) {
        let pill = null;
        for (let i = 0; i < container.children.length; i++) {
            const child = container.children[i];
            if (child.classList && child.classList.contains('liquid-pill-indicator')) {
                pill = child;
                break;
            }
        }
        if (!pill) {
            pill = document.createElement('span');
            pill.className = 'liquid-pill-indicator' + (variant ? (' liquid-pill-indicator--' + variant) : '');
            pill.setAttribute('aria-hidden', 'true');
            container.insertBefore(pill, container.firstChild || null);
        }
        container.classList.add('liquid-ready');
        return pill;
    }

    function syncContainer(container, animate) {
        const def = findMatchingDef(container);
        if (!def) return;

        let activeItem = null;
        const itemClass = def.itemSel.slice(1).split('.')[0];
        for (let i = 0; i < container.children.length; i++) {
            const c = container.children[i];
            if (c.classList && c.classList.contains(itemClass) && c.classList.contains('active')) {
                activeItem = c;
                break;
            }
        }
        if (!activeItem) return;

        const w = activeItem.offsetWidth || 0;
        const h = activeItem.offsetHeight || 0;
        if (w <= 0 || h <= 0) return;

        const pill = ensureIndicator(container, def.variant);
        const x = activeItem.offsetLeft || 0;
        const y = activeItem.offsetTop || 0;

        if (!animate) {
            pill.classList.add('liquid-no-trans');
        } else {
            pill.classList.remove('liquid-no-trans');
        }

        pill.style.width = w + 'px';
        pill.style.height = h + 'px';
        const translate = 'translate3d(' + x + 'px, ' + y + 'px, 0)';
        pill.style.webkitTransform = translate;
        pill.style.transform = translate;
        pill.style.opacity = '1';

        if (!animate) {
            // Commit non-animated geometry before enabling transitions
            if (pill.offsetWidth >= 0) {
                pill.classList.remove('liquid-no-trans');
            }
        } else {
            pill.classList.remove('is-morphing');
            if (pill.offsetWidth >= 0) {
                pill.classList.add('is-morphing');
            }
            if (pill._morphTimer) clearTimeout(pill._morphTimer);
            pill._morphTimer = setTimeout(() => {
                pill.classList.remove('is-morphing');
            }, 220);
        }
    }

    function syncAll(animate) {
        TRACK_DEFS.forEach(def => {
            PFCC.compat.qsa(def.trackSel).forEach(track => {
                syncContainer(track, Boolean(animate));
            });
        });
    }

    function initLiquid() {
        syncAll(false);
        setTimeout(() => syncAll(false), 80);

        let resizeTimer = null;
        global.addEventListener('resize', () => {
            if (resizeTimer) clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => syncAll(false), 60);
        });
    }

    PFCC.liquid = {
        syncContainer,
        syncAll,
        initLiquid
    };
})(window);
