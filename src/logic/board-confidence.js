/**
 * Board Confidence — a persistent 0–100 gauge of how the board rates you.
 *
 * Moves on results (stockouts, losses, defects, strong quarters), allocation
 * choices, crisis handling, and board-question answers. Hits zero → the board
 * fires you. Gives every decision an emotional stake beyond the cash line.
 */

export const CONFIDENCE_START = 70;

/** Clamp-adjust confidence on engine state. Safe when the field is missing. */
export function adjustConfidence(state, delta) {
    if (typeof state.boardConfidence !== 'number') state.boardConfidence = CONFIDENCE_START;
    state.boardConfidence = Math.max(0, Math.min(100, state.boardConfidence + delta));
    return state.boardConfidence;
}

/**
 * Assess a turn result → { delta, reasons: [{delta, text}] }.
 * @param {Object} result — engine turn result
 */
export function assessTurn(result) {
    const reasons = [];
    const add = (delta, text) => reasons.push({ delta, text });

    if (result.missedSales > 500)      add(-10, 'major stockout');
    else if (result.missedSales > 0)   add(-6,  'stockout');

    if (result.profit > 80000)         add(+4, 'exceptional quarter');
    else if (result.profit > 0)        add(+2, 'profitable quarter');
    else                               add(-4, 'loss quarter');

    if (result.defectsPassed > 50)     add(-3, 'defects reached customers');

    if (result._crisisResponse?.mitigated) add(+2, 'decisive crisis response');

    return { delta: reasons.reduce((s, r) => s + r.delta, 0), reasons };
}

/** Meter band for styling. */
export function confidenceBand(value) {
    if (value >= 60) return 'good';
    if (value >= 30) return 'wary';
    return 'critical';
}

/**
 * Render (or update) the HUD meter chip inside a host element.
 * @param {HTMLElement} host — container (created content is idempotent)
 * @param {number} value
 */
export function renderConfidenceMeter(host, value) {
    if (!host) return;
    let el = host.querySelector('.board-conf');
    if (!el) {
        el = document.createElement('div');
        el.className = 'board-conf';
        el.title = 'Board confidence — hits zero and you are out';
        el.innerHTML = `
            <span class="board-conf-label">BOARD</span>
            <span class="board-conf-track"><span class="board-conf-fill"></span></span>
            <span class="board-conf-value"></span>`;
        host.prepend(el);
    }
    const band = confidenceBand(value);
    el.dataset.band = band;
    el.querySelector('.board-conf-fill').style.width = `${value}%`;
    el.querySelector('.board-conf-value').textContent = Math.round(value);
}
