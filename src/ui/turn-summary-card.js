/**
 * TurnSummaryCard — full-screen modal shown after every procurement turn.
 * Leads with a plain-language story (what happened → what contributed →
 * one thing to remember, from logic/turn-story.js); the animated income
 * statement, operations detail and counterfactual replay ("what if you'd
 * had X units available?") sit under "Full results".
 */

import { buildCounterfactual } from '../logic/counterfactual.js';
import { buildTurnStory } from '../logic/turn-story.js';
import { getIcon, iconify } from '../graphics/svg-icons.js';

const fmt = (n) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(Math.abs(n));

const fmtSigned = (n) =>
    (n >= 0 ? '+' : '−') + fmt(n);

/**
 * Identify the biggest cost driver and return a coaching callout.
 * Returns { icon, label, message, type: 'warn'|'good'|'info' }
 */
function buildKeyDriver(r) {
    // Crisis trumps all
    if (r.crisis) {
        const type = r.crisis.severity === 'positive' ? 'good'
                   : r.crisis.severity === 'critical'  ? 'warn'
                   : 'warn';
        return {
            icon: r.crisis.severity === 'positive' ? '✦' : getIcon('bolt', 16),
            label: `Crisis: ${r.crisis.name}`,
            message: r.crisis.ticker,
            type,
        };
    }

    // Stockout — always the most critical teaching moment
    if (r.missedSales > 100) {
        const lostRev = r.sales > 0
            ? Math.round(r.missedSales * (r.revenue / r.sales))
            : 0;
        return {
            icon: getIcon('warning', 16),
            label: 'Stock-out',
            message: `${r.missedSales.toLocaleString()} units went unfulfilled — ≈${fmt(lostRev)} in lost revenue. More stock arriving before demand (a bigger or earlier order, or a higher extra-stock target) reduces this, at the cost of holding more.`,
            type: 'warn',
        };
    }

    // Holding cost overload
    if (r.holdingCost > r.shippingCost * 1.5 && r.holdingCost > 30000) {
        return {
            icon: getIcon('box', 16),
            label: 'Overstock penalty',
            message: `${fmt(r.holdingCost)} in storage (holding) costs — stock was well above demand. Smaller orders would cost less to store but leave less cover for surprises.`,
            type: 'warn',
        };
    }

    // Shipping dominated margin
    if (r.shippingCost > r.orderCost * 0.30 && r.shippingCost > 20000) {
        return {
            icon: getIcon('plane', 16),
            label: 'Freight premium',
            message: `${fmt(r.shippingCost)} in shipping was ${Math.round((r.shippingCost / r.totalCost) * 100)}% of your total cost. Slower shipping costs less if you can wait longer for the stock.`,
            type: 'warn',
        };
    }

    // Defects escaped to customers
    if (r.defectsPassed > 30) {
        return {
            icon: getIcon('alertCircle', 16),
            label: 'Quality escape',
            message: `${r.defectsPassed.toLocaleString()} faulty units reached customers — satisfaction took a hit. Stricter inspection finds more of them, at a higher cost per unit.`,
            type: 'warn',
        };
    }

    // Safety stock breach
    if (r.safetyBreach) {
        return {
            icon: getIcon('warning', 16),
            label: 'Safety stock breach',
            message: `Inventory dipped below your ${r.safetyStockTarget.toLocaleString()}-unit safety buffer. A demand spike next quarter could trigger a stock-out.`,
            type: 'warn',
        };
    }

    // Profitable turn — positive reinforcement
    if (r.profit > 60000) {
        return {
            icon: '✦',
            label: 'Strong quarter',
            message: `${fmt(r.revenue)} in revenue with cost discipline. This cadence keeps you profitable.`,
            type: 'good',
        };
    }

    // Modest profit — neutral
    if (r.profit >= 0) {
        return {
            icon: '→',
            label: 'Positive quarter',
            message: `Slim margin of ${fmt(r.profit)}. Review your cost breakdown to find room for improvement.`,
            type: 'info',
        };
    }

    // Loss quarter
    const biggestCost = Math.max(r.orderCost, r.shippingCost, r.holdingCost);
    const biggestLabel = biggestCost === r.holdingCost ? 'holding costs'
                       : biggestCost === r.shippingCost ? 'shipping costs'
                       : 'order costs';
    return {
        icon: '↓',
        label: 'Loss quarter',
        message: `Net loss of ${fmt(r.profit)}. ${biggestLabel.charAt(0).toUpperCase() + biggestLabel.slice(1)} were the biggest drag at ${fmt(biggestCost)}.`,
        type: 'warn',
    };
}

export class TurnSummaryCard {
    constructor() {
        this.overlay = null;
    }

    /**
     * @param {Object} result    — engine lastTurnResult
     * @param {Object} chapter   — current chapter data (may be null in endless mode)
     * @param {Function} onDismiss
     */
    show(result, chapter, onDismiss) {
        if (!result) { onDismiss?.(); return; }

        const driver = buildKeyDriver(result);
        const isProfitable = result.profit >= 0;
        const profitClass = isProfitable ? 'tsc-profit--positive' : 'tsc-profit--negative';
        const profitSign  = isProfitable ? '+' : '−';

        const chapterLabel = chapter
            ? `Q${result.turn} · Ch ${chapter.number}: ${chapter.title}`
            : `Wave ${result.endlessWave || 1} · Turn ${result.endlessTurn ?? result.turn}`;

        const costRows = [
            { label: 'Procurement',   value: result.orderCost,         icon: getIcon('factory', 15) },
            { label: 'Shipping',       value: result.shippingCost,      icon: getIcon('ship', 15) },
            { label: 'Inspection',     value: result.inspectionCost,    icon: getIcon('search', 15) },
            { label: 'Defect disposal',value: result.defectDisposalCost,icon: getIcon('xCircle', 15) },
            { label: 'Holding',        value: result.holdingCost,       icon: getIcon('box', 15) },
        ].filter(row => row.value > 0);

        const driverClass = driver.type === 'good' ? 'tsc-driver--good'
                          : driver.type === 'warn' ? 'tsc-driver--warn'
                          :                          'tsc-driver--info';

        // Plain-language story — what happened, what contributed, one thing to remember
        const story = buildTurnStory(result);
        const KIND = { choice: 'Your choice', start: 'Starting position', event: 'Event', uncertainty: 'Uncertainty' };
        const remember = story.remember;
        const storyHtml = `
            <section class="tsc-story" aria-labelledby="tsc-h-what">
                <h3 class="tsc-h" id="tsc-h-what">What happened</h3>
                <p class="tsc-lead">${story.happened}</p>
                <p class="tsc-lead">${story.money}</p>
                <table class="tsc-ba">
                    <caption class="pw-visually-hidden">Before and after this quarter</caption>
                    <thead><tr><th scope="col"><span class="pw-visually-hidden">Measure</span></th><th scope="col">Before</th><th scope="col">After</th></tr></thead>
                    <tbody>${story.beforeAfter.map(row => `<tr class="tsc-ba--${row.tone}"><th scope="row">${row.label}</th><td>${row.before}</td><td>${row.after}</td></tr>`).join('')}</tbody>
                </table>
                <h3 class="tsc-h">What contributed</h3>
                <ul class="tsc-why">${story.contributions.map(c => `<li><span class="tsc-tag tsc-tag--${c.kind}">${KIND[c.kind]}</span> <span>${c.text}</span></li>`).join('')}</ul>
                ${remember ? `
                <div class="tsc-remember">
                    <h3 class="tsc-h">One thing to remember</h3>
                    ${remember.plain ? `<p class="tsc-remember-plain">${remember.plain}</p>` : ''}
                    <p class="tsc-remember-term">In supply-chain terms: <strong>${remember.term}</strong>. ${remember.detail}</p>
                </div>` : ''}
            </section>`;

        // Operations — what physically happened this quarter (resolved engine data only)
        const n = (x) => (x || 0).toLocaleString();
        const next = (result._nextArrivals || []).slice(0, 3);
        const unresolved = [
            result.backlog > 0 ? `${n(result.backlog)} units still owed to customers (backlog)` : null,
            result.safetyBreach ? `Stock ended below your ${n(result.safetyStockTarget)}-unit safety target` : null,
            next.length ? `Next arrivals: ${next.map(a => `${n(a.units)} in Q${a.turn}`).join(', ')}` : 'No shipments en route',
        ].filter(Boolean);
        const opsHtml = `
            <div class="tsc-ops" data-delay="0">
                <dl class="tsc-ops-grid">
                    <div><dt>Shipments received</dt><dd>${n(result.unitsReceived)}</dd></div>
                    <div><dt>Demand</dt><dd>${n(result.demand)}${result.backlogBefore ? `<small> + ${n(result.backlogBefore)} backlog</small>` : ''}</dd></div>
                    <div><dt>Units fulfilled</dt><dd>${n(result.sales)}</dd></div>
                    <div class="${result.missedSales > 0 ? 'tsc-ops--bad' : ''}"><dt>Shortage</dt><dd>${result.missedSales > 0 ? n(result.missedSales) : 'None'}</dd></div>
                    <div><dt>Stock at quarter end</dt><dd>${n(result.inventory)}</dd></div>
                    <div><dt>Cash at quarter close</dt><dd>${(result.cash < 0 ? '−' : '') + fmt(result.cash)}</dd></div>
                </dl>
                <ul class="tsc-ops-next" aria-label="Carried into next quarter">${unresolved.map(t => `<li>${t}</li>`).join('')}</ul>
            </div>`;

        // Forecast verdict (demand slider call), decorated by dashboard
        const fc = result._forecast;
        let predictionHtml = '';
        if (fc) {
            const hit = fc.apePct <= 10;
            const near = fc.apePct <= 25;
            const icon = hit ? getIcon('target', 15) : near ? '≈' : '✗';
            const verdict = hit ? 'sharp call' : near ? 'close' : 'wide miss';
            const grade = fc.mapePct <= 10 ? 'planner-grade' : fc.mapePct <= 20 ? 'solid' : 'noisy';
            predictionHtml = `
                <div class="tsc-prediction ${hit ? 'tsc-prediction--hit' : 'tsc-prediction--miss'}" data-delay="0">
                    <span class="tsc-prediction-icon">${icon}</span>
                    <span class="tsc-prediction-text">
                        Forecast <strong>${fc.forecast.toLocaleString()}</strong> ·
                        actual <strong>${fc.actual.toLocaleString()}</strong> —
                        off by ${fc.apePct.toFixed(1)}% (${verdict}) ·
                        Session MAPE: <strong>${fc.mapePct.toFixed(1)}%</strong> over ${fc.n} call${fc.n !== 1 ? 's' : ''} — ${grade}
                    </span>
                </div>`;
        }

        // Active supply-contract outcome this quarter
        const contractHtml = result.contractNote ? `
            <div class="tsc-contract ${result.contractHonoured ? 'tsc-contract--ok' : 'tsc-contract--miss'}" data-delay="${costRows.length + 4}">
                ${getIcon('fileText', 14)} ${result.contractNote}
            </div>` : '';

        // Crisis mitigation record — the player's decisive response
        const cr = result._crisisResponse;
        const crisisResponseHtml = (cr && cr.mitigated) ? `
            <div class="tsc-mitigation" data-delay="${costRows.length + 4}">
                ${getIcon('wrench', 14)} <strong>${cr.label}</strong> — you paid ${fmt(cr.cost)} to blunt the crisis before it landed.
            </div>` : '';

        // Human vignette — a voice from the ground
        const vg = result._vignette;
        const vignetteHtml = vg ? `
            <div class="tsc-vignette" data-delay="${costRows.length + 5}">
                <p class="tsc-vignette-quote">&ldquo;${vg.quote}&rdquo;</p>
                <span class="tsc-vignette-source">— ${vg.source}</span>
            </div>` : '';

        // World-memory echoes — past decisions shaping this turn
        const echoes = result.worldEchoes || [];
        const echoesHtml = echoes.length ? `
            <div class="tsc-echoes" data-delay="${costRows.length + 4}">
                <div class="tsc-echoes-label">${getIcon('history', 13)} THE CHAIN REMEMBERS</div>
                ${echoes.map(e => `
                    <div class="tsc-echo">
                        <span class="tsc-echo-icon">${iconify(e.icon, 15)}</span>
                        <div class="tsc-echo-body">
                            <span class="tsc-echo-title">${e.title}</span>
                            <p class="tsc-echo-text">${e.text}</p>
                        </div>
                    </div>`).join('')}
            </div>` : '';

        // The concept-in-action insight leads the card as "One thing to remember" (storyHtml)

        // Counterfactual replay — same quarter, different availability
        const cf = buildCounterfactual(result);
        const cfHtml = cf ? `
            <div class="tsc-replay" data-delay="${costRows.length + 6}">
                <button class="tsc-replay-toggle" type="button">
                    ${getIcon('refresh', 13)} Replay this quarter — what if you'd had more (or less) stock?
                </button>
                <div class="tsc-replay-panel hidden">
                    <div class="tsc-replay-slider-row">
                        <input type="range" class="tsc-replay-slider"
                               min="0" max="${cf.maxX}" step="50" value="${cf.x0}"
                               aria-label="Units available in replay"/>
                        <span class="tsc-replay-x">${cf.x0.toLocaleString()} units</span>
                    </div>
                    <table class="tsc-replay-table">
                        <thead><tr><th></th><th>Actual</th><th>Replay</th><th>Δ</th></tr></thead>
                        <tbody>
                            <tr data-metric="missed"><td>Missed sales</td><td></td><td></td><td></td></tr>
                            <tr data-metric="leftover"><td>Units left over</td><td></td><td></td><td></td></tr>
                            <tr data-metric="holding"><td>Holding cost</td><td></td><td></td><td></td></tr>
                            <tr data-metric="net"><td>Quarter net</td><td></td><td></td><td></td></tr>
                        </tbody>
                    </table>
                    <p class="tsc-replay-note">Simplified replay — same demand (${cf.demand.toLocaleString()} units) and prices; ignores knock-on effects on later quarters.</p>
                </div>
            </div>` : '';

        this.overlay = document.createElement('div');
        this.overlay.className = 'tsc-overlay';
        this.overlay.innerHTML = `
            <div class="tsc-card glass-panel" role="dialog" aria-modal="true" aria-labelledby="tsc-title">

                <div class="tsc-header">
                    <div class="tsc-eyebrow">${chapterLabel}</div>
                    <h2 class="tsc-title" id="tsc-title" tabindex="-1">Quarter ${result.turn} results</h2>
                </div>

                <div class="tsc-body">

                    ${storyHtml}

                    ${predictionHtml}

                    <details class="tsc-details">
                    <summary>Full results: money, operations and replay</summary>

                    ${opsHtml}

                    <!-- Income Statement -->
                    <div class="tsc-statement">

                        <!-- Revenue row -->
                        <div class="tsc-row tsc-row--revenue" data-delay="0">
                            <span class="tsc-row-icon">${getIcon('coins', 15)}</span>
                            <span class="tsc-row-label">Revenue</span>
                            <span class="tsc-row-value tsc-row-value--revenue">+${fmt(result.revenue)}</span>
                        </div>

                        <div class="tsc-section-label" data-delay="1">Cost Breakdown</div>

                        ${costRows.map((row, i) => `
                        <div class="tsc-row tsc-row--cost" data-delay="${i + 2}">
                            <span class="tsc-row-icon">${row.icon}</span>
                            <span class="tsc-row-label">${row.label}</span>
                            <span class="tsc-row-value">−${fmt(row.value)}</span>
                        </div>`).join('')}

                        <div class="tsc-divider" data-delay="${costRows.length + 2}"></div>

                        <!-- Net profit -->
                        <div class="tsc-row tsc-row--profit ${profitClass}" data-delay="${costRows.length + 3}">
                            <span class="tsc-row-icon">${getIcon(isProfitable ? 'chartUp' : 'chartDown', 15)}</span>
                            <span class="tsc-row-label">Net Profit</span>
                            <span class="tsc-row-value tsc-profit-value">${profitSign}${fmt(result.profit)}</span>
                        </div>

                    </div>

                    <!-- Key Driver Callout -->
                    <div class="tsc-driver ${driverClass}" data-delay="${costRows.length + 4}">
                        <span class="tsc-driver-icon">${driver.icon}</span>
                        <div class="tsc-driver-body">
                            <span class="tsc-driver-label">${driver.label}</span>
                            <p class="tsc-driver-message">${driver.message}</p>
                        </div>
                    </div>

                    ${contractHtml}

                    ${crisisResponseHtml}

                    ${vignetteHtml}

                    ${echoesHtml}

                    ${cfHtml}

                    </details>

                </div>

                <div class="tsc-footer">
                    <button class="btn-primary tsc-continue-btn">Continue &rarr;</button>
                </div>

            </div>
        `;

        document.body.appendChild(this.overlay);

        // Animate overlay in
        requestAnimationFrame(() => {
            this.overlay.classList.add('tsc-overlay--visible');
            this._staggerRows();
            this.overlay.querySelector('#tsc-title')?.focus({ preventScroll: true });
        });

        this.overlay.querySelector('.tsc-continue-btn')
            .addEventListener('click', () => {
                this._hide();
                onDismiss?.();
            });

        if (cf) this._bindReplay(cf);
    }

    _bindReplay(cf) {
        const toggle = this.overlay.querySelector('.tsc-replay-toggle');
        const panel  = this.overlay.querySelector('.tsc-replay-panel');
        const slider = this.overlay.querySelector('.tsc-replay-slider');
        const xLabel = this.overlay.querySelector('.tsc-replay-x');

        const actual = cf.evaluate(cf.x0);
        const money  = (n) => (n < 0 ? '−' : '') + fmt(n);

        const update = () => {
            const x = parseInt(slider.value, 10);
            xLabel.textContent = x.toLocaleString() + ' units';
            const replay = cf.evaluate(x);
            const rows = {
                missed:   [actual.missed.toLocaleString(),   replay.missed.toLocaleString(),   replay.missed - actual.missed,   true],
                leftover: [actual.leftover.toLocaleString(), replay.leftover.toLocaleString(), replay.leftover - actual.leftover, true],
                holding:  [money(actual.holding),            money(replay.holding),            replay.holding - actual.holding,  true],
                net:      [money(actual.net),                money(replay.net),                replay.net - actual.net,          false],
            };
            for (const [metric, [a, b, delta, lowerIsBetter]] of Object.entries(rows)) {
                const tr = this.overlay.querySelector(`tr[data-metric="${metric}"]`);
                if (!tr) continue;
                const cells = tr.querySelectorAll('td');
                cells[1].textContent = a;
                cells[2].textContent = b;
                const better = lowerIsBetter ? delta < 0 : delta > 0;
                const isMoney = metric === 'holding' || metric === 'net';
                cells[3].textContent = delta === 0 ? '—'
                    : (delta > 0 ? '+' : '−') + (isMoney ? fmt(delta) : Math.abs(delta).toLocaleString());
                cells[3].className = delta === 0 ? '' : better ? 'tsc-replay-delta--good' : 'tsc-replay-delta--bad';
            }
        };

        toggle.addEventListener('click', () => {
            panel.classList.toggle('hidden');
            if (!panel.classList.contains('hidden')) update();
        });
        slider.addEventListener('input', update);
    }

    _staggerRows() {
        const items = this.overlay.querySelectorAll('[data-delay]');
        items.forEach(el => {
            const delay = parseInt(el.dataset.delay, 10) * 120;
            setTimeout(() => el.classList.add('tsc-row--visible'), delay);
        });
    }

    _hide() {
        if (!this.overlay) return;
        this.overlay.classList.remove('tsc-overlay--visible');
        this.overlay.classList.add('tsc-overlay--exit');
        this.overlay.addEventListener('transitionend', () => {
            this.overlay?.remove();
            this.overlay = null;
        }, { once: true });
        setTimeout(() => { this.overlay?.remove(); this.overlay = null; }, 400);
    }
}
