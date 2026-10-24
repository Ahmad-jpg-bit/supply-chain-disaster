/**
 * Server-side evidence that a stored cloud campaign contains at least one
 * completed quarter — used for review eligibility and the "Played a scenario"
 * label. The run's client-supplied meta (turn, chapter) is NOT trusted: the
 * stored snapshot must be internally consistent with the real catalogue:
 *
 *   - each history entry's turn lies in a real chapter and its chapter number
 *     matches that chapter;
 *   - the scenario at that position of the run's OWN shuffled order exists in
 *     the catalogue for that chapter, and the history entry names it;
 *   - turns strictly increase and the run's position is past the last one;
 *   - the recorded results are finite numbers, and the engine state names
 *     the same industry as the run.
 *
 * Limitation (documented in docs/community-metrics.md): the game runs in the
 * browser, so a determined person could hand-craft a consistent snapshot.
 * This check stops arbitrary or tampered uploads, not deliberate forgery;
 * one review per verified email, rate limits and moderation bound the rest.
 */

import { CHAPTER_SCENARIOS } from '../../src/data/scenarios-expanded.js';
import { EXPANSION_CHAPTER_SCENARIOS } from '../../src/data/expansion-scenarios.js';
import { CHAPTERS } from '../../src/data/chapters.js';
import { EXPANSION_CHAPTERS } from '../../src/data/expansion-chapters.js';

const INDUSTRIES = new Set(['fmcg', 'pharma', 'electronics']);
const ALL_CHAPTERS = [...CHAPTERS, ...EXPANSION_CHAPTERS];
const SCENARIO = {};   // id → { chapterId, title }
for (const [chapterId, list] of Object.entries({ ...CHAPTER_SCENARIOS, ...EXPANSION_CHAPTER_SCENARIOS })) {
    for (const sc of list) SCENARIO[sc.id] = { chapterId, title: sc.title };
}
const MAX_TURN = Math.max(...ALL_CHAPTERS.map(c => c.turnsRange[1]));
const chapterOfTurn = (turn) => ALL_CHAPTERS.find(c => turn >= c.turnsRange[0] && turn <= c.turnsRange[1]);

/** @returns {string|null} the run's industry when the snapshot proves ≥1 completed quarter */
export function completedQuarterEvidence(snapshot) {
    if (!snapshot || typeof snapshot !== 'object' || snapshot.saveVersion !== 2 || !INDUSTRIES.has(snapshot.industryId)) return null;
    if (snapshot.snapshot?.state?.industry?.id !== snapshot.industryId) return null;   // engine state agrees on the campaign
    const history = snapshot.history;
    const order = snapshot.shuffledScenarios;
    if (!Array.isArray(history) || !history.length || history.length > MAX_TURN || !order || typeof order !== 'object') return null;
    let last = 0;
    for (const h of history) {
        const turn = h?.turn;
        if (!Number.isInteger(turn) || turn <= last || turn > MAX_TURN) return null;
        const ch = chapterOfTurn(turn);
        if (!ch || h.chapter !== ch.number) return null;
        const sc = Array.isArray(order[ch.id]) ? order[ch.id][turn - ch.turnsRange[0]] : null;
        const known = sc && SCENARIO[sc.id];
        if (!known || known.chapterId !== ch.id || sc.title !== known.title || h.scenario !== known.title) return null;
        if (![h.demand, h.sales, h.cash].every(Number.isFinite) || h.demand < 0 || h.sales < 0) return null;
        last = turn;
    }
    if (!Number.isInteger(snapshot.turn) || snapshot.turn <= last) return null;
    return snapshot.industryId;
}
