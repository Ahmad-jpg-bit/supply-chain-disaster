export const SCENARIOS = [
    {
        id: 'bullwhip_surge',
        title: 'The Bullwhip Surge',
        text: 'A viral social media trend has caused a sudden spike in demand for your product category. Retailers are panic-ordering 3x their usual volume.',
        options: [
            {
                label: 'Expedite Production (Aggressive)',
                outcomeText: 'You paid a premium for air freight. Stock arrived fast, but margins took a hit.',
                modifiers: {
                    leadTime: -2,
                    unitCost: 1.5,
                    customerSatisfaction: 0 // +10 in logic
                }
            },
            {
                label: 'Stick to Forecast (Conservative)',
                outcomeText: 'You saved money, but retailers are furious about the stockouts.',
                modifiers: {
                    leadTime: 0,
                    unitCost: 1.0,
                    customerSatisfaction: -20
                }
            },
            {
                label: 'Balanced Increase (Moderate)',
                outcomeText: 'A safe middle ground. You missed some sales but kept costs under control.',
                modifiers: {
                    leadTime: 0,
                    unitCost: 1.1,
                    customerSatisfaction: 5
                }
            }
        ]
    },
    {
        id: 'port_strike_warning',
        title: 'Port Strike Rumors',
        text: 'Dockworkers at your main entry port are threatening to strike next month. Logistics could be paralyzed.',
        options: [
            {
                label: 'Pre-order Inventory (Stockpile)',
                outcomeText: 'You have plenty of stock, but warehousing costs are piling up.',
                modifiers: {
                    leadTime: 0,
                    unitCost: 1.2, // Storage costs equivalent
                    customerSatisfaction: 5
                }
            },
            {
                label: 'Reroute Shipments (Logistics Shift)',
                outcomeText: 'Your goods are taking a longer route. Lead times have increased significantly.',
                modifiers: {
                    leadTime: 4, // +4 weeks
                    unitCost: 1.3,
                    customerSatisfaction: 0
                }
            },
            {
                label: 'Do Nothing (Risk It)',
                outcomeText: 'The strike happened! You are stuck with zero incoming stock for weeks.',
                modifiers: {
                    leadTime: 8,
                    unitCost: 1.0,
                    customerSatisfaction: -30
                }
            }
        ]
    },
    {
        id: 'supplier_insolvency',
        title: 'Supplier Insolvency',
        text: 'Your key component supplier has filed for bankruptcy. Production is halted until you find a source.',
        options: [
            {
                label: 'Buy Competitor Stock (Spot Market)',
                outcomeText: 'You secured parts immediately, but at a massive markup.',
                modifiers: {
                    leadTime: 0,
                    unitCost: 2.0, // Double cost
                    customerSatisfaction: 10
                }
            },
            {
                label: 'Vet New Supplier (Due Diligence)',
                outcomeText: 'It took time to find a partner. You missed a whole cycle of sales.',
                modifiers: {
                    leadTime: 12,
                    unitCost: 0.9, // Cheaper long term
                    customerSatisfaction: -10
                }
            },
            {
                label: 'Internal Workaround (Retooling)',
                outcomeText: 'You modified the product to use generic parts. Quality (and satisfaction) dipped.',
                modifiers: {
                    leadTime: 2,
                    unitCost: 1.1,
                    customerSatisfaction: -15
                }
            }
        ]
    }
];
