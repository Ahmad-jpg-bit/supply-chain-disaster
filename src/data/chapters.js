export const CHAPTERS = [
    {
        id: 'demand_forecasting',
        number: 1,
        title: 'Demand Forecasting & Inventory Basics',
        icon: 'chartUp',
        description: 'Every supply chain begins with a question: how much will customers want? Get it wrong, and you either drown in unsold stock or lose sales to empty shelves.',
        keyPoints: [
            'Forecasting uses historical data, trends, and market signals',
            'Over-ordering ties up cash and risks obsolescence',
            'Under-ordering loses sales and damages customer trust',
            'The goal is balancing service level with inventory cost'
        ],
        realWorldExample: {
            electronics: 'When NVIDIA launched the RTX 4090, demand outstripped forecasts by 300%. Scalpers bought entire stocks while genuine customers waited months. Retailers who used pre-order data to forecast came out ahead; those relying on historical GPU sales were blindsided.',
            fmcg: 'In 2020, toilet paper manufacturers couldn\'t have predicted the panic buying surge. Kimberly-Clark\'s flexible forecasting models adapted within weeks by weighting real-time POS data over historical trends, while competitors faced months of empty shelves.',
            pharma: 'During the COVID-19 vaccine rollout, Pfizer had to forecast demand for a product that had never existed. They built scenario models for 50+ countries simultaneously, each with different approval timelines, storage requirements, and population priorities.'
        },
        turnsRange: [1, 4],
        activeNodes: ['warehouse', 'store']
    },
    {
        id: 'bullwhip_effect',
        number: 2,
        title: 'The Bullwhip Effect',
        icon: 'warning',
        description: 'A small change in customer demand can create massive swings upstream. A 10% increase at retail can become a 40% panic order at the factory. This amplification is the Bullwhip Effect.',
        keyPoints: [
            'Demand signals get distorted as they travel upstream',
            'Batch ordering and promotions amplify variability',
            'Information sharing across the chain reduces the effect',
            'Overreaction to short-term trends is the biggest driver'
        ],
        realWorldExample: {
            electronics: 'During the 2020-2022 chip shortage, automakers panic-ordered semiconductors, inflating demand signals. TSMC ramped up production massively — then got hit with a wave of cancellations when the auto market softened. The bullwhip turned a shortage into a glut within 18 months.',
            fmcg: 'Procter & Gamble discovered that while diaper sales were steady at retail, their factory orders swung wildly — each link in the chain was over-correcting based on incomplete information. They coined the term "bullwhip effect" studying their own Pampers supply chain.',
            pharma: 'When a flu strain was predicted to be severe in 2018, hospitals panic-ordered Tamiflu. Distributors doubled their orders to manufacturers. Roche\'s factories went to 24/7 production — then the flu season turned mild. $400M in expired inventory was destroyed the following year.'
        },
        turnsRange: [5, 8],
        activeNodes: ['supplier', 'factory', 'warehouse']
    },
    {
        id: 'jit_safety_stock',
        number: 3,
        title: 'JIT & Safety Stock',
        icon: 'clock',
        description: 'Just-In-Time means ordering only what you need, when you need it — minimizing waste but maximizing risk. Safety stock is the buffer that catches you when things go wrong.',
        keyPoints: [
            'JIT reduces holding costs and waste dramatically',
            'JIT requires reliable suppliers and short lead times',
            'Safety stock protects against demand and supply variability',
            'The optimal strategy blends both approaches based on risk'
        ],
        realWorldExample: {
            electronics: 'Apple keeps just 5 days of iPhone inventory — one of the leanest operations in tech. But they secure components months ahead with $50B+ in supplier prepayments, creating a hidden safety stock of committed capacity rather than physical parts.',
            fmcg: 'Zara pioneered fast-fashion JIT: small batches, 2-week factory-to-store cycles, and no reorders on most items. If a style sells out, it\'s gone — creating artificial scarcity. Their "miss rate" of 1% vs. the industry average of 17% shows JIT mastery.',
            pharma: 'Toyota pioneered JIT manufacturing, but the 2011 tsunami exposed its vulnerability. Pharmaceutical companies learned from this — maintaining 6-month safety stock on critical APIs (active pharmaceutical ingredients) because a single stockout can be life-threatening.'
        },
        turnsRange: [9, 12],
        activeNodes: ['factory', 'warehouse', 'truck']
    },
    {
        id: 'risk_management',
        number: 4,
        title: 'Risk Management & Supply Disruption',
        icon: 'shield',
        description: 'Supply chains are only as strong as their weakest link. Ports close, suppliers go bankrupt, and natural disasters strike. The question isn\'t if disruption will happen — it\'s when.',
        keyPoints: [
            'Single-source dependencies create catastrophic risk',
            'Dual-sourcing costs more but provides resilience',
            'Geographic diversification protects against regional disruptions',
            'Contingency plans must be made before crises hit'
        ],
        realWorldExample: {
            electronics: 'The 2021 Texas winter storm knocked out Samsung\'s Austin chip fab for over a month, causing $270M in losses. Companies dependent on that single facility — including automakers and appliance makers — had no backup. Those with multi-source strategies barely noticed.',
            fmcg: 'When the Suez Canal was blocked by the Ever Given in 2021, $9.6 billion of trade was held up daily. Unilever and Nestlé activated pre-planned alternative routes through the Cape of Good Hope, adding cost but maintaining supply. Smaller brands waited weeks.',
            pharma: 'In 2017, Hurricane Maria devastated Puerto Rico — home to 10% of all US pharmaceutical manufacturing. Baxter International\'s saline bag factory was destroyed, causing a nationwide IV shortage that lasted over a year. Hospitals rationed fluids for months.'
        },
        turnsRange: [13, 16],
        activeNodes: ['supplier', 'ship']
    },
    {
        id: 'total_cost_strategy',
        number: 5,
        title: 'Total Cost of Ownership & Strategy',
        icon: 'coins',
        description: 'The cheapest supplier isn\'t always the cheapest option. Total Cost of Ownership accounts for quality, lead time, risk, sustainability, and hidden costs that compound over time.',
        keyPoints: [
            'Purchase price is often less than 50% of total cost',
            'Hidden costs include quality failures, delays, and compliance',
            'Sustainable sourcing reduces long-term regulatory risk',
            'Strategic decisions require balancing multiple competing objectives'
        ],
        realWorldExample: {
            electronics: 'Apple maintains premium suppliers despite higher costs because quality failures in millions of devices would cost far more than the savings from cheaper parts. A single faulty battery model cost Samsung $5.3 billion in the Note 7 recall.',
            fmcg: 'Walmart\'s "Every Day Low Price" strategy extends to procurement: they don\'t just negotiate unit price — they audit suppliers\' warehousing, packaging, and transportation costs. By helping suppliers cut waste, Walmart reduces TCO for both parties.',
            pharma: 'Generic drug maker Ranbaxy chose the cheapest API suppliers, saving 20% on raw materials. But FDA inspections revealed data integrity violations linked to those suppliers. The resulting import bans, fines, and lost contracts cost 50x the initial "savings."'
        },
        turnsRange: [17, 20],
        activeNodes: ['supplier', 'factory', 'warehouse', 'truck', 'store']
    },
    {
        id: 'logistics_transportation',
        number: 6,
        title: 'Logistics & Transportation',
        icon: 'truck',
        description: 'Getting products from A to B sounds simple — until you factor in multi-modal transport, last-mile delivery costs, and route optimization across continents.',
        keyPoints: [
            'Multi-modal transport balances speed, cost, and reliability',
            'Last-mile delivery is often the most expensive leg of the journey',
            'Route optimization can cut logistics costs by 15-30%',
            'Warehouse placement determines your entire delivery network efficiency'
        ],
        realWorldExample: {
            electronics: 'Amazon built a logistics network rivaling FedEx and UPS, investing $60B+ in fulfillment. Their obsession with last-mile delivery — drones, lockers, same-day hubs — redefined customer expectations for the entire electronics retail industry.',
            fmcg: 'Coca-Cola operates one of the world\'s most complex distribution networks: 225+ bottling partners, 30M+ retail outlets, reaching villages with no paved roads. Their "route-to-market" strategy adapts transport mode by geography — from trucks to bicycles to canoes.',
            pharma: 'Moderna\'s COVID vaccine required -20°C cold chain logistics. They partnered with McKesson to build a temperature-monitored network using GPS-tracked thermal containers. A single temperature excursion could destroy $1M+ of doses, making logistics the most critical link.'
        },
        turnsRange: [21, 24],
        activeNodes: ['warehouse', 'truck', 'store']
    },
    {
        id: 'quality_management',
        number: 7,
        title: 'Quality Management',
        icon: 'checkmark',
        description: 'Quality isn\'t just inspection at the end of the line — it\'s a philosophy that permeates every process. Six Sigma, defect rates, and the staggering cost of poor quality can make or break a brand.',
        keyPoints: [
            'Six Sigma aims for 3.4 defects per million opportunities',
            'The cost of poor quality includes returns, warranty, and brand damage',
            'Prevention is 10x cheaper than detection, which is 10x cheaper than failure',
            'Quality management requires supplier partnerships, not just audits'
        ],
        realWorldExample: {
            electronics: 'Samsung\'s Galaxy Note 7 recall cost $5.3 billion after battery defects caused fires. The root cause? Rushing production timelines compressed quality testing. One shortcut destroyed years of brand trust and wiped $26B in market value.',
            fmcg: 'In 2008, melamine-contaminated baby formula from a Chinese supplier killed 6 infants and sickened 300,000. The scandal destroyed multiple brands overnight and led to a decade-long trust crisis — Chinese parents still fly to Hong Kong to buy foreign formula.',
            pharma: 'Johnson & Johnson\'s Tylenol recall in 1982 set the gold standard for quality response. After cyanide-tainted capsules killed 7 people, J&J recalled 31 million bottles ($100M cost) and invented tamper-proof packaging. Their transparency actually increased brand trust.'
        },
        turnsRange: [25, 28],
        activeNodes: ['supplier', 'factory', 'warehouse']
    },
    {
        id: 'sustainability_circular',
        number: 8,
        title: 'Sustainability & Circular Economy',
        icon: 'leaf',
        description: 'The linear "take-make-dispose" model is dying. Forward-thinking supply chains are closing the loop — reducing carbon footprints, enabling reverse logistics, and building ethical sourcing into their DNA.',
        keyPoints: [
            'Carbon footprint reporting is becoming mandatory in major markets',
            'Reverse logistics turns end-of-life products into new revenue streams',
            'Ethical sourcing protects against regulatory and reputational risk',
            'Circular design reduces material costs by up to 50% over time'
        ],
        realWorldExample: {
            electronics: 'Fairphone designs modular smartphones with replaceable components, ethically sourced minerals, and a take-back program. While niche, they proved circular electronics is viable — and Apple\'s shift to recycled rare earth metals shows the industry is following.',
            fmcg: 'Patagonia\'s Worn Wear program takes back used clothing, repairs and resells it — generating new revenue while reducing waste. Their "Don\'t Buy This Jacket" campaign boosted sales 30% by building trust through radical transparency.',
            pharma: 'AstraZeneca committed to zero-carbon operations by 2025 and carbon-negative by 2030. They redesigned drug packaging to eliminate 1,500 tons of plastic annually and switched to renewable energy across manufacturing sites, proving pharma can lead on sustainability.'
        },
        turnsRange: [29, 32],
        activeNodes: ['supplier', 'factory', 'warehouse', 'truck', 'store']
    }
];

export function getChapterForTurn(turn) {
    return CHAPTERS.find(ch => turn >= ch.turnsRange[0] && turn <= ch.turnsRange[1]) || null;
}

export function getChapterIndex(turn) {
    return CHAPTERS.findIndex(ch => turn >= ch.turnsRange[0] && turn <= ch.turnsRange[1]);
}

export function isFirstTurnOfChapter(turn) {
    return CHAPTERS.some(ch => ch.turnsRange[0] === turn);
}

export function isLastTurnOfChapter(turn) {
    return CHAPTERS.some(ch => ch.turnsRange[1] === turn);
}
