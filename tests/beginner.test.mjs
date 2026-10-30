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

/** Play FMCG Chapter 1 with fixed orders; returns the chapter's history and, as engine
 *  ground truth, the quarter the Q1 order object actually arrived (delays mutate it). */
function playChapter1(seed, qtyByTurn, inventory = 270) {
    return withSeed(seed, () => {
        const engine = new GameEngine();
        engine.init('fmcg', true, 0);
        engine.state.inventory = inventory;
        let firstOrder = null;
        while (engine.state.phase !== GAME_PHASES.CHAPTER_SUMMARY) {
            const s = engine.state;
            if (s.phase === GAME_PHASES.CHAPTER_INTRO) engine.advanceFromChapterIntro();
            else if (s.phase === GAME_PHASES.STORY) engine.makeDecision(0);
            else {
                const turn = s.turn;
                engine.prepareTurnCrisis();
                const before = new Set(s.inTransit);
                engine.processTurn({ ...s.procurementChoices, orderQuantity: qtyByTurn(turn) });
                const placed = engine.state.inTransit.find(o => !before.has(o));
                if (placed && !firstOrder) firstOrder = placed;
            }
        }
        return { turns: engine.state.history.filter(h => h.chapter === 1), firstOrder };
    });
}

test('chapter recap: across seeded runs the stated arrival matches what the engine actually did', () => {
    let checked = 0, delayed = 0, together = 0;
    for (let seed = 1; seed <= 60; seed++) {
        const { turns, firstOrder } = playChapter1(seed, () => 800);
        const recap = buildChapterRecap(turns);
        const q1 = turns[0];
        assert.equal(recap.decision, `In Q1 you ordered 800 units from ${q1.supplier} by ${q1.shipping}, due in Q${q1.arrivesOnTurn}.`);
        assert.match(recap.outcome, /^In Q1, customers could only buy the 270 units already in stock/);
        const actual = firstOrder?.arrivesOnTurn;   // ground truth: final arrival quarter of the Q1 order
        if (firstOrder && actual <= 4) {
            assert.match(recap.outcome, new RegExp(`(It arrived in Q${actual}|In Q${actual})\\b`), `seed ${seed}`);
            if (actual > q1.arrivesOnTurn) { delayed++; assert.match(recap.outcome, /late, after a transit delay/, `seed ${seed}`); }
            if (/another order due the same quarter/.test(recap.outcome)) together++;
            // A count is only attributed to the order when it's the sole arrival and matches the record
            const sole = recap.outcome.match(/It arrived in Q\d+[^:]*: ([\d,]+) units/);
            if (sole) assert.equal(Number(sole[1].replace(/,/g, '')), firstOrder.usableUnits + firstOrder.passedDefects, `seed ${seed}`);
        } else if (firstOrder) {
            assert.match(recap.outcome, new RegExp(`still on the way when the chapter ended, due in Q${actual}`), `seed ${seed}`);
        }
        for (const t of [recap.tradeoff, recap.tryNext]) assert.doesNotMatch(t, /will (prevent|fix|avoid)|guarantee|optimal/i);
        checked++;
    }
    assert.equal(checked, 60);
    assert.ok(delayed > 0, 'the sample includes delayed orders');
    assert.ok(together > 0, 'the sample includes orders arriving together');
});

test('chapter recap: zero first order, undelivered order, shared arrivals, defects, delays and supply cuts', () => {
    const q = (o) => ({ turn: 1, orderQuantity: 500, supplier: 'S', shipping: 'Ship', arrivesOnTurn: 2, sales: 270, inventory: 0, backlog: 700, backlogBefore: 0, demand: 970, unitsReceived: 0, defectsFound: 0, holdingCost: 9000, crisis: null, ...o });

    // First-quarter order was zero: the decision is the first order actually placed
    let recap = buildChapterRecap([q({ orderQuantity: 0 }), q({ turn: 2, orderQuantity: 900, arrivesOnTurn: 3, backlogBefore: 700 }), q({ turn: 3, orderQuantity: 0, unitsReceived: 900, sales: 900, backlog: 800, backlogBefore: 700 }), q({ turn: 4, orderQuantity: 0 })]);
    assert.equal(recap.decision, "You didn't order in Q1. In Q2 you ordered 900 units from S by Ship, due in Q3.");
    assert.match(recap.outcome, /It arrived in Q3: 900 units\. That quarter, customers wanted 1,670: 900 were served and 800 waited\./);

    // No orders at all: observed state only
    recap = buildChapterRecap([q({ orderQuantity: 0 }), q({ turn: 2, orderQuantity: 0, backlog: 900, inventory: 0 })]);
    assert.equal(recap.decision, "You didn't place any orders this chapter.");
    assert.match(recap.outcome, /By the end of Q2, 900 customer orders were waiting and 0 units were in stock\.$/);

    // Delivery not arrived by chapter end (lead time 4 quarters)
    recap = buildChapterRecap([q({ arrivesOnTurn: 5 }), q({ turn: 2, orderQuantity: 0 }), q({ turn: 3, orderQuantity: 0 }), q({ turn: 4, orderQuantity: 0 })]);
    assert.match(recap.outcome, /That order was still on the way when the chapter ended, due in Q5\./);
    assert.match(recap.tradeoff, /^Orders take at least a quarter/);

    // Two orders arrive together: the total is not credited to the Q1 order alone
    recap = buildChapterRecap([q({ arrivesOnTurn: 3 }), q({ turn: 2, orderQuantity: 600, arrivesOnTurn: 3 }), q({ turn: 3, orderQuantity: 0, unitsReceived: 1100 })]);
    assert.match(recap.outcome, /In Q3, 1,100 units arrived, including that order and another order due the same quarter\./);
    assert.doesNotMatch(recap.outcome, /It arrived/);

    // Inspection removed faulty units: the shipped count reflects it
    recap = buildChapterRecap([q({ defectsFound: 20 }), q({ turn: 2, orderQuantity: 0, unitsReceived: 480 })]);
    assert.match(recap.outcome, /It arrived in Q2: 480 units \(inspection removed 20 faulty units\)\./);

    // A transit delay in Q1 pushes it to Q3
    recap = buildChapterRecap([q({ crisis: { name: 'Port strike', effects: { transitDelay: 1 } } }), q({ turn: 2, orderQuantity: 0 }), q({ turn: 3, orderQuantity: 0, unitsReceived: 500 })]);
    assert.match(recap.outcome, /It arrived in Q3 \(1 quarter late, after a transit delay\): 500 units\./);

    // A supply cut: the shipped amount is unknown, so no count is credited to the order
    recap = buildChapterRecap([q({ crisis: { name: 'Allocation cut', effects: { capacityCut: 0.2 } } }), q({ turn: 2, orderQuantity: 0, unitsReceived: 400 })]);
    assert.match(recap.outcome, /In Q2, 400 units arrived, including that order \(a supply cut meant only part of it shipped\)\./);

    // A record that doesn't match the expected shipment is described, not explained
    recap = buildChapterRecap([q(), q({ turn: 2, orderQuantity: 0, unitsReceived: 350 })]);
    assert.match(recap.outcome, /In Q2, 350 units arrived, including that order\./);

    // Leftover stock branch + events listed separately
    recap = buildChapterRecap([q({ backlog: 0, inventory: 0 }), q({ turn: 2, orderQuantity: 0, unitsReceived: 500, sales: 400, demand: 400, backlog: 0, inventory: 100, holdingCost: 7000, crisis: { name: 'Port strike', effects: {} } })]);
    assert.match(recap.tradeoff, /The 100 units left after Q2 were protection .* storage cost \$7,000/);
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
