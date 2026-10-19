/**
 * Industry profiles for the pre-game picker — every number is read from the
 * game catalog and engine constants, so the landing page can't drift from
 * what the simulation actually does.
 */

import { INDUSTRIES } from './industries.js';
import { SUPPLIERS } from '../data/procurement-options.js';
import { BASE_LEAD_TURNS, HOLDING_RATES, DEMAND_PROFILES } from './engine.js';

const BASE_UNIT_COST = 100; // engine processTurn() baseCost
const DIFFICULTY_RANK = { Easy: 0, Medium: 1, Hard: 2 };

/** Catalog industries ordered easiest → hardest (catalog difficulty field). */
export function listIndustryProfiles() {
    return Object.values(INDUSTRIES)
        .map(ind => getIndustryProfile(ind.id))
        .sort((a, b) => (DIFFICULTY_RANK[a.difficulty] ?? 9) - (DIFFICULTY_RANK[b.difficulty] ?? 9));
}

export function getIndustryProfile(id) {
    const ind = Object.values(INDUSTRIES).find(i => i.id === id);
    if (!ind) return null;
    const suppliers = SUPPLIERS[id] || SUPPLIERS.electronics;
    const budget = suppliers.find(s => s.id === 'budget');
    const demand = DEMAND_PROFILES[id] || { swing: 0.1 };
    return {
        id,
        name: ind.name,
        difficulty: ind.difficulty,
        capital: ind.metrics.initialCapital,
        margin: ind.metrics.baseMargin,
        baseUnitCost: BASE_UNIT_COST,
        basePrice: BASE_UNIT_COST * (1 + ind.metrics.baseMargin),
        baseLeadTurns: BASE_LEAD_TURNS[id],
        holdingRate: HOLDING_RATES[id],
        demand,
        budgetSupplier: budget && {
            saving: 1 - budget.costMultiplier,
            defectRate: budget.defectRate,
            leadWeeks: budget.leadTimeModifier,
        },
    };
}
