/**
 * Concept insights — names the CSCP concept behind what just happened.
 *
 * getConceptInsight(result, history) inspects the turn result (and recent
 * history for variance-based patterns) and returns the single most relevant
 * concept with the player's actual numbers woven in, or null.
 * Rendered by TurnSummaryCard as the "Concept in action" block.
 */

const fmt = (n) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(Math.abs(n));

function variance(arr) {
    if (arr.length === 0) return 0;
    const m = arr.reduce((a, b) => a + b, 0) / arr.length;
    return arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
}

/**
 * @param {Object} result  — engine lastTurnResult
 * @param {Array}  history — engine state.history (includes this result)
 * @returns {{ term: string, text: string } | null}
 */
export function getConceptInsight(result, history = []) {
    const r = result;
    if (!r) return null;

    // Crisis fired → risk management framing
    if (r.crisis && r.crisis.severity !== 'positive') {
        return {
            term: 'Supply Chain Risk Management (SCRM)',
            text: `"${r.crisis.name}" was outside your control — but your exposure to it wasn't. SCRM means paying small premiums (dual sourcing, buffers, flexible routing) so single events can't break the chain.`,
        };
    }

    // Stockout → reorder point / safety stock
    if (r.missedSales > 0) {
        const lostRev = r.sales > 0 ? Math.round(r.missedSales * (r.revenue / r.sales)) : r.missedSales * 120;
        return {
            term: 'Reorder Point & Safety Stock',
            text: `${r.missedSales.toLocaleString()} units short ≈ ${fmt(lostRev)} lost. ROP = (demand × lead time) + safety stock — with a ${r.leadTimeTurns}-turn lead time, this stockout was locked in by an order placed too small, too late.`,
        };
    }

    // Order variance far exceeding demand variance → bullwhip
    const recent = history.slice(-4);
    if (recent.length >= 3) {
        const ratio = variance(recent.map(t => t.orderQuantity)) /
                      (variance(recent.map(t => t.demand)) || 1);
        if (ratio >= 2) {
            return {
                term: 'Bullwhip Effect',
                text: `Your recent orders swing ${ratio.toFixed(1)}× more than demand does. That amplification is the bullwhip effect — you are reacting to your own past orders, not to customers. Smooth your order sizes toward the demand signal.`,
            };
        }
    }

    // Defects reached customers → cost of quality
    if (r.defectsPassed > 30) {
        return {
            term: 'Cost of Quality (COQ)',
            text: `${r.defectsPassed.toLocaleString()} defects reached customers — that's external failure cost, the most expensive COQ category. The ${fmt(r.inspectionCost)} you ${r.inspectionCost > 0 ? 'spent' : 'saved'} on inspection is cheap by comparison.`,
        };
    }

    // Holding cost dominated → carrying cost / JIT trade-off
    if (r.holdingCost > 30000 && r.holdingCost > r.shippingCost * 1.5) {
        return {
            term: 'Inventory Carrying Cost',
            text: `${fmt(r.holdingCost)} went to warehousing stock that earned nothing this quarter. Carrying cost is why JIT exists — every unit on the shelf is cash paying rent. Order closer to real demand.`,
        };
    }

    // Shipping-heavy turn → total cost of ownership
    if (r.shippingCost > 20000 && r.shippingCost > r.orderCost * 0.3) {
        const pct = Math.round((r.shippingCost / r.totalCost) * 100);
        return {
            term: 'Total Cost of Ownership (TCO)',
            text: `Freight was ${pct}% of your total cost this quarter. TCO thinking prices the whole journey — a cheap unit price plus premium shipping is often dearer than a costlier local source on slower freight.`,
        };
    }

    // Backlog carried → service level
    if (r.backlog > 0) {
        return {
            term: 'Service Level & Backorders',
            text: `${r.backlog.toLocaleString()} units are backordered into next quarter. Every backordered unit is a customer waiting — service level measures the demand you fill on time, and yours just slipped.`,
        };
    }

    // Default: forecast accuracy framing (MAPE) when demand deviated notably
    const deviation = Math.abs(r.demand - 1000) / 1000;
    if (deviation >= 0.15) {
        return {
            term: 'Forecast Error (MAPE)',
            text: `Actual demand of ${r.demand.toLocaleString()} landed ${Math.round(deviation * 100)}% off the 1,000-unit baseline. That gap is what MAPE measures — and it's exactly why safety stock exists: to absorb the forecast being wrong.`,
        };
    }

    // Quiet, well-run quarter — reinforce the order-up-to logic
    if (r.profit > 0) {
        return {
            term: 'Order-Up-To Level',
            text: `Demand covered, no backlog, buffer intact. This is the order-up-to model working: on-hand + on-order raised to expected demand plus safety stock — nothing more, nothing less.`,
        };
    }

    return null;
}
