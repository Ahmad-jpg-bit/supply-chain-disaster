/**
 * Shortage allocation — rationing scarce units across customer segments.
 *
 * When a quarter ends in a real shortage, the player decides WHO gets the
 * units that exist. There is no "right" answer — only trade-offs:
 *
 *   · Velocity Retail   — premium payer: fills earn a 20% price premium now
 *   · Hartmann & Co.    — oldest account: starving them burns loyalty
 *   · Northline Stores  — churn risk: under-serve them and they delist you
 *
 * Teaches rationing & shortage gaming (a primary bullwhip cause) by making
 * the player do it. Consequences flow through cash, a persistent demand
 * modifier, and world-memory echoes that surface next quarter.
 */

const SPLIT = { premium: 0.30, loyal: 0.40, churn: 0.30 };
const PREMIUM_MARKUP = 0.20;

/**
 * Build the allocation scenario from a shortage turn.
 * @param {Object} result — engine turn result (missedSales > 0, sales > 0)
 * @returns {{ available, segments: Array }}
 */
export function buildAllocationScenario(result) {
    const demand = result.demand;
    const pricePerUnit = result.sales > 0 ? result.revenue / result.sales : 130;
    return {
        available: result.sales,
        pricePerUnit,
        segments: [
            {
                id: 'premium',
                name: 'Velocity Retail',
                tag: 'PAYS +20%',
                demand: Math.round(demand * SPLIT.premium),
                note: 'Will pay a 20% premium for every unit you give them this quarter.',
            },
            {
                id: 'loyal',
                name: 'Hartmann & Co.',
                tag: 'OLDEST ACCOUNT',
                demand: Math.round(demand * SPLIT.loyal),
                note: 'Your first customer. They remember how you treat them in a shortage.',
            },
            {
                id: 'churn',
                name: 'Northline Stores',
                tag: 'CHURN RISK',
                demand: Math.round(demand * SPLIT.churn),
                note: 'Already courting a competitor. Starve them and they delist you.',
            },
        ],
    };
}

/**
 * Apply the player's allocation to game state and return consequence lines.
 * @param {Object} state    — engine state (mutated: cash, archetypeModifiers, worldMemory)
 * @param {Object} scenario — from buildAllocationScenario
 * @param {Object} alloc    — { premium, loyal, churn } units
 * @returns {Array<{icon, text, tone}>} consequences to display
 */
export function applyAllocation(state, scenario, alloc) {
    const consequences = [];
    const wm = state.worldMemory || (state.worldMemory = {});
    if (!Array.isArray(wm.pendingEchoes)) wm.pendingEchoes = [];
    const seg = Object.fromEntries(scenario.segments.map(s => [s.id, s]));
    const fill = (id) => seg[id].demand > 0 ? (alloc[id] || 0) / seg[id].demand : 1;

    // Premium payer — immediate cash premium on every unit they got
    const premiumBonus = Math.round((alloc.premium || 0) * scenario.pricePerUnit * PREMIUM_MARKUP);
    if (premiumBonus > 0) {
        state.cash += premiumBonus;
        consequences.push({
            icon: '💰', tone: 'good',
            text: `Velocity Retail paid the 20% premium — +${premiumBonus.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} banked this quarter.`,
        });
    }

    // Oldest account — loyalty cuts both ways
    const loyalFill = fill('loyal');
    if (loyalFill < 0.6) {
        consequences.push({
            icon: '💔', tone: 'bad',
            text: `Hartmann & Co. got ${Math.round(loyalFill * 100)}% of what they ordered. Twenty years of partnership, and you shorted them first.`,
        });
        wm.pendingEchoes.push({
            icon: '💔',
            title: 'Hartmann & Co. remembers',
            text: 'You rationed your oldest account below 60% during the shortage. Their buyer has gone quiet — loyalty you spend takes years to rebuild.',
        });
    } else if (loyalFill >= 0.9) {
        state.archetypeModifiers.demandMultiplier =
            (state.archetypeModifiers.demandMultiplier ?? 1.0) * 1.02;
        consequences.push({
            icon: '🤝', tone: 'good',
            text: 'You protected Hartmann & Co. almost in full. Word travels — steady partners bring steady demand (+2% ongoing).',
        });
    }

    // Churn risk — under-serve and they delist you
    const churnFill = fill('churn');
    if (churnFill < 0.5) {
        state.archetypeModifiers.demandMultiplier =
            (state.archetypeModifiers.demandMultiplier ?? 1.0) * 0.96;
        consequences.push({
            icon: '🚪', tone: 'bad',
            text: `Northline Stores got ${Math.round(churnFill * 100)}% and walked. They delisted you — a slice of demand is gone for good (−4% ongoing).`,
        });
        wm.pendingEchoes.push({
            icon: '🚪',
            title: 'Northline shelf space lost',
            text: 'Your products came off Northline\'s shelves after the shortage. Rationing has consequences the spreadsheet doesn\'t show until next quarter.',
        });
    } else if (churnFill >= 0.8) {
        consequences.push({
            icon: '📌', tone: 'good',
            text: 'Northline Stores stayed. Serving your shakiest account in a shortage is what kept them on the shelf.',
        });
    }

    if (!consequences.length) {
        consequences.push({
            icon: '⚖️', tone: 'neutral',
            text: 'A balanced ration — nobody thrilled, nobody burned. Sometimes that is the best a shortage allows.',
        });
    }
    return consequences;
}
