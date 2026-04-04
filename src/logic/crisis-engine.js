/**
 * CrisisEngine — a lightweight "director" that introduces randomised starting
 * conditions and in-turn micro-crises to prevent every playthrough from feeling
 * identical. All randomness is seeded from Math.random() at two points:
 *   1. rollStartingConditions()  — called once at game start
 *   2. rollMicroCrisis()         — called at the start of every processTurn()
 */

// ─────────────────────────────────────────────────────────────────────────────
// STARTING ARCHETYPES
// Each archetype is a "world state" that varies cash and inventory from the
// industry baseline. The player sees the archetype label + briefing in the
// Chapter 1 intro screen.
// ─────────────────────────────────────────────────────────────────────────────

export const STARTING_ARCHETYPES = [
    {
        id: 'balanced',
        weight: 0.35,
        label: 'Balanced Start',
        briefing: 'Standard market entry. Adequate reserves and a healthy stock position.',
        icon: '⊜',
        cashMultiplier: 1.0,
        inventoryMultiplier: 1.0,
        modifiers: {},
    },
    {
        id: 'cash_surplus_inventory_crisis',
        weight: 0.18,
        label: 'Cash Surplus / Inventory Deficit',
        briefing: 'A clearance push last quarter drained warehouses. Capital is strong but shelves are nearly bare — replenish fast or face stockouts.',
        icon: '💰',
        cashMultiplier: 1.45,
        inventoryMultiplier: 0.18,
        modifiers: {},
    },
    {
        id: 'cash_crunch_inventory_surplus',
        weight: 0.18,
        label: 'Cash Crunch / Inventory Surplus',
        briefing: 'Aggressive bulk buying last quarter left reserves low. Inventory is high — holding costs will erode margin until demand catches up.',
        icon: '📦',
        cashMultiplier: 0.52,
        inventoryMultiplier: 2.3,
        modifiers: { unitCost: 1.0 },
    },
    {
        id: 'active_disruption',
        weight: 0.16,
        label: 'Active Disruption',
        briefing: 'An upstream disruption is already in motion. Lead times are stretched and supplier costs are elevated going into this period.',
        icon: '⚠',
        cashMultiplier: 0.82,
        inventoryMultiplier: 0.65,
        modifiers: { leadTime: 1, unitCost: 1.18 },
    },
    {
        id: 'favourable_conditions',
        weight: 0.13,
        label: 'Favourable Market Entry',
        briefing: 'Supplier contracts were renegotiated at a discount last quarter. Cost position is strong — use it to build resilience.',
        icon: '↗',
        cashMultiplier: 1.22,
        inventoryMultiplier: 1.25,
        modifiers: { unitCost: 0.88 },
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// MICRO-CRISIS EVENTS
// Each event has:
//   weight         — relative probability (compared to peers + noEventWeight)
//   industries     — null means all; array restricts to listed industry IDs
//   condition      — optional fn(state) → bool extra gate
//   effects        — object of modifiers applied during processTurn()
//   ticker         — headline injected into the Crisis Ticker
//   severity       — 'positive' | 'low' | 'medium' | 'high' | 'critical'
// ─────────────────────────────────────────────────────────────────────────────

export const MICRO_CRISES = [
    {
        id: 'port_strike',
        name: 'Port Labour Strike',
        weight: 5,
        industries: null,
        ticker: 'PORT DISRUPTION: Dockworkers strike at LA/Long Beach — all in-transit orders delayed +1 turn',
        severity: 'medium',
        effects: { transitDelay: 1 },
        consequenceText: (e) => `Port strike pushed your shipment back 1 turn — adjust safety stock to compensate.`,
    },
    {
        id: 'currency_shock',
        name: 'Currency Volatility',
        weight: 5,
        industries: null,
        ticker: 'FX ALERT: USD surge +18% against supplier currencies — import costs spike this quarter',
        severity: 'medium',
        effects: { costMultiplier: 1.18 },
        consequenceText: (e) => `FX swing inflated procurement cost by 18% — hedge or localise sourcing.`,
    },
    {
        id: 'demand_surge',
        name: 'Demand Surge',
        weight: 5,
        industries: null,
        ticker: 'DEMAND SPIKE: Viral trend + competitor stockout drives +30% demand spike this quarter',
        severity: 'low',
        effects: { demandMultiplier: 1.30 },
        consequenceText: () => `Unexpected demand surge: 30% above forecast — stockout risk elevated.`,
    },
    {
        id: 'logistics_crunch',
        name: 'Logistics Network Crunch',
        weight: 5,
        industries: null,
        ticker: 'FREIGHT: Global container shortage — spot rates +38% on all major lanes this quarter',
        severity: 'medium',
        effects: { shippingCostBoost: 1.38 },
        consequenceText: () => `Container shortage spiked freight rates 38% — review shipping tier selection.`,
    },
    {
        id: 'supplier_quality_failure',
        name: 'Supplier Batch Contamination',
        weight: 4,
        industries: null,
        ticker: 'QUALITY ALERT: Batch contamination at Tier-2 supplier — elevated defect rate this quarter',
        severity: 'high',
        effects: { defectRateBoost: 0.14 },
        consequenceText: () => `Supplier quality failure: defect rate elevated +14% — upgrade inspection tier.`,
    },
    {
        id: 'competitor_patent',
        name: 'Competitor Patent Injunction',
        weight: 3,
        industries: ['electronics'],
        condition: (state) => state.history.length > 0,
        ticker: 'IP ALERT: Rival files blocking patent — early adopters facing injunction risk next quarter',
        severity: 'critical',
        effects: { cashPenalty: 150000 },
        consequenceText: () => `Competitor patent forced a $150k legal reserve — IP risk is real in this space.`,
    },
    {
        id: 'cold_chain_failure',
        name: 'Cold Chain Excursion',
        weight: 4,
        industries: ['pharma'],
        ticker: 'COLD CHAIN: Temperature excursion detected in transit — 12% of inventory quarantined',
        severity: 'high',
        effects: { inventoryLoss: 0.12 },
        consequenceText: () => `Cold chain failure destroyed 12% of on-hand inventory — review carrier SLAs.`,
    },
    {
        id: 'regulatory_audit',
        name: 'Surprise Regulatory Audit',
        weight: 3,
        industries: ['pharma'],
        ticker: 'REGULATORY: Unannounced FDA audit in progress — operations under review this quarter',
        severity: 'high',
        effects: { cashPenalty: 80000, shippingCostBoost: 1.15 },
        consequenceText: () => `Regulatory audit imposed $80k compliance costs and slowed dispatch 15%.`,
    },
    {
        id: 'tariff_reprieve',
        name: 'Emergency Tariff Waiver',
        weight: 4,
        industries: null,
        ticker: 'TRADE: Emergency tariff waiver granted — import duties suspended this quarter',
        severity: 'positive',
        effects: { costMultiplier: 0.85 },
        consequenceText: () => `Tariff waiver cut procurement costs 15% this quarter — lock in buffer stock while rates hold.`,
    },
    {
        id: 'supplier_capacity_crunch',
        name: 'Supplier Capacity Crunch',
        weight: 4,
        industries: null,
        ticker: 'CAPACITY: Tier-1 supplier running at 95% — allocation cut 20%, price premium applied',
        severity: 'medium',
        effects: { costMultiplier: 1.12, capacityCut: 0.20 },
        consequenceText: () => `Supplier allocation cut 20% — only 80% of your order quantity will ship. Diversify sourcing.`,
    },
    {
        id: 'energy_price_spike',
        name: 'Energy Cost Spike',
        weight: 4,
        industries: ['electronics', 'pharma'],
        ticker: 'ENERGY: Natural gas prices surge 45% — manufacturing and logistics costs elevated',
        severity: 'medium',
        effects: { costMultiplier: 1.10, shippingCostBoost: 1.12 },
        consequenceText: () => `Energy spike raised both production and freight costs this quarter.`,
    },
    {
        id: 'demand_collapse',
        name: 'Demand Softening',
        weight: 3,
        industries: null,
        condition: (state) => state.history.length > 2,
        ticker: 'DEMAND: IHS Markit PMI falls to 47.2 — purchasing managers cutting forward orders',
        severity: 'medium',
        effects: { demandMultiplier: 0.72 },
        consequenceText: () => `Demand contracted 28% this quarter — avoid over-ordering or holding costs will mount.`,
    },
];

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/** Weighted random selection from an array of { weight, ... } objects. */
function weightedRandom(items) {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * total;
    for (const item of items) {
        r -= item.weight;
        if (r <= 0) return item;
    }
    return items[items.length - 1];
}

// ─────────────────────────────────────────────────────────────────────────────
// PUBLIC API
// ─────────────────────────────────────────────────────────────────────────────

export const CrisisEngine = {

    /**
     * Roll a starting archetype for this playthrough.
     * Returns the archetype object (including cash/inventory multipliers).
     */
    rollStartingConditions() {
        return weightedRandom(STARTING_ARCHETYPES);
    },

    /**
     * Roll for a micro-crisis event during a turn.
     * Returns a crisis event object or null (no event).
     *
     * @param {object} gameState  — engine.state
     * @param {number} chapterIndex
     */
    rollMicroCrisis(gameState, chapterIndex = 0) {
        const industryId = gameState.industry?.id;

        // Scale event likelihood with chapter progression (later = more chaotic)
        const chapterScaling  = 1 + chapterIndex * 0.06;

        // Filter eligible events
        const eligible = MICRO_CRISES.filter(e => {
            if (e.id === gameState.lastCrisisId) return false;          // no repeats
            if (e.industries && !e.industries.includes(industryId)) return false;
            if (e.condition && !e.condition(gameState)) return false;
            return true;
        });

        if (!eligible.length) return null;

        // Add a "no event" sentinel with a weight that ensures ~65% blank turns at chapter 1,
        // declining to ~50% by chapter 8 as chaos scales.
        const eventTotalWeight = eligible.reduce((s, e) => s + e.weight, 0) * chapterScaling;
        const noEventWeight    = eventTotalWeight * (0.65 / 0.35) / chapterScaling;

        const roll = Math.random() * (eventTotalWeight + noEventWeight);
        if (roll >= eventTotalWeight) return null; // blank turn

        // Select which event fires
        let cumulative = 0;
        for (const event of eligible) {
            cumulative += event.weight * chapterScaling;
            if (roll < cumulative) return event;
        }
        return null;
    },
};
