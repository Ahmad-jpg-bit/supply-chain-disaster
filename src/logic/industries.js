export const INDUSTRIES = {
    ELECTRONICS: {
        id: 'electronics',
        name: 'Consumer Electronics',
        description: 'High risk, high reward. Products become obsolete quickly.',
        metrics: {
            initialCapital: 1000000,
            baseMargin: 0.35,
            demandvolatility: 0.25,
            leadTimeWeeks: 12,
            inventoryHoldingCost: 0.15,
            obsolescenceRisk: 0.10
        },
        difficulty: 'Hard'
    },
    FMCG: {
        id: 'fmcg',
        name: 'Fast-Moving Consumer Goods',
        description: 'High volume, low margin. Efficiency is key.',
        metrics: {
            initialCapital: 500000,
            baseMargin: 0.15,
            demandvolatility: 0.05,
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
            baseMargin: 0.60,
            demandvolatility: 0.10,
            leadTimeWeeks: 26,
            inventoryHoldingCost: 0.25,
            obsolescenceRisk: 0.02
        },
        difficulty: 'Medium'
    }
};
