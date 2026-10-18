// Engine regression tests — run with `npm test`.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { withSeed, playCampaign, digest, scriptedChoices } from './helpers.mjs';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';

const golden = JSON.parse(readFileSync(new URL('./fixtures/engine-golden.json', import.meta.url), 'utf8'));
const roundTrip = (o) => JSON.parse(JSON.stringify(o));

test('identical seed + decisions reproduce the pre-redesign golden runs exactly', () => {
    for (const [key, expected] of Object.entries(golden)) {
        const [industryId, seed] = key.split(':');
        const actual = withSeed(Number(seed), () =>
            digest(playCampaign(GameEngine, GAME_PHASES, { industryId })));
        assert.deepEqual(roundTrip(actual), expected, `run ${key} diverged`);
    }
});

test('estimateTurn() matches processTurn() costs and timing whenever no crisis or echo fires', () => {
    let compared = 0;
    for (const [industryId, seed] of ['electronics', 'fmcg', 'pharma'].flatMap(i => [[i, 7], [i, 8]])) {
        withSeed(seed, () => playCampaign(GameEngine, GAME_PHASES, {
            industryId,
            onTurn(engine, choices) {
                const before = JSON.stringify(engine.state);
                const est = engine.estimateTurn(choices);
                assert.equal(JSON.stringify(engine.state), before, 'estimateTurn mutated state');
                if (engine.state.pendingCrisis) return;
                // Compare against the real resolution on a cloned engine (same RNG
                // position does not matter: costs and lead time are deterministic)
                const clone = new GameEngine();
                clone._allChapters = engine._allChapters;
                clone.state = { ...roundTrip(engine.state), pendingCrisis: null };
                clone._rng = () => 0.5; // keep the driver's seeded stream untouched
                clone.processTurn(choices);
                const r = clone.state.lastTurnResult;
                if (r.worldEchoes.length) return;
                for (const k of ['orderCost', 'shippingCost', 'inspectionCost', 'defectDisposalCost', 'holdingCost', 'leadTimeTurns', 'arrivesOnTurn']) {
                    assert.equal(est[k], r[k], `${industryId} turn ${r.turn}: ${k}`);
                }
                compared++;
            },
        }));
    }
    assert.ok(compared > 30, `only ${compared} turns compared`);
});

test('a story response applies its modifiers once (replaced, not compounded)', () => {
    withSeed(3, () => {
        const engine = new GameEngine();
        engine.init('electronics', true, 0);
        engine.advanceFromChapterIntro();
        const opt = engine.state.currentScenario.options[1];
        engine.makeDecision(1);
        assert.deepEqual(engine.state.modifiers, opt.modifiers);
        assert.equal(engine.state.phase, GAME_PHASES.PROCUREMENT);
        assert.throws(() => engine.makeDecision(0), /Not in Story Phase/);
    });
});

test('processTurn advances exactly one turn and records one history entry', () => {
    withSeed(5, () => {
        const engine = new GameEngine();
        engine.init('fmcg', true, 0);
        engine.advanceFromChapterIntro();
        engine.makeDecision(0);
        const turn = engine.state.turn;
        engine.processTurn(scriptedChoices(turn));
        assert.equal(engine.state.turn, turn + 1);
        assert.equal(engine.state.history.length, 1);
        assert.throws(() => engine.processTurn(scriptedChoices(turn)), /Not in Procurement Phase/);
    });
});

test('save/restore round-trip (JSON state patch, as save-game/resume do) continues identically', () => {
    const SPLIT = 9; // resume mid-chapter
    const run = (restore) => withSeed(11, () => {
        let engine = new GameEngine();
        engine.init('pharma', true, 0);
        let processed = 0;
        while (engine.state.phase !== GAME_PHASES.GAME_OVER) {
            const { phase } = engine.state;
            if (phase === GAME_PHASES.CHAPTER_INTRO) engine.advanceFromChapterIntro();
            else if (phase === GAME_PHASES.STORY) engine.makeDecision(engine.state.turn % engine.state.currentScenario.options.length);
            else if (phase === GAME_PHASES.CHAPTER_SUMMARY) engine.advanceFromChapterSummary();
            else {
                engine.prepareTurnCrisis();
                engine.processTurn(scriptedChoices(engine.state.turn));
                if (restore && ++processed === SPLIT) {
                    const saved = roundTrip(engine.state);
                    const all = engine._allChapters;
                    engine = new GameEngine();
                    engine._allChapters = all;
                    engine._expansionActivated = true;
                    Object.assign(engine.state, saved);
                } else if (!restore) processed++;
            }
        }
        return roundTrip(digest(engine));
    });
    assert.deepEqual(run(true), run(false));
});
