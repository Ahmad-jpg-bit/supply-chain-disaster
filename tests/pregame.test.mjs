// Pre-game page logic: save summaries, resume launch args, industry facts.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';
import { describeSave, resumeLaunchArgs, isValidEmail } from '../src/logic/pregame-state.js';
import { listIndustryProfiles, getIndustryProfile } from '../src/logic/industry-profiles.js';
import { CHAPTERS } from '../src/data/chapters.js';
import { EXPANSION_CHAPTERS } from '../src/data/expansion-chapters.js';
import { INDUSTRIES } from '../src/logic/industries.js';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';
import { withSeed } from './helpers.mjs';

const ALL = [...CHAPTERS, ...EXPANSION_CHAPTERS];
const record = (gs) => ({ found: true, email: 'a@b.co', savedAt: 1, version: 1, gameState: gs });

test('describeSave: mid-campaign save resumes at the next chapter', () => {
    const s = describeSave(record({ industryId: 'pharma', chapterIndex: 2, turn: 13, maxTurns: 40, cash: 5 }), ALL);
    assert.equal(s.resumable, true);
    assert.equal(s.nextChapterIndex, 3);
    assert.equal(s.nextChapter.number, 4);
    assert.equal(s.turnsPlayed, 12);
});

test('describeSave: finished campaign is not resumable; empty/invalid records give null', () => {
    assert.equal(describeSave(record({ industryId: 'fmcg', chapterIndex: 9, turn: 41, maxTurns: 40 }), ALL).resumable, false);
    assert.equal(describeSave({ found: false }, ALL), null);
    assert.equal(describeSave(record(null), ALL), null);
    assert.equal(describeSave(record({ chapterIndex: 1 }), ALL), null);
});

test('resumeLaunchArgs matches the pre-redesign restore call (next chapter, story, saved state)', () => {
    const gs = { industryId: 'electronics', chapterIndex: 1, turn: 9, maxTurns: 40 };
    assert.deepEqual(resumeLaunchArgs(describeSave(record(gs), ALL)), ['electronics', 2, 'story', gs]);
});

test('resuming through the engine continues the saved run at the saved turn', () => {
    withSeed(9, () => {
        const gs = { industryId: 'electronics', chapterIndex: 2, turn: 13, maxTurns: 40, cash: 777, inventory: 321, backlog: 0, inTransit: [] };
        const [industryId, chapterIndex, , patch] = resumeLaunchArgs(describeSave(record(gs), ALL));
        const engine = new GameEngine();
        engine.init(industryId, true, chapterIndex);           // same as Dashboard.startGame
        Object.assign(engine.state, patch);
        engine.advanceFromChapterIntro();
        assert.equal(engine.state.phase, GAME_PHASES.STORY);
        assert.equal(engine.state.currentChapter.number, 4);
        assert.equal(engine.state.cash, 777);
        assert.equal(engine.state.turn, 13);
    });
});

test('isValidEmail', () => {
    assert.equal(isValidEmail('x@y.io'), true);
    assert.equal(isValidEmail('nope'), false);
    assert.equal(isValidEmail(''), false);
});

test('industry profiles cover exactly the catalog and reflect engine values', () => {
    const ids = listIndustryProfiles().map(p => p.id).sort();
    assert.deepEqual(ids, Object.values(INDUSTRIES).map(i => i.id).sort());
    const pharma = getIndustryProfile('pharma');
    assert.equal(pharma.capital, INDUSTRIES.PHARMA.metrics.initialCapital);
    assert.equal(pharma.baseLeadTurns, 3);
    assert.equal(pharma.demand.spikeChance, 0.15);
    assert.ok(Math.abs(getIndustryProfile('fmcg').basePrice - 115) < 1e-9); // same float formula as the engine
    assert.equal(getIndustryProfile('nope'), null);
});
