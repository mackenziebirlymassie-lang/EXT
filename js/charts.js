(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function getTheme() {
        return PFCC.themes.OS_THEMES[PFCC.state.settings.preset] || PFCC.themes.OS_THEMES.obsidian;
    }

    function sizeHiDpiCanvas(canvas, fallbackHeight) {
        const rect = canvas.parentElement ? canvas.parentElement.getBoundingClientRect() : { width: 640, height: fallbackHeight };
        const width = Math.max(260, Math.floor(rect.width || 640));
        const height = Math.max(180, Math.floor(rect.height || fallbackHeight));
        const dpr = Math.min(global.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, width, height };
    }

    function formatShortMoney(val) {
        const abs = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
        if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
        return `${sign}${Math.round(abs)}`;
    }

    function pad2(n) {
        const s = String(n);
        return s.length < 2 ? '0' + s : s;
    }

    function computeBudgetPaceSeries(allTransactions, tf, monthlyBudget) {
        const targetYear = tf && tf.year !== undefined ? tf.year : new Date().getFullYear();
        const targetMonth = tf && tf.month !== undefined ? tf.month : new Date().getMonth();
        const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
        const prefix = `${targetYear}-${pad2(targetMonth + 1)}`;

        const dailySpend = new Array(daysInMonth).fill(0);
        allTransactions.forEach(t => {
            if (t.amount < 0 && t.date && t.date.startsWith(prefix)) {
                const dayNum = parseInt(t.date.slice(8, 10), 10);
                if (dayNum >= 1 && dayNum <= daysInMonth) {
                    dailySpend[dayNum - 1] += Math.abs(t.amount);
                }
            }
        });

        const now = new Date();
        const isCurrentMonth = now.getFullYear() === targetYear && now.getMonth() === targetMonth;
        const activeLimitDay = isCurrentMonth ? now.getDate() : daysInMonth;

        const actualCumulative = [];
        const idealCumulative = [];
        let acc = 0;
        const budget = Math.max(0, Number(monthlyBudget) || 0);

        for (let d = 1; d <= daysInMonth; d++) {
            acc += dailySpend[d - 1];
            actualCumulative.push(d <= activeLimitDay ? acc : null);
            idealCumulative.push(budget > 0 ? (budget * d) / daysInMonth : 0);
        }

        return { daysInMonth, activeLimitDay, isCurrentMonth, actualCumulative, idealCumulative, budget };
    }

    function computeRankedCategories(activeTimeframeTxs, categoryBudgets) {
        const expenses = activeTimeframeTxs.filter(t => t.amount < 0);
        const totalSpent = expenses.reduce((sum, t) => sum + Math.abs(t.amount), 0);
        const buckets = {};

        expenses.forEach(t => {
            const cat = t.category || 'Other';
            if (!buckets[cat]) buckets[cat] = { category: cat, total: 0, count: 0 };
            buckets[cat].total += Math.abs(t.amount);
            buckets[cat].count += 1;
        });

        return Object.keys(buckets).map(k => buckets[k])
            .sort((a, b) => b.total - a.total)
            .map(row => {
                const cap = categoryBudgets && categoryBudgets[row.category] ? parseFloat(categoryBudgets[row.category]) : 0;
                return {
                    category: row.category,
                    total: row.total,
                    count: row.count,
                    avg: row.total / row.count,
                    sharePct: totalSpent > 0 ? (row.total / totalSpent) * 100 : 0,
                    cap: cap > 0 ? cap : null
                };
            });
    }

    function renderBudgetPaceCanvas(canvas) {
        const { ctx, width, height } = sizeHiDpiCanvas(canvas, 250);
        const theme = getTheme();
        const state = PFCC.state;
        const series = computeBudgetPaceSeries(state.transactions, state.timeframe, state.settings.budget);

        const pad = { top: 20, right: 16, bottom: 28, left: 54 };
        const plotW = Math.max(60, width - pad.left - pad.right);
        const plotH = Math.max(60, height - pad.top - pad.bottom);

        const actualNums = series.actualCumulative.filter(v => v !== null);
        const maxVal = Math.max(100, series.budget, ...(actualNums.length ? actualNums : [0])) * 1.1;

        ctx.clearRect(0, 0, width, height);
        ctx.font = `11px ${state.settings.font}`;

        // Horizontal Grid & Y Labels
        const steps = 4;
        for (let i = 0; i <= steps; i++) {
            const ratio = i / steps;
            const y = pad.top + plotH - ratio * plotH;
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + plotW, y);
            ctx.stroke();

            ctx.fillStyle = theme.textSec;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatShortMoney(maxVal * ratio), pad.left - 8, y);
        }

        const xForDay = d => pad.left + ((d - 1) / Math.max(1, series.daysInMonth - 1)) * plotW;
        const yForVal = v => pad.top + plotH - (Math.min(v, maxVal) / maxVal) * plotH;

        // X Axis Tick Labels
        ctx.fillStyle = theme.textSec;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        [1, Math.ceil(series.daysInMonth / 2), series.daysInMonth].forEach(d => {
            ctx.fillText(`D${d}`, xForDay(d), pad.top + plotH + 8);
        });

        // Ideal Linear Budget Pace Line (dashed)
        if (series.budget > 0) {
            ctx.save();
            ctx.setLineDash([5, 4]);
            ctx.strokeStyle = theme.textSec;
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(xForDay(1), yForVal(series.idealCumulative[0]));
            ctx.lineTo(xForDay(series.daysInMonth), yForVal(series.idealCumulative[series.daysInMonth - 1]));
            ctx.stroke();
            ctx.restore();
        }

        // Actual Cumulative Spend Area + Line
        const lastActual = actualNums.length ? actualNums[actualNums.length - 1] : 0;
        const overPace = series.budget > 0 && lastActual > series.idealCumulative[Math.max(0, series.activeLimitDay - 1)];
        const lineColor = overPace ? theme.colorRed : theme.accentText;

        ctx.beginPath();
        let started = false;
        let lastX = pad.left;
        let lastY = pad.top + plotH;

        series.actualCumulative.forEach((val, idx) => {
            if (val === null) return;
            const x = xForDay(idx + 1);
            const y = yForVal(val);
            if (!started) {
                ctx.moveTo(x, y);
                started = true;
            } else {
                ctx.lineTo(x, y);
            }
            lastX = x;
            lastY = y;
        });

        if (started) {
            ctx.strokeStyle = lineColor;
            ctx.lineWidth = 2.25;
            ctx.stroke();

            ctx.lineTo(lastX, pad.top + plotH);
            ctx.lineTo(xForDay(1), pad.top + plotH);
            ctx.closePath();
            ctx.fillStyle = PFCC.utils.hexToRgba(lineColor, 0.14);
            ctx.fill();

            // Active point marker
            ctx.beginPath();
            ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
            ctx.fillStyle = lineColor;
            ctx.fill();
        }

        // Legend Strip at Top Left of Plot
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = lineColor;
        ctx.fillText('Actual Spend', pad.left, 4);
        if (series.budget > 0) {
            ctx.fillStyle = theme.textSec;
            ctx.fillText('-- Ideal Pace', pad.left + 96, 4);
        }

        canvas._chartMeta = { type: 'pace', series, pad, plotW, plotH, maxVal };
    }

    function renderMonthlyBarsCanvas(canvas) {
        const { ctx, width, height } = sizeHiDpiCanvas(canvas, 250);
        const theme = getTheme();
        const allTransactions = PFCC.state.transactions;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const months = [];

        const d = new Date();
        for (let i = 5; i >= 0; i--) {
            const target = new Date(d.getFullYear(), d.getMonth() - i, 1);
            const y = target.getFullYear();
            const m = target.getMonth();
            const prefix = `${y}-${pad2(m + 1)}`;
            const monthTxs = allTransactions.filter(t => t.date && t.date.startsWith(prefix));
            months.push({
                label: monthNames[m],
                inc: monthTxs.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0),
                exp: monthTxs.filter(t => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0)
            });
        }

        const pad = { top: 22, right: 14, bottom: 28, left: 54 };
        const plotW = Math.max(60, width - pad.left - pad.right);
        const plotH = Math.max(60, height - pad.top - pad.bottom);
        const allMonthNums = months.reduce((acc, m) => {
            acc.push(m.inc, m.exp);
            return acc;
        }, []);
        const maxVal = Math.max(100, ...allMonthNums) * 1.15;

        ctx.clearRect(0, 0, width, height);
        ctx.font = `11px ${PFCC.state.settings.font}`;

        for (let i = 0; i <= 4; i++) {
            const ratio = i / 4;
            const y = pad.top + plotH - ratio * plotH;
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + plotW, y);
            ctx.stroke();

            ctx.fillStyle = theme.textSec;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatShortMoney(maxVal * ratio), pad.left - 8, y);
        }

        const groupW = plotW / months.length;
        const barW = Math.min(20, Math.max(8, groupW * 0.28));

        months.forEach((m, idx) => {
            const cx = pad.left + idx * groupW + groupW / 2;
            const incH = (m.inc / maxVal) * plotH;
            const expH = (m.exp / maxVal) * plotH;

            ctx.fillStyle = theme.colorGreen;
            ctx.fillRect(cx - barW - 2, pad.top + plotH - incH, barW, incH);

            ctx.fillStyle = theme.colorRed;
            ctx.fillRect(cx + 2, pad.top + plotH - expH, barW, expH);

            ctx.fillStyle = theme.textSec;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(m.label, cx, pad.top + plotH + 8);
        });

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = theme.colorGreen;
        ctx.fillText('Income', pad.left, 4);
        ctx.fillStyle = theme.colorRed;
        ctx.fillText('Expenses', pad.left + 58, 4);

        canvas._chartMeta = { type: 'monthly', months, pad, groupW };
    }

    function renderForecastCanvas(canvas, projData) {
        if (!canvas || !projData) return;
        const { ctx, width, height } = sizeHiDpiCanvas(canvas, 240);
        const theme = getTheme();

        const pad = { top: 22, right: 16, bottom: 28, left: 60 };
        const plotW = Math.max(60, width - pad.left - pad.right);
        const plotH = Math.max(60, height - pad.top - pad.bottom);

        const allVals = [...projData.baseline, ...projData.simulated];
        const maxVal = Math.max(100, ...allVals) * 1.12;
        const minVal = Math.min(0, ...allVals);
        const span = Math.max(1, maxVal - minVal);

        ctx.clearRect(0, 0, width, height);
        ctx.font = `11px ${PFCC.state.settings.font}`;

        for (let i = 0; i <= 4; i++) {
            const ratio = i / 4;
            const val = minVal + span * ratio;
            const y = pad.top + plotH - ratio * plotH;
            ctx.strokeStyle = theme.border;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(pad.left, y);
            ctx.lineTo(pad.left + plotW, y);
            ctx.stroke();

            ctx.fillStyle = theme.textSec;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(formatShortMoney(val), pad.left - 8, y);
        }

        const totalPts = projData.simulated.length;
        const xForIdx = i => pad.left + (i / Math.max(1, totalPts - 1)) * plotW;
        const yForVal = v => pad.top + plotH - ((v - minVal) / span) * plotH;

        ctx.fillStyle = theme.textSec;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        const step = Math.max(1, Math.floor((totalPts - 1) / 4));
        for (let i = 0; i < totalPts; i += step) {
            ctx.fillText(i === 0 ? 'Now' : `${i}m`, xForIdx(i), pad.top + plotH + 8);
        }

        // Baseline curve (dashed)
        ctx.save();
        ctx.setLineDash([5, 4]);
        ctx.strokeStyle = theme.textSec;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        projData.baseline.forEach((v, i) => {
            if (i === 0) ctx.moveTo(xForIdx(i), yForVal(v));
            else ctx.lineTo(xForIdx(i), yForVal(v));
        });
        ctx.stroke();
        ctx.restore();

        // Simulated curve
        ctx.strokeStyle = theme.colorGreen;
        ctx.lineWidth = 2.25;
        ctx.beginPath();
        projData.simulated.forEach((v, i) => {
            if (i === 0) ctx.moveTo(xForIdx(i), yForVal(v));
            else ctx.lineTo(xForIdx(i), yForVal(v));
        });
        ctx.stroke();

        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillStyle = theme.colorGreen;
        ctx.fillText('Simulated Net Worth', pad.left, 4);
        ctx.fillStyle = theme.textSec;
        ctx.fillText('-- Baseline', pad.left + 140, 4);
    }

    function renderCategoryBreakdown(activeTimeframeTxs) {
        const container = PFCC.dom.categoryBreakdownList;
        if (!container) return;
        container.textContent = '';

        const ranked = computeRankedCategories(activeTimeframeTxs, PFCC.state.settings.categoryBudgets);
        if (ranked.length === 0) {
            const empty = PFCC.utils.createEl('div', 'ledger-empty');
            empty.appendChild(PFCC.utils.createEl('p', 'empty-hint', 'No expenses recorded in this timeframe yet.'));
            container.appendChild(empty);
            return;
        }

        ranked.forEach(item => {
            const row = PFCC.utils.createEl('div', 'alloc-row');

            const head = PFCC.utils.createEl('div', 'alloc-head');
            const labelWrap = PFCC.utils.createEl('span', 'alloc-cat');
            labelWrap.appendChild(PFCC.icons.create(PFCC.icons.getCategoryIcon(item.category), 14));
            labelWrap.appendChild(PFCC.utils.createEl('span', '', item.category));
            labelWrap.appendChild(PFCC.utils.createEl('span', 'alloc-meta', `${item.count} tx | avg ${PFCC.utils.formatCurrency(item.avg)}`));

            const valWrap = PFCC.utils.createEl('span', 'alloc-val');
            valWrap.textContent = `${PFCC.utils.formatCurrency(item.total)} (${item.sharePct.toFixed(1)}%)`;

            head.appendChild(labelWrap);
            head.appendChild(valWrap);

            const track = PFCC.utils.createEl('div', 'alloc-bar-bg');
            const fill = PFCC.utils.createEl('div', `alloc-bar-fill ${item.cap && item.total > item.cap ? 'is-over' : ''}`);
            fill.style.width = `${Math.max(2, item.sharePct)}%`;
            track.appendChild(fill);

            row.appendChild(head);
            row.appendChild(track);
            container.appendChild(row);
        });
    }

    function updateUpperChart(allTransactions) {
        const canvas = PFCC.dom.trendChartCanvas;
        if (!canvas) return;
        if (PFCC.state.activeUpperChart === 'monthly') {
            renderMonthlyBarsCanvas(canvas);
        } else {
            renderBudgetPaceCanvas(canvas);
        }
    }

    function updateCharts(activeTimeframeTxs) {
        updateUpperChart(PFCC.state.transactions);
        renderCategoryBreakdown(activeTimeframeTxs);
    }

    function bindCanvasTooltip(canvas) {
        const tip = PFCC.dom.chartTooltip;
        if (!canvas || !tip) return;

        canvas.addEventListener('mousemove', e => {
            const meta = canvas._chartMeta;
            if (!meta) return;
            const rect = canvas.getBoundingClientRect();
            const mx = e.clientX - rect.left;

            if (meta.type === 'pace') {
                const rel = Math.max(0, Math.min(1, (mx - meta.pad.left) / meta.plotW));
                const dayIdx = Math.round(rel * (meta.series.daysInMonth - 1));
                const actual = meta.series.actualCumulative[dayIdx];
                const ideal = meta.series.idealCumulative[dayIdx];
                tip.textContent = `Day ${dayIdx + 1}: ${actual !== null ? PFCC.utils.formatCurrency(actual) : 'Future'}${meta.series.budget > 0 ? ` | Ideal ${PFCC.utils.formatCurrency(ideal)}` : ''}`;
            } else if (meta.type === 'monthly') {
                const idx = Math.max(0, Math.min(meta.months.length - 1, Math.floor((mx - meta.pad.left) / meta.groupW)));
                const m = meta.months[idx];
                tip.textContent = `${m.label}: +${PFCC.utils.formatCurrency(m.inc)} / -${PFCC.utils.formatCurrency(m.exp)}`;
            }

            tip.style.display = 'block';
            tip.style.left = `${Math.min(e.clientX + 12, global.innerWidth - 220)}px`;
            tip.style.top = `${Math.max(8, e.clientY - 28)}px`;
        });

        canvas.addEventListener('mouseleave', () => {
            tip.style.display = 'none';
        });
    }

    function initCharts() {
        const el = PFCC.dom;
        el.chartTabBtns.forEach(btn => {
            btn.addEventListener('click', e => {
                el.chartTabBtns.forEach(b => b.classList.remove('active'));
                e.currentTarget.classList.add('active');
                PFCC.state.activeUpperChart = e.currentTarget.getAttribute('data-chart');
                el.chartMainTitle.textContent = PFCC.state.activeUpperChart === 'pace'
                    ? 'Cumulative Spend vs. Linear Budget Pace'
                    : '6-Month Cash Flow (Income vs. Expense)';
                updateUpperChart(PFCC.state.transactions);
            });
        });

        bindCanvasTooltip(el.trendChartCanvas);

        global.addEventListener('resize', () => {
            if (PFCC.state.activeView === 'budget') {
                updateUpperChart(PFCC.state.transactions);
            } else if (PFCC.state.activeView === 'forecast') {
                PFCC.planning.updateSimulation();
            }
        });
    }

    PFCC.charts = {
        computeBudgetPaceSeries,
        computeRankedCategories,
        renderForecastCanvas,
        updateCharts,
        updateUpperChart,
        initCharts
    };
})(window);
