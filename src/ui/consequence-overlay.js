/**
 * ConsequenceOverlay — a brief auto-dismissing banner injected at the top of
 * the story phase, surfacing the most notable financial outcome from the last
 * procurement turn. Replaces the "loading screen → outcome card" pattern with
 * inline, contextual consequence messaging.
 */

const fmt = (n) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0
    }).format(Math.abs(n));

/**
 * Derive the single most notable consequence from a turn result object.
 * Returns null if nothing is significant enough to surface.
 */
export function buildConsequenceData(result) {
    if (!result) return null;

    // Crisis events take priority — they're unpredictable and most educational
    if (result.crisis) {
        const c = result.crisis;
        const type = c.severity === 'positive' ? 'positive'
                   : c.severity === 'critical' ? 'critical'
                   : c.severity === 'high'     ? 'negative'
                   :                             'neutral';
        const icon = c.severity === 'positive' ? '✓'
                   : c.severity === 'critical' ? '🔴'
                   : c.severity === 'high'     ? '⚠'
                   :                             '⚡';
        return {
            type,
            icon,
            headline: `Crisis: ${c.name}`,
            detail: typeof c.consequenceText === 'function' ? c.consequenceText(c) : c.ticker,
        };
    }

    // 1. Stock-out — most operationally critical
    if (result.missedSales > 0) {
        const lostRev = fmt(result.missedSales * (result.revenue / (result.sales || 1)));
        return {
            type: 'critical',
            icon: '⚠',
            headline: `Stock-out: ${result.missedSales.toLocaleString()} units unmet`,
            detail: `≈${lostRev} in missed revenue — replenish faster next quarter.`,
        };
    }

    // 2. Large loss quarter
    if (result.profit < -25000) {
        return {
            type: 'negative',
            icon: '↓',
            headline: `Loss quarter: ${fmt(result.profit)} net`,
            detail: result.holdingCost > result.shippingCost
                ? `Overstock drove ${fmt(result.holdingCost)} in holding costs — lean down.`
                : `Shipping premiums cost ${fmt(result.shippingCost)} — review freight tiers.`,
        };
    }

    // 3. Premium freight dominated costs
    if (result.shippingCost > 0 && result.shippingCost > result.orderCost * 0.35) {
        return {
            type: 'negative',
            icon: '✈',
            headline: `Freight premium: ${fmt(result.shippingCost)} in shipping`,
            detail: 'Air/express lanes consumed margin — consider sea freight if lead time allows.',
        };
    }

    // 4. Quality escape
    if (result.defectsPassed > 50) {
        return {
            type: 'negative',
            icon: '🔴',
            headline: `Quality escape: ${result.defectsPassed.toLocaleString()} defective units shipped`,
            detail: 'Customer satisfaction hit. Upgrade inspection tier to contain future escapes.',
        };
    }

    // 5. Holding cost overload (overstock)
    if (result.holdingCost > 45000) {
        return {
            type: 'neutral',
            icon: '📦',
            headline: `Overstock penalty: ${fmt(result.holdingCost)} in holding costs`,
            detail: 'Excess inventory is eroding margins — reduce order quantity or increase safety stock precision.',
        };
    }

    // 6. Strong profitable turn — positive reinforcement
    if (result.profit > 75000) {
        return {
            type: 'positive',
            icon: '✓',
            headline: `Record quarter: +${fmt(result.profit)} net profit`,
            detail: 'Supply chain aligned with demand. Sustain this cadence.',
        };
    }

    return null; // nothing notable enough
}

let _autoTimer = null;

/**
 * Inject a consequence banner at the top of the given container element.
 * Auto-dismisses after `duration` ms. Returns the created element.
 */
export function showConsequenceOverlay(container, data, duration = 5000) {
    if (!data || !container) return null;

    // Remove any existing overlay
    dismissConsequenceOverlay(container);

    const el = document.createElement('div');
    el.className = `consequence-overlay consequence-overlay--${data.type}`;
    el.setAttribute('role', 'status');
    el.innerHTML = `
        <div class="cq-inner">
            <span class="cq-icon" aria-hidden="true">${data.icon}</span>
            <div class="cq-body">
                <span class="cq-headline">${data.headline}</span>
                <span class="cq-detail">${data.detail}</span>
            </div>
            <button class="cq-dismiss" aria-label="Dismiss" title="Dismiss">×</button>
        </div>
        <div class="cq-progress" style="animation-duration:${duration}ms"></div>
    `;

    el.querySelector('.cq-dismiss').addEventListener('click', () => {
        _dismiss(el);
    });

    // Prepend before all other children
    container.insertBefore(el, container.firstChild);

    // Force reflow then add the enter class
    void el.offsetHeight;
    el.classList.add('consequence-overlay--visible');

    if (_autoTimer) clearTimeout(_autoTimer);
    _autoTimer = setTimeout(() => _dismiss(el), duration);

    return el;
}

export function dismissConsequenceOverlay(container) {
    container?.querySelectorAll('.consequence-overlay').forEach(el => _dismiss(el));
}

function _dismiss(el) {
    el.classList.remove('consequence-overlay--visible');
    el.classList.add('consequence-overlay--exit');
    el.addEventListener('transitionend', () => el.remove(), { once: true });
    // Safety removal if transition doesn't fire
    setTimeout(() => el.remove(), 600);
}
