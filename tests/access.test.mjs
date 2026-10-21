// Client access rules: free intro scope, locked campaigns, grandfathered saves
// and saves surviving entitlement changes.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSeed } from './helpers.mjs';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';
import { buildSnapshot, isPrePackagingSave, writeLocalSave, readLocalSave, PACKAGING_VERSION, LOCAL_SAVE_KEY } from '../src/logic/save-game.js';
import { describeSave, saveIsGrandfathered } from '../src/logic/pregame-state.js';
import { Entitlements } from '../src/logic/entitlements.js';
import { FEATURE } from '../src/data/packages.js';
import { CHAPTERS } from '../src/data/chapters.js';
import { EXPANSION_CHAPTERS } from '../src/data/expansion-chapters.js';

const ALL = [...CHAPTERS, ...EXPANSION_CHAPTERS];
const ACCESS_KEYS = ['scd_access_v1', 'scd_premium', 'scd_checkout_claim'];
const resetAccess = () => ACCESS_KEYS.forEach(k => localStorage.removeItem(k));
const grantCore = () => Entitlements.save({ token: 'test-token', access: { packages: ['core'] } });

/** A v2 save of a campaign played to the given phase, optionally stamped. */
function savedCampaign(industryId, stamp) {
    return withSeed(7, () => {
        const engine = new GameEngine();
        engine.init(industryId, true, 0);
        if (stamp) engine.state.packagingVersion = PACKAGING_VERSION;
        while (engine.state.phase !== GAME_PHASES.CHAPTER_SUMMARY) {
            const { phase } = engine.state;
            if (phase === GAME_PHASES.CHAPTER_INTRO) engine.advanceFromChapterIntro();
            else if (phase === GAME_PHASES.STORY) engine.makeDecision(0);
            else if (phase === GAME_PHASES.PROCUREMENT) { engine.prepareTurnCrisis(); engine.processTurn({}); }
        }
        return buildSnapshot(engine);
    });
}

test('guest: only FMCG Chapter 1 is playable; other campaigns and modes are locked', () => {
    resetAccess();
    assert.equal(Entitlements.canPlay('fmcg', 1), true);
    assert.equal(Entitlements.canPlay('fmcg', 2), false);
    for (const id of ['pharma', 'electronics']) assert.equal(Entitlements.canPlay(id, 1), false, id);
    for (const f of [FEATURE.CHAPTER_JUMP, FEATURE.ENDLESS, FEATURE.WEEKLY, FEATURE.ADVANCED_REPORT, FEATURE.CERTIFICATE]) {
        assert.equal(Entitlements.has(f), false, f);
    }
    assert.equal(Entitlements.has(FEATURE.REPLAY), true, 'the free intro is replayable');
    assert.equal(Entitlements.ownsCore(), false);
    assert.equal(Entitlements.token(), null);
});

test('Core owner: every chapter of all three campaigns and every Core feature', () => {
    resetAccess();
    grantCore();
    for (const id of ['fmcg', 'pharma', 'electronics']) {
        for (const ch of ALL) assert.equal(Entitlements.canPlay(id, ch.number), true, `${id} ch${ch.number}`);
    }
    for (const f of Object.values(FEATURE)) assert.equal(Entitlements.has(f), true, f);
    assert.equal(Entitlements.ownsCore(), true);
    resetAccess();
});

test('legacy local Full Access record keeps everything; expired promo grants nothing', () => {
    resetAccess();
    localStorage.setItem('scd_premium', JSON.stringify({ active: true, tier: 'standard' }));
    assert.equal(Entitlements.canPlay('electronics', 10), true);
    assert.equal(Entitlements.ownsCore(), true);
    localStorage.setItem('scd_premium', JSON.stringify({ active: true, expiresAt: Date.now() - 1000 }));
    assert.equal(Entitlements.canPlay('electronics', 1), false);
    resetAccess();
});

test('the free intro is FMCG Chapter 1 only', () => {
    assert.equal(Entitlements.isFreeIntro('fmcg', 1), true);
    assert.equal(Entitlements.isFreeIntro('fmcg', 2), false);
    assert.equal(Entitlements.isFreeIntro('pharma', 1), false);
});

test('saves started before the packaging are grandfathered; new ones are not', () => {
    const old = savedCampaign('electronics', false);
    const fresh = savedCampaign('fmcg', true);
    assert.equal(isPrePackagingSave(old), true);
    assert.equal(isPrePackagingSave(fresh), false);
    assert.equal(saveIsGrandfathered(describeSave({ gameState: old }, ALL, 'device')), true);
    assert.equal(saveIsGrandfathered(describeSave({ gameState: fresh }, ALL, 'device')), false);
    // Legacy chapter-boundary (v1) saves predate the packaging too
    assert.equal(saveIsGrandfathered({ gameState: { industryId: 'pharma', chapterIndex: 4, turn: 21 } }), true);
    // A grandfathered run re-saved later keeps its flag
    const resaved = savedCampaign('fmcg', true);
    resaved.snapshot.state.grandfathered = true;
    assert.equal(isPrePackagingSave(resaved), true);
});

test('a free-intro save at the chapter boundary needs Core to continue, and is kept unchanged', () => {
    resetAccess();
    localStorage.removeItem(LOCAL_SAVE_KEY);
    const gs = savedCampaign('fmcg', true);
    writeLocalSave(gs);
    const save = describeSave(readLocalSave(), ALL, 'device');
    assert.equal(save.resumable, true);
    assert.equal(save.nextChapter.number, 2);
    assert.equal(saveIsGrandfathered(save), false);
    assert.equal(Entitlements.canPlay(save.industryId, save.nextChapter.number), false, 'guest is locked at chapter 2');

    // Buying Core unlocks the same save — nothing about the save changes
    grantCore();
    assert.equal(Entitlements.canPlay(save.industryId, save.nextChapter.number), true);
    assert.deepEqual(readLocalSave().gameState, JSON.parse(JSON.stringify(gs)));

    // Losing access (refund / invalid token) locks again but never deletes the save
    resetAccess();
    assert.equal(Entitlements.canPlay(save.industryId, save.nextChapter.number), false);
    assert.ok(readLocalSave(), 'save still present after access is removed');
    localStorage.removeItem(LOCAL_SAVE_KEY);
});
