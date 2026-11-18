(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function getTheme() {
        return PFCC.themes.OS_THEMES[PFCC.state.settings.preset] || PFCC.themes.OS_THEMES.obsidian;
    }

    function sizeHiDpiCanvas(canvas, fallbackHeight) {
        canvas.style.width = '100%';
        const parent = canvas.parentElement;
        const rect = parent ? parent.getBoundingClientRect() : { width: 0, height: fallbackHeight };
        const cs = (parent && global.getComputedStyle) ? global.getComputedStyle(parent) : null;
        const padX = cs ? ((parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)) : 0;
        const padY = cs ? ((parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0)) : 0;
        const rawW = rect.width > 0 ? Math.max(0, rect.width - padX) : 640;
        const rawH = (rect.height > 0 ? rect.height : fallbackHeight) - padY;
        const viewportCap = global.innerWidth ? Math.max(200, global.innerWidth - 36) : 640;
        const measuredW = Math.min(rawW, viewportCap);
        const width = Math.max(200, Math.floor(measuredW));
        const height = Math.max(160, Math.floor(rawH));
        const dpr = Math.min(global.devicePixelRatio || 1, 2);

        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        canvas.style.width = '100%';
        canvas.style.height = `${height}px`;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        return { ctx, width, height };
    }

    function formatShortMoney(val) {
        const abs = Math.abs(val);
        const sign = val < 0 ? '-' : '';
        if (abs >= 1000000000000) return `${sign}${(abs / 1000000000000).toFixed(1)}T`;
        if (abs >= 1000000000) return `${sign}${(abs / 1000000000).toFixed(1)}B`;
        if (abs >= 1000000) return `${sign}${(abs / 1000000).toFixed(1)}M`;
        if (abs >= 1000) return `${sign}${(abs / 1000).toFixed(1)}k`;
        return `${sign}${Math.round(abs)}`;
    }

    function computeLeftPad(ctx, labels, minPad) {
        let maxW = 0;
        for (let i = 0; i < labels.length; i++) {
            const w = ctx.measureText ? ctx.measureText(labels[i]).width : String(labels[i]).length * 7;
            if (w > maxW) maxW = w;
        }
        return Math.max(minPad || 44, Math.min(72, Math.ceil(maxW) + 12));
    }

    function drawTopLegend(ctx, padLeft, rightEdge, items) {
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let cursorX = padLeft;
        let cursorY = 4;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const w = ctx.measureText ? ctx.measureText(item.label).width : item.label.length * 7;
            if (i > 0 && cursorX + w > rightEdge) {
                cursorX = padLeft;
                cursorY += 14;
            }
            ctx.fillStyle = item.color;
            ctx.fillText(item.label, cursorX, cursorY);
            cursorX += w + 14;
        }
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

        const actualNums = series.actualCumulative.filter(v => v !== null);
        const maxVal = Math.max(100, series.budget, ...(actualNums.length ? actualNums : [0])) * 1.1;

        ctx.clearRect(0, 0, width, height);
        ctx.font = `11px ${state.settings.font}`;

        const steps = 4;
        const yLabels = [];
        for (let i = 0; i <= steps; i++) {
            yLabels.push(formatShortMoney(maxVal * (i / steps)));
        }
        const pad = { top: 22, right: 14, bottom: 26, left: computeLeftPad(ctx, yLabels, 44) };
        const plotW = Math.max(60, width - pad.left - pad.right);
        const plotH = Math.max(60, height - pad.top - pad.bottom);

        // Horizontal Grid & Y Labels
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
            ctx.fillText(yLabels[i], pad.left - 8, y);
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
        const legendItems = [{ label: 'Actual Spend', color: lineColor }];
        if (series.budget > 0) legendItems.push({ label: '-- Ideal Pace', color: theme.textSec });
        drawTopLegend(ctx, pad.left, width - pad.right, legendItems);

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

        const allMonthNums = months.reduce((acc, m) => {
            acc.push(m.inc, m.exp);
            return acc;
        }, []);
        const maxVal = Math.max(100, ...allMonthNums) * 1.15;

        ctx.clearRect(0, 0, width, height);
        ctx.font = `11px ${PFCC.state.settings.font}`;

        const yLabels = [];
        for (let i = 0; i <= 4; i++) {
            yLabels.push(formatShortMoney(maxVal * (i / 4)));
        }
        const pad = { top: 22, right: 12, bottom: 26, left: computeLeftPad(ctx, yLabels, 44) };
        const plotW = Math.max(60, width - pad.left - pad.right);
        const plotH = Math.max(60, height - pad.top - pad.bottom);

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
            ctx.fillText(yLabels[i], pad.left - 8, y);
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

        drawTopLegend(ctx, pad.left, width - pad.right, [
            { label: 'Income', color: theme.colorGreen },
            { label: 'Expenses', color: theme.colorRed }
        ]);

        canvas._chartMeta = { type: 'monthly', months, pad, groupW };
    }

    function renderForecastCanvas(canvas, projData) {
        if (!canvas || !projData) return;
        const { ctx, width, height } = sizeHiDpiCanvas(canvas, 220);
        const theme = getTheme();

        const allVals = [...projData.baseline, ...projData.simulated];
        const maxVal = Math.max(100, ...allVals) * 1.12;
        const minVal = Math.min(0, ...allVals);
        const span = Math.max(1, maxVal - minVal);

        ctx.clearRect(0, 0, width, height);
        ctx.font = `11px ${PFCC.state.settings.font}`;

        const yLabels = [];
        for (let i = 0; i <= 4; i++) {
            yLabels.push(formatShortMoney(minVal + span * (i / 4)));
        }

        const simLegend = width < 300 ? 'Simulated' : 'Simulated Net Worth';
        const baseLegend = '-- Baseline';
        const leftPad = computeLeftPad(ctx, yLabels, 44);
        const rightEdge = width - 12;
        const simW = ctx.measureText ? ctx.measureText(simLegend).width : simLegend.length * 7;
        const baseW = ctx.measureText ? ctx.measureText(baseLegend).width : baseLegend.length * 7;
        const wrapsLegend = leftPad + simW + 14 + baseW > rightEdge;

        const pad = { top: wrapsLegend ? 34 : 22, right: 12, bottom: 26, left: leftPad };
        const plotW = Math.max(60, width - pad.left - pad.right);
        const plotH = Math.max(60, height - pad.top - pad.bottom);

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
            ctx.fillText(yLabels[i], pad.left - 8, y);
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

        // Simulated curve + soft area fill
        ctx.strokeStyle = theme.colorGreen;
        ctx.lineWidth = 2.25;
        ctx.beginPath();
        projData.simulated.forEach((v, i) => {
            if (i === 0) ctx.moveTo(xForIdx(i), yForVal(v));
            else ctx.lineTo(xForIdx(i), yForVal(v));
        });
        ctx.stroke();

        if (totalPts > 1) {
            const endX = xForIdx(totalPts - 1);
            const endY = yForVal(projData.simulated[totalPts - 1]);
            ctx.lineTo(endX, pad.top + plotH);
            ctx.lineTo(xForIdx(0), pad.top + plotH);
            ctx.closePath();
            ctx.fillStyle = PFCC.utils.hexToRgba(theme.colorGreen, 0.12);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(endX, endY, 3.5, 0, Math.PI * 2);
            ctx.fillStyle = theme.colorGreen;
            ctx.fill();
        }

        drawTopLegend(ctx, pad.left, rightEdge, [
            { label: simLegend, color: theme.colorGreen },
            { label: baseLegend, color: theme.textSec }
        ]);

        canvas._chartMeta = { type: 'forecast', series: projData, pad, plotW, plotH, minVal, span };
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

        const updateTip = (clientX, clientY) => {
            const meta = canvas._chartMeta;
            if (!meta) return;
            const rect = canvas.getBoundingClientRect();
            const mx = clientX - rect.left;

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
            } else if (meta.type === 'forecast') {
                const totalPts = meta.series.simulated.length;
                const rel = Math.max(0, Math.min(1, (mx - meta.pad.left) / meta.plotW));
                const idx = Math.round(rel * Math.max(0, totalPts - 1));
                const simVal = meta.series.simulated[idx] || 0;
                const baseVal = meta.series.baseline[idx] || 0;
                const label = idx === 0 ? 'Now' : `${idx}m`;
                tip.textContent = `${label}: ${PFCC.utils.formatCurrency(simVal)} (Base ${PFCC.utils.formatCurrency(baseVal)})`;
            }

            tip.style.display = 'block';
            const vw = global.innerWidth || 360;
            const maxLeft = Math.max(8, vw - Math.min(260, vw - 16));
            tip.style.left = `${Math.max(8, Math.min(clientX + 10, maxLeft))}px`;
            tip.style.top = `${Math.max(8, clientY - 34)}px`;
        };

        canvas.addEventListener('mousemove', e => updateTip(e.clientX, e.clientY));
        canvas.addEventListener('mouseleave', () => {
            tip.style.display = 'none';
        });
        canvas.addEventListener('touchstart', e => {
            if (e.touches && e.touches[0]) updateTip(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        canvas.addEventListener('touchmove', e => {
            if (e.touches && e.touches[0]) updateTip(e.touches[0].clientX, e.touches[0].clientY);
        }, { passive: true });
        canvas.addEventListener('touchend', () => {
            tip.style.display = 'none';
        }, { passive: true });
        canvas.addEventListener('touchcancel', () => {
            tip.style.display = 'none';
        }, { passive: true });
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
        bindCanvasTooltip(el.forecastChartCanvas);

        global.addEventListener('resize', () => {
            if (PFCC.state.activeView === 'budget') {
                updateUpperChart(PFCC.state.transactions);
            } else if (PFCC.state.activeView === 'forecast') {
                PFCC.planning.updateSimulation();
            }
        });
    }

    PFCC.charts = {
        sizeHiDpiCanvas,
        formatShortMoney,
        computeBudgetPaceSeries,
        computeRankedCategories,
        renderForecastCanvas,
        updateCharts,
        updateUpperChart,
        initCharts
    };
})(window);
