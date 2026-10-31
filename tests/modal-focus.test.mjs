// Full-screen overlays keep keyboard focus: the page behind is inert while any
// overlay is open, focus moves into the overlay, and handovers don't release early.
import { test } from 'node:test';
import assert from 'node:assert/strict';

function fakeDom() {
    const app = { inert: false };
    const doc = { activeElement: null, getElementById: (id) => (id === 'app' ? app : null), querySelectorAll: () => [] };
    const el = (name) => {
        const node = { name, focus() { doc.activeElement = node; } };
        return node;
    };
    const overlay = (btn) => ({ contains: (n) => n === btn, querySelector: () => btn });
    return { app, doc, el, overlay };
}

test('holdModal makes the page inert, moves focus in, and counts handovers', async () => {
    const { app, doc, el, overlay } = fakeDom();
    globalThis.document = doc;
    const { holdModal } = await import('../src/ui/modal-focus.js');

    const summaryBtn = el('summary-continue');
    const releaseSummary = holdModal(overlay(summaryBtn));
    assert.equal(app.inert, true);
    assert.equal(doc.activeElement, summaryBtn, 'focus moves into the overlay');

    // Summary → concept card: the next overlay holds before the previous release lands
    const cardBtn = el('card-continue');
    const releaseCard = holdModal(overlay(cardBtn));
    releaseSummary();
    assert.equal(app.inert, true, 'still inert while the concept card is open');
    releaseSummary();   // a second release of the same hold is ignored
    assert.equal(app.inert, true);
    releaseCard();
    assert.equal(app.inert, false, 'page usable again once every overlay has closed');

    // Focus already inside the overlay is left where it is
    const inside = el('title');
    doc.activeElement = inside;
    const release = holdModal({ contains: (n) => n === inside, querySelector: () => el('other') });
    assert.equal(doc.activeElement, inside);
    release();
    delete globalThis.document;
});

test('readyAfter ignores activations right after an overlay opens (double-click tail)', async () => {
    const { readyAfter } = await import('../src/ui/modal-focus.js');
    const ready = readyAfter(120);
    assert.equal(ready(), false, 'a click arriving immediately is ignored');
    await new Promise(r => setTimeout(r, 160));
    assert.equal(ready(), true, 'a deliberate click after the overlay settles works');
});

test('rationing sliders can allocate any pool exactly (step 1)', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('../src/ui/allocation-overlay.js', import.meta.url), 'utf8');
    // Commit needs every unit allocated; a step > 1 makes pools like 1,008 impossible to finish
    assert.match(src, /class="alloc-slider"[\s\S]*?step="1"/);
});
