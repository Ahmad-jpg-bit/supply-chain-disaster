/**
 * Route Planner — compose an intermodal shipping lane for a logistics chapter.
 *
 * A route is one long-haul leg (overseas plant → transit hub) plus one
 * last-mile leg (hub → regional DC). The composition sets your shipping
 * economics for the chapter: cost factor and lead-time change. Cheapest lanes
 * (ocean + rail) are slowest — and in this game slow *is* the risk, because
 * late arrivals cause stockouts. Teaches intermodal transportation directly.
 */

const BASELINE_DAYS = 20;   // the "standard" door-to-door time, = 0 turn delta
const DAYS_PER_TURN  = 14;  // ~2 weeks per quarter-turn, matching the engine

export const LONG_HAUL_LEGS = [
    {
        id: 'ocean', mode: 'Ocean Freight', icon: '🚢',
        from: 'Overseas Plant', to: 'Transit Hub',
        costFactor: 0.70, days: 28, risk: 'Weather & port congestion',
    },
    {
        id: 'air', mode: 'Air Freight', icon: '✈️',
        from: 'Overseas Plant', to: 'Transit Hub',
        costFactor: 1.55, days: 4, risk: 'Low — premium capacity',
    },
];

export const LAST_MILE_LEGS = [
    {
        id: 'rail', mode: 'Rail', icon: '🚆',
        from: 'Transit Hub', to: 'Regional DC',
        costFactor: 0.85, days: 7, risk: 'Fixed schedule, low flexibility',
    },
    {
        id: 'truck', mode: 'Trucking', icon: '🚚',
        from: 'Transit Hub', to: 'Regional DC',
        costFactor: 1.10, days: 3, risk: 'Flexible but fuel-exposed',
    },
];

export const DEFAULT_ROUTE = { longId: 'ocean', lastId: 'truck' };

/**
 * Compute totals + engine modifiers for a chosen long-haul + last-mile pair.
 * @returns {{ shippingCostFactor, leadTimeMod, totalDays, exposure, legs } | null}
 */
export function computeRoute(longId, lastId) {
    const long = LONG_HAUL_LEGS.find(l => l.id === longId);
    const last = LAST_MILE_LEGS.find(l => l.id === lastId);
    if (!long || !last) return null;

    const shippingCostFactor = Math.round(long.costFactor * last.costFactor * 100) / 100;
    const totalDays = long.days + last.days;
    const leadTimeMod = Math.round((totalDays - BASELINE_DAYS) / DAYS_PER_TURN);

    // Exposure is a teaching label: driven by transit time (late = stockout risk)
    const exposure = totalDays >= 30 ? 'High' : totalDays >= 15 ? 'Moderate' : 'Low';

    return { shippingCostFactor, leadTimeMod, totalDays, exposure, legs: { long, last } };
}

/**
 * Build the chapter-scoped active-route record from a chosen pair.
 */
export function routeFromChoice(longId, lastId, chapterIndex) {
    const r = computeRoute(longId, lastId);
    if (!r) return null;
    return {
        longId, lastId,
        label: `${r.legs.long.mode} → ${r.legs.last.mode}`,
        shippingCostFactor: r.shippingCostFactor,
        leadTimeMod: r.leadTimeMod,
        totalDays: r.totalDays,
        exposure: r.exposure,
        activeThroughChapter: chapterIndex,
    };
}

/** Chapter numbers where the route planner is offered. */
export const LOGISTICS_CHAPTERS = [6, 9, 10];
