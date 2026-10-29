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
 * Chapter-end recap from the recorded quarters of the chapter.
 * Decision = the first quarter's order; outcome = what arrived and happened
 * when stock from earlier orders first arrived; trade-off and next idea follow
 * from that outcome. Events and demand variation are listed separately.
 * @param {Array} turns — history entries for the chapter, in play order
 */
export function buildChapterRecap(turns) {
    if (!turns?.length) return null;
    const first = turns[0];
    const later = turns.slice(1);

    const decision = first.orderQuantity > 0
        ? `In Q${first.turn} you ordered ${n(first.orderQuantity)} units from ${first.supplier} by ${first.shipping}, due in Q${first.arrivesOnTurn}.`
        : `In Q${first.turn} you didn't place an order.`;

    const startText = `In Q${first.turn}, customers could only buy the ${n(first.sales + first.inventory)} units already in stock${first.backlog > 0 ? `; ${n(first.backlog)} had to wait` : ''}.`;
    const arrival = later.find(t => t.unitsReceived > 0);
    let outcome;
    let tradeoff;
    let tryNext;
    if (arrival) {
        const wanted = arrival.demand + (arrival.backlogBefore || 0);
        outcome = `${startText} In Q${arrival.turn}, ${n(arrival.unitsReceived)} units from your earlier orders arrived before customers bought: they wanted ${n(wanted)}, `
            + (arrival.backlog > 0 ? `${n(arrival.sales)} were served and ${n(arrival.backlog)} waited.` : `all were served and ${n(arrival.inventory)} units were left.`);
        if (arrival.backlog > 0) {
            tradeoff = 'Stock that arrives later can\'t serve customers who are waiting now. A bigger or earlier order means more stock in later quarters — but it costs more up front, and leftover stock adds storage cost if demand comes in lower.';
            tryNext = `In another run, try ordering in Q${first.turn} with Q${first.arrivesOnTurn}'s customers in mind, then compare how many customers wait with how much you spend.`;
        } else {
            tradeoff = `The ${n(arrival.inventory)} units left after Q${arrival.turn} were protection against a demand surprise, but stock costs money to keep: storage cost ${money(arrival.holdingCost)} that quarter.`;
            tryNext = 'In another run, try a smaller order or a lower extra-stock target, then compare storage costs with how many customers wait.';
        }
    } else {
        outcome = `${startText} No stock from your orders had arrived by the end of the chapter.`;
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
