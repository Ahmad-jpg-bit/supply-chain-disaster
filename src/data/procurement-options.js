// Procurement decision options for the expanded decision panel

export const SUPPLIERS = {
    electronics: [
        {
            id: 'budget',
            name: 'ValueTech Components',
            tier: 'Budget',
            costMultiplier: 0.7,
            defectRate: 0.12,
            leadTimeModifier: 2,
            description: 'Low cost, higher defect rates, longer lead times'
        },
        {
            id: 'standard',
            name: 'ReliaParts Inc.',
            tier: 'Standard',
            costMultiplier: 1.0,
            defectRate: 0.05,
            leadTimeModifier: 0,
            description: 'Balanced cost, quality, and reliability'
        },
        {
            id: 'premium',
            name: 'PrecisionCore Ltd.',
            tier: 'Premium',
            costMultiplier: 1.4,
            defectRate: 0.01,
            leadTimeModifier: -1,
            description: 'Top quality, minimal defects, fast delivery'
        }
    ],
    fmcg: [
        {
            id: 'budget',
            name: 'BulkBasics Co.',
            tier: 'Budget',
            costMultiplier: 0.75,
            defectRate: 0.10,
            leadTimeModifier: 1,
            description: 'Cheap bulk materials, variable quality'
        },
        {
            id: 'standard',
            name: 'SteadySupply Ltd.',
            tier: 'Standard',
            costMultiplier: 1.0,
            defectRate: 0.04,
            leadTimeModifier: 0,
            description: 'Consistent quality and dependable delivery'
        },
        {
            id: 'premium',
            name: 'PureSource Organics',
            tier: 'Premium',
            costMultiplier: 1.35,
            defectRate: 0.01,
            leadTimeModifier: -1,
            description: 'Premium ingredients, near-zero defects'
        }
    ],
    pharma: [
        {
            id: 'budget',
            name: 'GeneriChem Labs',
            tier: 'Budget',
            costMultiplier: 0.65,
            defectRate: 0.08,
            leadTimeModifier: 3,
            description: 'Lower cost APIs, longer qualification times'
        },
        {
            id: 'standard',
            name: 'MedGrade Supply',
            tier: 'Standard',
            costMultiplier: 1.0,
            defectRate: 0.03,
            leadTimeModifier: 0,
            description: 'GMP-certified, reliable supply chain'
        },
        {
            id: 'premium',
            name: 'PharmaPure International',
            tier: 'Premium',
            costMultiplier: 1.5,
            defectRate: 0.005,
            leadTimeModifier: -2,
            description: 'Highest purity, priority manufacturing slots'
        }
    ]
};

export const SHIPPING_METHODS = [
    {
        id: 'charter',
        name: 'Emergency Charter Flight',
        costPerUnit: 35,
        leadTimeModifier: -4,
        description: '$35/unit, 4 weeks faster — crisis response'
    },
    {
        id: 'express',
        name: 'Express Air Freight',
        costPerUnit: 15,
        leadTimeModifier: -2,
        description: '$15/unit, 2 weeks faster'
    },
    {
        id: 'standard',
        name: 'Standard Shipping',
        costPerUnit: 8,
        leadTimeModifier: 0,
        description: '$8/unit, normal transit'
    },
    {
        id: 'economy',
        name: 'Economy Sea Freight',
        costPerUnit: 3,
        leadTimeModifier: 2,
        description: '$3/unit, 2 weeks slower'
    },
    {
        id: 'intermodal',
        name: 'Sea + Rail Intermodal',
        costPerUnit: 2,
        leadTimeModifier: 3,
        description: '$2/unit, 3 weeks slower — maximum cost savings'
    }
];

export const PRICING_STRATEGIES = [
    {
        id: 'premium',
        name: 'Premium Pricing',
        priceMultiplier: 1.2,
        demandMultiplier: 0.8,
        description: '20% higher price, 20% less demand'
    },
    {
        id: 'standard',
        name: 'Market Price',
        priceMultiplier: 1.0,
        demandMultiplier: 1.0,
        description: 'Standard price and demand'
    },
    {
        id: 'discount',
        name: 'Discount Strategy',
        priceMultiplier: 0.8,
        demandMultiplier: 1.3,
        description: '20% lower price, 30% more demand'
    }
];

export const QUALITY_INSPECTIONS = [
    {
        id: 'none',
        name: 'No Inspection',
        costPerUnit: 0,
        defectCatchRate: 0,
        description: '$0/unit, defects pass through'
    },
    {
        id: 'standard',
        name: 'Standard QC',
        costPerUnit: 2,
        defectCatchRate: 0.70,
        description: '$2/unit, catches 70% of defects'
    },
    {
        id: 'rigorous',
        name: 'Rigorous Inspection',
        costPerUnit: 5,
        defectCatchRate: 0.95,
        description: '$5/unit, catches 95% of defects'
    }
];
