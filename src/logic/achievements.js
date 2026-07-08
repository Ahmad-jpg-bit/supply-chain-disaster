/**
 * Concept-named achievements — badges that force the vocabulary.
 *
 * Unlocks persist in localStorage ('scd_achievements'); each id maps to the
 * CSCP concept it certifies. Checked at turn end and chapter end; newly
 * unlocked achievements are returned for the toast.
 */

const STORAGE_KEY = 'scd_achievements';

export const ACHIEVEMENT_DEFS = {
    bullwhip_tamer: {
        icon: '🎢',
        name: 'Bullwhip Tamer',
        concept: 'Bullwhip Effect',
        desc: 'Finished a chapter with a bullwhip ratio under 1.5 — your orders tracked demand instead of amplifying it.',
    },
    tco_hawk: {
        icon: '🦅',
        name: 'TCO Hawk',
        concept: 'Total Cost of Ownership',
        desc: 'Finished a chapter with total landed cost under $115 per unit sold — you priced the whole journey, not just the invoice.',
    },
    forecast_oracle: {
        icon: '🔮',
        name: 'Forecast Oracle',
        concept: 'MAPE',
        desc: 'Session MAPE under 10% across 8+ forecast calls — planner-grade accuracy.',
    },
    loyalty_dividend: {
        icon: '🤝',
        name: 'Loyalty Dividend',
        concept: 'Supplier Relationship Management',
        desc: 'A long-standing supplier shielded you during a crisis. Relationships are capacity insurance.',
    },
    clean_streak: {
        icon: '✨',
        name: 'Clean Streak',
        concept: 'Cost of Quality',
        desc: 'Eight consecutive quarters without shipping a single defect to customers.',
    },
    perfect_service: {
        icon: '🛡️',
        name: 'Perfect Service',
        concept: 'Service Level',
        desc: 'A full chapter without missing a single sale — 100% fill rate.',
    },
};

function getUnlocked() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); }
    catch { return {}; }
}

function unlock(ids) {
    if (!ids.length) return [];
    const stored = getUnlocked();
    const fresh = ids.filter(id => !stored[id] && ACHIEVEMENT_DEFS[id]);
    if (!fresh.length) return [];
    fresh.forEach(id => { stored[id] = Date.now(); });
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(stored)); } catch { /* noop */ }
    return fresh.map(id => ({ id, ...ACHIEVEMENT_DEFS[id] }));
}

/**
 * Turn-end checks.
 * @param {Object} p
 * @param {Object} p.result        — engine turn result
 * @param {Object} p.forecastStats — { sumApe, n } session forecast stats
 * @param {Object} p.worldMemory   — engine.state.worldMemory
 * @returns {Array} newly unlocked definitions
 */
export function checkTurnAchievements({ result, forecastStats, worldMemory }) {
    const ids = [];

    if (forecastStats?.n >= 8 && (forecastStats.sumApe / forecastStats.n) < 0.10) {
        ids.push('forecast_oracle');
    }
    if ((result?.worldEchoes || []).some(e => (e.title || '').includes('shields you'))) {
        ids.push('loyalty_dividend');
    }
    if ((worldMemory?.cleanQuarters ?? 0) >= 8) {
        ids.push('clean_streak');
    }
    return unlock(ids);
}

/**
 * Chapter-end checks.
 * @param {Array} chapterTurns — history entries for the finished chapter
 * @returns {Array} newly unlocked definitions
 */
export function checkChapterAchievements(chapterTurns) {
    if (!chapterTurns || chapterTurns.length < 3) return [];
    const ids = [];

    const variance = (arr) => {
        const m = arr.reduce((a, b) => a + b, 0) / arr.length;
        return arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
    };
    const bw = variance(chapterTurns.map(t => t.orderQuantity)) /
               (variance(chapterTurns.map(t => t.demand)) || 1);
    if (bw < 1.5) ids.push('bullwhip_tamer');

    const totalSales = chapterTurns.reduce((s, t) => s + (t.sales || 0), 0);
    const landed = chapterTurns.reduce((s, t) =>
        s + (t.orderCost || 0) + (t.shippingCost || 0) + (t.inspectionCost || 0) +
        (t.defectDisposalCost || 0) + (t.holdingCost || 0), 0);
    if (totalSales > 0 && landed / totalSales < 115) ids.push('tco_hawk');

    if (chapterTurns.every(t => (t.missedSales || 0) === 0)) ids.push('perfect_service');

    return unlock(ids);
}
