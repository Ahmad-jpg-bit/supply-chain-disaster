/**
 * Guide coach — the inline tip shown next to the control it explains during
 * the optional guided start. Pure markup + copy; the Dashboard places it,
 * wires its buttons and persists progress (logic/guide-state.js).
 *
 * Every number in a tip comes from the engine estimate / projection the
 * decision screen already shows. Tips never suggest a quantity or option.
 */

import { fmtMoney, fmtNum } from './procurement-workspace.js';

/**
 * @param {{ id: string, index: number, total: number, last: boolean, phaseEnd: boolean }} step
 * @param {{ title: string, text: string }} content
 */
export function coachHTML(step, content) {
    return `
        <aside class="gc" id="gc-coach" role="region" aria-labelledby="gc-title" data-step="${step.id}">
            <p class="gc-eyebrow">Guided start · tip ${step.index + 1} of ${step.total}</p>
            <h3 class="gc-title" id="gc-title" tabindex="-1">${content.title}</h3>
            <p class="gc-text" id="gc-text">${content.text}</p>
            <div class="gc-actions">
                <button type="button" class="gc-next" data-gc="next">${step.last ? 'Finish guide' : step.phaseEnd ? 'Got it' : 'Next tip'}</button>
                <button type="button" class="gc-skip" data-gc="skip">Skip guidance</button>
            </div>
        </aside>`;
}

/**
 * Where a tip goes and what it says.
 * @param {string} id — step id
 * @param {Object} ctx — { state, est?, rows?, earliest? } (procurement steps need the estimate)
 * @returns {{ anchor: string, where: InsertPosition, highlight: string, title: string, text: string } | null}
 */
export function guideContent(id, ctx) {
    const s = ctx.state;
    const est = ctx.est;
    switch (id) {
        case 'story':
            return {
                anchor: '.story-options', where: 'beforebegin', highlight: '.story-options',
                title: 'Start with this quarter\'s event',
                text: 'Each turn is one quarter (3 months), and it starts with an event like this one. Read it, then pick a response — it can change your costs, delivery times or customer demand this quarter. There is no single right answer. The briefing tells a story; your real numbers are always in the bar at the top of the screen.',
            };
        case 'brief':
            return {
                anchor: '.pw-brief', where: 'beforebegin', highlight: '.pw-brief',
                title: 'Your quarter at a glance',
                text: 'This box sums up the quarter: what happened, what you need to decide, and what to keep in mind. You set your order in the numbered decisions.',
            };
        case 'stock': {
            if (!est) return null;
            const available = s.inventory + est.arrivingThisTurn;
            const need = est.expectedDemand + s.backlog;
            const arriving = est.arrivingThisTurn > 0 ? ` (including ${fmtNum(est.arrivingThisTurn)} arriving this quarter)` : '';
            const verdict = available < need
                ? `That's less than expected, and a new order can't arrive before Q${ctx.earliest} — so some customers will probably have to wait this quarter. The order you place now is for the quarters after.`
                : 'That should cover this quarter if demand is as expected. The order you place now is for the quarters after.';
            return {
                anchor: '.metrics-panel', where: 'afterend', highlight: '.metric-card[data-metric="inventory"], .metric-card[data-metric="demand"]',
                title: 'Compare your stock with demand',
                text: `You have <strong>${fmtNum(available)} units</strong> to sell${arriving}. Customers are expected to want about <strong>${fmtNum(need)}</strong> this quarter${s.backlog > 0 ? `, including ${fmtNum(s.backlog)} still waiting from last quarter` : ''}. ${verdict}`,
            };
        }
        case 'order':
            return {
                anchor: '.pw-qty-field', where: 'afterend', highlight: '.pw-qblock',
                title: 'Enter how much to order',
                text: `Type a number or use the buttons. The box starts at ${fmtNum(est?.orderQuantity ?? 0)} units — change it if you want more or less stock later. The other decisions already have a setting; open them to compare options. Each shows a summary even when closed.`,
            };
        case 'cost': {
            if (!est) return null;
            const cashAfter = s.cash - est.purchaseCost;
            const now = est.orderQuantity > 0
                ? `Right now this order costs <strong>${fmtMoney(est.purchaseCost)}</strong>, leaving <strong>${fmtMoney(cashAfter)}</strong>, and arrives in <strong>Q${est.arrivesOnTurn}</strong>.`
                : 'You are not ordering anything at the moment.';
            return {
                anchor: '#pw-cons-title', where: 'beforebegin', highlight: '.pw-cons',
                title: 'See what your choices mean',
                text: `${now} These numbers update whenever you change a choice. Costs are known now; stock is an estimate, because exact demand and surprise events stay unknown until the quarter plays out.`,
            };
        }
        case 'confirm':
            return {
                anchor: '.pw-actionbar', where: 'beforebegin', highlight: '.pw-actionbar',
                title: 'Confirm when you\'re ready',
                text: `Check “Your choices”, then press Confirm. ${s.isEndless ? '' : 'You\'ll guess this quarter\'s demand first — it\'s practice and doesn\'t change what happens. '}Sometimes an urgent message arrives before the quarter plays out. Then you'll see what happened and why.`,
            };
        default:
            return null;
    }
}
