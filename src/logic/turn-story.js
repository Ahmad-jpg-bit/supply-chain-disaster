/**
 * Turn story — the plain-language "what happened / what contributed / one
 * thing to remember" summary at the top of the quarterly results card.
 *
 * Built only from the resolved engine result plus a few values the
 * Dashboard records before resolution (`_before`, `_expectedDemand`,
 * `_storyResponse`, `_storyEffects`, `_firstQuarter`, `_conceptInsight`).
 * It states causes only where the engine output shows them, and keeps the
 * player's choices apart from events and ordinary demand variation.
 */

import { PRICING_STRATEGIES } from '../data/procurement-options.js';

const n = (x) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(x || 0);
const money = (x) => (x < 0 ? '−' : '') + new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(Math.abs(x || 0));

/** A crisis's consequence line; the live crisis data holds it as a function of its effects. */
export const crisisText = (c) => (typeof c.consequenceText === 'function' ? c.consequenceText(c.effects) : c.consequenceText) || c.ticker || '';

/** One short, plain sentence per concept the insights module can name. */
export const PLAIN_CONCEPTS = {
    'Supply Chain Risk Management (SCRM)': 'You can\'t prevent every event, but you can choose how exposed you are to one — usually by paying a little extra in advance.',
    'Reorder Point & Safety Stock': 'An order only helps from the quarter it arrives. Ordering ahead of the wait — plus a little extra for surprises — keeps shelves stocked, but extra stock also ties up money.',
    'Bullwhip Effect': 'When your order sizes swing more than customer demand does, planning gets harder. Orders that follow demand steadily are easier to manage.',
    'Cost of Quality (COQ)': 'Faulty units that reach customers usually cost more than finding them first. Inspection costs money but can prevent bigger losses.',
    'Inventory Carrying Cost': 'Stock sitting in the warehouse costs money every quarter. More stock protects against shortages but costs more to keep.',
    'Total Cost of Ownership (TCO)': 'The cheapest price per unit isn\'t always the cheapest overall — shipping, storage and quality costs add up.',
    'Service Level & Backorders': 'Customers you can\'t serve now wait for later stock. The share of demand you serve on time is called your service level.',
    'Forecast Error (MAPE)': 'Demand rarely matches the estimate exactly. Keeping some extra stock is one way to absorb the difference.',
    'Order-Up-To Level': 'Having enough stock for expected demand plus a small buffer kept this quarter steady.',
};

/**
 * @param {Object} r — engine lastTurnResult, decorated by the Dashboard
 * @returns {{ happened: string, money: string, beforeAfter: Array, contributions: Array, remember: Object|null }}
 */
export function buildTurnStory(r) {
    const available = r.sales + r.inventory;           // stock customers could buy this quarter
    const wanted = r.demand + (r.backlogBefore || 0);
    const waitingNote = r.backlogBefore > 0 ? ` (including ${n(r.backlogBefore)} still waiting from last quarter)` : '';

    const happened = r.backlog > 0
        ? `Customers wanted ${n(wanted)} units${waitingNote}. You had ${n(available)} to sell, so ${n(r.sales)} were served and ${n(r.backlog)} orders are still waiting.`
        : `Customers wanted ${n(wanted)} units${waitingNote} and you had ${n(available)} to sell, so every order was served. ${n(r.inventory)} units are left in stock.`;
    const moneyLine = r.profit >= 0
        ? `The quarter made a profit of ${money(r.profit)}.`
        : `The quarter made a loss of ${money(-r.profit)}.`;

    const b = r._before;
    const beforeAfter = [];
    if (b) beforeAfter.push({ label: 'Money', before: money(b.cash), after: money(r.cash), tone: r.cash < b.cash ? 'down' : r.cash > b.cash ? 'up' : 'same' });
    const stockBefore = b ? b.inventory : r.startingInventory;
    beforeAfter.push({ label: 'Stock', before: n(stockBefore), after: n(r.inventory), tone: r.inventory < stockBefore ? 'down' : r.inventory > stockBefore ? 'up' : 'same' });
    const waitBefore = b ? b.backlog : (r.backlogBefore || 0);
    if (waitBefore > 0 || r.backlog > 0) {
        beforeAfter.push({ label: 'Customer orders waiting', before: n(waitBefore), after: n(r.backlog), tone: r.backlog > waitBefore ? 'bad' : r.backlog < waitBefore ? 'good' : 'same' });
    }

    const contributions = [];
    const add = (kind, text) => contributions.push({ kind, text });

    if (r._firstQuarter && (r.backlog > 0 || r.missedSales > 0)) {
        add('start', 'This quarter\'s stock was set before you started — no order placed this quarter could arrive in time.');
    }
    add('choice', r.orderQuantity > 0
        ? `You ordered ${n(r.orderQuantity)} units, due in Q${r.arrivesOnTurn} — orders always take at least a quarter, so none of it could be sold this quarter.`
        : 'You didn\'t order anything this quarter.');
    if (r.unitsReceived > 0) add('choice', `${n(r.unitsReceived)} units from earlier orders arrived in time to sell.`);

    const pricing = PRICING_STRATEGIES.find(p => p.name === r.pricing);
    if (pricing && pricing.demandMultiplier !== 1) {
        const p = Math.round(Math.abs(pricing.demandMultiplier - 1) * 100);
        add('choice', `${pricing.name} ${pricing.demandMultiplier > 1 ? 'raised' : 'lowered'} customer demand by about ${p}% and ${pricing.priceMultiplier > 1 ? 'raised' : 'lowered'} the price of each unit sold.`);
    }
    if (r.defectsPassed > 0) {
        add('choice', `About ${n(r.defectsPassed)} faulty units in this order got past inspection (${r.inspection}), which lowers customer satisfaction.`);
    } else if (r.defectsFound > 0) {
        add('choice', `Inspection found ${n(r.defectsFound)} faulty units in this order before customers could get them.`);
    }
    if (r.safetyBreach) {
        add('choice', `Stock ended below your extra-stock target of ${n(r.safetyStockTarget)} units, which lowers customer satisfaction.`);
    }
    if (r._storyResponse && r._storyEffects?.length) {
        add('choice', `Your event response “${r._storyResponse}”: ${r._storyEffects.join(', ')}.`);
    }

    if (r.crisis) {
        add('event', `${r.crisis.name}: ${crisisText(r.crisis) || 'a surprise event this quarter.'}`);
    }
    if (r.worldEchoes?.length) {
        add('event', `Effects of earlier decisions: ${r.worldEchoes.map(e => e.title).join('; ')}.`);
    }

    const exp = r._expectedDemand;
    if (exp > 0) {
        const diff = (r.demand - exp) / exp;
        const causes = ['demand varies from quarter to quarter'];
        if (r.crisis?.effects?.demandMultiplier && r.crisis.effects.demandMultiplier !== 1) causes.push('this quarter\'s event changed it');
        if (r.worldEchoes?.length) causes.push('earlier decisions can affect it');
        add('uncertainty', Math.abs(diff) < 0.03
            ? `Demand (${n(r.demand)}) was close to the estimate of about ${n(exp)}.`
            : `Demand came in at ${n(r.demand)}, about ${Math.round(Math.abs(diff) * 100)}% ${diff > 0 ? 'above' : 'below'} the estimate of ${n(exp)} — ${causes.join(', and ')}.`);
    }

    const insight = r._conceptInsight;
    const remember = insight
        ? { plain: PLAIN_CONCEPTS[insight.term] || null, term: insight.term, detail: insight.text }
        : null;

    return { happened, money: moneyLine, beforeAfter, contributions, remember };
}
