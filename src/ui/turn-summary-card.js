/**
 * TurnSummaryCard — full-screen modal shown after every procurement turn.
 * Displays an animated income statement (revenue → costs → net profit)
 * so the player understands exactly why their cash changed.
 */

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
            icon: r.crisis.severity === 'positive' ? '✦' : '⚡',
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
            icon: '⚠',
            label: 'Stock-out',
            message: `${r.missedSales.toLocaleString()} units went unfulfilled — ≈${fmt(lostRev)} in lost revenue. Raise your order quantity or safety stock target.`,
            type: 'warn',
        };
    }

    // Holding cost overload
    if (r.holdingCost > r.shippingCost * 1.5 && r.holdingCost > 30000) {
        return {
            icon: '📦',
            label: 'Overstock penalty',
            message: `${fmt(r.holdingCost)} tied up in holding costs — your inventory exceeds demand. Lean down your order quantity.`,
            type: 'warn',
        };
    }

    // Shipping dominated margin
    if (r.shippingCost > r.orderCost * 0.30 && r.shippingCost > 20000) {
        return {
            icon: '✈',
            label: 'Freight premium',
            message: `${fmt(r.shippingCost)} in shipping ate ${Math.round((r.shippingCost / r.totalCost) * 100)}% of your total cost. Shift to sea or rail if lead time allows.`,
            type: 'warn',
        };
    }

    // Defects escaped to customers
    if (r.defectsPassed > 30) {
        return {
            icon: '🔴',
            label: 'Quality escape',
            message: `${r.defectsPassed.toLocaleString()} defective units shipped to customers — satisfaction took a hit. Step up to Standard or Rigorous inspection.`,
            type: 'warn',
        };
    }

    // Safety stock breach
    if (r.safetyBreach) {
        return {
            icon: '⚠',
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
            ? `Q${result.turn - 1} · Ch ${chapter.number}: ${chapter.title}`
            : `Wave ${result.endlessWave || 1} · Turn ${result.turn - 1}`;

        const costRows = [
            { label: 'Procurement',   value: result.orderCost,         icon: '🏭' },
            { label: 'Shipping',       value: result.shippingCost,      icon: '🚢' },
            { label: 'Inspection',     value: result.inspectionCost,    icon: '🔍' },
            { label: 'Defect disposal',value: result.defectDisposalCost,icon: '❌' },
            { label: 'Holding',        value: result.holdingCost,       icon: '📦' },
        ].filter(row => row.value > 0);

        const driverClass = driver.type === 'good' ? 'tsc-driver--good'
                          : driver.type === 'warn' ? 'tsc-driver--warn'
                          :                          'tsc-driver--info';

        this.overlay = document.createElement('div');
        this.overlay.className = 'tsc-overlay';
        this.overlay.innerHTML = `
            <div class="tsc-card glass-panel">

                <div class="tsc-header">
                    <div class="tsc-eyebrow">${chapterLabel}</div>
                    <h2 class="tsc-title">Quarterly Results</h2>
                </div>

                <div class="tsc-body">

                    <!-- Income Statement -->
                    <div class="tsc-statement">

                        <!-- Revenue row -->
                        <div class="tsc-row tsc-row--revenue" data-delay="0">
                            <span class="tsc-row-icon">💰</span>
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
                            <span class="tsc-row-icon">${isProfitable ? '📈' : '📉'}</span>
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

                </div>

                <div class="tsc-footer">
                    <button class="btn-primary tsc-continue-btn">Next Turn &rarr;</button>
                </div>

            </div>
        `;

        document.body.appendChild(this.overlay);

        // Animate overlay in
        requestAnimationFrame(() => {
            this.overlay.classList.add('tsc-overlay--visible');
            this._staggerRows();
        });

        this.overlay.querySelector('.tsc-continue-btn')
            .addEventListener('click', () => {
                this._hide();
                onDismiss?.();
            });
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
