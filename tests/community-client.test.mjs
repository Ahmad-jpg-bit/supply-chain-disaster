// Community client logic: review prompt milestones/dismissal, drafts, stats opt-out,
// and that the game's turn resolution sends the right progress event.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import './helpers.mjs';   // in-memory localStorage

const CM = await import('../src/logic/community.js');

const calls = [];
CM._setFetch(async (url, opts) => {
    calls.push({ url, ...opts, body: opts.body ? JSON.parse(opts.body) : undefined });
    return new Response(JSON.stringify({ counted: true }), { status: 200 });
});

test('prompt: shown per run until "Not now", never again for that run', () => {
    localStorage.clear();
    assert.equal(CM.shouldPrompt('r-a'), true);
    CM.dismissPrompt('r-a');
    assert.equal(CM.shouldPrompt('r-a'), false, 'not repeated within the same run');
    assert.equal(CM.shouldPrompt('r-b'), true, 'another campaign may ask again');
});

test('prompt: not shown after this browser posted a review', async () => {
    localStorage.clear();
    CM._setFetch(async () => new Response(JSON.stringify({ id: 'x', status: 'published' }), { status: 200 }));
    assert.equal((await CM.submitReview({ rating: 5 })).ok, true);
    assert.equal(CM.shouldPrompt('r-c'), false);
});

test('draft: saved locally, cleared only by a successful post', async () => {
    localStorage.clear();
    CM.saveDraft({ rating: 3, text: 'draft text', displayName: 'Lee' });
    assert.equal(CM.loadDraft().text, 'draft text');
    CM._setFetch(async () => new Response(JSON.stringify({ error: 'not_eligible' }), { status: 403 }));
    const r = await CM.submitReview({ rating: 3, text: 'draft text' });
    assert.deepEqual([r.ok, r.error], [false, 'not_eligible']);
    assert.equal(CM.loadDraft().text, 'draft text', 'kept after a failed post (e.g. before verification)');
    CM._setFetch(async () => new Response(JSON.stringify({ id: 'x', status: 'pending' }), { status: 200 }));
    await CM.submitReview({ rating: 3, text: 'draft text' });
    assert.equal(CM.loadDraft(), null);
});

test('stats: ?stats=off excludes this browser, ?stats=on restores it; webdriver never counts', () => {
    localStorage.clear();
    calls.length = 0;
    CM._setFetch(async (url, opts) => { calls.push(JSON.parse(opts.body)); return new Response('{}', { status: 200 }); });
    const ev = { runId: 'r-1', industryId: 'fmcg', chapterId: 'demand_forecasting', scenarioId: 'steady_seas', turn: 1 };
    CM.applyStatsParam('?stats=off');
    assert.equal(CM.recordQuarter(ev), null);
    CM.applyStatsParam('?stats=on');
    assert.ok(CM.recordQuarter(ev));
    assert.deepEqual(calls.at(-1), { action: 'progress', ...ev });
    const nav = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { webdriver: true }, configurable: true });
    try { assert.equal(CM.recordQuarter(ev), null); }
    finally { nav ? Object.defineProperty(globalThis, 'navigator', nav) : delete globalThis.navigator; }
});

test('stats: unavailable API gives null (no fake numbers)', async () => {
    CM._setFetch(async () => { throw new Error('offline'); });
    assert.equal(await CM.fetchStats(), null);
});
