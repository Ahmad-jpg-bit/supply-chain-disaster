/**
 * World Memory — the supply chain remembers how you treat it.
 *
 * Persistent relationship state that makes earlier decisions echo in later
 * chapters, always with a message explaining the causal link:
 *
 *   · Loyalty shield      — quarters of steady orders buy crisis protection
 *   · Re-onboarding fee   — suppliers you abandoned charge to requalify you
 *   · Quality debt        — shipped defects suppress demand until redeemed
 *   · Reliability credit  — a long no-stockout streak earns extra demand
 *
 * Lives inside engine.state.worldMemory so save/restore carries it.
 */

const LOYALTY_SHIELD_MIN_STREAK = 4;   // consecutive quarters with one supplier
const REONBOARD_MIN_ORDERS      = 3;   // relationship depth before abandonment matters
const REONBOARD_GAP_TURNS       = 5;   // quarters of silence that cool a relationship
const REONBOARD_PREMIUM         = 1.10;
const QUALITY_DEBT_THRESHOLD    = 150; // cumulative defective units shipped
const QUALITY_DEBT_REDEMPTION   = 3;   // clean quarters to clear the debt
const QUALITY_DEBT_DEMAND       = 0.93;
const SERVICE_CREDIT_STREAK     = 6;   // no-stockout quarters for the credit
const SERVICE_CREDIT_DEMAND     = 1.04;
const CRISIS_SHIELD_FACTOR      = 0.5; // loyalty halves harmful crisis effects

export function createWorldMemory() {
    return {
        suppliers: {},        // id → { orders, consecutive, lastOrderTurn, firstOrderTurn }
        lastSupplierId: null,
        defectsShipped: 0,
        cleanQuarters: 0,
        qualityDebtCleared: false,
        serviceStreak: 0,
        stockoutQuarters: 0,
    };
}

/**
 * Evaluate echoes for the turn being processed. Called BEFORE cost/demand
 * math so the returned factors can be applied, and before updateWorldMemory.
 *
 * @param {Object} state    — engine state (reads state.worldMemory, state.turn)
 * @param {Object} supplier — resolved supplier object ({ id, name, ... })
 * @param {Object|null} crisis — crisis rolled this turn, if any
 * @returns {{ costMultiplier, demandMultiplier, crisisShield, echoes: Array }}
 */
export function computeWorldEchoes(state, supplier, crisis) {
    if (!state.worldMemory) state.worldMemory = createWorldMemory();
    const wm = state.worldMemory;
    const fx = { costMultiplier: 1.0, demandMultiplier: 1.0, crisisShield: 1.0, echoes: [] };

    const rec = wm.suppliers[supplier.id];

    // ── Loyalty shield: steady orders soften a harmful crisis ──────────────
    const crisisHurts = crisis && crisis.severity !== 'positive' &&
        ((crisis.effects?.capacityCut ?? 0) > 0 || (crisis.effects?.costMultiplier ?? 1) > 1);
    if (crisisHurts && rec && wm.lastSupplierId === supplier.id &&
        rec.consecutive >= LOYALTY_SHIELD_MIN_STREAK) {
        fx.crisisShield = CRISIS_SHIELD_FACTOR;
        fx.echoes.push({
            icon: '🤝',
            title: `${supplier.name} shields you`,
            text: `${rec.consecutive} straight quarters of orders bought you priority when "${crisis.name}" hit — the damage to your allocation and pricing was cut in half. Loyalty is a real asset.`,
        });
    }

    // ── Re-onboarding premium: returning to an abandoned supplier ──────────
    if (rec && rec.lastOrderTurn != null &&
        rec.orders >= REONBOARD_MIN_ORDERS &&
        (state.turn - rec.lastOrderTurn) >= REONBOARD_GAP_TURNS) {
        fx.costMultiplier *= REONBOARD_PREMIUM;
        fx.echoes.push({
            icon: '🧾',
            title: `${supplier.name} requalifies you`,
            text: `You went quiet on them after Q${rec.lastOrderTurn} — ${state.turn - rec.lastOrderTurn} quarters of silence. Re-onboarding audits added 10% to this order. Dropped relationships cost money to restart.`,
        });
    }

    // ── Quality debt: shipped defects suppress demand until redeemed ───────
    if (wm.defectsShipped >= QUALITY_DEBT_THRESHOLD && !wm.qualityDebtCleared) {
        if (wm.cleanQuarters >= QUALITY_DEBT_REDEMPTION) {
            wm.qualityDebtCleared = true;
            fx.echoes.push({
                icon: '✅',
                title: 'Quality debt cleared',
                text: `${QUALITY_DEBT_REDEMPTION} clean quarters in a row — retailers have stopped double-inspecting your deliveries. Demand penalty lifted. Trust is rebuilt slowly, then all at once.`,
            });
        } else {
            fx.demandMultiplier *= QUALITY_DEBT_DEMAND;
            fx.echoes.push({
                icon: '📉',
                title: 'Quality debt',
                text: `${wm.defectsShipped.toLocaleString()} defective units have reached customers so far — retailers trimmed orders by 7% until you prove yourself. Clean quarters: ${wm.cleanQuarters}/${QUALITY_DEBT_REDEMPTION}.`,
            });
        }
    }

    // ── Reliability credit: long no-stockout streak earns demand ───────────
    if (wm.serviceStreak >= SERVICE_CREDIT_STREAK) {
        fx.demandMultiplier *= SERVICE_CREDIT_DEMAND;
        fx.echoes.push({
            icon: '📈',
            title: 'Reliability credit',
            text: `${wm.serviceStreak} quarters without a stockout — retailers expanded your shelf space (+4% demand). One miss resets this. Service level is a compounding asset.`,
        });
    }

    return fx;
}

/**
 * Record this turn into world memory. Called AFTER the result is computed.
 * @param {Object} state    — engine state
 * @param {Object} result   — the turn result just pushed to history
 * @param {Object} supplier — resolved supplier used this turn
 */
export function updateWorldMemory(state, result, supplier) {
    if (!state.worldMemory) state.worldMemory = createWorldMemory();
    const wm = state.worldMemory;

    // Supplier relationship
    let rec = wm.suppliers[supplier.id];
    if (!rec) {
        rec = { orders: 0, consecutive: 0, lastOrderTurn: null, firstOrderTurn: result.turn };
        wm.suppliers[supplier.id] = rec;
    }
    rec.orders += 1;
    rec.consecutive = (wm.lastSupplierId === supplier.id) ? rec.consecutive + 1 : 1;
    rec.lastOrderTurn = result.turn;
    wm.lastSupplierId = supplier.id;

    // Quality reputation
    const defects = result.defectsPassed || 0;
    wm.defectsShipped += defects;
    wm.cleanQuarters = defects > 0 ? 0 : wm.cleanQuarters + 1;
    // Shipping a fresh wave of defects after redemption reopens the debt
    if (defects > 50 && wm.qualityDebtCleared) {
        wm.qualityDebtCleared = false;
        wm.defectsShipped = defects; // debt restarts from the new wave
        wm.cleanQuarters = 0;
    }

    // Service reputation
    if ((result.missedSales || 0) > 0) {
        wm.serviceStreak = 0;
        wm.stockoutQuarters += 1;
    } else {
        wm.serviceStreak += 1;
    }
}
