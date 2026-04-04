// 8 expansion scenarios: 4 per expansion chapter (turns 33–40)
// Focus: Global crisis management and multi-regional network design.
// Each scenario marked expansionOnly: true.

export const EXPANSION_CHAPTER_SCENARIOS = {

    // ===== CHAPTER 9: Global Crisis Management (turns 33–36) =====
    global_crisis_management: [
        {
            id: 'port_strike',
            title: 'Port Strike — Rotterdam Closed',
            text: "Dockworkers at the Port of Rotterdam — Europe's largest — have gone on strike with no end in sight. Three weeks of your inbound shipments are stuck. Alternative ports (Hamburg, Antwerp) are at capacity. How do you respond?",
            highlightNode: 'ship',
            expansionOnly: true,
            options: [
                {
                    label: 'Activate Emergency Air Freight',
                    outcomeText: 'You chartered air freight for critical stock. Costs surged, but you maintained supply continuity and kept customers satisfied. Crisis resolved — at a premium.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: -1, unitCost: 1.45, customerSatisfaction: 8 }
                },
                {
                    label: 'Reroute via Hamburg + Inland Rail',
                    outcomeText: 'You rerouted through Hamburg and used rail to bridge the gap. Transit added 10 days but costs stayed manageable. Smart contingency execution.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.2, customerSatisfaction: 0 }
                },
                {
                    label: 'Wait for Strike to End',
                    outcomeText: 'You chose to wait. The strike lasted 3 weeks. By the time goods cleared, you had stockouts, missed sales, and unhappy customers. Patience was not a strategy.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 4, unitCost: 1.0, customerSatisfaction: -20 }
                }
            ]
        },
        {
            id: 'fuel_price_surge',
            title: 'Fuel Price Surge — Brent Crude +42%',
            text: 'Geopolitical tensions have driven Brent crude oil up 42% in 6 weeks. Shipping carriers are applying emergency bunker fuel surcharges of $800–$2,000 per container. Your freight contracts have no price cap. How do you adapt?',
            highlightNode: 'truck',
            expansionOnly: true,
            options: [
                {
                    label: 'Negotiate a Fuel-Hedged Long-Term Contract',
                    outcomeText: 'You locked in a 12-month freight rate with a fuel hedge clause. Costs rose 15% now but you are protected from further surges. Strategic foresight pays off.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: 5 }
                },
                {
                    label: 'Shift High-Volume Lanes to Sea + Rail Intermodal',
                    outcomeText: 'You switched to sea + rail intermodal, cutting fuel exposure by 30%. Lead times grew slightly, but the cost savings were significant and sustainable.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.1, customerSatisfaction: 0 }
                },
                {
                    label: 'Pass the Surcharge to Customers',
                    outcomeText: 'You raised prices to cover the fuel surcharge. Short-term margins held, but 18% of your customers switched to competitors who absorbed the cost. Market share eroded.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -15 }
                }
            ]
        },
        {
            id: 'red_sea_rerouting',
            title: 'Red Sea Crisis — Primary Route Disrupted',
            text: 'Attacks on commercial shipping in the Red Sea have forced your primary carrier to suspend all Suez Canal transits. The Cape of Good Hope reroute adds 10–14 days and $2,000 per container. You have 45 days of stock remaining. What do you do?',
            highlightNode: 'ship',
            expansionOnly: true,
            options: [
                {
                    label: 'Reroute via Cape + Accelerate Production',
                    outcomeText: 'You accepted the longer route and asked your supplier to start production immediately. By offsetting lead time with earlier ordering, you maintained supply with minimal stockouts.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.25, customerSatisfaction: 5 }
                },
                {
                    label: 'Split: Air Freight Critical SKUs, Sea for Bulk',
                    outcomeText: 'You flew high-margin, low-volume items and routed bulk via Cape. Costs were elevated but targeted. A pragmatic multi-modal response to an uncontrollable disruption.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.35, customerSatisfaction: 3 }
                },
                {
                    label: 'Attempt the Disrupted Route (Accept Risk)',
                    outcomeText: 'Your carrier refused. You scrambled for a last-minute alternative, paying spot rates 60% above contract. Poor risk management under pressure compounded the disruption.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 3, unitCost: 1.6, customerSatisfaction: -10 }
                }
            ]
        },
        {
            id: 'customs_delay_crisis',
            title: 'Regulatory Shock — New Customs Requirements',
            text: 'Your largest import market has introduced new product certification requirements effective immediately, with no transition period. 40% of your inbound shipments are held at customs pending documentation review. How do you respond?',
            highlightNode: 'warehouse',
            expansionOnly: true,
            options: [
                {
                    label: 'Engage Customs Broker + Expedite Documentation',
                    outcomeText: 'A specialist customs broker cleared the backlog in 8 days. The fee was substantial, but you minimized stockouts and maintained retailer relationships.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.18, customerSatisfaction: 3 }
                },
                {
                    label: 'Prioritize Fast-Moving SKUs Only',
                    outcomeText: 'You fast-tracked certification for your top 20% of SKUs and accepted delays on the rest. Focused execution kept revenue flowing while the full resolution took longer.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.1, customerSatisfaction: -5 }
                },
                {
                    label: 'Challenge the Decision with Legal Action',
                    outcomeText: 'Legal proceedings took 3 months. Meanwhile, goods sat in customs and competitors filled your shelf space. The legal approach solved the principle — not the business problem.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 5, unitCost: 1.3, customerSatisfaction: -20 }
                }
            ]
        }
    ],

    // ===== CHAPTER 10: Multi-Regional Logistics Networks (turns 37–40) =====
    multi_regional_networks: [
        {
            id: 'nearshoring_decision',
            title: 'Nearshoring: Regional Factory or Stay Offshore?',
            text: 'Labour costs have risen 25% in your primary offshore manufacturing country over 3 years. A nearshore facility would cost 35% more per unit but cut lead times from 12 weeks to 3 weeks. Your competitors are debating the same move. Do you nearshore?',
            highlightNode: 'factory',
            expansionOnly: true,
            options: [
                {
                    label: 'Dual-Shore: Offshore Base + Nearshore Flex Capacity',
                    outcomeText: 'You built a nearshore flex factory for 30% of volume. Offshore handles base load cheaply; nearshore handles surges quickly. The dual model delivered cost efficiency and speed when it mattered.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: -1, unitCost: 1.12, customerSatisfaction: 10 }
                },
                {
                    label: 'Full Nearshore Transition',
                    outcomeText: 'You moved all production nearshore. Lead times dropped dramatically and customers noticed. The 35% cost premium was offset by lower safety stock requirements and far better responsiveness.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: -3, unitCost: 1.35, customerSatisfaction: 8 }
                },
                {
                    label: 'Stay Offshore — Optimise Forecasting Instead',
                    outcomeText: 'You kept offshore production and focused on better demand forecasting. Cost stayed low but you remained exposed to long-haul disruptions and rising fuel costs. A pragmatic short-term choice.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 2, unitCost: 0.9, customerSatisfaction: -5 }
                }
            ]
        },
        {
            id: 'regional_hub_design',
            title: 'Regional Hub: Build or Partner with a 3PL?',
            text: 'Expanding into Southeast Asia requires a regional distribution hub to serve 6 markets efficiently. Option A: Build your own warehouse (18-month lead time, $4M capex). Option B: Partner with a 3PL already operating in the region. How do you establish your hub?',
            highlightNode: 'warehouse',
            expansionOnly: true,
            options: [
                {
                    label: 'Partner with 3PL for Immediate Launch',
                    outcomeText: 'The 3PL got you operational in 8 weeks. Higher per-unit cost, but zero capex and you validated demand before committing. A textbook asset-light market entry.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: -2, unitCost: 1.2, customerSatisfaction: 10 }
                },
                {
                    label: 'Build Your Own Hub (Long-Term Control)',
                    outcomeText: 'You began construction. 18 months later you had a state-of-the-art facility with full data and process control. The wait was painful but the long-term economics are superior.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 3, unitCost: 1.3, customerSatisfaction: -5 }
                },
                {
                    label: 'Serve Region from Existing Offshore Warehouse',
                    outcomeText: 'You tried to serve 6 new markets from a single distant warehouse. Transit costs were 40% higher than local distribution and customers complained about 3-week windows. Expansion stalled.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 4, unitCost: 1.4, customerSatisfaction: -15 }
                }
            ]
        },
        {
            id: 'customs_automation',
            title: 'Cross-Border Customs Automation',
            text: 'Your cross-border shipments face 2–5 day clearance delays due to manual documentation. A digital customs platform promises automated HS code classification, pre-clearance filing, and real-time tracking — cutting clearance to under 12 hours. Do you invest?',
            highlightNode: 'truck',
            expansionOnly: true,
            options: [
                {
                    label: 'Deploy Automation Across All Lanes',
                    outcomeText: 'Full automation cut clearance delays by 85%. The time savings compounded across hundreds of shipments annually — effectively adding 3–5 days of free lead time to every international order.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: -2, unitCost: 1.08, customerSatisfaction: 12 }
                },
                {
                    label: 'Pilot on High-Volume Lanes Only',
                    outcomeText: 'You piloted automation on your 3 busiest lanes and saw strong results. Expansion will take time, but you validated ROI and built internal expertise before committing.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: -1, unitCost: 1.05, customerSatisfaction: 5 }
                },
                {
                    label: 'Keep Manual Process — Lower Short-Term Cost',
                    outcomeText: 'You skipped the investment. Clearance delays continued, and a new regulatory update created a backlog that took 3 weeks to clear. The cost of inaction exceeded the cost of automation.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 3, unitCost: 1.0, customerSatisfaction: -10 }
                }
            ]
        },
        {
            id: 'last_mile_innovation',
            title: 'Last-Mile Innovation: Lockers, Crowd-Delivery, or Drones?',
            text: 'Last-mile delivery represents 53% of your total logistics cost. Three pilot programs have been shortlisted: smart pickup lockers at transit hubs, crowd-sourced delivery via gig workers, and autonomous drone delivery for dense urban zones. Which do you scale?',
            highlightNode: 'store',
            expansionOnly: true,
            options: [
                {
                    label: 'Smart Pickup Lockers — Proven and Scalable',
                    outcomeText: 'Lockers reduced failed deliveries by 70% and cut last-mile cost by 22%. Customers adapted quickly. The low-tech solution outperformed the flashier alternatives on unit economics and reliability.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: -1, unitCost: 0.9, customerSatisfaction: 12 }
                },
                {
                    label: 'Crowd-Sourced Delivery Network',
                    outcomeText: 'The gig network scaled fast and cut costs by 18% in dense areas. Quality varied — some handling complaints — but net satisfaction improved with better partner onboarding.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: -1, unitCost: 0.92, customerSatisfaction: 5 }
                },
                {
                    label: 'Drone Delivery (Innovation-First)',
                    outcomeText: 'The drone pilot was technically impressive but regulatory approvals, weather limitations, and payload restrictions kept unit economics negative. Too early for scale — a costly proof of concept.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.25, customerSatisfaction: 3 }
                }
            ]
        }
    ]
};
