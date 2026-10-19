// Save system: full snapshots resume at any turn, identically to never stopping.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSeed, scriptedChoices, digest } from './helpers.mjs';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';
import { buildSnapshot, restoreSnapshot, isSnapshot, readLocalSave, writeLocalSave, LOCAL_SAVE_KEY } from '../src/logic/save-game.js';
import { describeSave, newerSave, resumeLaunchArgs } from '../src/logic/pregame-state.js';
import { CHAPTERS } from '../src/data/chapters.js';
import { EXPANSION_CHAPTERS } from '../src/data/expansion-chapters.js';

const ALL = [...CHAPTERS, ...EXPANSION_CHAPTERS];
const json = (o) => JSON.parse(JSON.stringify(o));

/** One deterministic step of a campaign (same policy as helpers.playCampaign). */
function step(engine) {
    const { phase } = engine.state;
    if (phase === GAME_PHASES.CHAPTER_INTRO) engine.advanceFromChapterIntro();
    else if (phase === GAME_PHASES.STORY) engine.makeDecision(engine.state.turn % engine.state.currentScenario.options.length);
    else if (phase === GAME_PHASES.PROCUREMENT) { engine.prepareTurnCrisis(); engine.processTurn(scriptedChoices(engine.state.turn)); }
    else if (phase === GAME_PHASES.CHAPTER_SUMMARY) engine.advanceFromChapterSummary();
}

/** Restore into a fresh engine exactly as Dashboard.startGame does, without consuming the seeded stream. */
function restoreFresh(gs) {
    const seeded = Math.random;
    Math.random = () => 0.5;            // init() draws (archetype, shuffles) are all overwritten by the snapshot
    const engine = new GameEngine();
    engine.init(gs.industryId, true, gs.chapterIndex);
    restoreSnapshot(engine, gs);
    Math.random = seeded;
    engine._rng = Math.random;          // init() captured the stand-in; in the game it captures the real Math.random
    return engine;
}

for (const savePhase of [GAME_PHASES.STORY, GAME_PHASES.PROCUREMENT, GAME_PHASES.CHAPTER_SUMMARY]) {
    test(`a save taken in ${savePhase} resumes and finishes identically to an uninterrupted run`, () => {
        for (const industryId of ['electronics', 'fmcg', 'pharma']) {
            const run = (interrupt) => withSeed(20261019, () => {
                let engine = new GameEngine();
                engine.init(industryId, true, 0);
                let saved = false;
                for (let guard = 0; engine.state.phase !== GAME_PHASES.GAME_OVER && guard < 500; guard++) {
                    // interrupt mid-campaign (chapter 3), on the requested phase
                    if (interrupt && !saved && engine.state.turn >= 10 && engine.state.phase === savePhase) {
                        const gs = json(buildSnapshot(engine, { draft: null }));   // what storage holds
                        assert.ok(isSnapshot(gs));
                        engine = restoreFresh(gs);
                        saved = true;
                    }
                    step(engine);
                }
                if (interrupt) assert.ok(saved, 'never reached the save point');
                return json({ d: digest(engine), mastery: engine.mastery.scores });
            });
            assert.deepEqual(run(true), run(false), `${industryId} diverged after resuming from ${savePhase}`);
        }
    });
}

test('snapshots keep every legacy field so older readers (email, recall-cron) still work', () => {
    withSeed(4, () => {
        const engine = new GameEngine();
        engine.init('fmcg', true, 0);
        engine.advanceFromChapterIntro();
        const gs = buildSnapshot(engine);
        for (const k of ['industryId', 'chapterIndex', 'cash', 'inventory', 'turn', 'maxTurns', 'shuffledScenarios', 'history', 'boardConfidence']) {
            assert.ok(k in gs, `missing ${k}`);
        }
        assert.equal(gs.saveVersion, 2);
        assert.equal(gs.snapshot.state.history, undefined, 'history must not be duplicated inside the snapshot');
    });
});

test('describeSave: mid-chapter snapshot resumes at its chapter and quarter', () => {
    withSeed(6, () => {
        const engine = new GameEngine();
        engine.init('pharma', true, 0);
        for (let i = 0; i < 40 && !(engine.state.turn === 7 && engine.state.phase === GAME_PHASES.PROCUREMENT); i++) step(engine);
        const gs = json(buildSnapshot(engine));
        const s = describeSave({ savedAt: 5, gameState: gs }, ALL, 'device');
        assert.equal(s.resumable, true);
        assert.equal(s.midChapter, true);
        assert.equal(s.nextChapter.number, 2);
        assert.equal(s.quarter, 3);          // turn 7 = chapter 2, quarter 3
        assert.equal(s.turnsPlayed, 6);
        assert.equal(s.source, 'device');
        assert.deepEqual(resumeLaunchArgs(s), ['pharma', 1, 'story', null, gs]);
    });
});

test('describeSave: a finished campaign snapshot is not resumable', () => {
    const gs = { industryId: 'fmcg', chapterIndex: 9, turn: 41, maxTurns: 40, saveVersion: 2, phase: GAME_PHASES.GAME_OVER, snapshot: { state: { turn: 41 } } };
    assert.equal(describeSave({ savedAt: 1, gameState: gs }, ALL).resumable, false);
});

test('newerSave prefers the most recent save', () => {
    const a = { savedAt: 10 }, b = { savedAt: 20 };
    assert.equal(newerSave(a, b), b);
    assert.equal(newerSave(b, a), b);
    assert.equal(newerSave(null, a), a);
    assert.equal(newerSave(a, null), a);
});

test('local save read/write round-trip', () => {
    localStorage.removeItem(LOCAL_SAVE_KEY);
    assert.equal(readLocalSave(), null);
    assert.equal(writeLocalSave({ industryId: 'fmcg', turn: 3 }), true);
    const rec = readLocalSave();
    assert.equal(rec.gameState.industryId, 'fmcg');
    assert.ok(rec.savedAt > 0);
    localStorage.setItem(LOCAL_SAVE_KEY, '{not json');
    assert.equal(readLocalSave(), null);
});
