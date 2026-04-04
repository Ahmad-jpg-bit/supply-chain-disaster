// Expansion Bundle chapters (9–10), turns 33–40
// Only accessible to users with the Expansion Bundle tier.

export const EXPANSION_CHAPTERS = [
    {
        id: 'global_crisis_management',
        number: 9,
        title: 'Global Crisis Management',
        icon: 'warning',
        description: 'Port strikes, fuel surges, geopolitical rerouting — global crises test every assumption about your supply chain. When the world turns upside down, your contingency plans define whether you survive.',
        keyPoints: [
            'Port strikes can freeze entire trade lanes within 24 hours',
            'Fuel surcharges can double shipping costs overnight',
            'Geopolitical disruptions require fast alternative corridor decisions',
            'Crisis contingency plans must be built before the crisis hits'
        ],
        realWorldExample: {
            electronics: 'The 2021 Ever Given blockage halted $9.6 billion of daily trade through the Suez Canal for 6 days. Tech companies had semiconductors and displays stuck in containers. Those with dual-route plans rerouted via Cape of Good Hope within hours; others waited weeks.',
            fmcg: 'The 2023 Red Sea attacks by Houthi forces forced Maersk and CMA CGM to suspend Suez Canal routes. Consumer goods companies scrambled as transit times from Asia to Europe ballooned from 28 to 45 days. Nestlé activated emergency replenishment plans and air-freighted critical SKUs.',
            pharma: 'A 2024 Djibouti port strike disrupted pharmaceutical cold-chain shipments from Indian API manufacturers. Companies with charter air freight contracts maintained supply; others faced potential drug shortages in African and European markets.'
        },
        turnsRange: [33, 36],
        activeNodes: ['ship', 'warehouse', 'truck'],
        expansionOnly: true
    },
    {
        id: 'multi_regional_networks',
        number: 10,
        title: 'Multi-Regional Logistics Networks',
        icon: 'globe',
        description: 'The era of single-factory, single-country supply chains is ending. Building multi-regional networks — nearshoring, friend-shoring, distributed hubs — is how leading companies future-proof their operations.',
        keyPoints: [
            'Nearshoring reduces lead times but increases per-unit costs',
            'Regional distribution hubs cut last-mile costs by up to 40%',
            'Customs automation is critical for cross-border speed',
            'Multi-regional networks require real-time end-to-end visibility'
        ],
        realWorldExample: {
            electronics: 'Apple began manufacturing iPhones in India and Brazil alongside China. Each regional factory serves local and nearby markets, reducing tariff exposure and transit times. The multi-regional model cost 8% more but cut geopolitical concentration risk dramatically.',
            fmcg: 'Unilever operates 302 manufacturing sites in 69 countries with regional distribution hubs designed around local demand patterns. Their Connected Distribution network uses AI to optimize inter-hub transfers in real time, reducing total logistics costs by 12%.',
            pharma: "Pfizer's COVID vaccine distribution used a 3-tier network: global manufacturing hubs, regional distribution centers, and local last-mile partners. This design allowed simultaneous delivery to 91 countries within 90 days of approval — unprecedented in pharmaceutical logistics."
        },
        turnsRange: [37, 40],
        activeNodes: ['supplier', 'factory', 'warehouse', 'truck', 'store'],
        expansionOnly: true
    }
];
