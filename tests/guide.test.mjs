// Gameplay comprehension layer: guided-start persistence + phase awareness,
// decision-screen markup (controls preserved, plain-language brief) and the
// results card's "what happened / what contributed" story.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSeed } from './helpers.mjs';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';
import {
    GUIDE_KEY, GUIDE_STEPS, readGuide, writeGuide, isReturningPlayer, shouldAutoStart,
    currentStep, startGuide, nextGuide, skipGuide,
} from '../src/logic/guide-state.js';
import { buildWorkspaceHTML, turnGoal, turnNote, choicesSummary } from '../src/ui/procurement-workspace.js';
import { guideContent } from '../src/ui/guide-coach.js';
import { computeProjection } from '../src/ui/planning-workbench.js';
import { buildTurnStory } from '../src/logic/turn-story.js';
import { buildSnapshot } from '../src/logic/save-game.js';
import { SUPPLIERS, SHIPPING_METHODS, PRICING_STRATEGIES, QUALITY_INSPECTIONS } from '../src/data/procurement-options.js';

const memStore = () => {
    const m = new Map();
    return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
};
const { STORY, PROCUREMENT, CHAPTER_INTRO, CHAPTER_SUMMARY } = GAME_PHASES;

/** Engine in the procurement phase of its first quarter (story response committed). */
function procurementEngine(industryId = 'fmcg', startChapter = 0) {
    const engine = new GameEngine();
    engine.init(industryId, true, startChapter);
    engine.advanceFromChapterIntro();
    engine.makeDecision(0);
    assert.equal(engine.state.phase, PROCUREMENT);
    return engine;
}

function projection(engine, choices) {
    const s = engine.state;
    const est = engine.estimateTurn(choices);
    const rows = computeProjection({
        inventory: s.inventory, backlog: s.backlog, inTransit: s.inTransit, currentTurn: s.turn,
        orderQty: est.orderQuantity, orderUsable: est.arrivingUnits, leadTimeTurns: est.leadTimeTurns,
        expectedDemand: est.expectedDemand, safetyStock: choices.safetyStockTarget, horizon: 4,
    });
    return { est, rows };
}

// ── Guide state ───────────────────────────────────────────────────────────

test('guide state: unseen by default, survives a round trip, ignores corrupt storage', () => {
    const st = memStore();
    assert.deepEqual(readGuide(st), { status: 'unseen', step: 0, replay: false });
    writeGuide({ status: 'active', step: 3, replay: false }, st);
    assert.deepEqual(readGuide(st), { status: 'active', step: 3, replay: false });
    st.setItem(GUIDE_KEY, '{not json');
    assert.equal(readGuide(st).status, 'unseen');
    st.setItem(GUIDE_KEY, JSON.stringify({ status: 'active', step: 99 }));
    assert.equal(readGuide(st).step, GUIDE_STEPS.length - 1, 'out-of-range step is clamped');
    const blocked = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
    assert.equal(readGuide(blocked).status, 'unseen');
    assert.doesNotThrow(() => writeGuide(startGuide(), blocked));
});

test('guide auto-starts only for a new player on the first quarter of a campaign', () => {
    const unseen = { status: 'unseen', step: 0 };
    assert.equal(shouldAutoStart({ mode: 'story', historyLength: 0, guide: unseen, returning: false }), true);
    assert.equal(shouldAutoStart({ mode: 'endless', historyLength: 0, guide: unseen, returning: false }), false);
    assert.equal(shouldAutoStart({ mode: 'weekly', historyLength: 0, guide: unseen, returning: false }), false);
    assert.equal(shouldAutoStart({ mode: 'story', historyLength: 3, guide: unseen, returning: false }), false, 'resumed mid-campaign');
    assert.equal(shouldAutoStart({ mode: 'story', historyLength: 0, guide: unseen, returning: true }), false);
    assert.equal(shouldAutoStart({ mode: 'story', historyLength: 0, guide: skipGuide(), returning: false }), false);
    assert.equal(shouldAutoStart({ mode: 'story', historyLength: 0, guide: { status: 'done', step: 0 }, returning: false }), false);
});

test('returning players: other played runs, skipped intros or a pre-runs save', () => {
    assert.equal(isReturningPlayer({ metas: [] }), false);
    assert.equal(isReturningPlayer({ metas: [{ runId: 'me', turn: 1 }], currentRunId: 'me' }), false);
    assert.equal(isReturningPlayer({ metas: [{ runId: 'me', turn: 1 }, { runId: 'old', turn: 1 }], currentRunId: 'me' }), false, 'an abandoned unplayed run is not experience');
    assert.equal(isReturningPlayer({ metas: [{ runId: 'old', turn: 6 }], currentRunId: 'me' }), true);
    assert.equal(isReturningPlayer({ skippedIntros: true }), true);
    assert.equal(isReturningPlayer({ legacySave: true }), true);
});

test('guide steps follow the game phase and resume at the right place', () => {
    const g = startGuide(false);
    assert.equal(currentStep(g, STORY, 0).id, 'story');
    assert.equal(currentStep(g, STORY, 0).phaseEnd, true, 'next tip waits for the procurement phase');
    // Reload after the story response was committed: the story tip is skipped
    assert.equal(currentStep(g, PROCUREMENT, 0).id, 'brief');
    assert.equal(currentStep({ ...g, step: 4 }, PROCUREMENT, 0).id, 'cost');
    // No tips outside the explained phases
    assert.equal(currentStep(g, CHAPTER_INTRO, 0), null);
    assert.equal(currentStep(g, CHAPTER_SUMMARY, 0), null);
    // An automatic guide never reappears after the first quarter resolved…
    assert.equal(currentStep(g, PROCUREMENT, 1), null);
    // …but a replay from Help works at any turn
    assert.equal(currentStep(startGuide(true), STORY, 12).id, 'story');
    assert.equal(currentStep(startGuide(true), PROCUREMENT, 12).id, 'brief');
    // Finished or skipped guides stay quiet
    assert.equal(currentStep(skipGuide(), PROCUREMENT, 0), null);
    // Walking the steps ends in "done"
    let walk = startGuide(false);
    for (let i = 0; i < GUIDE_STEPS.length; i++) walk = nextGuide(walk, i);
    assert.equal(walk.status, 'done');
    const last = currentStep({ ...g, step: GUIDE_STEPS.length - 1 }, PROCUREMENT, 0);
    assert.equal(last.last, true);
});

test('guide progress never enters a save snapshot (save format unchanged)', () => {
    withSeed(11, () => {
        const engine = procurementEngine();
        const snap = buildSnapshot(engine, { draft: { ...engine.state.procurementChoices, orderQuantity: 1700 } });
        const json = JSON.stringify(snap);
        assert.ok(!json.includes(GUIDE_KEY) && !/"guide/.test(json));
        assert.deepEqual(Object.keys(snap.snapshot.ui).sort(), ['askedRecallChapters', 'draft', 'forecastStats']);
        assert.equal(snap.snapshot.ui.draft.orderQuantity, 1700);
    });
});

// ── Decision screen ───────────────────────────────────────────────────────

test('decision screen keeps every original control for every industry and later chapters', () => {
    withSeed(5, () => {
        for (const industryId of ['fmcg', 'pharma', 'electronics']) {
            for (const start of [0, 4, 9]) {
                const engine = procurementEngine(industryId, start);
                const s = engine.state;
                const html = buildWorkspaceHTML({ state: s, suppliers: SUPPLIERS[industryId], draft: s.procurementChoices, openGroups: { supply: true, pricing: false, protection: false } });
                for (const id of ['order-input', 'safety-stock-slider', 'place-order-btn', 'pw-c-total', 'pw-c-cash', 'pw-c-arrival', 'pw-c-inv', 'pw-c-warning', 'pw-choices-text', 'pw-brief-goal', 'pw-brief-note']) {
                    assert.ok(html.includes(`id="${id}"`), `${industryId}/${start}: #${id}`);
                }
                const radios = [
                    ...SUPPLIERS[industryId].map(o => ['pw-supplier', o.id]),
                    ...SHIPPING_METHODS.map(o => ['pw-shipping', o.id]),
                    ...PRICING_STRATEGIES.map(o => ['pw-pricing', o.id]),
                    ...QUALITY_INSPECTIONS.map(o => ['pw-inspection', o.id]),
                ];
                for (const [name, value] of radios) assert.ok(html.includes(`name="${name}" value="${value}"`), `${industryId}: ${name}=${value}`);
                // The current draft is what is selected — guidance never changes defaults
                assert.ok(html.includes(`name="pw-supplier" value="${s.procurementChoices.supplierId}" checked`));
                assert.ok(html.includes(`value="${s.procurementChoices.orderQuantity}"`));
                // Collapsed groups are hidden only in their body; their summaries stay visible
                assert.match(html, /id="pw-body-pricing" role="region" aria-labelledby="pw-tog-pricing" hidden/);
                assert.ok(html.includes('id="pw-sum-pricing"') && html.includes('id="pw-sum-protection"'));
                assert.ok(html.includes(`Quarter ${s.turn} at a glance`));
            }
        }
    });
});

test('turn brief states the real stock/demand situation and never suggests a quantity', () => {
    withSeed(21, () => {
        const engine = procurementEngine('fmcg');
        const s = engine.state;
        const choices = { ...s.procurementChoices };

        s.inventory = 200;   // well short of expected demand
        let { est, rows } = projection(engine, choices);
        let goal = turnGoal({ state: s, est, rows, earliest: s.turn + 1 });
        assert.match(goal, /200 units/);
        assert.match(goal, new RegExp(est.expectedDemand.toLocaleString('en-US')));
        assert.match(goal, /likely run short/);

        s.inventory = 5000;  // plenty
        ({ est, rows } = projection(engine, choices));
        goal = turnGoal({ state: s, est, rows, earliest: s.turn + 1 });
        assert.doesNotMatch(goal, /run short/);

        s.backlog = 640;     // customers waiting take priority in the message
        ({ est, rows } = projection(engine, choices));
        goal = turnGoal({ state: s, est, rows, earliest: s.turn + 2 });
        assert.match(goal, /640 customer orders are still waiting/);
        assert.match(goal, new RegExp(`Q${s.turn + 2} at the earliest`));

        for (const text of [goal, turnNote({ state: s, est, earliest: s.turn + 1 })]) {
            assert.doesNotMatch(text, /you should order|recommend|best option/i);
        }
        const summary = choicesSummary(est, choices.safetyStockTarget);
        assert.ok(summary.includes(est.supplier.name) && summary.includes(est.shippingMethod.name) && summary.includes(`Q${est.arrivesOnTurn}`));
    });
});

test('guide tips quote the same estimate the decision screen shows', () => {
    withSeed(8, () => {
        const engine = procurementEngine('fmcg');
        const s = engine.state;
        const choices = { ...s.procurementChoices, orderQuantity: 1300 };
        const { est, rows } = projection(engine, choices);
        const cost = guideContent('cost', { state: s, est, rows, earliest: s.turn + 1 });
        assert.ok(cost.text.includes(Math.round(est.purchaseCost).toLocaleString('en-US')));
        assert.ok(cost.text.includes(`Q${est.arrivesOnTurn}`));
        const stock = guideContent('stock', { state: s, est, rows, earliest: s.turn + 1 });
        assert.ok(stock.text.includes((s.inventory + est.arrivingThisTurn).toLocaleString('en-US')));
        for (const step of GUIDE_STEPS) {
            const c = guideContent(step.id, { state: s, est, rows, earliest: s.turn + 1 });
            assert.ok(c && c.anchor && c.title && c.text, step.id);
        }
    });
});

// ── Results story ─────────────────────────────────────────────────────────

/** Resolve one quarter the way the Dashboard does and decorate the result. */
function resolveDecorated(engine, choices, extra = {}) {
    const s = engine.state;
    const before = { cash: s.cash, inventory: s.inventory, backlog: s.backlog };
    const expectedDemand = engine.estimateTurn(choices).expectedDemand;
    engine.prepareTurnCrisis();
    engine.processTurn(choices);
    const r = engine.state.lastTurnResult;
    Object.assign(r, { _before: before, _expectedDemand: expectedDemand, _firstQuarter: engine.state.history.length === 1, _storyEffects: [], ...extra });
    return r;
}

test("results story: a first-quarter shortage states the starting-stock constraint alongside the player's own choices", () => {
    withSeed(31, () => {
        const engine = procurementEngine('fmcg');
        engine.state.inventory = 150;
        engine.state.pendingCrisis = null;
        const r = resolveDecorated(engine, { ...engine.state.procurementChoices, pricingId: 'discount' });
        r.crisis = null;
        const story = buildTurnStory(r);
        assert.ok(r.backlog > 0);
        assert.match(story.happened, new RegExp(`${r.sales.toLocaleString('en-US')} were served and ${r.backlog.toLocaleString('en-US')} orders are still waiting`));
        assert.equal(story.contributions[0].kind, 'start');
        assert.equal(story.contributions[0].text, 'You started with 150 units and nothing on the way. No order placed this quarter could arrive in time.');
        assert.ok(story.contributions.some(c => c.kind === 'choice' && /raised customer demand/.test(c.text)), "the player's pricing is listed too");
        assert.ok(story.contributions.some(c => c.kind === 'uncertainty'));
        assert.ok(!story.contributions.some(c => c.kind === 'event'), 'no event without a crisis');
        assert.deepEqual(story.beforeAfter.map(b => b.label), ['Money', 'Stock', 'Customer orders waiting']);
    });
});

test('results story: later quarters, profit/loss wording and events are reported only from engine output', () => {
    const base = {
        turn: 6, demand: 1000, sales: 1000, inventory: 400, backlog: 0, backlogBefore: 0, missedSales: 0,
        profit: -12000, cash: 90000, startingInventory: 1400, unitsReceived: 0, orderQuantity: 800, arrivesOnTurn: 8,
        pricing: 'Market Price', inspection: 'Standard QC', defectsPassed: 0, defectsFound: 0, safetyBreach: false,
        crisis: null, worldEchoes: [], _before: { cash: 102000, inventory: 1400, backlog: 0 }, _expectedDemand: 1000, _firstQuarter: false,
    };
    let story = buildTurnStory({ ...base, revenue: 83000, totalCost: 95000, holdingCost: 7000 });
    assert.equal(story.money, "Sales brought in $83,000 and this quarter's costs, including the new order, came to $95,000: a loss of $12,000.");
    assert.equal(story.contributions.find(c => c.kind === 'choice').text, "You ordered 800 units for $88,000, counted in this quarter's costs. They're due in Q8 and can only be sold once they arrive.");
    for (const c of story.contributions) assert.doesNotMatch(c.text, /will (earn|sell|recover)|earn money|guarantee/i, 'no promised future sales');
    assert.match(story.happened, /every order was served\. 400 units are left/);
    assert.ok(!story.contributions.some(c => c.kind === 'start'));
    assert.match(story.contributions.find(c => c.kind === 'uncertainty').text, /close to the estimate/);
    assert.equal(story.beforeAfter.length, 2, 'no waiting row when nobody waited');

    story = buildTurnStory({ ...base, demand: 1300, sales: 1300, inventory: 100, crisis: { name: 'Port strike', ticker: 'Ports closed', effects: { demandMultiplier: 1.2 } } });
    assert.ok(story.contributions.some(c => c.kind === 'event' && c.text.startsWith('Port strike')));
    assert.match(story.contributions.find(c => c.kind === 'uncertainty').text, /30% above the estimate of 1,000 .*this quarter's event changed it/);

    // Live crisis data holds the consequence line as a function of its effects
    story = buildTurnStory({ ...base, crisis: { name: 'Tariff waiver', ticker: 't', effects: {}, consequenceText: () => 'Costs fell 15%.' } });
    assert.equal(story.contributions.find(c => c.kind === 'event').text, 'Tariff waiver: Costs fell 15%.');

    // Cash that moved outside the quarter's result is reported separately, naming only recorded parts
    story = buildTurnStory({ ...base, revenue: 83000, totalCost: 95000, _cashAfter: 75000, _crisisResponse: { mitigated: true, cost: 15000 } });
    assert.match(story.money, /a loss of \$12,000\. In total your money fell by \$27,000, including \$15,000 for your crisis response\.$/);
    assert.deepEqual(story.beforeAfter[0], { label: 'Money', before: '$102,000', after: '$75,000', tone: 'down' });
    story = buildTurnStory({ ...base, revenue: 83000, totalCost: 95000, _cashAfter: 93000 });
    assert.match(story.money, /In total your money fell by \$9,000\.$/, 'an unexplained difference is stated without a cause');

    // A transit-delay event moves the due quarter
    story = buildTurnStory({ ...base, totalCost: 95000, holdingCost: 7000, crisis: { name: 'Port strike', ticker: 't', effects: { transitDelay: 1 } } });
    assert.match(story.contributions.find(c => c.kind === 'choice').text, /due in Q9/);

    // First quarter: no starting-stock line when stock arrived, or when nobody went short
    assert.ok(!buildTurnStory({ ...base, _firstQuarter: true, backlog: 50, unitsReceived: 300 }).contributions.some(c => c.kind === 'start'));
    assert.ok(!buildTurnStory({ ...base, _firstQuarter: true }).contributions.some(c => c.kind === 'start'));

    story = buildTurnStory({ ...base, safetyBreach: true, safetyStockTarget: 500, _conceptInsight: { term: 'Reorder Point & Safety Stock', text: 'Detail.' } });
    assert.ok(story.contributions.some(c => c.kind === 'choice' && /extra-stock target of 500/.test(c.text)));
    assert.equal(story.remember.term, 'Reorder Point & Safety Stock');
    assert.ok(story.remember.plain);
});
