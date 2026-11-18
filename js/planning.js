(function (global) {
    'use strict';

    const PFCC = global.PFCC = global.PFCC || {};

    function calculateRunway(activeTxs, allTxs) {
        const txs = allTxs || PFCC.state.transactions;
        const netBalance = txs.reduce((acc, t) => acc + t.amount, 0);
        const totalExp = activeTxs.filter(t => t.amount < 0).reduce((acc, t) => acc + Math.abs(t.amount), 0);
        const income = activeTxs.filter(t => t.amount > 0).reduce((acc, t) => acc + t.amount, 0);

        if (totalExp === 0) return { text: 'No Burn', months: Infinity, status: 'safe' };
        if (income >= totalExp) return { text: 'Cash Positive', months: Infinity, status: 'positive' };

        const netMonthlyBurn = totalExp - income;
        if (netBalance <= 0) return { text: '0.0 Mos', months: 0, status: 'danger' };

        const months = netBalance / netMonthlyBurn;
        return {
            text: `${months.toFixed(1)} Mos`,
            months,
            status: months < 3 ? 'danger' : (months < 6 ? 'warning' : 'safe')
        };
    }

    // 4-Point Freelancer Treasury Matrix (Replaces Gamified RPG Badges)
    function computeFinancialRatios(activeTxs, allTxs, subs, taxRateVal) {
        const txs = allTxs || PFCC.state.transactions;
        const subscriptions = subs || PFCC.state.subscriptions;
        const inc = activeTxs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const exp = activeTxs.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);

        const savingsRate = inc > 0 ? ((inc - exp) / inc) * 100 : null;

        const monthlySubs = subscriptions.reduce((sum, sub) => {
            return sum + (sub.billingCycle === 'yearly' ? sub.amount / 12 : sub.amount);
        }, 0);
        const fixedBurnRatio = exp > 0 ? Math.min(999, (monthlySubs / exp) * 100) : (monthlySubs > 0 ? 100 : 0);

        const allIncome = txs.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
        const liquidBalance = txs.reduce((s, t) => s + t.amount, 0);
        const taxReserve = allIncome * (taxRateVal || 0.25);
        const taxDelta = liquidBalance - taxReserve;

        const runway = calculateRunway(activeTxs, txs);

        return {
            savingsRate,
            fixedBurnRatio,
            monthlySubs,
            taxReserve,
            taxDelta,
            taxCovered: taxDelta >= 0,
            runway
        };
    }

    function updateFinancialRatiosStrip(activeTxs) {
        const el = PFCC.dom;
        if (!el.ratioSavingsRate) return;
        const taxRate = el.taxRate ? parseFloat(el.taxRate.value) || 0.25 : 0.25;
        const r = computeFinancialRatios(activeTxs, PFCC.state.transactions, PFCC.state.subscriptions, taxRate);

        if (r.savingsRate === null) {
            el.ratioSavingsRate.textContent = 'N/A';
            el.ratioSavingsRate.className = 'submetric-val text-muted';
        } else {
            el.ratioSavingsRate.textContent = `${r.savingsRate.toFixed(1)}%`;
            el.ratioSavingsRate.className = `submetric-val ${r.savingsRate >= 20 ? 'text-green' : (r.savingsRate >= 0 ? 'text-warn' : 'text-red')}`;
        }

        if (el.ratioFixedBurn) {
            el.ratioFixedBurn.textContent = `${r.fixedBurnRatio.toFixed(1)}%`;
            el.ratioFixedBurn.className = `submetric-val ${r.fixedBurnRatio <= 35 ? 'text-green' : (r.fixedBurnRatio <= 60 ? 'text-warn' : 'text-red')}`;
        }

        if (el.ratioTaxCoverage) {
            if (r.taxReserve === 0) {
                el.ratioTaxCoverage.textContent = 'No Tax Due';
                el.ratioTaxCoverage.className = 'submetric-val text-muted';
            } else if (r.taxCovered) {
                el.ratioTaxCoverage.textContent = 'Covered (100%)';
                el.ratioTaxCoverage.className = 'submetric-val text-green';
            } else {
                el.ratioTaxCoverage.textContent = `-${PFCC.utils.formatCurrency(Math.abs(r.taxDelta))}`;
                el.ratioTaxCoverage.className = 'submetric-val text-red';
            }
        }

        if (el.ratioSurvivalRunway) {
            el.ratioSurvivalRunway.textContent = r.runway.text;
            el.ratioSurvivalRunway.className = `submetric-val ${r.runway.status === 'danger' ? 'text-red' : (r.runway.status === 'warning' ? 'text-warn' : 'text-green')}`;
        }
    }

    function runFinancialAdvisor(totalIncome, totalExpense, activeTimeframeTxs, runway) {
        const el = PFCC.dom;
        const settings = PFCC.state.settings;
        const formatCurrency = PFCC.utils.formatCurrency;
        if (!el.advisorCards) return;
        el.advisorCards.textContent = '';

        const insights = [];
        const netSavings = totalIncome - totalExpense;
        const targetGoal = settings.savingsGoal || 0;
        const budgetLimit = settings.budget || 0;

        if (el.goalProgress) {
            if (targetGoal > 0) {
                const goalPct = totalIncome === 0 ? 0 : Math.max(0, Math.min((netSavings / targetGoal) * 100, 100));
                el.goalProgress.textContent = `${goalPct.toFixed(1)}%`;
                if (netSavings >= targetGoal) {
                    insights.push({ type: 'success', icon: 'check', title: 'Savings Target Met', text: `Target of ${formatCurrency(targetGoal)} achieved for this period.` });
                } else if (netSavings < 0) {
                    insights.push({ type: 'danger', icon: 'alert', title: 'Negative Cashflow', text: `Expenses exceed income by ${formatCurrency(Math.abs(netSavings))}.` });
                } else {
                    insights.push({ type: 'info', icon: 'target', title: 'Savings Goal Active', text: `${formatCurrency(targetGoal - netSavings)} remaining to hit your target.` });
                }
            } else {
                el.goalProgress.textContent = 'N/A';
            }
        }

        if (budgetLimit > 0) {
            const actualUsagePct = (totalExpense / budgetLimit) * 100;
            el.budgetProgressBar.style.width = `${Math.min(actualUsagePct, 100)}%`;
            el.budgetPercentageText.textContent = `${actualUsagePct.toFixed(1)}%`;

            if (actualUsagePct > 100) {
                el.budgetProgressBar.classList.add('over-budget');
                el.budgetPercentageText.classList.add('text-red');
                insights.push({ type: 'danger', icon: 'alert', title: 'Over Monthly Budget', text: `Exceeded overall budget by ${formatCurrency(totalExpense - budgetLimit)}.` });
            } else {
                el.budgetProgressBar.classList.remove('over-budget');
                el.budgetPercentageText.classList.remove('text-red');
            }
            el.budgetStatusTag.textContent = `Budget: ${formatCurrency(budgetLimit)}`;
        } else {
            el.budgetProgressBar.style.width = '0%';
            el.budgetProgressBar.classList.remove('over-budget');
            el.budgetPercentageText.textContent = 'N/A';
            el.budgetPercentageText.classList.remove('text-red');
            el.budgetStatusTag.textContent = 'Budget: Unset';
        }

        if (settings.categoryBudgets) {
            const catExpenses = activeTimeframeTxs.filter(t => t.amount < 0).reduce((acc, t) => {
                acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
                return acc;
            }, {});

            Object.keys(settings.categoryBudgets).forEach(cat => {
                const cap = parseFloat(settings.categoryBudgets[cat]) || 0;
                const spent = catExpenses[cat] || 0;
                if (cap > 0 && spent > cap) {
                    insights.push({
                        type: 'warning',
                        icon: 'alert',
                        title: `${cat} Cap Exceeded`,
                        text: `Spent ${formatCurrency(spent)} of ${formatCurrency(cap)} limit in ${cat}.`
                    });
                }
            });
        }

        if (runway.status === 'danger') {
            insights.push({ type: 'danger', icon: 'alert', title: 'Runway Alert', text: `High burn rate: ${runway.text} of runway remaining.` });
        }

        let score = 100;
        if (budgetLimit > 0 && totalExpense > budgetLimit) score -= 30;
        if (netSavings < 0) score -= 40;
        if (PFCC.state.transactions.length === 0) score = 100;
        if (el.healthSub) {
            el.healthSub.textContent = `Health: ${Math.max(0, Math.min(100, score))}/100`;
        }

        if (insights.length === 0) {
            insights.push({ type: 'info', icon: 'activity', title: 'Indicators Nominal', text: 'Cashflow, budget limits, and runway are within target ranges.' });
        }

        insights.slice(0, 4).forEach(item => {
            const card = PFCC.utils.createEl('div', `advice-card ${item.type}`);
            const heading = PFCC.utils.createEl('h4', 'advice-title');
            heading.appendChild(PFCC.icons.create(item.icon, 15));
            heading.appendChild(PFCC.utils.createEl('span', '', item.title));
            const p = PFCC.utils.createEl('p', '', item.text);
            card.appendChild(heading);
            card.appendChild(p);
            el.advisorCards.appendChild(card);
        });
    }

    function renderEnvelopes(activeTimeframeTxs) {
        const el = PFCC.dom;
        if (!el.envelopesGrid) return;
        el.envelopesGrid.textContent = '';

        const budgets = PFCC.state.settings.categoryBudgets || { Software: 150, Food: 400, Housing: 1000, Transport: 150 };
        const catExpenses = activeTimeframeTxs.filter(t => t.amount < 0).reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + Math.abs(t.amount);
            return acc;
        }, {});

        const formatCurrency = PFCC.utils.formatCurrency;
        let renderedCount = 0;

        Object.keys(budgets).forEach(cat => {
            const limit = parseFloat(budgets[cat]) || 0;
            if (limit <= 0) return;
            renderedCount++;
            const spent = catExpenses[cat] || 0;
            const pct = (spent / limit) * 100;
            const cappedPct = Math.min(pct, 100);

            let tone = 'green';
            let statusText = `${formatCurrency(limit - spent)} left`;
            if (pct >= 100) {
                tone = 'red';
                statusText = `+${formatCurrency(spent - limit)} over`;
            } else if (pct >= 75) {
                tone = 'warn';
            }

            const card = PFCC.utils.createEl('div', 'envelope-card');
            const top = PFCC.utils.createEl('div', 'envelope-top');

            const titleWrap = PFCC.utils.createEl('span', 'envelope-title');
            titleWrap.appendChild(PFCC.icons.create(PFCC.icons.getCategoryIcon(cat), 15));
            titleWrap.appendChild(PFCC.utils.createEl('span', '', cat));

            const badge = PFCC.utils.createEl('span', `envelope-badge tone-${tone}`, `${pct.toFixed(0)}%`);
            top.appendChild(titleWrap);
            top.appendChild(badge);

            const numbers = PFCC.utils.createEl('div', 'envelope-numbers');
            numbers.appendChild(PFCC.utils.createEl('span', 'envelope-spent', `${formatCurrency(spent)} spent`));
            numbers.appendChild(PFCC.utils.createEl('span', '', `Limit: ${formatCurrency(limit)}`));

            const barBg = PFCC.utils.createEl('div', 'envelope-bar-bg');
            const barFill = PFCC.utils.createEl('div', `envelope-bar-fill tone-bg-${tone}`);
            barFill.style.width = `${cappedPct}%`;
            barBg.appendChild(barFill);

            const statusEl = PFCC.utils.createEl('div', `envelope-status-text tone-text-${tone}`, statusText);

            card.appendChild(top);
            card.appendChild(numbers);
            card.appendChild(barBg);
            card.appendChild(statusEl);
            el.envelopesGrid.appendChild(card);
        });

        if (renderedCount === 0) {
            el.envelopesGrid.appendChild(
                PFCC.utils.createEl('p', 'empty-hint span-all', 'No category limits configured. Select "Adjust Limits" to allocate budget envelopes.')
            );
        }
    }

    function parseGrowthRate(rawVal) {
        const parsed = parseFloat(rawVal);
        return Number.isNaN(parsed) ? 0.07 : parsed / 100;
    }

    function updateSimulation() {
        const el = PFCC.dom;
        if (!el.simIncomeShift) return;
        const formatCurrency = PFCC.utils.formatCurrency;
        const incomeShift = parseFloat(el.simIncomeShift.value) || 0;
        const expenseShift = parseFloat(el.simExpenseShift.value) || 0;
        const growthRate = parseGrowthRate(el.simAnnualGrowth.value);
        const horizonYears = PFCC.state.forecastYears || 3;
        const totalMonths = horizonYears * 12;

        el.simIncomeShiftVal.textContent = `${incomeShift >= 0 ? '+' : ''}${formatCurrency(incomeShift)}/mo`;
        el.simExpenseShiftVal.textContent = `${expenseShift >= 0 ? '+' : ''}${formatCurrency(expenseShift)}/mo`;
        el.simAnnualGrowthVal.textContent = `${Math.round(growthRate * 100)}% / yr`;

        const timeframeFiltered = PFCC.utils.getFilteredTransactionsByTimeframe(PFCC.state.transactions, PFCC.state.timeframe);
        const curInc = timeframeFiltered.filter(i => i.amount > 0).reduce((acc, i) => acc + i.amount, 0);
        const curExp = timeframeFiltered.filter(i => i.amount < 0).reduce((acc, i) => acc + Math.abs(i.amount), 0);

        const baseMonthlyNet = curInc - curExp;
        const simInc = Math.max(0, curInc + incomeShift);
        const simExp = Math.max(0, curExp + expenseShift);
        const simMonthlyNet = simInc - simExp;

        el.simNewNet.textContent = `${simMonthlyNet >= 0 ? '+' : ''}${formatCurrency(simMonthlyNet)}/mo`;
        el.simNewNet.className = `submetric-val sim-val ${simMonthlyNet >= 0 ? 'text-green' : 'text-red'}`;

        const lifetimeBalance = PFCC.state.transactions.reduce((acc, item) => acc + item.amount, 0);
        if (simExp === 0) {
            el.simRunway.textContent = 'No Burn';
            el.simRunway.className = 'submetric-val sim-val text-green';
        } else if (simInc >= simExp) {
            el.simRunway.textContent = 'Cash Positive';
            el.simRunway.className = 'submetric-val sim-val text-green';
        } else {
            const netBurn = simExp - simInc;
            const mos = lifetimeBalance > 0 ? (lifetimeBalance / netBurn) : 0;
            el.simRunway.textContent = `${mos.toFixed(1)} Mos`;
            el.simRunway.className = `submetric-val sim-val ${mos < 3 ? 'text-red' : (mos < 6 ? 'text-warn' : 'text-accent')}`;
        }

        const rMonthly = growthRate / 12;
        const startWealth = PFCC.markets ? PFCC.markets.calculateNetWorth().total : Math.max(0, lifetimeBalance);
        const baselineSeries = [Math.max(0, startWealth)];
        const simulatedSeries = [Math.max(0, startWealth)];

        let fvBase = Math.max(0, startWealth);
        let fvSim = Math.max(0, startWealth);
        for (let m = 1; m <= totalMonths; m++) {
            fvBase = Math.max(0, fvBase * (1 + rMonthly) + baseMonthlyNet);
            fvSim = Math.max(0, fvSim * (1 + rMonthly) + simMonthlyNet);
            baselineSeries.push(fvBase);
            simulatedSeries.push(fvSim);
        }

        el.sim1yr.textContent = formatCurrency(simulatedSeries[Math.min(12, simulatedSeries.length - 1)]);
        if (el.simHorizonLabel) el.simHorizonLabel.textContent = `${horizonYears}-Year Projected Wealth`;
        if (el.simHorizonVal) el.simHorizonVal.textContent = formatCurrency(simulatedSeries[simulatedSeries.length - 1]);

        if (el.forecastChartCanvas && PFCC.charts && PFCC.charts.renderForecastCanvas) {
            PFCC.charts.renderForecastCanvas(el.forecastChartCanvas, {
                baseline: baselineSeries,
                simulated: simulatedSeries
            });
        }
    }

    function renderHeatmap() {
        const el = PFCC.dom;
        if (!el.heatmapGrid) return;
        el.heatmapGrid.textContent = '';
        const now = new Date();
        const year = now.getFullYear();
        if (el.heatmapYearLabel) el.heatmapYearLabel.textContent = String(year);

        const dayMap = {};
        PFCC.state.transactions.forEach(t => {
            const d = t.date;
            if (!d || !d.startsWith(String(year))) return;
            if (!dayMap[d]) dayMap[d] = { income: 0, expense: 0 };
            if (t.amount > 0) dayMap[d].income += t.amount;
            else dayMap[d].expense += Math.abs(t.amount);
        });

        const jan1 = new Date(year, 0, 1);
        const startDay = jan1.getDay();
        const endDate = new Date(year, 11, 31);

        let currentDate = new Date(jan1);
        let currentWeek = PFCC.utils.createEl('div', 'heatmap-week');
        el.heatmapGrid.appendChild(currentWeek);

        for (let pad = 0; pad < startDay; pad++) {
            currentWeek.appendChild(PFCC.utils.createEl('div', 'heatmap-cell heatmap-spacer'));
        }

        while (currentDate <= endDate) {
            if (currentDate.getDay() === 0 && currentWeek.children.length > 0) {
                currentWeek = PFCC.utils.createEl('div', 'heatmap-week');
                el.heatmapGrid.appendChild(currentWeek);
            }

            const dateStr = PFCC.utils.getLocalDateString(currentDate);
            const cell = PFCC.utils.createEl('button', 'heatmap-cell');
            cell.type = 'button';
            cell.setAttribute('data-date', dateStr);
            cell.setAttribute('aria-label', `Filter ledger by ${dateStr}`);

            const data = dayMap[dateStr];
            if (data) {
                const net = data.income - data.expense;
                if (net > 0) {
                    const intensity = Math.min(data.income / 500, 1);
                    cell.style.background = `rgba(52, 211, 153, ${0.25 + intensity * 0.7})`;
                    cell.style.borderColor = 'rgba(52, 211, 153, 0.5)';
                } else if (data.expense > 0) {
                    const intensity = Math.min(data.expense / 300, 1);
                    cell.style.background = `rgba(248, 113, 113, ${0.25 + intensity * 0.7})`;
                    cell.style.borderColor = 'rgba(248, 113, 113, 0.5)';
                }
            }

            if (currentDate > now) cell.style.opacity = '0.3';

            const showTip = (clientX, clientY) => {
                if (!el.heatmapTooltip) return;
                const info = dayMap[dateStr];
                el.heatmapTooltip.textContent = '';
                el.heatmapTooltip.appendChild(PFCC.utils.createEl('strong', '', dateStr));
                if (info) {
                    if (info.income > 0) {
                        el.heatmapTooltip.appendChild(PFCC.utils.createEl('div', 'text-green', `+${PFCC.utils.formatCurrency(info.income)} Income`));
                    }
                    if (info.expense > 0) {
                        el.heatmapTooltip.appendChild(PFCC.utils.createEl('div', 'text-red', `-${PFCC.utils.formatCurrency(info.expense)} Expenses`));
                    }
                } else {
                    el.heatmapTooltip.appendChild(PFCC.utils.createEl('div', 'text-muted', 'No activity'));
                }
                el.heatmapTooltip.style.display = 'block';
                const left = Math.min(clientX + 12, global.innerWidth - 190);
                el.heatmapTooltip.style.left = `${Math.max(8, left)}px`;
                el.heatmapTooltip.style.top = `${Math.max(8, clientY - 12)}px`;
            };

            cell.addEventListener('mouseenter', e => showTip(e.clientX, e.clientY));
            cell.addEventListener('focus', () => {
                const rect = cell.getBoundingClientRect();
                showTip(rect.left, rect.bottom + 8);
            });
            cell.addEventListener('mouseleave', () => {
                if (el.heatmapTooltip) el.heatmapTooltip.style.display = 'none';
            });
            cell.addEventListener('blur', () => {
                if (el.heatmapTooltip) el.heatmapTooltip.style.display = 'none';
            });
            cell.addEventListener('click', () => {
                if (typeof PFCC.switchWorkbenchView === 'function') PFCC.switchWorkbenchView('ledger');
                if (el.searchFilter) {
                    el.searchFilter.value = dateStr;
                    el.searchFilter.dispatchEvent(new Event('input'));
                    el.searchFilter.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    PFCC.audio.playClickSound();
                }
            });

            currentWeek.appendChild(cell);
            currentDate.setDate(currentDate.getDate() + 1);
        }
    }

    function updateFIREAndTax() {
        const el = PFCC.dom;
        const txs = PFCC.state.transactions;
        const allIncome = txs.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0);
        const lifetimeBalance = txs.reduce((a, t) => a + t.amount, 0);

        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
        const recentTxs = txs.filter(t => new Date(t.date) >= sixMonthsAgo);
        const monthsSpan = Math.max(1, Math.ceil((Date.now() - sixMonthsAgo.getTime()) / (30.44 * 86400000)));

        const monthlyIncome = recentTxs.filter(t => t.amount > 0).reduce((a, t) => a + t.amount, 0) / monthsSpan;
        const monthlyExpense = recentTxs.filter(t => t.amount < 0).reduce((a, t) => a + Math.abs(t.amount), 0) / monthsSpan;
        const monthlySavings = monthlyIncome - monthlyExpense;
        const annualBurn = monthlyExpense * 12;

        const fireTarget = annualBurn * 25;
        const netWorth = PFCC.markets.calculateNetWorth().total;
        const firePct = fireTarget > 0 ? (netWorth / fireTarget) * 100 : 0;

        if (el.fireTarget) el.fireTarget.textContent = PFCC.utils.formatCurrency(fireTarget);
        if (el.fireProgress) el.fireProgress.textContent = `${firePct.toFixed(1)}%`;
        if (el.fireProgressBar) el.fireProgressBar.style.width = `${Math.min(firePct, 100)}%`;

        if (el.fireYear) {
            if (fireTarget > 0 && firePct >= 100) {
                el.fireYear.textContent = 'Target Reached';
                el.fireYear.className = 'submetric-val text-green';
            } else if (monthlySavings > 0 && fireTarget > 0) {
                const remaining = Math.max(0, fireTarget - netWorth);
                const yearsToFire = (remaining / monthlySavings) / 12;
                const targetYear = new Date().getFullYear() + Math.ceil(yearsToFire);
                el.fireYear.textContent = `~${targetYear} (${Math.ceil(yearsToFire)}yr)`;
                el.fireYear.className = 'submetric-val text-accent';
            } else {
                el.fireYear.textContent = fireTarget === 0 ? 'Add expenses' : 'Net negative';
                el.fireYear.className = 'submetric-val text-muted';
            }
        }

        if (el.apocalypseRunway) {
            if (monthlyExpense > 0 && lifetimeBalance > 0) {
                const months = lifetimeBalance / monthlyExpense;
                const yrs = Math.floor(months / 12);
                const mos = Math.floor(months % 12);
                const days = Math.floor((months % 1) * 30);
                el.apocalypseRunway.textContent = yrs > 0 ? `${yrs}yr ${mos}mo ${days}d` : `${mos}mo ${days}d`;
            } else {
                el.apocalypseRunway.textContent = lifetimeBalance <= 0 ? '0 days' : 'Indefinite';
            }
        }

        const taxRate = el.taxRate ? parseFloat(el.taxRate.value) || 0.25 : 0.25;
        const taxReserve = allIncome * taxRate;
        const safeToSpend = Math.max(0, lifetimeBalance - taxReserve);

        if (el.taxLocked) el.taxLocked.textContent = PFCC.utils.formatCurrency(taxReserve);
        if (el.safeToSpend) el.safeToSpend.textContent = PFCC.utils.formatCurrency(safeToSpend);
    }

    function renderVaults() {
        const el = PFCC.dom;
        if (!el.vaultsGrid) return;
        el.vaultsGrid.textContent = '';

        if (PFCC.state.savingsVaults.length === 0) {
            const empty = PFCC.utils.createEl('div', 'ledger-empty span-all');
            const iconWrap = PFCC.utils.createEl('span', 'ledger-empty-icon');
            iconWrap.appendChild(PFCC.icons.create('target', 28));
            empty.appendChild(iconWrap);
            empty.appendChild(PFCC.utils.createEl('p', 'empty-hint', 'No savings vaults yet. Use "+ New Vault" to set a savings goal.'));
            el.vaultsGrid.appendChild(empty);
            return;
        }

        PFCC.state.savingsVaults.forEach(vault => {
            const pct = vault.target > 0 ? Math.min((vault.saved / vault.target) * 100, 100) : 0;
            const iconKey = PFCC.icons.normalizeVaultIcon(vault.icon);

            const card = PFCC.utils.createEl('div', 'vault-card');
            const header = PFCC.utils.createEl('div', 'vault-header');
            const titleWrap = PFCC.utils.createEl('span', 'vault-title');
            titleWrap.appendChild(PFCC.icons.create(iconKey, 15));
            titleWrap.appendChild(PFCC.utils.createEl('span', '', vault.name));

            header.appendChild(titleWrap);
            header.appendChild(PFCC.utils.createEl('span', 'vault-pct', `${pct.toFixed(1)}%`));

            const numbers = PFCC.utils.createEl('div', 'vault-numbers');
            numbers.appendChild(PFCC.utils.createEl('span', 'envelope-spent', PFCC.utils.formatCurrency(vault.saved)));
            numbers.appendChild(PFCC.utils.createEl('span', '', `of ${PFCC.utils.formatCurrency(vault.target)}`));

            const barBg = PFCC.utils.createEl('div', 'vault-bar-bg');
            const barFill = PFCC.utils.createEl('div', `vault-bar-fill ${pct >= 100 ? 'is-complete' : ''}`);
            barFill.style.width = `${pct}%`;
            barBg.appendChild(barFill);

            const actions = PFCC.utils.createEl('div', 'vault-actions');
            const depBtn = PFCC.utils.createEl('button', 'btn btn-outline btn-sm', '+ Deposit');
            depBtn.type = 'button';
            depBtn.addEventListener('click', () => {
                PFCC.openActionDialog({
                    title: `Deposit to ${vault.name}`,
                    message: `Current: ${PFCC.utils.formatCurrency(vault.saved)} of ${PFCC.utils.formatCurrency(vault.target)}`,
                    input: true,
                    inputLabel: 'Deposit Amount',
                    defaultValue: 100,
                    confirmLabel: 'Deposit',
                    onConfirm: amt => {
                        vault.saved = Math.min(vault.saved + amt, vault.target * 2);
                        PFCC.utils.safeSaveJSON('appSavingsVaults', PFCC.state.savingsVaults);
                        renderVaults();
                        PFCC.audio.playSuccessSound();
                    }
                });
            });

            const wdBtn = PFCC.utils.createEl('button', 'btn btn-outline btn-sm', '- Withdraw');
            wdBtn.type = 'button';
            wdBtn.addEventListener('click', () => {
                PFCC.openActionDialog({
                    title: `Withdraw from ${vault.name}`,
                    message: `Available: ${PFCC.utils.formatCurrency(vault.saved)}`,
                    input: true,
                    inputLabel: 'Withdraw Amount',
                    defaultValue: 50,
                    confirmLabel: 'Withdraw',
                    onConfirm: amt => {
                        vault.saved = Math.max(vault.saved - amt, 0);
                        PFCC.utils.safeSaveJSON('appSavingsVaults', PFCC.state.savingsVaults);
                        renderVaults();
                        PFCC.audio.playWarningSound();
                    }
                });
            });

            const delBtn = PFCC.utils.createEl('button', 'action-icon-btn delete');
            delBtn.type = 'button';
            delBtn.style.opacity = '1';
            delBtn.setAttribute('aria-label', `Delete vault ${vault.name}`);
            delBtn.appendChild(PFCC.icons.create('close', 14));
            delBtn.addEventListener('click', () => {
                PFCC.openActionDialog({
                    title: 'Delete Savings Vault',
                    message: `Remove "${vault.name}" from your savings vaults?`,
                    confirmLabel: 'Delete',
                    danger: true,
                    onConfirm: () => {
                        PFCC.state.savingsVaults = PFCC.state.savingsVaults.filter(v => v.id !== vault.id);
                        PFCC.utils.safeSaveJSON('appSavingsVaults', PFCC.state.savingsVaults);
                        renderVaults();
                        PFCC.audio.playWarningSound();
                    }
                });
            });

            actions.appendChild(depBtn);
            actions.appendChild(wdBtn);
            actions.appendChild(delBtn);

            card.appendChild(header);
            card.appendChild(numbers);
            card.appendChild(barBg);
            card.appendChild(actions);
            el.vaultsGrid.appendChild(card);
        });
    }

    function calculateDebtPayoffSchedule(debtsList, strategy) {
        const sorted = [...debtsList].sort((a, b) => {
            if (strategy === 'snowball') return a.balance - b.balance;
            return (b.rate || 0) - (a.rate || 0);
        });

        let tempDebts = sorted.filter(d => d.balance > 0).map(d => Object.assign({}, d));
        let months = 0;
        let totalInterest = 0;

        while (tempDebts.some(d => d.balance > 0) && months < 600) {
            months++;
            tempDebts.forEach(d => {
                const monthlyInterest = (d.balance * (d.rate || 0) / 100) / 12;
                totalInterest += monthlyInterest;
                d.balance += monthlyInterest;
                d.balance -= Math.max(d.minPayment || 0, 0);
                if (d.balance < 0) d.balance = 0;
            });
            tempDebts = tempDebts.filter(d => d.balance > 0);
        }

        return { sorted, months, totalInterest };
    }

    function renderDebts() {
        const el = PFCC.dom;
        if (!el.debtList) return;
        el.debtList.textContent = '';

        const { sorted, months, totalInterest } = calculateDebtPayoffSchedule(PFCC.state.debts, PFCC.state.debtStrategy);
        let totalDebt = 0;
        let totalMinPayment = 0;

        sorted.forEach((debt, idx) => {
            totalDebt += debt.balance;
            totalMinPayment += debt.minPayment;

            const li = PFCC.utils.createEl('li', `debt-item ${debt.balance <= 0 ? 'debt-paid-off' : ''}`);
            const info = PFCC.utils.createEl('div', 'sub-info');

            const nameEl = PFCC.utils.createEl('div', 'debt-name');
            if (idx === 0 && debt.balance > 0) {
                nameEl.appendChild(PFCC.utils.createEl('span', 'ledger-badge', 'NEXT'));
            }
            nameEl.appendChild(PFCC.utils.createEl('span', '', debt.name));

            const metaEl = PFCC.utils.createEl(
                'div',
                'debt-meta',
                `${debt.rate ? debt.rate + '% APR' : '0% APR'} | Min: ${PFCC.utils.formatCurrency(debt.minPayment)}/mo`
            );
            info.appendChild(nameEl);
            info.appendChild(metaEl);

            const actions = PFCC.utils.createEl('div', 'sub-actions');
            actions.appendChild(PFCC.utils.createEl('span', 'debt-balance', PFCC.utils.formatCurrency(debt.balance)));

            const payBtn = PFCC.utils.createEl('button', 'btn btn-outline btn-sm', 'Pay');
            payBtn.type = 'button';
            payBtn.disabled = debt.balance <= 0;
            payBtn.addEventListener('click', () => {
                PFCC.openActionDialog({
                    title: `Payment toward ${debt.name}`,
                    message: `Remaining balance: ${PFCC.utils.formatCurrency(debt.balance)}`,
                    input: true,
                    inputLabel: 'Payment Amount',
                    defaultValue: debt.minPayment,
                    confirmLabel: 'Apply Payment',
                    onConfirm: amt => {
                        debt.balance = Math.max(debt.balance - amt, 0);
                        PFCC.utils.safeSaveJSON('appDebts', PFCC.state.debts);
                        renderDebts();
                        PFCC.audio.playSuccessSound();
                    }
                });
            });

            const delBtn = PFCC.utils.createEl('button', 'action-icon-btn delete');
            delBtn.type = 'button';
            delBtn.style.opacity = '1';
            delBtn.setAttribute('aria-label', `Delete debt ${debt.name}`);
            delBtn.appendChild(PFCC.icons.create('close', 14));
            delBtn.addEventListener('click', () => {
                PFCC.openActionDialog({
                    title: 'Remove Debt Record',
                    message: `Delete "${debt.name}" from your payoff tracker?`,
                    confirmLabel: 'Remove',
                    danger: true,
                    onConfirm: () => {
                        PFCC.state.debts = PFCC.state.debts.filter(d => d.id !== debt.id);
                        PFCC.utils.safeSaveJSON('appDebts', PFCC.state.debts);
                        renderDebts();
                        PFCC.audio.playWarningSound();
                    }
                });
            });

            actions.appendChild(payBtn);
            actions.appendChild(delBtn);

            li.appendChild(info);
            li.appendChild(actions);
            el.debtList.appendChild(li);
        });

        if (PFCC.state.debts.length === 0) {
            const emptyLi = PFCC.utils.createEl('li', 'ledger-empty');
            const iconWrap = PFCC.utils.createEl('span', 'ledger-empty-icon');
            iconWrap.appendChild(PFCC.icons.create('creditCard', 26));
            emptyLi.appendChild(iconWrap);
            emptyLi.appendChild(PFCC.utils.createEl('p', 'empty-hint', 'No outstanding liabilities logged. Use "+ Add Debt" to model Snowball or Avalanche payoff.'));
            el.debtList.appendChild(emptyLi);
        }

        if (el.totalDebtBadge) el.totalDebtBadge.textContent = `Total: ${PFCC.utils.formatCurrency(totalDebt)}`;

        if (el.debtSummaryMetrics) {
            el.debtSummaryMetrics.textContent = '';
            if (PFCC.state.debts.length > 0) {
                const payoffStr = months >= 600 ? '50+ years' : `${Math.floor(months / 12)}yr ${months % 12}mo`;
                const items = [
                    { label: 'Debt-Free Estimate', value: payoffStr, cls: 'text-green' },
                    { label: 'Projected Interest', value: PFCC.utils.formatCurrency(totalInterest), cls: 'text-red' },
                    { label: 'Monthly Minimums', value: `${PFCC.utils.formatCurrency(totalMinPayment)}/mo`, cls: 'text-accent' }
                ];
                items.forEach(item => {
                    const box = PFCC.utils.createEl('div', 'submetric-card');
                    box.appendChild(PFCC.utils.createEl('span', 'submetric-label', item.label));
                    box.appendChild(PFCC.utils.createEl('h4', `submetric-val ${item.cls}`, item.value));
                    el.debtSummaryMetrics.appendChild(box);
                });
            }
        }
    }

    function resetSimulation() {
        const el = PFCC.dom;
        if (el.simIncomeShift) el.simIncomeShift.value = 0;
        if (el.simExpenseShift) el.simExpenseShift.value = 0;
        if (el.simAnnualGrowth) el.simAnnualGrowth.value = 7;
        PFCC.state.forecastYears = 3;
        if (el.simHorizonBtns) {
            el.simHorizonBtns.forEach(b => {
                const isDefault = b.getAttribute('data-years') === '3';
                b.classList.toggle('active', isDefault);
                b.setAttribute('aria-pressed', String(isDefault));
            });
            if (PFCC.liquid && el.simHorizonBtns[0] && el.simHorizonBtns[0].parentNode) {
                PFCC.liquid.syncContainer(el.simHorizonBtns[0].parentNode, true);
            }
        }
        updateSimulation();
    }

    function initPlanning() {
        const el = PFCC.dom;
        if (el.btnAdjustEnvelopes) {
            el.btnAdjustEnvelopes.addEventListener('click', () => {
                PFCC.settings.openSettings();
                const finTab = document.querySelector('[data-tab="finance"]');
                if (finTab) finTab.click();
                PFCC.audio.playClickSound();
            });
        }

        if (el.simIncomeShift) el.simIncomeShift.addEventListener('input', updateSimulation);
        if (el.simExpenseShift) el.simExpenseShift.addEventListener('input', updateSimulation);
        if (el.simAnnualGrowth) el.simAnnualGrowth.addEventListener('input', updateSimulation);

        if (el.simHorizonBtns) {
            el.simHorizonBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    el.simHorizonBtns.forEach(b => {
                        b.classList.remove('active');
                        b.setAttribute('aria-pressed', 'false');
                    });
                    btn.classList.add('active');
                    btn.setAttribute('aria-pressed', 'true');
                    if (PFCC.liquid && typeof PFCC.liquid.syncContainer === 'function') {
                        PFCC.liquid.syncContainer(btn.parentNode, true);
                    }
                    PFCC.state.forecastYears = parseInt(btn.getAttribute('data-years') || '3', 10);
                    updateSimulation();
                    PFCC.audio.playClickSound();
                });
            });
        }

        if (el.btnResetSim) {
            el.btnResetSim.addEventListener('click', () => {
                resetSimulation();
                PFCC.audio.playClickSound();
            });
        }

        if (el.taxRate) {
            el.taxRate.addEventListener('change', () => {
                updateFIREAndTax();
                const tf = PFCC.utils.getFilteredTransactionsByTimeframe(PFCC.state.transactions, PFCC.state.timeframe);
                updateFinancialRatiosStrip(tf);
            });
        }

        if (el.btnAddVault) {
            el.btnAddVault.addEventListener('click', () => {
                el.vaultFormDrawer.classList.toggle('active');
                if (el.vaultFormDrawer.classList.contains('active') && el.vaultName) el.vaultName.focus();
                PFCC.audio.playClickSound();
            });
        }
        if (el.btnCancelVault) {
            el.btnCancelVault.addEventListener('click', () => el.vaultFormDrawer.classList.remove('active'));
        }
        if (el.vaultForm) {
            el.vaultForm.addEventListener('submit', e => {
                e.preventDefault();
                const name = el.vaultName.value.trim();
                const target = parseFloat(el.vaultTarget.value);
                const saved = parseFloat(el.vaultSaved.value) || 0;
                const icon = PFCC.icons.normalizeVaultIcon(el.vaultIcon.value);
                if (!name || Number.isNaN(target) || target <= 0) return;

                PFCC.state.savingsVaults.push({
                    id: 'vault-' + Math.floor(Math.random() * 1000000),
                    name,
                    target,
                    saved,
                    icon
                });
                PFCC.utils.safeSaveJSON('appSavingsVaults', PFCC.state.savingsVaults);
                el.vaultForm.reset();
                if (PFCC.picker && typeof PFCC.picker.syncSelect === 'function') {
                    PFCC.picker.syncSelect(el.vaultIcon);
                }
                el.vaultFormDrawer.classList.remove('active');
                renderVaults();
                PFCC.audio.playSuccessSound();
            });
        }

        PFCC.compat.qsa('.debt-strategy-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                PFCC.compat.qsa('.debt-strategy-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                if (PFCC.liquid && typeof PFCC.liquid.syncContainer === 'function') {
                    PFCC.liquid.syncContainer(btn.parentNode, true);
                }
                PFCC.state.debtStrategy = btn.dataset.strategy;
                renderDebts();
                PFCC.audio.playClickSound();
            });
        });

        if (el.btnAddDebt) {
            el.btnAddDebt.addEventListener('click', () => {
                el.debtFormDrawer.classList.toggle('active');
                if (el.debtFormDrawer.classList.contains('active') && el.debtName) el.debtName.focus();
                PFCC.audio.playClickSound();
            });
        }
        if (el.btnCancelDebt) {
            el.btnCancelDebt.addEventListener('click', () => el.debtFormDrawer.classList.remove('active'));
        }
        if (el.debtForm) {
            el.debtForm.addEventListener('submit', e => {
                e.preventDefault();
                const name = el.debtName.value.trim();
                const balance = parseFloat(el.debtBalance.value);
                const rate = parseFloat(el.debtRate.value) || 0;
                const minPayment = parseFloat(el.debtMinPayment.value);
                if (!name || Number.isNaN(balance) || Number.isNaN(minPayment)) return;

                PFCC.state.debts.push({
                    id: 'debt-' + Math.floor(Math.random() * 1000000),
                    name,
                    balance,
                    rate,
                    minPayment
                });
                PFCC.utils.safeSaveJSON('appDebts', PFCC.state.debts);
                el.debtForm.reset();
                el.debtFormDrawer.classList.remove('active');
                renderDebts();
                PFCC.audio.playSuccessSound();
            });
        }
    }

    PFCC.planning = {
        calculateRunway,
        computeFinancialRatios,
        updateFinancialRatiosStrip,
        runFinancialAdvisor,
        renderEnvelopes,
        parseGrowthRate,
        updateSimulation,
        resetSimulation,
        renderHeatmap,
        updateFIREAndTax,
        renderVaults,
        calculateDebtPayoffSchedule,
        renderDebts,
        initPlanning
    };
})(window);
