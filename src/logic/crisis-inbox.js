/**
 * Crisis Inbox — turns micro-crises into messages from named people,
 * delivered BEFORE the quarter resolves, with a mitigation decision.
 *
 * buildCrisisMessage(crisis, ctx) → { sender, role, subject, body, severity,
 * options } where options always include "absorb" and, when the crisis type
 * supports it, one paid mitigation that mutates the (cloned) crisis effects.
 */

const SENDERS = {
    logistics: { name: 'Dana Okafor',    role: 'Logistics Director' },
    cfo:       { name: 'Priya Nair',     role: 'Chief Financial Officer' },
    sales:     { name: 'Marcus Bell',    role: 'VP of Sales' },
    quality:   { name: 'Dr. Amara Diallo', role: 'Quality Assurance Lead' },
    legal:     { name: 'Ellen Ruiz',     role: 'General Counsel' },
    supplier:  { name: 'Chen Wei',       role: 'Supplier Account Manager' },
};

const MESSAGES = {
    port_strike: {
        from: 'logistics',
        body: 'Dockworkers walked out at LA/Long Beach an hour ago. Everything we have on the water slips at least one quarter. I can charter an air rescue for the critical pallets, but it will not be cheap.',
    },
    currency_shock: {
        from: 'cfo',
        body: 'The dollar just moved 18% against our supplier currencies. Every open PO reprices at the new rate. I can lock a forward contract to cap half the damage — costs us a fee now.',
    },
    demand_surge: {
        from: 'sales',
        body: 'Whatever you do, do not slow down. A competitor just stocked out and a viral post is sending buyers our way — I am seeing +30% on forward orders this quarter. Hope you have the inventory.',
    },
    logistics_crunch: {
        from: 'logistics',
        body: 'Container spot rates jumped 38% overnight — global equipment shortage. Freight on this quarter\'s order will hurt. Nothing to charter our way out of; it is everyone\'s problem.',
    },
    supplier_quality_failure: {
        from: 'quality',
        body: 'We caught contamination in a tier-2 batch feeding our supplier. Expect defect rates well above normal this quarter. I can fly in a third-party inspection team to screen everything before it ships.',
    },
    competitor_patent: {
        from: 'legal',
        body: 'A rival filed a blocking patent this morning and named us in the injunction request. I have to reserve $150k for the defence. Not optional, and not quick. I will keep you out of depositions if I can.',
    },
    cold_chain_failure: {
        from: 'quality',
        body: 'Temperature excursion in transit — the data loggers flagged 12% of on-hand stock outside range. Protocol says quarantine. I can fast-track requalification testing to save part of the batch.',
    },
    regulatory_audit: {
        from: 'quality',
        body: 'FDA auditors are in the lobby. Unannounced. Compliance costs land this quarter and dispatch slows while they are on the floor. Smile, cooperate, and do not sign anything without Ellen.',
    },
    tariff_reprieve: {
        from: 'cfo',
        body: 'Good news for once — the emergency tariff waiver cleared overnight. Import duties suspended this quarter, procurement lands about 15% cheaper. If you were ever going to build buffer stock, it is now.',
    },
    supplier_capacity_crunch: {
        from: 'supplier',
        body: 'I will be straight with you — we are at 95% utilisation and allocating everyone. As it stands you get 80% of your order at a price premium. I can push you up the queue with a broker fee, if you want it.',
    },
    energy_price_spike: {
        from: 'logistics',
        body: 'Natural gas up 45% — production and freight both reprice this quarter. I can lock a short-term energy hedge through our 3PL to soften it, but the window closes today.',
    },
    demand_collapse: {
        from: 'sales',
        body: 'PMI just printed 47.2 and my inbox went quiet. Purchasing managers are cutting forward orders across the board — plan for demand well under forecast. Do not over-order into this.',
    },
};

/** Paid mitigations keyed by crisis id. `apply` mutates the cloned effects. */
const MITIGATIONS = {
    port_strike: {
        label: 'Charter air rescue',
        note: 'Removes the +1 turn transit delay on in-flight orders.',
        cost: 18000,
        apply: (fx) => { delete fx.transitDelay; },
    },
    currency_shock: {
        label: 'Lock forward contract',
        note: 'Caps the FX damage — cost spike cut in half.',
        cost: 10000,
        apply: (fx) => { fx.costMultiplier = 1 + (fx.costMultiplier - 1) / 2; },
    },
    supplier_quality_failure: {
        label: 'Fly in third-party inspection',
        note: 'Screens the batch — removes the defect-rate spike.',
        cost: 12000,
        apply: (fx) => { delete fx.defectRateBoost; },
    },
    cold_chain_failure: {
        label: 'Fast-track requalification',
        note: 'Saves half of the quarantined stock.',
        cost: 10000,
        apply: (fx) => { fx.inventoryLoss = fx.inventoryLoss / 2; },
    },
    supplier_capacity_crunch: {
        label: 'Pay the broker fee',
        note: 'Restores your full allocation (price premium still applies).',
        cost: 15000,
        apply: (fx) => { delete fx.capacityCut; },
    },
    energy_price_spike: {
        label: 'Lock short-term energy hedge',
        note: 'Halves both the production and freight cost spikes.',
        cost: 9000,
        apply: (fx) => {
            fx.costMultiplier    = 1 + (fx.costMultiplier - 1) / 2;
            fx.shippingCostBoost = 1 + (fx.shippingCostBoost - 1) / 2;
        },
    },
};

/**
 * Build the inbox message + options for a pending crisis.
 * @param {Object} crisis — CLONED pending crisis from engine.prepareTurnCrisis()
 * @param {Object} [ctx]  — { supplierName }
 */
export function buildCrisisMessage(crisis, ctx = {}) {
    const meta   = MESSAGES[crisis.id] || { from: 'logistics', body: crisis.ticker };
    const sender = { ...SENDERS[meta.from] };
    if (meta.from === 'supplier' && ctx.supplierName) {
        sender.role = `Account Manager, ${ctx.supplierName}`;
    }

    const options = [{
        id: 'absorb',
        label: crisis.severity === 'positive' ? 'Noted — make the most of it' : 'Absorb it',
        note: crisis.severity === 'positive' ? '' : 'Take the hit as-is. Sometimes that is the right call.',
        cost: 0,
    }];

    const mit = MITIGATIONS[crisis.id];
    if (mit) options.push({ id: 'mitigate', ...mit });

    return {
        sender,
        subject: crisis.name,
        body: meta.body,
        severity: crisis.severity,
        options,
    };
}

/**
 * Apply the player's response. Mutates the cloned crisis effects and charges
 * cash. Returns a record for the turn summary.
 * @param {Object} state  — engine state
 * @param {Object} crisis — pending crisis (cloned)
 * @param {Object} option — chosen option from buildCrisisMessage
 */
export function applyCrisisResponse(state, crisis, option) {
    if (option.id !== 'mitigate') {
        return { mitigated: false, label: option.label, cost: 0 };
    }
    state.cash -= option.cost;
    option.apply(crisis.effects);
    return { mitigated: true, label: option.label, cost: option.cost };
}
