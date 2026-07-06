/**
 * Board-meeting recall questions — one per chapter concept.
 *
 * Shown at the start of a chapter, asking about a concept from an EARLIER
 * chapter (spaced retrieval). Keyed by chapter id; each maps 1:1 to the
 * CSCP definition taught by that chapter's DefinitionCard.
 *
 * Shape: { concept, asker, question, options[3], correctIndex, explanation }
 */

export const RECALL_QUESTIONS = {

    demand_forecasting: {
        concept: 'MAPE',
        asker: 'CFO',
        question: 'Our forecast ran a 20% MAPE last year. What does that actually mean for operations?',
        options: [
            'On average, our forecast missed actual demand by 20% — roughly 1 in 5 units was excess stock or a stockout',
            'We lost 20% of revenue to forecasting software costs',
            'Demand grew 20% faster than we projected each quarter',
        ],
        correctIndex: 0,
        explanation: 'MAPE is the average absolute percentage gap between forecast and actual demand. A 20% MAPE means every fifth unit was planned wrong — either cash tied up in excess inventory or a missed sale.',
    },

    bullwhip_effect: {
        concept: 'Bullwhip Effect',
        asker: 'VP of Manufacturing',
        question: 'Retail demand only moved 5%, but our factory orders swung 40%. What is going on?',
        options: [
            'Our factory is simply overproducing to hit utilisation targets',
            'The bullwhip effect — small demand changes amplify upstream as each tier adds its own buffer',
            'Seasonal demand — the swing will cancel out next quarter',
        ],
        correctIndex: 1,
        explanation: 'That amplification is the bullwhip effect. Each tier reacts to orders (not real demand) and pads its own buffer, so a 5% retail flick becomes a 40% crack at the factory. The cure is sharing demand data downstream-to-upstream.',
    },

    jit_safety_stock: {
        concept: 'Reorder Point & Safety Stock',
        asker: 'Head of Inventory',
        question: 'Daily demand averages 100 units and lead time is 10 days. With 50 units of safety stock, where is our reorder point?',
        options: [
            '1,000 units — safety stock is separate from the reorder point',
            '150 units — daily demand plus safety stock',
            '1,050 units — (average demand × lead time) + safety stock',
        ],
        correctIndex: 2,
        explanation: 'ROP = (average demand × lead time) + safety stock = (100 × 10) + 50 = 1,050. Order when inventory hits that level and the replenishment lands just as the buffer is reached.',
    },

    risk_management: {
        concept: 'Supply Chain Risk Management',
        asker: 'Board Chair',
        question: 'Our sole supplier just filed for bankruptcy. Which SCRM practice would have limited this exposure?',
        options: [
            'Dual sourcing — qualifying a second supplier before the failure, trading some cost for resilience',
            'Negotiating a lower unit price in the original contract',
            'Carrying zero inventory so nothing is stranded with the supplier',
        ],
        correctIndex: 0,
        explanation: 'Single-source dependency is a classic SCRM failure. Dual sourcing costs more per unit in good times — that premium is the insurance you pay so one bankruptcy cannot stop your line.',
    },

    total_cost_strategy: {
        concept: 'Total Cost of Ownership',
        asker: 'CFO',
        question: 'Supplier B quotes 20% below Supplier A. Under TCO thinking, when is B still the wrong choice?',
        options: [
            'Never — the lowest unit price is by definition the lowest cost',
            'When B\'s defects, longer lead times, and inspection needs cost more than the 20% saved',
            'Only if B is in a different country than A',
        ],
        correctIndex: 1,
        explanation: 'TCO counts everything after the invoice: quality failures, expedited freight, inspection, carrying cost of longer lead times. A 20% cheaper unit price can easily carry 35–50% higher total cost.',
    },

    logistics_transportation: {
        concept: 'Intermodal Transportation',
        asker: 'Logistics Director',
        question: 'Why would we route freight sea-then-rail instead of trucking the whole lane?',
        options: [
            'Intermodal combines the cheapest mode per leg in one container — big cost savings for a modest time penalty',
            'Trucks cannot legally carry containerised freight across borders',
            'It is always faster than road on every lane',
        ],
        correctIndex: 0,
        explanation: 'Intermodal moves one container across ship, rail, and truck legs, using each mode where it is cheapest. You trade some speed and flexibility for dramatically lower cost per unit-mile.',
    },

    quality_management: {
        concept: 'Cost of Quality',
        asker: 'VP of Customer Experience',
        question: 'Defective units reached customers last quarter. In Cost of Quality terms, what did we just incur?',
        options: [
            'Prevention costs — money spent stopping defects before they occur',
            'Appraisal costs — money spent inspecting and testing product',
            'External failure costs — the most expensive category: returns, replacements, and lost trust',
        ],
        correctIndex: 2,
        explanation: 'COQ splits into prevention, appraisal, and internal/external failure. External failure — defects that reach the customer — is the costliest: returns, warranty claims, and reputational damage dwarf what inspection would have cost.',
    },

    sustainability_circular: {
        concept: 'Reverse Logistics',
        asker: 'Sustainability Officer',
        question: 'What distinguishes a circular supply chain from a traditional linear one?',
        options: [
            'It runs entirely on renewable energy',
            'Products flow back — returns, refurbishment, and recycling feed materials into new production instead of landfill',
            'It uses circular shipping routes to cut fuel burn',
        ],
        correctIndex: 1,
        explanation: 'Linear is take-make-dispose. Circular closes the loop with reverse logistics: returned and end-of-life products are recovered, refurbished, or recycled back into the chain — cutting both waste and raw material cost.',
    },

    global_crisis_management: {
        concept: 'Business Continuity Planning',
        asker: 'Board Chair',
        question: 'A canal blockage just froze our primary trade lane. What separates firms with real BCP from the rest?',
        options: [
            'They pre-identified alternate routes, suppliers, and decision triggers — the plan existed before the crisis',
            'They carry enough cash to wait out any disruption indefinitely',
            'They avoid international shipping altogether',
        ],
        correctIndex: 0,
        explanation: 'Business Continuity Planning is done before the disruption: mapped alternate lanes, pre-qualified backup suppliers, and thresholds that trigger the switch. In a crisis you execute a plan — you don\'t write one.',
    },

    multi_regional_networks: {
        concept: 'Nearshoring & Network Design',
        asker: 'Strategy Director',
        question: 'We are weighing moving production from Asia to Mexico. What is the core nearshoring trade-off?',
        options: [
            'Higher unit cost in exchange for shorter lead times, lower freight, and less disruption exposure',
            'Lower unit cost with no operational differences',
            'It only matters for tax purposes',
        ],
        correctIndex: 0,
        explanation: 'Nearshoring usually raises labour cost per unit but shortens lead times, cuts freight and pipeline inventory, and shrinks exposure to long-haul disruptions. Network design weighs that total landed cost, not the unit price alone.',
    },
};
