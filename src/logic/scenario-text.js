/**
 * Scenario briefing text as shown to the player.
 *
 * Briefings that describe the player's current position use tokens filled
 * from the live game state when the briefing appears, so the story never
 * contradicts the numbers on screen. The text is looked up by scenario id
 * from the current data: saved games carry copies of scenarios (in
 * `currentScenario` / `shuffledScenarios`), and older copies may hold
 * outdated wording.
 *
 * Tokens: {stock} units on hand · {nextQuarter} earliest arrival quarter for
 * a new order (lead time is never under one quarter) · {lastQuarter} last
 * quarter's demand, or the baseline before any quarter has resolved ·
 * {onTheWay} stock in transit.
 */

import { CHAPTER_SCENARIOS } from '../data/scenarios-expanded.js';
import { EXPANSION_CHAPTER_SCENARIOS } from '../data/expansion-scenarios.js';

const n = (x) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(x || 0);

const BY_ID = new Map(
    [...Object.values(CHAPTER_SCENARIOS), ...Object.values(EXPANSION_CHAPTER_SCENARIOS)]
        .flat()
        .map(s => [s.id, s]),
);

const TOKENS = {
    stock: (s) => n(s.inventory),
    nextQuarter: (s) => `Q${s.turn + 1}`,
    lastQuarter: (s) => (s.lastTurnResult
        ? `Last quarter's demand was ${n(s.lastTurnResult.demand)} units.`
        : 'Your baseline forecast is about 1,000 units a quarter.'),
    onTheWay: (s) => {
        const list = s.inTransit || [];
        const units = list.reduce((sum, o) => sum + (o.usableUnits || 0) + (o.passedDefects || 0), 0);
        if (!units) return 'nothing on the way';
        return `${n(units)} units on the way (the next due in Q${Math.min(...list.map(o => o.arrivesOnTurn))})`;
    },
};

/** @param {{ id?: string, text: string }} scenario  @param {Object} state — engine state */
export function scenarioText(scenario, state) {
    const text = BY_ID.get(scenario?.id)?.text ?? scenario?.text ?? '';
    return text.replace(/\{(\w+)\}/g, (m, key) => (TOKENS[key] ? TOKENS[key](state) : m));
}
