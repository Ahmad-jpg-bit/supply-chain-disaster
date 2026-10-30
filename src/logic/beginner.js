/**
 * Beginner learning layer for the free FMCG Chapter 1.
 *
 * Pure helpers: which runs get it, the opening-shortage framing, the
 * conceptual arrival check that replaces the first quarter's demand guess,
 * and the chapter-end recap + transfer question. Every statement is built
 * from engine estimates (before a quarter) or recorded results (after it);
 * nothing here recommends a quantity or reveals future demand.
 */

const n = (x) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(x || 0);
const money = (x) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(x || 0));

/** The layer applies to campaign play of FMCG Chapter 1 only. */
export function isBeginnerChapter(state, mode) {
    return mode === 'story' && !state.isEndless && state.industry?.id === 'fmcg' && (state.chapterIndex ?? 0) === 0;
}

/**
 * Before the first quarter resolves: is a shortfall expected that no order
 * can prevent (lead time is never under one quarter)?
 * @param {Object} p — { state, est, rows, earliest, pricingDemands: number[] }
 * @returns {null | { available, expected, earliest, minDemand, maxDemand, priceCanCover }}
 */
export function openingShortage({ state, est, rows, earliest, pricingDemands }) {
    if (state.history.length > 0 || !rows?.[0]?.stockout) return null;
    const available = state.inventory + est.arrivingThisTurn;
    const minDemand = Math.min(...pricingDemands);
    return {
        available,
        expected: est.expectedDemand,
        earliest,
        minDemand,
        maxDemand: Math.max(...pricingDemands),
        priceCanCover: minDemand + state.backlog <= available,
    };
}

/** Engine fact behind the arrival check: an order never reaches this quarter's customers. */
export const arrivesInTime = (est, turn) => est.arrivesOnTurn <= turn;

/**
 * One or two sentences linking the player's expectation to what happened.
 * @param {{ answer: 'yes'|'no', arrivesOnTurn: number, turn: number }} reflection
 * @param {Object} r — the resolved quarter's result
 */
export function reflectionLine(reflection, r) {
    if (!reflection?.answer) return null;
    const available = r.sales + r.inventory;
    const due = r.arrivesOnTurn + (r.crisis?.effects?.transitDelay || 0);
    const fact = `Your order is due in Q${due}, so this quarter's customers could only buy the ${n(available)} units you already had.`;
    return reflection.answer === 'no'
        ? `You expected the order to arrive after this quarter's customers — and it did. ${fact}`
        : `You expected the order to arrive in time for this quarter. ${fact} Orders always take at least a quarter.`;
}

/** Labelled hypothetical used after the chapter (not tied to the player's numbers). */
export const TRANSFER_QUESTION = {
    id: 'transfer_ch1',
    prompt: 'Hypothetical: customers need 800 units this quarter, you have 300 in stock, and anything you order arrives next quarter. Does ordering more now fix this quarter\'s shortage?',
    options: [{ id: 'yes', label: 'Yes' }, { id: 'no', label: 'No' }],
    correct: 'no',
    explanation: 'No. An order placed now arrives next quarter at the earliest, so this quarter\'s customers can only buy the 300 units you have. Ordering more changes how much stock you have later — and how much you spend and store.',
};

/**
 * Quarter an order actually arrives: its due quarter, pushed back by every
 * transit-delay event that fired while it was still on the way (the engine
 * delays in-transit orders at the end of the crisis quarter, after that
 * quarter's deliveries were received).
 */
function arrivalQuarter(order, turns) {
    let due = order.arrivesOnTurn;
    for (const t of turns) {
        if (t.turn >= order.turn && t.turn < due && t.crisis?.effects?.transitDelay) due += t.crisis.effects.transitDelay;
    }
    return due;
}

/**
 * Chapter-end recap from the recorded quarters of the chapter.
 * Decision = the player's first order this chapter. Its outcome is stated only
 * as far as the records establish it: arrival quarter (incl. transit delays),
 * units shipped after inspection (unknown when a supply cut hit it), whether
 * other orders arrived in the same quarter, and what customers saw then.
 * Events and demand variation are listed separately.
 * @param {Array} turns — history entries for the chapter, in play order
 */
export function buildChapterRecap(turns) {
    if (!turns?.length) return null;
    const first = turns[0];
    const last = turns[turns.length - 1];
    const order = turns.find(t => t.orderQuantity > 0);

    // What the first quarter's customers could buy (a run's first quarter has nothing on the way)
    const startText = first.unitsReceived
        ? ''
        : `In Q${first.turn}, customers could only buy the ${n(first.sales + first.inventory)} units already in stock${first.backlog > 0 ? `; ${n(first.backlog)} had to wait` : ''}. `;
    const servedText = (t) => `customers wanted ${n(t.demand + (t.backlogBefore || 0))}: `
        + (t.backlog > 0 ? `${n(t.sales)} were served and ${n(t.backlog)} waited.` : `all were served and ${n(t.inventory)} units were left.`);
    const endState = `By the end of Q${last.turn}, ${n(last.backlog)} customer orders were waiting and ${n(last.inventory)} units were in stock.`;

    let decision;
    let outcome;
    let at = null;   // the quarter the decision's order arrived, when within the chapter
    if (!order) {
        decision = 'You didn\'t place any orders this chapter.';
        outcome = `${startText}${endState}`;
    } else {
        decision = `${order === first ? '' : `You didn't order in Q${first.turn}. `}In Q${order.turn} you ordered ${n(order.orderQuantity)} units from ${order.supplier} by ${order.shipping}, due in Q${order.arrivesOnTurn}.`;
        const due = arrivalQuarter(order, turns);
        const late = due - order.arrivesOnTurn;
        const delayed = late > 0 ? ` (${late} quarter${late === 1 ? '' : 's'} late, after a transit delay)` : '';
        const cut = Boolean(order.crisis?.effects?.capacityCut);
        const shipped = order.orderQuantity - (order.defectsFound || 0);   // engine: arriving = usable + passed defects
        const inspected = order.defectsFound > 0 ? ` (inspection removed ${n(order.defectsFound)} faulty units)` : '';
        at = turns.find(t => t.turn === due) || null;
        if (!at) {
            outcome = `${startText}That order was still on the way when the chapter ended, due in Q${due}${delayed}. ${endState}`;
        } else {
            const together = turns.some(o => o !== order && o.orderQuantity > 0 && arrivalQuarter(o, turns) === due);
            const arrived = (!together && !cut && at.unitsReceived === shipped)
                ? `It arrived in Q${due}${delayed}: ${n(shipped)} units${inspected}. `
                : `In Q${due}${delayed}, ${n(at.unitsReceived)} units arrived, including that order${together ? ' and another order due the same quarter' : ''}${cut ? ' (a supply cut meant only part of it shipped)' : ''}. `;
            outcome = `${startText}${arrived}That quarter, ${servedText(at)}`;
        }
    }

    let tradeoff;
    let tryNext;
    if (at && at.backlog > 0) {
        tradeoff = 'Stock that arrives later can\'t serve customers who are waiting now. A bigger or earlier order means more stock in later quarters — but it costs more up front, and leftover stock adds storage cost if demand comes in lower.';
        tryNext = `In another run, try ordering in Q${first.turn} with the customers of your order's arrival quarter in mind, then compare how many customers wait with how much you spend.`;
    } else if (at) {
        tradeoff = `The ${n(at.inventory)} units left after Q${at.turn} were protection against a demand surprise, but stock costs money to keep: storage cost ${money(at.holdingCost)} that quarter.`;
        tryNext = 'In another run, try a smaller order or a lower extra-stock target, then compare storage costs with how many customers wait.';
    } else {
        tradeoff = 'Orders take at least a quarter, so what you order now shapes later quarters, not the current one.';
        tryNext = 'In another run, check the "Order arrives" quarter before you confirm, and plan for the customers of that quarter.';
    }

    const crises = turns.filter(t => t.crisis).map(t => `Q${t.turn}: ${t.crisis.name}`);
    const demands = turns.map(t => t.demand);
    return {
        decision,
        outcome,
        tradeoff,
        tryNext,
        events: crises.length ? `Surprise events: ${crises.join('; ')}.` : 'No surprise events this chapter.',
        uncertainty: demands.length > 1
            ? `Customer demand ranged from ${n(Math.min(...demands))} to ${n(Math.max(...demands))} units a quarter (baseline about 1,000). It varies every quarter, and event responses and pricing can raise or lower it.`
            : `Customer demand was ${n(demands[0])} units (baseline about 1,000).`,
    };
}
