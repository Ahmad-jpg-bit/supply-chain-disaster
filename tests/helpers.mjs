// Shared harness for engine regression tests (node --test).
// The engine reads Math.random (campaign play) and localStorage (debrief
// collector), so tests swap in a seeded PRNG and an in-memory store.

import { mulberry32 } from '../src/logic/seeded-rng.js';

const store = new Map();
globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
};

const realRandom = Math.random;

/** Run fn with Math.random replaced by a seeded stream; always restores. */
export function withSeed(seed, fn) {
    Math.random = mulberry32(seed);
    try { return fn(); } finally { Math.random = realRandom; }
}

const SUPPLIER_IDS   = ['budget', 'standard', 'premium'];
const SHIPPING_IDS   = ['charter', 'express', 'standard', 'economy', 'intermodal'];
const PRICING_IDS    = ['premium', 'standard', 'discount'];
const INSPECTION_IDS = ['none', 'standard', 'rigorous'];

/** Deterministic decision script that cycles through every option of all six decision types. */
export function scriptedChoices(turn) {
    return {
        supplierId:        SUPPLIER_IDS[turn % 3],
        shippingId:        SHIPPING_IDS[turn % 5],
        orderQuantity:     600 + ((turn * 337) % 1100),
        pricingId:         PRICING_IDS[(turn + 1) % 3],
        inspectionId:      INSPECTION_IDS[(turn + 2) % 3],
        safetyStockTarget: (turn % 5) * 300,
    };
}

/**
 * Play a full campaign (all chapters) with scripted story + procurement
 * decisions, consuming the pre-rolled crisis exactly like the UI does.
 * Returns the engine for inspection.
 */
export function playCampaign(GameEngine, GAME_PHASES, { industryId = 'electronics', onTurn } = {}) {
    const engine = new GameEngine();
    engine.init(industryId, true, 0);
    let guard = 0;
    while (engine.state.phase !== GAME_PHASES.GAME_OVER && guard++ < 500) {
        const { phase } = engine.state;
        if (phase === GAME_PHASES.CHAPTER_INTRO) {
            engine.advanceFromChapterIntro();
        } else if (phase === GAME_PHASES.STORY) {
            const n = engine.state.currentScenario.options.length;
            engine.makeDecision(engine.state.turn % n);
        } else if (phase === GAME_PHASES.PROCUREMENT) {
            const choices = scriptedChoices(engine.state.turn);
            engine.prepareTurnCrisis();
            onTurn?.(engine, choices);
            engine.processTurn(choices);
        } else if (phase === GAME_PHASES.CHAPTER_SUMMARY) {
            engine.advanceFromChapterSummary();
        } else {
            throw new Error(`Unexpected phase ${phase}`);
        }
    }
    return engine;
}

/** Stable, comparable digest of a finished run (drops timestamps). */
export function digest(engine) {
    const s = engine.state;
    return {
        turn: s.turn,
        phase: s.phase,
        cash: s.cash,
        inventory: s.inventory,
        backlog: s.backlog,
        inTransit: s.inTransit,
        history: s.history.map(h => {
            const { worldEchoes, ...rest } = h;
            return { ...rest, worldEchoes: (worldEchoes || []).map(e => e.title) };
        }),
    };
}
