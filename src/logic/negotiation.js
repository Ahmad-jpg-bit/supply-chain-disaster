/**
 * Supplier Negotiation — contract offer/counter driven by relationship.
 *
 * A supplier you have a track record with proposes a supply agreement:
 * a per-unit discount in exchange for a per-quarter volume commitment, for
 * the rest of the chapter. The player can accept, counter (push for better
 * terms — the supplier's willingness to concede depends on how you've treated
 * them), or decline. Miss the committed volume in a quarter and the discount
 * voids and a shortfall fee applies.
 *
 * Teaches volume commitments, contract TCO, and that relationships are
 * negotiating leverage — the same lesson the world-memory layer rewards.
 */

/**
 * Relationship score 0–1 from world memory for a given supplier id.
 * Orders build it; a current active streak strengthens it; queued betrayal
 * echoes (e.g. abandonment) are not supplier-specific here, so we lean on the
 * supplier's own record.
 */
export function relationshipScore(worldMemory, supplierId) {
    const rec = worldMemory?.suppliers?.[supplierId];
    if (!rec) return 0;
    const fromOrders = Math.min(0.55, rec.orders * 0.11);
    const fromStreak = worldMemory.lastSupplierId === supplierId
        ? Math.min(0.35, (rec.consecutive || 0) * 0.09)
        : 0;
    const lull = rec.lastOrderTurn != null ? 0 : 0.1;
    return Math.max(0, Math.min(1, fromOrders + fromStreak - lull));
}

/** Round to the nearest step. */
const round = (n, step) => Math.round(n / step) * step;

/**
 * Build the opening contract offer.
 * Better relationship → deeper discount, gentler volume commitment.
 * @returns {{ supplierId, supplierName, discountPct, minVolume, shortfallFee,
 *             score, tier }}
 */
export function buildOpeningOffer(worldMemory, supplier) {
    const score = relationshipScore(worldMemory, supplier.id);
    const discountPct = round(4 + score * 8, 1);          // 4%–12%
    const minVolume   = round(1300 - score * 300, 50);     // 1,300 → 1,000
    const shortfallFee = 12000;
    const tier = score >= 0.6 ? 'preferred' : score >= 0.3 ? 'established' : 'new';
    return {
        supplierId: supplier.id,
        supplierName: supplier.name,
        discountPct,
        minVolume,
        shortfallFee,
        score,
        tier,
    };
}

/**
 * Resolve a player counter-offer. The player asks for a better deal (deeper
 * discount + lower commitment); the supplier's response is gated on the
 * relationship. Returns the negotiation outcome.
 *
 * @param {Object} offer — current offer (from buildOpeningOffer)
 * @returns {{ result: 'improved'|'held'|'walked', offer: Object|null, message: string }}
 */
export function resolveCounter(offer) {
    const s = offer.score;
    const roll = Math.random();
    // Strong relationships almost always yield something; weak ones risk a walk.
    const concedeChance = 0.25 + s * 0.6;
    const walkChance    = Math.max(0, 0.22 - s * 0.28);

    if (roll < walkChance) {
        return {
            result: 'walked',
            offer: null,
            message: `"${offer.supplierName} here — I've bent as far as I can for an account at your level. The original terms stand, take them or leave them."`,
        };
    }
    if (roll < walkChance + concedeChance) {
        const improved = {
            ...offer,
            discountPct: round(Math.min(18, offer.discountPct + 2 + s * 2), 1),
            minVolume: round(Math.max(800, offer.minVolume - 100 - s * 100), 50),
            countered: true,
        };
        return {
            result: 'improved',
            offer: improved,
            message: `"For a partner like you, I can do ${improved.discountPct}% and drop the commitment to ${improved.minVolume.toLocaleString()} units. That's my best."`,
        };
    }
    return {
        result: 'held',
        offer: { ...offer, countered: true },
        message: `"I hear you, but the numbers are the numbers this quarter. Same terms — still a good deal."`,
    };
}

/**
 * Turn an accepted offer into an active contract stored on engine state.
 * @param {Object} offer
 * @param {number} chapterIndex — chapter the contract is active through
 */
export function contractFromOffer(offer, chapterIndex) {
    return {
        supplierId: offer.supplierId,
        supplierName: offer.supplierName,
        discountPct: offer.discountPct,
        minVolume: offer.minVolume,
        shortfallFee: offer.shortfallFee,
        activeThroughChapter: chapterIndex,
        quartersHonoured: 0,
        quartersMissed: 0,
    };
}

/**
 * Evaluate a contract against the quarter being processed. Called from the
 * engine before cost math when a contract is active for the chosen supplier.
 * @returns {{ costFactor, fee, honoured, note }}
 */
export function evaluateContract(contract, supplierId, orderQuantity) {
    if (!contract || contract.supplierId !== supplierId) {
        return { costFactor: 1, fee: 0, honoured: null, note: null };
    }
    if (orderQuantity >= contract.minVolume) {
        contract.quartersHonoured += 1;
        return {
            costFactor: 1 - contract.discountPct / 100,
            fee: 0,
            honoured: true,
            note: `Contract honoured — ${contract.discountPct}% off from ${contract.supplierName} (${orderQuantity.toLocaleString()} ≥ ${contract.minVolume.toLocaleString()} committed).`,
        };
    }
    contract.quartersMissed += 1;
    return {
        costFactor: 1,
        fee: contract.shortfallFee,
        honoured: false,
        note: `Volume shortfall — you ordered ${orderQuantity.toLocaleString()} against a ${contract.minVolume.toLocaleString()}-unit commitment. Discount voided and a ${contract.shortfallFee.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })} shortfall fee applies.`,
    };
}
