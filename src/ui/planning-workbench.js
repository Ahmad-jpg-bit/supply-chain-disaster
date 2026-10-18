/**
 * Planning Workbench — live inventory projection for the procurement workspace.
 *
 * As the player changes order quantity / safety stock / supplier / shipping,
 * this projects on-hand inventory over the next few turns using the engine's
 * own fulfilment order (arrivals → demand, backlog first) with deterministic
 * demand — the volatility the player must buffer against is exactly what
 * safety stock is for. Rendered by ui/procurement-workspace.js.
 */

const HORIZON = 4;

/**
 * Pure projection of the next HORIZON turns.
 *
 * @param {Object} p
 * @param {number} p.inventory      — on-hand units now
 * @param {number} p.backlog        — carried backlog
 * @param {Array}  p.inTransit      — engine inTransit entries ({ usableUnits, passedDefects, arrivesOnTurn })
 * @param {number} p.currentTurn    — the turn being planned
 * @param {number} p.orderQty       — order being placed this turn
 * @param {number} p.orderUsable    — usable units of that order after defects
 * @param {number} p.leadTimeTurns  — lead time of the new order
 * @param {number} p.expectedDemand — deterministic demand forecast per turn
 * @param {number} p.safetyStock    — player's safety stock target
 * @param {number} [p.horizon]      — turns to project (default HORIZON)
 * @returns {Array<{turn, arrivals, demand, endInv, stockout, short, belowSafety}>}
 */
export function computeProjection(p) {
    const rows = [];
    let inv     = p.inventory;
    let backlog = p.backlog || 0;

    for (let i = 0; i < (p.horizon ?? HORIZON); i++) {
        const turn = p.currentTurn + i;

        let arrivals = (p.inTransit || [])
            .filter(o => o.arrivesOnTurn === turn)
            .reduce((s, o) => s + (o.usableUnits || 0) + (o.passedDefects || 0), 0);
        if (turn === p.currentTurn + p.leadTimeTurns) arrivals += p.orderUsable;

        inv += arrivals;
        const short     = Math.max(0, p.expectedDemand - inv);
        const effDemand = p.expectedDemand + backlog;
        const sales     = Math.min(inv, effDemand);
        const stockout  = inv < p.expectedDemand;
        backlog         = Math.max(0, effDemand - sales);
        inv             = Math.max(0, inv - sales);

        rows.push({
            turn,
            arrivals,
            demand: p.expectedDemand,
            endInv: inv,
            stockout,
            short,
            belowSafety: inv < p.safetyStock,
        });
    }
    return rows;
}
