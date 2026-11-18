import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

function loadAppModules(mockStorageData = {}, { throwOnSave = false } = {}) {
    const store = new Map(Object.entries(mockStorageData));
    const listeners = new Map();

    const makeClassList = () => {
        const set = new Set();
        return {
            add: (...c) => c.forEach(x => set.add(x)),
            remove: (...c) => c.forEach(x => set.delete(x)),
            toggle: (c, force) => {
                if (force === undefined) {
                    if (set.has(c)) set.delete(c);
                    else set.add(c);
                } else if (force) {
                    set.add(c);
                } else {
                    set.delete(c);
                }
            },
            contains: c => set.has(c)
        };
    };

    const mockCtx = {
        scale() {}, setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() {}, fillRect() {}, fillText() {}, arc() {}, closePath() {},
        fill() {}, save() {}, restore() {}, translate() {}, rotate() {},
        setLineDash() {}, strokeRect() {}, roundRect() {},
        measureText: txt => ({ width: String(txt || '').length * 7 }),
        createLinearGradient: () => ({ addColorStop() {} })
    };

    const makeMockNode = (tagName = 'div') => {
        const node = {
            tagName: tagName.toUpperCase(),
            children: [],
            style: {
                setProperty(k, v) { this[k] = String(v); },
                removeProperty(k) { delete this[k]; }
            },
            attributes: {},
            dataset: {},
            className: '',
            textContent: '',
            innerHTML: '',
            value: '',
            checked: false,
            disabled: false,
            clientWidth: 400,
            clientHeight: 220,
            width: 400,
            height: 220,
            parentNode: null,
            classList: makeClassList(),
            get firstChild() {
                return this.children[0] || null;
            },
            appendChild(child) {
                child.parentNode = this;
                this.children.push(child);
                return child;
            },
            setAttribute(k, v) {
                this.attributes[k] = String(v);
            },
            getAttribute(k) {
                return this.attributes[k] ?? null;
            },
            hasAttribute(k) {
                return Object.prototype.hasOwnProperty.call(this.attributes, k);
            },
            addEventListener(ev, fn) {
                if (!listeners.has(ev)) listeners.set(ev, []);
                listeners.get(ev).push(fn);
            },
            dispatchEvent() {},
            querySelectorAll() { return []; },
            querySelector() { return makeMockNode('span'); },
            closest() { return null; },
            matches() { return false; },
            getBoundingClientRect() { return { width: 400, height: 220, top: 0, left: 0, right: 400, bottom: 220 }; },
            getContext() { return mockCtx; },
            focus() {},
            click() {},
            scrollIntoView() {},
            remove() {
                if (this.parentNode && Array.isArray(this.parentNode.children)) {
                    const idx = this.parentNode.children.indexOf(this);
                    if (idx !== -1) this.parentNode.children.splice(idx, 1);
                    this.parentNode = null;
                }
            }
        };
        return node;
    };

    const idNodes = new Map();
    const docListeners = new Map();
    const documentMock = {
        readyState: 'complete',
        documentElement: makeMockNode('html'),
        body: makeMockNode('body'),
        activeElement: null,
        createElement: tag => makeMockNode(tag),
        createElementNS: (_ns, tag) => makeMockNode(tag),
        createTextNode: txt => ({ nodeType: 3, textContent: String(txt) }),
        getElementById: id => {
            if (!idNodes.has(id)) idNodes.set(id, makeMockNode('div'));
            return idNodes.get(id);
        },
        querySelector: () => makeMockNode('div'),
        querySelectorAll: () => [],
        addEventListener: (ev, fn) => {
            if (!docListeners.has(ev)) docListeners.set(ev, []);
            docListeners.get(ev).push(fn);
        },
        _dispatchKeydown: evt => {
            const list = docListeners.get('keydown') || [];
            list.forEach(fn => fn(evt));
        }
    };

    const sandbox = {
        window: null,
        document: documentMock,
        localStorage: {
            getItem: k => (store.has(k) ? store.get(k) : null),
            setItem: (k, v) => {
                if (throwOnSave) throw new Error('QuotaExceededError');
                store.set(k, String(v));
            },
            removeItem: k => store.delete(k)
        },
        navigator: {},
        Intl,
        Date,
        Math,
        JSON,
        Number,
        String,
        Array,
        Object,
        Error,
        setTimeout: () => 0,
        clearTimeout: () => {},
        setInterval: () => 0,
        requestAnimationFrame: () => 0,
        devicePixelRatio: 1,
        getComputedStyle: el => ({
            paddingTop: (el && el.style && el.style.paddingTop) || '0px',
            paddingRight: (el && el.style && el.style.paddingRight) || '0px',
            paddingBottom: (el && el.style && el.style.paddingBottom) || '0px',
            paddingLeft: (el && el.style && el.style.paddingLeft) || '0px',
            getPropertyValue: () => ''
        }),
        matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {} }),
        addEventListener: () => {},
        removeEventListener: () => {},
        console
    };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;

    const files = ['compat.js', 'icons.js', 'i18n.js', 'themes.js', 'state.js', 'audio.js', 'markets.js', 'charts.js', 'ledger.js', 'planning.js', 'importer.js', 'cli.js', 'settings.js', 'main.js'];
    for (const file of files) {
        const code = fs.readFileSync(path.join(rootDir, 'js', file), 'utf8');
        vm.runInNewContext(code, sandbox, { filename: file });
    }
    return { PFCC: sandbox.PFCC, store, dispatchKeydown: documentMock._dispatchKeydown };
}

test('resilient startup with corrupted localStorage JSON', () => {
    const { PFCC } = loadAppModules({
        appTransactions: '{corrupted_json',
        appSettings: 'not-json',
        appSavingsVaults: '[[['
    });
    assert.ok(Array.isArray(PFCC.state.transactions));
    assert.equal(PFCC.state.transactions.length, 0);
    assert.equal(PFCC.state.settings.preset, 'obsidian');
});

test('legacy theme and emoji vault icon migration', () => {
    const { PFCC } = loadAppModules({
        appSettings: JSON.stringify({ preset: 'tokyonight', radius: '20px', font: "'Inter', sans-serif" }),
        appSavingsVaults: JSON.stringify([{ id: 'v1', name: 'Laptop', target: 1000, saved: 100, icon: '\uD83D\uDCBB' }])
    });
    assert.equal(PFCC.state.settings.preset, 'obsidian');
    assert.equal(PFCC.state.settings.radius, '6px');
    assert.equal(PFCC.state.settings.font, "'JetBrains Mono', monospace");
    assert.equal(PFCC.state.savingsVaults[0].icon, 'laptop');
});

test('safeSaveJSON gracefully handles QuotaExceededError without throwing', () => {
    const { PFCC } = loadAppModules({}, { throwOnSave: true });
    const ok = PFCC.utils.safeSaveJSON('appTransactions', [{ id: '1' }]);
    assert.equal(ok, false);
});

test('auto-categorization rules apply category and deduplicated tags', () => {
    const { PFCC } = loadAppModules();
    const tx = { id: 'tx1', text: 'AWS EC2 Production Server', amount: -620, category: 'Other', tags: ['#cloud'] };
    PFCC.utils.applyAutoRules(tx);
    assert.equal(tx.category, 'Software');
    assert.deepEqual(tx.tags, ['#cloud', '#devops', '#major']);
});

test('CSV parser handles quoted commas and escaped quotes', () => {
    const { PFCC } = loadAppModules();
    const csv = 'Date,Description,Amount,Category\n2026-11-01,"Cloud, Hosting ""Pro""",-49.50,Software\n2026-11-02,Client Retainer,1500.00,Salary';
    const parsed = PFCC.importer.parseCsvText(csv);
    assert.deepStrictEqual([...parsed.headers], ['Date', 'Description', 'Amount', 'Category']);
    assert.equal(parsed.dataRows.length, 2);
    assert.equal(parsed.dataRows[0][1], 'Cloud, Hosting "Pro"');
    assert.equal(parsed.dataRows[0][2], '-49.50');
});

test('runway and debt snowball/avalanche schedules compute accurately', () => {
    const { PFCC } = loadAppModules();
    const txs = [
        { id: '1', amount: 3000, date: '2026-11-01' },
        { id: '2', amount: -1500, date: '2026-11-05' }
    ];
    const runwayPos = PFCC.planning.calculateRunway(txs, txs);
    assert.equal(runwayPos.status, 'positive');

    const burnOnly = [{ id: '3', amount: -500, date: '2026-11-06' }];
    const runwayBurn = PFCC.planning.calculateRunway(burnOnly, [{ id: 'a', amount: 2000, date: '2026-10-01' }]);
    assert.equal(runwayBurn.months, 4);
    assert.equal(runwayBurn.status, 'warning');

    const debts = [
        { id: 'd1', name: 'Card A', balance: 1000, rate: 24, minPayment: 100 },
        { id: 'd2', name: 'Loan B', balance: 500, rate: 5, minPayment: 100 }
    ];
    const snowball = PFCC.planning.calculateDebtPayoffSchedule(debts, 'snowball');
    const avalanche = PFCC.planning.calculateDebtPayoffSchedule(debts, 'avalanche');
    assert.equal(snowball.sorted[0].name, 'Loan B');
    assert.equal(avalanche.sorted[0].name, 'Card A');
    assert.ok(snowball.months > 0 && snowball.totalInterest > 0);
});

test('chronological running balance, treasury ratios, and budget pace calculations', () => {
    const { PFCC } = loadAppModules();
    const txs = [
        { id: 't2', amount: -200, category: 'Software', date: '2026-11-10' },
        { id: 't1', amount: 1500, category: 'Salary', date: '2026-11-01' },
        { id: 't3', amount: -100, category: 'Food', date: '2026-11-12' }
    ];
    const balMap = PFCC.utils.computeRunningBalanceMap(txs);
    assert.equal(balMap.get('t1'), 1500);
    assert.equal(balMap.get('t2'), 1300);
    assert.equal(balMap.get('t3'), 1200);

    const subs = [{ id: 's1', name: 'VPS', amount: 30, billingCycle: 'monthly' }];
    const ratios = PFCC.planning.computeFinancialRatios(txs, txs, subs, 0.25);
    assert.equal(Math.round(ratios.savingsRate), 80); // (1500 - 300)/1500 = 80%
    assert.equal(Math.round(ratios.fixedBurnRatio), 10); // 30/300 = 10%
    assert.equal(ratios.taxCovered, true); // 1200 >= 375

    const ranked = PFCC.charts.computeRankedCategories(txs, { Software: 150 });
    assert.equal(ranked[0].category, 'Software');
    assert.equal(ranked[0].total, 200);
    assert.equal(ranked[0].cap, 150);

    const pace = PFCC.charts.computeBudgetPaceSeries(txs, { year: 2026, month: 10 }, 1000);
    assert.equal(pace.daysInMonth, 30);
    assert.equal(pace.actualCumulative[9], 200);
    assert.equal(pace.actualCumulative[11], 300);
});

test('no em dashes, purple gradients, pill radii, or external Chart.js CDN exist', () => {
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
    const fav = fs.readFileSync(path.join(rootDir, 'favicon.svg'), 'utf8');
    const allText = [html, css, fav].join('\n');

    assert.equal(allText.includes('\u2014'), false, 'Found forbidden em dash');
    assert.equal(/gradient-btn|gradient-text|#bb9af7|#a855f7/i.test(allText), false, 'Found forbidden purple gradient');
    assert.equal(/border-radius:\s*(20px|9999px|50%)/i.test(css), false, 'Found pill/circular button radius in CSS');
    assert.equal(html.includes('cdn.jsdelivr.net/npm/chart.js'), false, 'External Chart.js CDN should be removed');
    const entries = fs.readdirSync(rootDir);
    assert.equal(entries.includes('index.html'), true, 'Lowercase index.html must exist');
    assert.equal(entries.includes('Index.html'), false, 'Uppercase Index.html should not exist');
    assert.equal(entries.includes('script.js'), false, 'Old script.js should not exist');
});

test('all JS modules use Chromium 51 (ES6) compatible syntax and compat.js polyfills work', () => {
    const jsFiles = fs.readdirSync(path.join(rootDir, 'js')).filter(f => f.endsWith('.js'));
    assert.equal(jsFiles.includes('compat.js'), true, 'js/compat.js must exist');
    const html = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
    assert.equal(html.includes('<script defer src="js/compat.js"></script>'), true, 'index.html must load js/compat.js');

    for (const file of jsFiles) {
        const src = fs.readFileSync(path.join(rootDir, 'js', file), 'utf8');
        assert.equal(/\basync\s+function\b|\basync\s*\(|\bawait\s+/.test(src), false, `${file} contains async/await (Chrome 55+)`);
        assert.equal(/\?\./.test(src), false, `${file} contains optional chaining ?. (Chrome 80+)`);
        assert.equal(/\?\?/.test(src), false, `${file} contains nullish coalescing ?? (Chrome 80+)`);
        assert.equal(/\.pad(?:Start|End)\b/.test(src) && file !== 'compat.js', false, `${file} uses String.padStart/End directly`);
        assert.equal(/\.flatMap\b/.test(src) && file !== 'compat.js', false, `${file} uses Array.flatMap directly`);
        assert.equal(/querySelectorAll\([^)]*\)\.forEach/.test(src), false, `${file} calls querySelectorAll().forEach() directly`);
    }

    // Execute compat.js polyfills in an isolated ES6-like sandbox missing Chrome 54+ APIs
    const compatCode = fs.readFileSync(path.join(rootDir, 'js', 'compat.js'), 'utf8');
    const MockObject = function O(x) { return x; };
    MockObject.keys = Object.keys;
    const legacySandbox = {
        String: function S(v) { return '' + v; },
        Object: MockObject,
        Array: { prototype: { forEach: Array.prototype.forEach, map: Array.prototype.map, reduce: Array.prototype.reduce, concat: Array.prototype.concat } },
        Element: { prototype: {} },
        NodeList: { prototype: {} },
        PFCC: {}
    };
    legacySandbox.String.prototype = {};
    legacySandbox.window = legacySandbox;
    vm.runInNewContext(compatCode, legacySandbox);

    assert.equal(typeof legacySandbox.String.prototype.padStart, 'function');
    assert.equal(legacySandbox.String.prototype.padStart.call('5', 2, '0'), '05');
    assert.equal(typeof legacySandbox.Object.values, 'function');
    assert.deepStrictEqual([...legacySandbox.Object.values({ a: 1, b: 2 })], [1, 2]);
    assert.equal(typeof legacySandbox.Array.prototype.flatMap, 'function');
    assert.equal(typeof legacySandbox.NodeList.prototype.forEach, 'function');
    assert.equal(typeof legacySandbox.Element.prototype.closest, 'function');
    assert.equal(typeof legacySandbox.Element.prototype.remove, 'function');
});

test('style.css includes Chromium 51 WebKit fallbacks and touch optimizations', () => {
    const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
    assert.equal(css.includes('-webkit-tap-highlight-color: transparent'), true, 'Missing tap highlight removal');
    assert.equal(css.includes('touch-action: manipulation'), true, 'Missing touch-action: manipulation');
    assert.equal(css.includes('-webkit-backdrop-filter'), true, 'Missing -webkit-backdrop-filter prefix');
    assert.equal(css.includes('@supports (display: grid)'), true, 'Missing @supports (display: grid) fallback reset');
    assert.equal(css.includes('@supports not (inset: 0)'), true, 'Missing @supports not (inset: 0) flex gap fallback');
    assert.equal(css.includes('overflow-x: hidden'), true, 'Missing overflow-x: hidden fallback before clip');
    const cssWithoutFeatureQuery = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/@supports\s+not\s*\(\s*inset:\s*0\s*\)/g, '');
    assert.equal(/\binset\s*:/.test(cssWithoutFeatureQuery), false, 'Forbidden CSS inset declaration found');
});

test('open-source repository files exist and contain zero em dashes or emojis', () => {
    const required = ['LICENSE', 'README.md', 'CONTRIBUTING.md', 'SECURITY.md', 'package.json', '.gitignore', '.editorconfig'];
    const emojiRe = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u;
    for (const file of required) {
        const p = path.join(rootDir, file);
        assert.equal(fs.existsSync(p), true, `Missing required OSS file: ${file}`);
        const content = fs.readFileSync(p, 'utf8');
        assert.equal(content.includes('\u2014'), false, `${file} contains forbidden em dash`);
        assert.equal(emojiRe.test(content), false, `${file} contains forbidden emoji`);
    }
    const pkg = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf8'));
    assert.equal(pkg.license, 'MIT');
    assert.equal(pkg.scripts.test, 'node --test tests/verify.mjs');
});

test('no ES2018 object spread, Object.entries, Promise.finally, or direct querySelectorAll().forEach across js modules', () => {
    const jsFiles = fs.readdirSync(path.join(rootDir, 'js')).filter(f => f.endsWith('.js'));
    for (const file of jsFiles) {
        const src = fs.readFileSync(path.join(rootDir, 'js', file), 'utf8');
        assert.equal(/\{\s*\.\.\./.test(src), false, `${file} contains ES2018 object spread`);
        assert.equal(/Object\.entries\b/.test(src), false, `${file} uses Object.entries (Chrome 54+)`);
        assert.equal(/\.finally\s*\(/.test(src), false, `${file} uses Promise.finally (Chrome 63+)`);
        if (file !== 'compat.js') {
            assert.equal(/querySelectorAll\s*\(/.test(src), false, `${file} calls querySelectorAll directly instead of PFCC.compat.qsa`);
        }
    }
});

test('style.css Chromium 51-85 fixes: webkit prefixes, separated :focus-visible, grid-gap, and flex-gap fallback', () => {
    const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
    assert.equal(css.includes('-webkit-filter: blur(8px)'), true, 'Missing -webkit-filter blur for Privacy mode');
    assert.equal(css.includes('-webkit-user-select: none'), true, 'Missing -webkit-user-select for Privacy mode');
    assert.equal(css.includes('-webkit-animation:'), true, 'Missing -webkit-animation prefixes');
    assert.equal(css.includes('@-webkit-keyframes'), true, 'Missing @-webkit-keyframes');
    assert.equal(css.includes('grid-gap:'), true, 'Missing grid-gap fallback before gap');
    assert.equal(css.includes('@supports not (inset: 0)'), true, 'Must gate flex-gap fallback on @supports not (inset: 0) for Chrome 51-86');
    assert.equal(css.includes('@supports (gap: 8px)'), false, 'Broken @supports (gap: 8px) rule must be removed');
    assert.equal(/\.heatmap-cell:hover,\s*\.heatmap-cell:focus-visible/.test(css), false, 'Do not comma-group :hover with :focus-visible');
    assert.equal(/\.cmd-item:hover,\s*\.cmd-item:focus-visible/.test(css), false, 'Do not comma-group :hover with :focus-visible');
    assert.equal(/@supports\s*\(display:\s*grid\)[\s\S]*\.form-row[\s\S]*margin:\s*0;/.test(css), false, '.form-row margin-bottom must not be wiped by margin: 0');
    assert.equal(/minmax\(220px,\s*1fr\)/.test(css), true, 'Missing minmax fallback before min()');
    assert.equal(/max-width:\s*380px;/.test(css), true, 'Missing fallback max-width on toast-container before min()');
});

test('CSV importer handles apostrophes and preserves YYYY-MM-DD dates without timezone shift', () => {
    const { PFCC } = loadAppModules();
    const csv = "Date,Description,Amount,Category\n2026-11-01,McDonald's Coffee,-4.50,Food";
    const parsed = PFCC.importer.parseCsvText(csv);
    assert.equal(parsed.dataRows.length, 1);
    assert.equal(parsed.dataRows[0][1], "McDonald's Coffee");
    assert.equal(parsed.dataRows[0][2], '-4.50');
    assert.equal(PFCC.importer.normalizeCsvDate('2026-11-01'), '2026-11-01');
});

test('receipt URL sanitizer blocks javascript: and external http URLs while allowing data:image', () => {
    const { PFCC } = loadAppModules();
    assert.equal(PFCC.utils.sanitizeReceiptUrl('javascript:alert(1)'), '');
    assert.equal(PFCC.utils.sanitizeReceiptUrl('https://evil.example/img.png'), '');
    assert.equal(PFCC.utils.sanitizeReceiptUrl('data:image/jpeg;base64,ABC123'), 'data:image/jpeg;base64,ABC123');
});

test('backup normalizer sanitizes restored transactions and rules safely', () => {
    const { PFCC } = loadAppModules();
    const cleaned = PFCC.settings.sanitizeRestoredPayload({
        transactions: [
            { id: '1', text: 'Valid', amount: '-42.5', category: 'Food', date: '2026-11-01', tags: 'not-array', receipt: 'javascript:alert(1)' },
            null
        ],
        autoRules: [
            { id: 'r1', keywords: 'AWS', amountThreshold: 'bad', assignCategory: 'Software', assignTags: null }
        ]
    });
    assert.equal(cleaned.transactions.length, 1);
    assert.equal(cleaned.transactions[0].amount, -42.5);
    assert.deepStrictEqual([...cleaned.transactions[0].tags], []);
    assert.equal(cleaned.transactions[0].receipt, null);
    assert.deepStrictEqual([...cleaned.autoRules[0].keywords], []);
});

test('Forecast Lab honors 0% CAGR without defaulting back to 7%', () => {
    const { PFCC } = loadAppModules();
    assert.equal(PFCC.planning.parseGrowthRate('0'), 0);
    assert.equal(PFCC.planning.parseGrowthRate(''), 0.07);
});

test('CONTRIBUTING.md matches PFCC.compat exports', () => {
    const contrib = fs.readFileSync(path.join(rootDir, 'CONTRIBUTING.md'), 'utf8');
    assert.equal(contrib.includes('String.prototype.padStart`'), false, 'CONTRIBUTING.md should reference PFCC.compat.pad2, not padStart via compat');
    assert.equal(contrib.includes('PFCC.compat.pad2'), true);
    assert.equal(contrib.includes('PFCC.compat.qsa'), true);
});

test('keyboard shortcut handler skips synthetic events where e.key is undefined', () => {
    const { dispatchKeydown } = loadAppModules();
    assert.doesNotThrow(() => {
        dispatchKeydown({ key: undefined, ctrlKey: true, metaKey: false, target: { tagName: 'BODY' }, preventDefault() {} });
        dispatchKeydown({ key: undefined, ctrlKey: false, metaKey: false, target: { tagName: 'BODY' }, preventDefault() {} });
    });
});

test('downloadTextFile supports Android APK WebView data URI fallback and attaches link to body', () => {
    const { PFCC } = loadAppModules();
    assert.equal(typeof PFCC.utils.downloadTextFile, 'function');
    assert.doesNotThrow(() => {
        PFCC.utils.downloadTextFile('backup.json', '{"ok":true}', 'application/json;charset=utf-8');
    });
});

test('PFCC.handleBackPress closes drawers/views before allowing APK exit', () => {
    const { PFCC } = loadAppModules();
    assert.equal(typeof PFCC.handleBackPress, 'function');
    assert.equal(PFCC.handleBackPress(), false);
    PFCC.switchWorkbenchView('treasury');
    assert.equal(PFCC.state.activeView, 'treasury');
    assert.equal(PFCC.handleBackPress(), true);
    assert.equal(PFCC.state.activeView, 'ledger');
});

test('Android APK project scaffold and synced www assets are complete and consistent', () => {
    const requiredFiles = [
        'scripts/sync-android.mjs',
        'android/settings.gradle',
        'android/build.gradle',
        'android/gradle.properties',
        'android/gradle/wrapper/gradle-wrapper.properties',
        'android/app/build.gradle',
        'android/app/proguard-rules.pro',
        'android/app/src/main/AndroidManifest.xml',
        'android/app/src/main/java/org/pfcc/financeos/MainActivity.java',
        'android/app/src/main/java/org/pfcc/financeos/ApkFileProvider.java',
        'android/app/src/main/res/drawable/ic_launcher_foreground.xml',
        'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml',
        'android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml',
        '.github/workflows/android-apk.yml',
        'android/app/src/main/assets/www/index.html',
        'android/app/src/main/assets/www/style.css',
        'android/app/src/main/assets/www/favicon.svg',
        'android/app/src/main/assets/www/js/compat.js'
    ];
    for (const rel of requiredFiles) {
        assert.equal(fs.existsSync(path.join(rootDir, rel)), true, `Missing Android file: ${rel}`);
    }
    for (const dpi of ['mipmap-mdpi', 'mipmap-hdpi', 'mipmap-xhdpi', 'mipmap-xxhdpi', 'mipmap-xxxhdpi']) {
        assert.equal(fs.existsSync(path.join(rootDir, 'android/app/src/main/res', dpi, 'ic_launcher.png')), true);
        assert.equal(fs.existsSync(path.join(rootDir, 'android/app/src/main/res', dpi, 'ic_launcher_round.png')), true);
    }
    const gradle = fs.readFileSync(path.join(rootDir, 'android/app/build.gradle'), 'utf8');
    assert.equal(gradle.includes('minSdk = 24'), true);
    assert.equal(gradle.includes('syncWebAssets'), true);
    assert.equal(gradle.includes('APP_BUILD_NUMBER'), true);
    const manifest = fs.readFileSync(path.join(rootDir, 'android/app/src/main/AndroidManifest.xml'), 'utf8');
    assert.equal(manifest.includes('REQUEST_INSTALL_PACKAGES'), true);
    assert.equal(manifest.includes('ApkFileProvider'), true);
    const java = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/org/pfcc/financeos/MainActivity.java'), 'utf8');
    assert.equal(java.includes('setDomStorageEnabled(true)'), true);
    assert.equal(java.includes('onShowFileChooser'), true);
    assert.equal(java.includes('AndroidBridge'), true);
    assert.equal(java.includes('handleBackPress'), true);
    assert.equal(java.includes('checkForUpdates'), true);
    assert.equal(java.includes('startApkUpdate'), true);
    assert.equal(
        fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8'),
        fs.readFileSync(path.join(rootDir, 'android/app/src/main/assets/www/index.html'), 'utf8')
    );
});

test('PFCC.onAppUpdateAvailable invokes AndroidBridge.startApkUpdate upon confirmation', () => {
    const { PFCC } = loadAppModules();
    assert.equal(typeof PFCC.onAppUpdateAvailable, 'function');
    assert.doesNotThrow(() => {
        PFCC.onAppUpdateAvailable(5, 'Build #5', 'https://github.com/mackenziebirlymassie-lang/EXT/releases/download/latest/PFCC-V2-latest.apk');
    });
});

test('charts formatShortMoney supports billions/trillions and Forecast chart fits narrow portrait widths', () => {
    const { PFCC } = loadAppModules();
    assert.equal(typeof PFCC.charts.formatShortMoney, 'function');
    assert.equal(PFCC.charts.formatShortMoney(1500000000), '1.5B');
    assert.equal(PFCC.charts.formatShortMoney(2300000000000), '2.3T');
    assert.equal(PFCC.charts.formatShortMoney(-5170000), '-5.2M');

    const drawnTexts = [];
    const mockCtx = {
        scale() {}, setTransform() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {},
        stroke() {}, fillRect() {}, arc() {}, closePath() {}, fill() {}, save() {}, restore() {},
        setLineDash() {},
        measureText: txt => ({ width: String(txt || '').length * 7 }),
        fillText(txt, x, y) { drawnTexts.push({ txt: String(txt), x, y }); }
    };
    const narrowCanvas = {
        style: {},
        width: 290,
        height: 220,
        parentElement: {
            getBoundingClientRect: () => ({ width: 290, height: 220 })
        },
        getContext: () => mockCtx
    };

    PFCC.charts.renderForecastCanvas(narrowCanvas, {
        baseline: [0, 2500000000, 5000000000],
        simulated: [0, 3200000000, 6800000000]
    });

    assert.equal(narrowCanvas._chartMeta && narrowCanvas._chartMeta.type, 'forecast');
    const baselineLegend = drawnTexts.find(item => item.txt.includes('Baseline'));
    assert.ok(baselineLegend, 'Expected Baseline legend text to be rendered');
    const estimatedEnd = baselineLegend.x + baselineLegend.txt.length * 7;
    assert.ok(estimatedEnd <= 290, `Baseline legend clipped at ${estimatedEnd}px > 290px`);
});

test('charts sizeHiDpiCanvas subtracts parent padding so Trend chart does not overflow wrapper', () => {
    const { PFCC } = loadAppModules();
    assert.equal(typeof PFCC.charts.sizeHiDpiCanvas, 'function');
    const canvas = {
        style: {},
        width: 0,
        height: 0,
        parentElement: {
            style: {
                paddingTop: '16px',
                paddingBottom: '16px',
                paddingLeft: '16px',
                paddingRight: '16px'
            },
            getBoundingClientRect: () => ({ width: 338, height: 270 })
        },
        getContext: () => ({ setTransform() {} })
    };

    const sized = PFCC.charts.sizeHiDpiCanvas(canvas, 250);
    assert.equal(sized.height, 238);
    assert.equal(sized.width, 306);
});

test('backup normalizer preserves subscription cycles, IOU direction/desc, and uppercase holdings', () => {
    const { PFCC } = loadAppModules();
    const cleaned = PFCC.settings.sanitizeRestoredPayload({
        subscriptions: [{ id: 's1', name: 'VPS', amount: 24, billingCycle: 'yearly', category: 'Software' }],
        ious: [{ id: 'i1', person: 'Alice', amount: 45, direction: 'receivable', desc: 'Lunch', settled: false }],
        holdings: { btc: 0.5, ETH: 2, SOL: 10, paxg: 1 }
    });
    assert.equal(cleaned.subscriptions[0].billingCycle, 'yearly');
    assert.equal(cleaned.subscriptions[0].category, 'Software');
    assert.equal(cleaned.ious[0].direction, 'receivable');
    assert.equal(cleaned.ious[0].desc, 'Lunch');
    assert.equal(cleaned.holdings.BTC, 0.5);
    assert.equal(cleaned.holdings.ETH, 2);
    assert.equal(cleaned.holdings.SOL, 10);
    assert.equal(cleaned.holdings.PAXG, 1);
});

test('Forecast resetSimulation restores 3Y horizon along with sliders', () => {
    const { PFCC } = loadAppModules();
    PFCC.state.forecastYears = 10;
    assert.equal(typeof PFCC.planning.resetSimulation, 'function');
    PFCC.planning.resetSimulation();
    assert.equal(PFCC.state.forecastYears, 3);
});

test('style.css portrait Forecast and modal layout fixes are present', () => {
    const css = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
    assert.equal(/\.modal-content\s*>\s*\.window-header[\s\S]*flex-wrap:\s*nowrap/.test(css), true, 'Modal header should not wrap close button');
    assert.equal(/@media\s*\(max-width:\s*640px\)[\s\S]*\.submetrics-grid\.two-col\s*\{[\s\S]*repeat\(2,\s*minmax\(0,\s*1fr\)\)/.test(css), true, '640px mobile should keep two-col submetrics in 2x2 grid');
    assert.equal(/@media\s*\(max-width:\s*1180px\)[\s\S]*grid-template-columns:\s*minmax\(0,\s*1fr\)/.test(css), true, 'Responsive collapsed grids should use minmax(0, 1fr)');
    assert.equal(css.includes('.section-body.forecast-grid'), true, 'Legacy fallback must neutralize negative margin on .section-body.forecast-grid');
});

test('Android in-place APK updater uses explicit persistent signing config and validates downloaded APK', () => {
    const gradle = fs.readFileSync(path.join(rootDir, 'android/app/build.gradle'), 'utf8');
    const workflow = fs.readFileSync(path.join(rootDir, '.github/workflows/android-apk.yml'), 'utf8');
    const java = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/org/pfcc/financeos/MainActivity.java'), 'utf8');
    const provider = fs.readFileSync(path.join(rootDir, 'android/app/src/main/java/org/pfcc/financeos/ApkFileProvider.java'), 'utf8');

    assert.equal(gradle.includes('PFCC_DEBUG_KEYSTORE'), true, 'build.gradle must support explicit PFCC_DEBUG_KEYSTORE for debug signing');
    assert.equal(gradle.includes('signingConfigs'), true, 'build.gradle must configure signingConfigs.debug explicitly');
    assert.equal(workflow.includes('PFCC_DEBUG_KEYSTORE'), true, 'CI workflow must pass PFCC_DEBUG_KEYSTORE to Gradle');
    assert.equal(workflow.includes('apksigner'), true, 'CI workflow must verify APK signing certificate');
    assert.equal(workflow.includes('O=PFCC'), true, 'CI workflow must enforce O=PFCC signing certificate');
    assert.equal(java.includes('release-assets.githubusercontent.com'), true, 'MainActivity must allow GitHub release-assets CDN');
    assert.equal(java.includes('EXTRA_NOT_UNKNOWN_SOURCE'), true, 'MainActivity should pass EXTRA_NOT_UNKNOWN_SOURCE to installer');
    assert.equal(provider.includes('openAssetFile'), true, 'ApkFileProvider must override openAssetFile with real APK length');
});
