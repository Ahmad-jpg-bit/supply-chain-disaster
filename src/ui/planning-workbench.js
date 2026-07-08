/**
 * Planning Workbench — live inventory projection in the procurement panel.
 *
 * As the player drags order quantity / safety stock / switches supplier or
 * shipping, this projects on-hand inventory over the next few turns using the
 * engine's own fulfilment model (deterministic demand — the volatility the
 * player must buffer against is exactly what safety stock is for).
 *
 * Direct manipulation with continuous feedback: drag left and the stockout
 * zone appears; drag right and the overstock signal grows.
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
 * @returns {Array<{turn, arrivals, demand, endInv, stockout, belowSafety}>}
 */
export function computeProjection(p) {
    const rows = [];
    let inv     = p.inventory;
    let backlog = p.backlog || 0;

    for (let i = 0; i < HORIZON; i++) {
        const turn = p.currentTurn + i;

        let arrivals = (p.inTransit || [])
            .filter(o => o.arrivesOnTurn === turn)
            .reduce((s, o) => s + (o.usableUnits || 0) + (o.passedDefects || 0), 0);
        if (turn === p.currentTurn + p.leadTimeTurns) arrivals += p.orderUsable;

        inv += arrivals;
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
            belowSafety: inv < p.safetyStock,
        });
    }
    return rows;
}

/**
 * Render the projection as a compact SVG bar chart with a safety-stock line.
 * @param {Array} rows        — output of computeProjection
 * @param {number} safetyStock
 * @returns {string} svg markup
 */
export function renderProjectionSVG(rows, safetyStock) {
    const W = 250, H = 110, PAD_L = 8, PAD_B = 18, PAD_T = 12;
    const plotH = H - PAD_B - PAD_T;
    const maxVal = Math.max(safetyStock * 1.4, ...rows.map(r => r.endInv), 1);
    const barW = (W - PAD_L * 2) / rows.length;

    const y = (v) => PAD_T + plotH - (Math.min(v, maxVal) / maxVal) * plotH;

    const bars = rows.map((r, i) => {
        const x = PAD_L + i * barW + barW * 0.18;
        const bw = barW * 0.64;
        const barY = y(r.endInv);
        const colour = r.stockout ? '#ef4444' : r.belowSafety ? '#f59e0b' : '#22c55e';
        const label = r.endInv >= 1000 ? (r.endInv / 1000).toFixed(1) + 'k' : String(r.endInv);
        return `
            <rect x="${x.toFixed(1)}" y="${barY.toFixed(1)}" width="${bw.toFixed(1)}"
                  height="${Math.max(2, (PAD_T + plotH - barY)).toFixed(1)}"
                  rx="2" fill="${colour}" fill-opacity="0.75"/>
            ${r.stockout ? `<text x="${(x + bw / 2).toFixed(1)}" y="${(barY - 3).toFixed(1)}"
                  text-anchor="middle" font-size="8" fill="#f87171" font-weight="700">✕</text>` : ''}
            <text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle"
                  font-size="8" fill="#64748b">Q${r.turn}</text>
            <text x="${(x + bw / 2).toFixed(1)}" y="${Math.max(PAD_T + 7, barY - 3).toFixed(1)}"
                  text-anchor="middle" font-size="7.5" fill="#94a3b8">${r.stockout ? '' : label}</text>`;
    }).join('');

    const safetyY = y(safetyStock);
    return `
        <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img"
             aria-label="Projected inventory for the next ${rows.length} turns">
            <line x1="${PAD_L}" y1="${safetyY.toFixed(1)}" x2="${W - PAD_L}" y2="${safetyY.toFixed(1)}"
                  stroke="#3b82f6" stroke-width="1" stroke-dasharray="4 3" opacity="0.8"/>
            <text x="${W - PAD_L}" y="${(safetyY - 3).toFixed(1)}" text-anchor="end"
                  font-size="7.5" fill="#60a5fa">safety ${safetyStock.toLocaleString()}</text>
            ${bars}
        </svg>`;
}

/**
 * Compute + render into the workbench container, with a one-line readout.
 * @param {HTMLElement} container
 * @param {Object} params — see computeProjection
 */
export function updateWorkbench(container, params) {
    if (!container) return;
    const rows = computeProjection(params);

    const firstStockout = rows.find(r => r.stockout);
    const allHealthy    = rows.every(r => !r.stockout && !r.belowSafety);
    const excess        = rows.every(r => r.endInv > params.safetyStock * 2.2) && params.safetyStock > 0;

    let readout, cls;
    if (firstStockout) {
        readout = `Projected stockout in Q${firstStockout.turn} — order more or expedite`;
        cls = 'wb-readout--danger';
    } else if (excess) {
        readout = 'Well above safety stock all horizon — cash is sleeping in the warehouse';
        cls = 'wb-readout--warn';
    } else if (allHealthy) {
        readout = 'Buffer holds across the horizon';
        cls = 'wb-readout--good';
    } else {
        readout = 'Buffer dips below safety stock — a demand spike would hurt';
        cls = 'wb-readout--warn';
    }

    container.innerHTML = `
        <div class="wb-label">INVENTORY PROJECTION — NEXT ${rows.length} TURNS</div>
        ${renderProjectionSVG(rows, params.safetyStock)}
        <div class="wb-readout ${cls}">${readout}</div>
    `;
}
