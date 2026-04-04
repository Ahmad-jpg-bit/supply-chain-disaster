/**
 * CSCP (Certified Supply Chain Professional) concept definitions.
 * One key term per chapter, mapped by chapter ID.
 *
 * Each entry aligns with the APICS CSCP exam domains:
 *   SCD  — Supply Chain Design
 *   SCPE — Supply Chain Planning & Execution
 *   SCIBP — Supply Chain Improvement & Best Practices
 */

export const CSCP_DEFINITIONS = {

    // Chapter 1 — Demand Forecasting & Inventory Basics
    demand_forecasting: {
        term:       'Mean Absolute Percentage Error (MAPE)',
        domain:     'SCPE',
        domainFull: 'Supply Chain Planning & Execution',
        definition:
            'MAPE measures forecast accuracy as the average absolute percentage difference between forecasted and actual demand. A lower MAPE indicates a more accurate forecast. It is the most widely used metric for comparing forecast performance across products and time periods.',
        whyItMatters:
            'Every inventory and procurement decision is downstream of your forecast. A 20% MAPE means 1 in 5 units is either excess stock tying up cash or a stockout costing you revenue. CSCP candidates must understand how MAPE, MAD, and bias work together to diagnose forecasting problems.',
        examTip:
            'MAPE = (Σ |Actual − Forecast| / Actual) × 100 ÷ n. On the exam, watch for questions that contrast MAPE (percentage-based, good for cross-product comparison) with MAD (absolute units, good for reorder point calculations).',
        memoryHook: 'Think of MAPE as your "miss rate" — the higher it is, the more often your forecast is embarrassingly wrong.',
    },

    // Chapter 2 — The Bullwhip Effect
    bullwhip_effect: {
        term:       'Bullwhip Effect',
        domain:     'SCPE',
        domainFull: 'Supply Chain Planning & Execution',
        definition:
            'The Bullwhip Effect is the phenomenon where small fluctuations in end-customer demand cause increasingly large swings in orders as they travel upstream through the supply chain. It was first described by Procter & Gamble studying their Pampers supply chain and formally modelled by Hau Lee at Stanford.',
        whyItMatters:
            'It is one of the most tested concepts on the CSCP exam. The four primary causes — demand signal processing, rationing and shortage gaming, order batching, and price fluctuations — each have specific countermeasures. Understanding them lets you diagnose real supply chain instability.',
        examTip:
            'Remember the four causes with the acronym DROP: Demand signal processing, Rationing gaming, Order batching, Price promotions. The primary cure for all four is information sharing — VMI, EDI, and collaborative forecasting (CPFR) all reduce Bullwhip.',
        memoryHook: 'A small flick of the wrist at the retail end becomes a violent crack at the factory end. The further upstream, the louder the crack.',
    },

    // Chapter 3 — JIT & Safety Stock
    jit_safety_stock: {
        term:       'Reorder Point (ROP) & Safety Stock',
        domain:     'SCPE',
        domainFull: 'Supply Chain Planning & Execution',
        definition:
            'The Reorder Point is the inventory level at which a new order must be placed to avoid a stockout during lead time. Safety Stock is the buffer inventory held above the ROP to absorb variability in demand or lead time. ROP = (Average Daily Demand × Lead Time) + Safety Stock.',
        whyItMatters:
            'ROP and safety stock calculations are guaranteed to appear on the CSCP exam with numerical questions. They bridge JIT philosophy (minimize inventory) with operational reality (variability exists). Getting these wrong in practice means either stockouts or millions in excess inventory.',
        examTip:
            'Safety Stock = Z × σ_LTD, where Z is the service-level z-score and σ_LTD is the standard deviation of demand during lead time. A 95% service level uses Z = 1.65; 99% uses Z = 2.33. Know these z-scores by heart.',
        memoryHook: 'ROP is your "order now" alarm. Safety stock is the snooze button that keeps you running if the alarm goes off late.',
    },

    // Chapter 4 — Risk Management & Supply Disruption
    risk_management: {
        term:       'Supply Chain Risk Management (SCRM)',
        domain:     'SCD',
        domainFull: 'Supply Chain Design',
        definition:
            'SCRM is the systematic identification, assessment, and mitigation of risks that could disrupt supply chain operations. It encompasses supply risk, demand risk, operational risk, and security risk. Key strategies include dual sourcing, geographic diversification, buffer stock, and business continuity planning (BCP).',
        whyItMatters:
            'Post-COVID, SCRM has become the most strategically important area in supply chain management. The CSCP exam tests both the framework (identify → assess → mitigate → monitor) and specific mitigation strategies. Expect scenario-based questions asking which SCRM response is most appropriate.',
        examTip:
            'APICS distinguishes between risk mitigation (reducing probability) and risk contingency (reducing impact). Dual-sourcing is mitigation; safety stock is contingency. On the exam, identify which type the question is asking for before selecting your answer.',
        memoryHook: 'SCRM is like insurance — you pay a premium every day (dual sourcing, safety stock) so that when disaster hits, you don\'t go bankrupt.',
    },

    // Chapter 5 — Total Cost of Ownership & Strategy
    total_cost_strategy: {
        term:       'Total Cost of Ownership (TCO)',
        domain:     'SCD',
        domainFull: 'Supply Chain Design',
        definition:
            'TCO is the complete cost of procuring, operating, and retiring an asset or supplier relationship over its full lifecycle. It includes purchase price, transportation, quality failures, inventory holding, warranty, compliance, and end-of-life disposal — often revealing that the cheapest unit price is not the lowest total cost.',
        whyItMatters:
            'TCO is a foundational sourcing framework tested heavily in the CSCP Supply Chain Design domain. It explains why companies pay premium supplier prices, why reshoring makes financial sense despite higher wages, and why quality failures are always more expensive than prevention.',
        examTip:
            'The CSCP exam often presents a TCO question as a comparison between two suppliers with different unit prices, lead times, and defect rates. Always calculate total annual cost including quality costs and holding costs — not just the per-unit price.',
        memoryHook: 'TCO = "true cost of ownership." The sticker price is the tip of the iceberg. The $3 billion Samsung Note 7 recall made that painfully clear.',
    },

    // Chapter 6 — Logistics & Transportation
    logistics_transportation: {
        term:       'Intermodal Transportation',
        domain:     'SCPE',
        domainFull: 'Supply Chain Planning & Execution',
        definition:
            'Intermodal transportation is the use of two or more different transport modes (e.g., ship + rail + truck) in a single, seamless journey using standardised containers. It optimises cost, speed, and carbon footprint by assigning each leg to the most efficient mode. The ISO container is the enabler that made global intermodal possible.',
        whyItMatters:
            'The CSCP exam tests modal selection logic: air (fast/expensive), ocean (slow/cheap), rail (medium cost, good for land corridors), and truck (last-mile flexibility). Understanding how to build an intermodal solution and its trade-offs is core to the logistics domain.',
        examTip:
            'Remember the modal hierarchy by cost per tonne-km: Air > Truck > Rail > Ocean > Pipeline. Speed is roughly the inverse. On exam questions about time-sensitive, high-value goods — think air or expedited truck. Bulk commodities — ocean or rail.',
        memoryHook: 'One container, many modes. The humble 40-foot steel box is the reason global trade is possible — it fits on a ship, a train, and a truck without unpacking.',
    },

    // Chapter 7 — Quality Management
    quality_management: {
        term:       'Cost of Quality (COQ)',
        domain:     'SCIBP',
        domainFull: 'Supply Chain Improvement & Best Practices',
        definition:
            'Cost of Quality is the total cost incurred to achieve and maintain product quality. It has four components: Prevention Costs (training, process design), Appraisal Costs (inspection, testing), Internal Failure Costs (scrap, rework before delivery), and External Failure Costs (returns, recalls, warranty, lost customers). The goal is to invest in prevention to avoid the far greater costs of failure.',
        whyItMatters:
            'APICS uses COQ to demonstrate that quality is a strategic investment, not a cost centre. The classic ratio is 1:10:100 — $1 in prevention saves $10 in appraisal and $100 in failure. The CSCP exam frequently tests whether candidates can classify a quality cost into the correct category.',
        examTip:
            'For exam questions, use the PAIF mnemonic: Prevention, Appraisal, Internal failure, External failure. External failure is always the most expensive and the one that damages brand equity. Internal failure is cheaper but still wasteful. Prevention is always the correct strategic focus.',
        memoryHook: 'Think of COQ as a quality iceberg: appraisal and prevention are visible above water; internal and external failures are the massive hidden mass that sinks companies.',
    },

    // Chapter 8 — Sustainability & Circular Economy
    sustainability_circular: {
        term:       'Reverse Logistics & Circular Economy',
        domain:     'SCIBP',
        domainFull: 'Supply Chain Improvement & Best Practices',
        definition:
            'Reverse Logistics is the process of moving goods from end-consumer back through the supply chain for return, repair, remanufacturing, recycling, or disposal. The Circular Economy extends this into a design philosophy: products are designed from the outset to be recovered, refurbished, and re-entered into the supply chain — eliminating the concept of "waste."',
        whyItMatters:
            'Reverse logistics is a growing CSCP exam topic as sustainability becomes a strategic imperative. Extended Producer Responsibility (EPR) laws now mandate reverse logistics programs in the EU, UK, and many US states. Brands that design for circularity reduce raw material exposure and regulatory risk.',
        examTip:
            'The CSCP exam distinguishes between returns management (reactive — handling customer returns), repair/refurbishment (value recovery), and end-of-life recycling (material recovery). Know which generates the most value: remanufacturing typically recovers 85% of original value vs. 15% for raw material recycling.',
        memoryHook: 'Linear economy: Take → Make → Dispose. Circular economy: Take → Make → Recover → Repeat. The future of supply chain runs in a loop, not a line.',
    },

    // Chapter 9 — Global Crisis Management (Expansion)
    global_crisis_management: {
        term:       'Business Continuity Planning (BCP)',
        domain:     'SCD',
        domainFull: 'Supply Chain Design',
        definition:
            'Business Continuity Planning is the process of creating systems and procedures to ensure that critical supply chain functions can continue or rapidly recover during and after a major disruption. A BCP includes risk identification, impact analysis, recovery strategies, and regular simulation exercises (tabletop drills).',
        whyItMatters:
            'Post-COVID and post-Red Sea crisis, BCP is now a Board-level strategic priority. CSCP candidates must understand the relationship between BCP, SCRM, and resilience design. Regulators in pharma, food, and defence now require documented BCPs. It is also tested in the CSCP exam under Supply Chain Design.',
        examTip:
            'Know the four BCP recovery metrics: RTO (Recovery Time Objective — how fast you must recover), RPO (Recovery Point Objective — how much data/inventory loss is tolerable), MTD (Maximum Tolerable Downtime), and WRT (Work Recovery Time). These are frequently tested with scenario questions.',
        memoryHook: 'BCP is the fire drill you run before the fire. Companies without one discover their plan on the worst possible day.',
    },

    // Chapter 10 — Multi-Regional Logistics Networks (Expansion)
    multi_regional_networks: {
        term:       'Network Design & Nearshoring',
        domain:     'SCD',
        domainFull: 'Supply Chain Design',
        definition:
            'Supply Chain Network Design is the strategic process of determining the optimal number, location, and capacity of facilities (suppliers, factories, DCs, ports) to minimise total cost while meeting service level requirements. Nearshoring is a network design decision to relocate production or sourcing closer to the end market to reduce lead time, risk, and tariff exposure — at the cost of higher per-unit production cost.',
        whyItMatters:
            'Network design is one of the highest-impact and highest-difficulty topics in the CSCP exam. It integrates cost modelling, risk management, and service level strategy. The nearshoring megatrend (driven by geopolitics, COVID, and ESG) means this concept is more exam-relevant than ever.',
        examTip:
            'Network design questions on the CSCP exam typically involve trade-offs between number of facilities (more = higher fixed cost, lower transport cost, lower lead time) vs fewer facilities (lower fixed cost, higher transport, higher lead time). Use the centre-of-gravity method concept for location questions.',
        memoryHook: 'Nearshoring trades unit cost for resilience and speed. Ask: "What is one day of lead time worth to my customer?" The answer usually justifies paying more per unit.',
    },
};
