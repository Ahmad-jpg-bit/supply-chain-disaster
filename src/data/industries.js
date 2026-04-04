export const INDUSTRIES = {
    ELECTRONICS: {
        id: 'electronics',
        name: 'Consumer Electronics',
        description: 'High risk, high reward. Products become obsolete quickly.',
        metrics: {
            initialCapital: 1000000,
            baseMargin: 0.35, // 35% margin
            demandvolatility: 0.25, // High variance
            leadTimeWeeks: 12,
            inventoryHoldingCost: 0.15, // 15% per annum
            obsolescenceRisk: 0.10 // 10% chance of stock becoming worthless per quarter
        },
        difficulty: 'Hard'
    },
    FMCG: {
        id: 'fmcg',
        name: 'Fast-Moving Consumer Goods',
        description: 'High volume, low margin. Efficiency is key.',
        metrics: {
            initialCapital: 500000,
            baseMargin: 0.15, // 15% margin
            demandvolatility: 0.05, // Low variance
            leadTimeWeeks: 4,
            inventoryHoldingCost: 0.05,
            obsolescenceRisk: 0.01
        },
        difficulty: 'Easy'
    },
    PHARMA: {
        id: 'pharma',
        name: 'Pharmaceuticals',
        description: 'Critical supplies, strict compliance, long lead times.',
        metrics: {
            initialCapital: 2000000,
            baseMargin: 0.60, // 60% margin
            demandvolatility: 0.10,
            leadTimeWeeks: 26, // 6 months
            inventoryHoldingCost: 0.25, // High storage requirements (cold chain)
            obsolescenceRisk: 0.02
        },
        difficulty: 'Medium'
    }
};
