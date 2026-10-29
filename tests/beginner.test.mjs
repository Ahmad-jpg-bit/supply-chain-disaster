// Beginner layer for the free FMCG Chapter 1: who gets it, opening-shortage
// framing, the arrival check, the chapter recap and corrected response text.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSeed } from './helpers.mjs';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';
import { isBeginnerChapter, openingShortage, arrivesInTime, reflectionLine, buildChapterRecap, TRANSFER_QUESTION } from '../src/logic/beginner.js';
import { buildWorkspaceHTML, flowRowsHTML, flowSummaryText } from '../src/ui/procurement-workspace.js';
import { computeProjection } from '../src/ui/planning-workbench.js';
import { optionOutcome } from '../src/logic/scenario-text.js';
import { CHAPTER_SCENARIOS } from '../src/data/scenarios-expanded.js';
import { SUPPLIERS, SHIPPING_METHODS, PRICING_STRATEGIES } from '../src/data/procurement-options.js';

function procurementEngine(industryId = 'fmcg', startChapter = 0) {
    const engine = new GameEngine();
    engine.init(industryId, true, startChapter);
    engine.advanceFromChapterIntro();
    engine.makeDecision(0);
    return engine;
}
function view(engine, choices = engine.state.procurementChoices) {
    const s = engine.state;
    const est = engine.estimateTurn(choices);
    const rows = computeProjection({
        inventory: s.inventory, backlog: s.backlog, inTransit: s.inTransit, currentTurn: s.turn,
        orderQty: est.orderQuantity, orderUsable: est.arrivingUnits, leadTimeTurns: est.leadTimeTurns,
        expectedDemand: est.expectedDemand, safetyStock: choices.safetyStockTarget, horizon: 4,
    });
    const pricingDemands = PRICING_STRATEGIES.map(p => engine.estimateTurn({ ...choices, pricingId: p.id }).expectedDemand);
    return { s, est, rows, pricingDemands, earliest: s.turn + 1 };
}

test('beginner layer applies to FMCG Chapter 1 campaigns only', () => {
    withSeed(1, () => {
        assert.equal(isBeginnerChapter(procurementEngine('fmcg', 0).state, 'story'), true);
        assert.equal(isBeginnerChapter(procurementEngine('fmcg', 1).state, 'story'), false);
        assert.equal(isBeginnerChapter(procurementEngine('pharma', 0).state, 'story'), false);
        assert.equal(isBeginnerChapter(procurementEngine('electronics', 0).state, 'story'), false);
        const e = new GameEngine(); e.initEndless('fmcg');
        assert.equal(isBeginnerChapter(e.state, 'endless'), false);
    });
});

test('engine fact behind the arrival check: no order reaches the current quarter, for any option', () => {
    withSeed(2, () => {
        for (const industryId of ['fmcg', 'pharma', 'electronics']) {
            const engine = procurementEngine(industryId);
            for (const sup of SUPPLIERS[industryId]) for (const m of SHIPPING_METHODS) {
                const est = engine.estimateTurn({ ...engine.state.procurementChoices, supplierId: sup.id, shippingId: m.id });
                assert.equal(arrivesInTime(est, engine.state.turn), false, `${industryId} ${sup.id}/${m.id}`);
            }
        }
    });
});

test('opening shortage: shown only before the first quarter resolves, with the price lever stated honestly', () => {
    withSeed(3, () => {
        const engine = procurementEngine('fmcg');
        engine.state.inventory = 270;
        let v = view(engine);
        let o = openingShortage({ state: v.s, est: v.est, rows: v.rows, earliest: v.earliest, pricingDemands: v.pricingDemands });
        assert.ok(o);
        assert.equal(o.available, 270);
        assert.equal(o.priceCanCover, false, 'no price option brings expected demand down to 270');
        assert.equal(o.minDemand, Math.min(...v.pricingDemands));

        // Enough stock at the highest price, not at the default one: the shortage is not unavoidable
        engine.state.inventory = o.minDemand + 10;
        v = view(engine);
        o = openingShortage({ state: v.s, est: v.est, rows: v.rows, earliest: v.earliest, pricingDemands: v.pricingDemands });
        assert.equal(o?.priceCanCover, true);

        engine.state.inventory = 5000;
        v = view(engine);
        assert.equal(openingShortage({ state: v.s, est: v.est, rows: v.rows, earliest: v.earliest, pricingDemands: v.pricingDemands }), null);

        engine.state.inventory = 100;
        engine.state.history = [{ turn: 1 }];
        v = view(engine);
        assert.equal(openingShortage({ state: v.s, est: v.est, rows: v.rows, earliest: v.earliest, pricingDemands: v.pricingDemands }), null, 'later quarters use the regular warning');
    });
});

test('flow illustration uses live stock, estimated vs last demand, and the real arrival quarter', () => {
    withSeed(4, () => {
        const engine = procurementEngine('fmcg');
        const s = engine.state;
        s.inventory = 400;
        s.inTransit = [{ usableUnits: 600, passedDefects: 0, arrivesOnTurn: s.turn }];
        const est = engine.estimateTurn({ ...s.procurementChoices, orderQuantity: 1200 });
        let html = flowRowsHTML(s, est);
        assert.match(html, /1,000 units/, 'stock now includes arrivals due this quarter');
        assert.match(html, /incl\. 600 arriving now/);
        assert.match(html, new RegExp(`about ${est.expectedDemand.toLocaleString('en-US')}`));
        assert.match(html, /expected \(estimate\)\. No quarter played yet\./);
        assert.match(html, new RegExp(`Q${est.arrivesOnTurn}`));
        s.lastTurnResult = { demand: 987 };
        html = flowRowsHTML(s, est);
        assert.match(html, /Last quarter's demand: 987\./);
        assert.equal(flowSummaryText(s, est), `1,000 units for this quarter's customers · this order arrives Q${est.arrivesOnTurn}`);

        const base = { state: s, suppliers: SUPPLIERS.fmcg, draft: s.procurementChoices, openGroups: { supply: true, pricing: false, protection: false } };
        assert.ok(buildWorkspaceHTML({ ...base, beginner: { flowOpen: true } }).includes('id="pw-flowfig" open'));
        assert.ok(buildWorkspaceHTML({ ...base, beginner: { flowOpen: false } }).includes('id="pw-flowfig">'));
        const plain = buildWorkspaceHTML(base);
        assert.ok(!plain.includes('pw-flowfig') && !plain.includes('pw-opening'));
    });
});

test('arrival reflection links the expectation to the recorded result without marking', () => {
    const r = { sales: 270, inventory: 0, arrivesOnTurn: 2, crisis: null };
    assert.equal(reflectionLine(null, r), null);
    assert.match(reflectionLine({ answer: 'no' }, r), /^You expected the order to arrive after this quarter's customers — and it did\. Your order is due in Q2, so this quarter's customers could only buy the 270 units/);
    assert.match(reflectionLine({ answer: 'yes' }, r), /Orders always take at least a quarter\.$/);
    assert.match(reflectionLine({ answer: 'no' }, { ...r, crisis: { effects: { transitDelay: 1 } } }), /due in Q3/);
});

test('chapter recap: a real decision, its recorded outcome, a trade-off and an idea; events kept apart', () => {
    withSeed(7, () => {
        const engine = new GameEngine();
        engine.init('fmcg', true, 0);
        engine.state.inventory = 270;
        while (engine.state.phase !== GAME_PHASES.CHAPTER_SUMMARY) {
            if (engine.state.phase === GAME_PHASES.CHAPTER_INTRO) engine.advanceFromChapterIntro();
            else if (engine.state.phase === GAME_PHASES.STORY) engine.makeDecision(0);
            else { engine.prepareTurnCrisis(); engine.processTurn({ ...engine.state.procurementChoices, orderQuantity: 800 }); }
        }
        const turns = engine.state.history.filter(h => h.chapter === 1);
        assert.equal(turns.length, 4);
        const recap = buildChapterRecap(turns);
        assert.equal(recap.decision, `In Q1 you ordered 800 units from ${turns[0].supplier} by ${turns[0].shipping}, due in Q${turns[0].arrivesOnTurn}.`);
        assert.match(recap.outcome, /^In Q1, customers could only buy the 270 units already in stock/);
        const arrival = turns.slice(1).find(t => t.unitsReceived > 0);
        assert.match(recap.outcome, new RegExp(`In Q${arrival.turn}, ${arrival.unitsReceived.toLocaleString('en-US')} units from your earlier orders arrived`));
        assert.ok(recap.tradeoff && recap.tryNext);
        assert.match(recap.uncertainty, /baseline about 1,000/);
        for (const t of [recap.tradeoff, recap.tryNext]) assert.doesNotMatch(t, /will (prevent|fix|avoid)|guarantee|optimal/i);
    });
    // Leftover-stock branch and the no-arrival branch
    const q = (o) => ({ turn: 1, orderQuantity: 500, supplier: 'S', shipping: 'Ship', arrivesOnTurn: 2, sales: 900, inventory: 300, backlog: 0, demand: 900, unitsReceived: 0, holdingCost: 9000, crisis: null, ...o });
    let recap = buildChapterRecap([q(), q({ turn: 2, unitsReceived: 500, inventory: 400, holdingCost: 7000 })]);
    assert.match(recap.tradeoff, /The 400 units left after Q2 were protection .* storage cost \$7,000/);
    recap = buildChapterRecap([q(), q({ turn: 2, crisis: { name: 'Port strike' } })]);
    assert.match(recap.outcome, /No stock from your orders had arrived/);
    assert.equal(recap.events, 'Surprise events: Q2: Port strike.');
    assert.equal(buildChapterRecap([]), null);
});

test('transfer question is a labelled hypothetical with an engine-consistent answer', () => {
    assert.match(TRANSFER_QUESTION.prompt, /^Hypothetical:/);
    assert.equal(TRANSFER_QUESTION.correct, 'no');
    assert.match(TRANSFER_QUESTION.explanation, /^No\. An order placed now arrives next quarter at the earliest/);
});

test('Chapter 1 response text describes intentions, not outcomes; old saved copies show the new text', () => {
    const outcomeClaims = /improved \d|left you well|stayed efficient|built up as|bleeding|nailed|caused a massive|worked against you|ordered precisely|started winning/i;
    for (const sc of CHAPTER_SCENARIOS.demand_forecasting) {
        sc.options.forEach((o, i) => {
            assert.doesNotMatch(o.outcomeText, outcomeClaims, `${sc.id} #${i}`);
            const stale = { ...sc, options: sc.options.map(x => ({ ...x, outcomeText: 'Forecast accuracy improved 18%.' })) };
            assert.equal(optionOutcome(stale, i), o.outcomeText);
        });
    }
});
