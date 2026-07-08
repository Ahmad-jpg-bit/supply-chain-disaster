/**
 * Counterfactual replay — "what if you'd had X units available this quarter?"
 *
 * Pure recompute of the quarter just played with the SAME demand, backlog and
 * prices, varying only the units available at fulfilment. Comparing what
 * happened to what would have happened is one of the strongest teaching
 * mechanics there is.
 *
 * Simplifications (stated in the UI): unit economics are taken from this
 * quarter's actuals, and knock-on effects on later quarters are ignored.
 */

const HOLDING_RATES = { electronics: 0.07, fmcg: 0.04, pharma: 0.09 };
const BASE_COST = 100;

/**
 * Build an evaluate-able model from a turn result.
 * Returns null when the result lacks the snapshot fields (legacy turns).
 *
 * @param {Object} r — engine turn result
 * @returns {{ x0, demand, effDemand, maxX, evaluate(x): Object } | null}
 */
export function buildCounterfactual(r) {
    if (r == null || r.startingInventory == null || r.demand == null) return null;

    const available = r.startingInventory + (r.unitsReceived || 0);
    const backlog   = r.backlogBefore || 0;
    const effDemand = r.demand + backlog;

    // Per-unit economics from this quarter's actuals, with sane fallbacks
    const pricePerUnit = r.sales > 0 ? r.revenue / r.sales : BASE_COST * 1.3;
    const landedPerUnit = r.orderQuantity > 0
        ? (r.orderCost + r.shippingCost + r.inspectionCost + r.defectDisposalCost) / r.orderQuantity
        : BASE_COST * 1.15;
    const holdingRate = HOLDING_RATES[r.industryId] ?? 0.05;

    const evaluate = (x) => {
        const sales   = Math.min(x, effDemand);
        const missed  = Math.max(0, r.demand - x);
        const revenue = sales * pricePerUnit;
        const holding = x * BASE_COST * holdingRate;
        // Units you'd have needed to acquire beyond what was already on hand
        const acquisition = landedPerUnit * Math.max(0, x - r.startingInventory);
        const net = revenue - holding - acquisition;
        return { x, sales: Math.round(sales), missed: Math.round(missed),
                 revenue: Math.round(revenue), holding: Math.round(holding),
                 acquisition: Math.round(acquisition), net: Math.round(net),
                 leftover: Math.max(0, Math.round(x - sales)) };
    };

    return {
        x0: available,
        demand: r.demand,
        effDemand,
        maxX: Math.max(available, Math.ceil((effDemand * 1.6) / 100) * 100),
        evaluate,
    };
}
