// 20 scenarios: 4 per chapter, played sequentially
// Each option has conceptAlignment: 'optimal' | 'cautious' | 'risky'

export const CHAPTER_SCENARIOS = {
    // ===== CHAPTER 1: Demand Forecasting & Inventory Basics =====
    demand_forecasting: [
        {
            id: 'steady_seas',
            title: 'Steady Seas',
            text: 'It\'s your first quarter. Demand has been predictable, and your suppliers are reliable. This is a chance to establish your baseline ordering pattern. How do you set your initial inventory strategy?',
            highlightNode: 'warehouse',
            options: [
                {
                    label: 'Match Forecast Exactly (Lean Start)',
                    outcomeText: 'You ordered precisely what the forecast suggested. Minimal waste, but no buffer if anything changes.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: 5 }
                },
                {
                    label: 'Order 50% Extra (Play It Safe)',
                    outcomeText: 'You built up a comfortable buffer. Your warehouse is full, but so are your holding costs.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: 5 }
                },
                {
                    label: 'Order Minimum (Cut Costs)',
                    outcomeText: 'You kept orders razor-thin. If demand ticks up even slightly, you\'ll be caught short.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 0.85, customerSatisfaction: -5 }
                }
            ]
        },
        {
            id: 'holiday_approaching',
            title: 'Holiday Season Approaching',
            text: 'Historical data shows demand typically doubles during the holiday quarter. Marketing is already ramping up campaigns. How do you prepare your inventory?',
            highlightNode: 'store',
            options: [
                {
                    label: 'Scale Up Gradually (Data-Driven)',
                    outcomeText: 'You increased orders by 80% based on historical trends. Smart use of data left you well-positioned.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 10, demandMultiplier: 1.5 }
                },
                {
                    label: 'Double Everything (Max Prep)',
                    outcomeText: 'You went all-in on holiday prep. If demand matches, you\'re golden. If not, you\'re sitting on expensive stock.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: -1, unitCost: 1.3, customerSatisfaction: 5, demandMultiplier: 1.4 }
                },
                {
                    label: 'Wait and React (See What Happens)',
                    outcomeText: 'You decided to wait for real demand signals. By the time orders spiked, your lead time worked against you.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 2, unitCost: 1.0, customerSatisfaction: -15, demandMultiplier: 1.6 }
                }
            ]
        },
        {
            id: 'new_competitor',
            title: 'New Competitor Enters Market',
            text: 'A well-funded competitor just launched in your market with aggressive pricing. Early signals suggest they\'re capturing 15% of your customer base. How do you adjust your forecast?',
            highlightNode: 'store',
            options: [
                {
                    label: 'Reduce Forecast by 15% (Realistic Adjustment)',
                    outcomeText: 'You adjusted your forecast to reflect the new market reality. Inventory levels stayed efficient.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 0.95, customerSatisfaction: 0, demandMultiplier: 0.85 }
                },
                {
                    label: 'Maintain Current Levels (Hold Steady)',
                    outcomeText: 'You kept ordering the same amounts. Some excess inventory built up as demand softened.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: -5, demandMultiplier: 0.92 }
                },
                {
                    label: 'Increase Orders to Compete (Price War)',
                    outcomeText: 'You ramped up orders and slashed prices to fight back. Margins are bleeding, but you\'re holding market share.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.4, customerSatisfaction: 5, demandMultiplier: 1.18 }
                }
            ]
        },
        {
            id: 'ai_forecast_engine',
            title: 'AI Demand Sensing',
            text: 'A vendor pitches an AI-powered demand sensing platform that ingests social media, weather, and POS data to predict demand 30 days out. Early pilots show 20% better accuracy — but the model is a black box. How do you deploy it?',
            highlightNode: 'warehouse',
            options: [
                {
                    label: 'Deploy with Human Oversight (Hybrid)',
                    outcomeText: 'You let the AI generate forecasts while planners reviewed and adjusted outliers. Forecast accuracy improved 18% and your team learned to trust — and challenge — the model.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 10 }
                },
                {
                    label: 'Full Automation (Trust the Algorithm)',
                    outcomeText: 'The AI ran forecasts end-to-end. It nailed routine weeks, but a regional event the model had never seen caused a massive misforecast. No human was in the loop to catch it.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -15 }
                },
                {
                    label: 'Reject the Platform (Stick to Spreadsheets)',
                    outcomeText: 'You stayed with manual forecasting. Competitors using AI-driven demand sensing reacted faster to market shifts and started winning shelf space.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: -5 }
                }
            ]
        }
    ],

    // ===== CHAPTER 2: The Bullwhip Effect =====
    bullwhip_effect: [
        {
            id: 'retailer_panic',
            title: 'The Bullwhip Surge',
            text: 'A viral social media trend has caused a sudden spike in demand for your product category. Retailers are panic-ordering 3x their usual volume. But is real consumer demand actually up that much?',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Balanced Increase (Verify Demand)',
                    outcomeText: 'You increased production moderately and checked point-of-sale data. Real demand was only up 30%, not 300%. Smart move.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 5, demandMultiplier: 1.1 }
                },
                {
                    label: 'Expedite Production (Match Orders)',
                    outcomeText: 'You paid a premium for air freight to match retailer orders. Most of that "demand" was safety stock padding — now everyone is oversupplied.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: -2, unitCost: 1.5, customerSatisfaction: 0, demandMultiplier: 1.4 }
                },
                {
                    label: 'Stick to Forecast (Ignore Noise)',
                    outcomeText: 'You held firm on your forecast. Retailers are frustrated, but you avoided the bullwhip trap. Some sales were missed.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -10, demandMultiplier: 0.9 }
                }
            ]
        },
        {
            id: 'control_tower_visibility',
            title: 'Control Tower Visibility',
            text: 'Your supply chain has dozens of partners but no single view of inventory in motion. An IoT control tower platform promises real-time visibility from factory floor to store shelf — but it requires every partner to share data. How do you roll it out?',
            highlightNode: 'warehouse',
            options: [
                {
                    label: 'Pilot with Willing Partners, Prove Value First',
                    outcomeText: 'You onboarded your three most collaborative partners. Real-time tracking cut information lag from days to minutes. Other partners saw the results and asked to join.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 10 }
                },
                {
                    label: 'Mandate Adoption for All Partners',
                    outcomeText: 'You forced every partner onto the platform. Two major distributors pushed back and threatened to leave. The data is great — for the partners who stayed.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: -10 }
                },
                {
                    label: 'Internal Visibility Only (Track Our Own Inventory)',
                    outcomeText: 'You gained visibility inside your own walls but blind spots remain everywhere else. When a partner\'s warehouse flooded, you had no warning until orders stopped arriving.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -5 }
                }
            ]
        },
        {
            id: 'regional_bullwhip',
            title: 'Regional Panic Buying',
            text: 'A sudden currency devaluation in Southeast Asia triggers panic-buying in the region. Your centralized ordering system sees the spike and automatically amplifies it globally — warehouses in Europe and the Americas start stockpiling too. The bullwhip is going international.',
            highlightNode: 'ship',
            options: [
                {
                    label: 'Isolate Regional Signals, Verify Before Propagating',
                    outcomeText: 'You paused automatic replenishment outside SE Asia and verified that demand elsewhere was normal. The regional spike was real; the global echo was phantom. Bullwhip contained.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.05, customerSatisfaction: 5, demandMultiplier: 1.0 }
                },
                {
                    label: 'Let the System Respond Globally (Trust Automation)',
                    outcomeText: 'Every region over-ordered simultaneously. Six weeks later, warehouses worldwide are bloated with excess stock while SE Asia is already returning to normal demand.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.4, customerSatisfaction: -10, demandMultiplier: 1.3 }
                },
                {
                    label: 'Freeze All Orders Until Analysis Complete',
                    outcomeText: 'You halted ordering globally while analysts investigated. SE Asian customers couldn\'t get product during genuine demand. Over-correction caused its own damage.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.0, customerSatisfaction: -10, demandMultiplier: 0.8 }
                }
            ]
        },
        {
            id: 'smoothing_the_wave',
            title: 'Smoothing the Wave',
            text: 'After three quarters of volatile orders, your factory is struggling with production planning. Your team proposes switching from batch ordering to continuous replenishment. It requires investing in real-time POS data sharing.',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Invest in Data Sharing (Long-term Fix)',
                    outcomeText: 'The investment paid off. Real-time demand visibility cut order variability by 40%. The bullwhip is finally under control.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: 15 }
                },
                {
                    label: 'Add Inventory Buffers Instead (Quick Fix)',
                    outcomeText: 'More safety stock absorbed the swings, but at a cost. You\'re treating the symptom, not the cause.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.2, customerSatisfaction: 5 }
                },
                {
                    label: 'Keep Current System (No Change)',
                    outcomeText: 'Business as usual means bullwhip as usual. Your factory continues to whipsaw between overtime and idle time.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -10 }
                }
            ]
        }
    ],

    // ===== CHAPTER 3: JIT & Safety Stock =====
    jit_safety_stock: [
        {
            id: 'zero_waste_initiative',
            title: 'Zero Waste Initiative',
            text: 'The board wants to implement Just-In-Time manufacturing to cut holding costs by 40%. Your suppliers have been reliable lately, but JIT means zero margin for error. How aggressively do you adopt JIT?',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Phased JIT with Safety Stock for Critical Parts',
                    outcomeText: 'You went JIT on commodity items but kept safety stock for critical components. Holding costs dropped 25% with minimal risk.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 0.9, customerSatisfaction: 10 }
                },
                {
                    label: 'Full JIT Across All Lines (Maximum Savings)',
                    outcomeText: 'Holding costs plummeted, but you\'re now one supplier hiccup away from a production shutdown.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 0.75, customerSatisfaction: 5 }
                },
                {
                    label: 'Keep Current Inventory Levels (Too Risky)',
                    outcomeText: 'You passed on JIT entirely. The board is disappointed, and competitors are gaining a cost advantage.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: -5 }
                }
            ]
        },
        {
            id: 'automation_vs_flexibility',
            title: 'Automation vs. Flexibility',
            text: 'Your JIT line needs faster changeovers to handle smaller, more frequent batches. Engineering proposes robotic cells that can switch products in 10 minutes — but the union workforce fears job losses. Manual changeovers currently take 90 minutes.',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Retrain Workers to Operate Robotic Cells (Upskill)',
                    outcomeText: 'You invested in retraining so operators became robot supervisors. Changeover time dropped to 12 minutes, no layoffs occurred, and the union became an advocate for the new system.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 10 }
                },
                {
                    label: 'Full Automation, Reduce Headcount',
                    outcomeText: 'Changeovers are lightning fast, but morale cratered. Experienced workers left, taking institutional knowledge with them. When the robots glitched, nobody knew the manual fallback.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: -1, unitCost: 0.85, customerSatisfaction: -10 }
                },
                {
                    label: 'Keep Manual Changeovers (Avoid Conflict)',
                    outcomeText: 'You avoided the difficult conversation. Competitors with faster changeovers now offer shorter lead times and wider product ranges. Your JIT system is limited by its own workforce constraints.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 1, unitCost: 1.05, customerSatisfaction: -5 }
                }
            ]
        },
        {
            id: 'delayed_shipment',
            title: 'Delayed Shipment',
            text: 'Your primary supplier just informed you that your next shipment will be 2 weeks late due to raw material shortages. Under JIT, you have only 3 days of stock remaining. What\'s your move?',
            highlightNode: 'truck',
            options: [
                {
                    label: 'Activate Backup Supplier + Ration Current Stock',
                    outcomeText: 'Your pre-arranged backup supplier filled the gap at a slight premium. Customers barely noticed.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.15, customerSatisfaction: 0 }
                },
                {
                    label: 'Wait for Primary Supplier (Trust the Relationship)',
                    outcomeText: 'You waited. Production stopped for 11 days. Customer orders piled up. JIT without backup plans is a gamble.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 4, unitCost: 1.0, customerSatisfaction: -20 }
                },
                {
                    label: 'Spot Buy at Any Price (Panic Mode)',
                    outcomeText: 'You bought whatever was available at 2x cost. Production continued, but your margins vanished.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 2.0, customerSatisfaction: 5 }
                }
            ]
        },
        {
            id: 'finding_sweet_spot',
            title: 'Finding the Sweet Spot',
            text: 'After experimenting with JIT, your team has data on which components cause the most disruptions. They propose a hybrid model: JIT for 70% of items, strategic safety stock for 30% of critical parts. The question is how much safety stock.',
            highlightNode: 'warehouse',
            options: [
                {
                    label: '2 Weeks Safety Stock on Critical Items (Data-Backed)',
                    outcomeText: 'Analysis showed 2 weeks covers 95% of disruptions. The perfect balance of cost and protection.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 15 }
                },
                {
                    label: '6 Weeks Safety Stock (Maximum Buffer)',
                    outcomeText: 'You\'ll never stock out, but you\'re back to pre-JIT holding costs. Was the whole exercise pointless?',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.3, customerSatisfaction: 5 }
                },
                {
                    label: 'No Safety Stock (Pure JIT)',
                    outcomeText: 'You committed to pure JIT despite the data showing risks. Bold, but the next disruption could be devastating.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 0.8, customerSatisfaction: -5 }
                }
            ]
        }
    ],

    // ===== CHAPTER 4: Risk Management & Supply Disruption =====
    risk_management: [
        {
            id: 'digital_twin_risk',
            title: 'Digital Twin Warning',
            text: 'Your team built a digital twin of the supply chain that simulates disruptions. It\'s now flashing red: a port congestion scenario has a 70% probability of occurring within 30 days. The model recommends pre-positioning inventory at alternative ports — but acting on a simulation is expensive if it\'s wrong.',
            highlightNode: 'ship',
            options: [
                {
                    label: 'Act on the Model with a Hedged Position',
                    outcomeText: 'You pre-positioned 60% of critical stock at alternative ports. The congestion hit right on schedule. Your partial hedge meant some delays, but competitors were fully paralyzed.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.2, customerSatisfaction: 10 }
                },
                {
                    label: 'Ignore the Model (Simulations Aren\'t Reality)',
                    outcomeText: 'The congestion materialized exactly as predicted. With no pre-positioning, you scrambled for emergency logistics at triple cost. The digital twin sits unused — proven right but ignored.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 6, unitCost: 1.5, customerSatisfaction: -25 }
                },
                {
                    label: 'Full Repositioning (Trust the Model 100%)',
                    outcomeText: 'You moved everything to alternative ports at massive cost. The congestion happened, but your over-reaction left inventory scattered inefficiently. Right call, excessive execution.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.35, customerSatisfaction: 5 }
                }
            ]
        },
        {
            id: 'supplier_collapse',
            title: 'Supplier Insolvency',
            text: 'Your key component supplier has filed for bankruptcy. Production is halted until you find an alternative source. This supplier provided 60% of your critical components.',
            highlightNode: 'supplier',
            options: [
                {
                    label: 'Activate Pre-vetted Backup Supplier',
                    outcomeText: 'Your risk management plan had a backup supplier ready. Transition took just 2 weeks. The cost of preparation paid off.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 2, unitCost: 1.1, customerSatisfaction: 5 }
                },
                {
                    label: 'Buy Competitor Stock (Spot Market)',
                    outcomeText: 'You secured parts immediately at a massive markup. You\'re running, but bleeding money.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 2.0, customerSatisfaction: 0 }
                },
                {
                    label: 'Vet New Supplier From Scratch',
                    outcomeText: 'It took 12 weeks to find and qualify a new partner. You missed an entire cycle of sales.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 12, unitCost: 0.9, customerSatisfaction: -15 }
                }
            ]
        },
        {
            id: 'nearshore_or_offshore',
            title: 'Nearshore or Offshore?',
            text: 'Geopolitical tensions are making your Asian supply base increasingly risky. Your team proposes nearshoring production to Mexico — closer, but 15% higher unit costs. You could dual-shore for redundancy, fully transition, or stay the course and hope tensions ease.',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Dual-Shore Strategy (Build Redundancy)',
                    outcomeText: 'You established a Mexican line while maintaining Asia. When a trade restriction hit six months later, you shifted volume seamlessly. Higher cost, but you never missed a shipment.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.15, customerSatisfaction: 10 }
                },
                {
                    label: 'Full Transition to Mexico',
                    outcomeText: 'You went all-in on nearshoring. Lead times dropped from 8 weeks to 2, but losing Asian supplier relationships means no fallback if Mexican capacity can\'t scale.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: -2, unitCost: 1.25, customerSatisfaction: 5 }
                },
                {
                    label: 'Stay Offshore (Ride It Out)',
                    outcomeText: 'New export controls froze 40% of your Asian supply. With no alternative in place, you lost two months of production while competitors with diversified footprints kept shipping.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 6, unitCost: 1.0, customerSatisfaction: -20 }
                }
            ]
        },
        {
            id: 'trade_war',
            title: 'Trade War',
            text: 'New tariffs of 25% have been announced on imports from your primary manufacturing region. They take effect in 60 days. Your competitors are scrambling. How do you respond?',
            highlightNode: 'ship',
            options: [
                {
                    label: 'Diversify Manufacturing Across Regions',
                    outcomeText: 'You began shifting production to tariff-free zones. Short-term costs rose, but you\'re building long-term resilience.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 2, unitCost: 1.15, customerSatisfaction: 5 }
                },
                {
                    label: 'Stockpile Before Tariffs Hit',
                    outcomeText: 'You rushed in inventory at pre-tariff prices. It\'s a band-aid — you still need a long-term solution.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 0 }
                },
                {
                    label: 'Pass Costs to Customers (Price Increase)',
                    outcomeText: 'You raised prices 25%. Customers fled to competitors who absorbed the costs. Market share cratered.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.25, customerSatisfaction: -20 }
                }
            ]
        }
    ],

    // ===== CHAPTER 6: Logistics & Transportation =====
    logistics_transportation: [
        {
            id: 'last_mile_dilemma',
            title: 'The Last Mile Dilemma',
            text: 'Your delivery costs are skyrocketing. Analysis shows last-mile delivery accounts for 53% of total shipping costs. Customers expect next-day delivery, but your current hub-and-spoke model can\'t keep up without premium freight charges.',
            highlightNode: 'truck',
            options: [
                {
                    label: 'Deploy Micro-Fulfillment Centers (Strategic Network)',
                    outcomeText: 'You placed small warehouses near major population centers. Last-mile costs dropped 35% and delivery times halved. The upfront investment pays for itself within two quarters.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: -1, unitCost: 1.1, customerSatisfaction: 15 }
                },
                {
                    label: 'Partner with Local Couriers (Outsource)',
                    outcomeText: 'Local courier partnerships gave you flexibility without capital investment. Costs improved moderately, but quality control is inconsistent across partners.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 5 }
                },
                {
                    label: 'Keep Current Model, Raise Shipping Fees',
                    outcomeText: 'You passed delivery costs to customers. Cart abandonment rates jumped 25% as competitors offered free shipping.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -20 }
                }
            ]
        },
        {
            id: 'transport_mode_selection',
            title: 'Multi-Modal Decision',
            text: 'A major order needs to move from your Asian factory to European warehouses. You can ship by sea (6 weeks, cheapest), rail (3 weeks, moderate), or air (1 week, expensive). The product launch is in 5 weeks.',
            highlightNode: 'ship',
            options: [
                {
                    label: 'Rail + Local Truck (Balanced Multi-Modal)',
                    outcomeText: 'The rail-truck combination arrived in 3.5 weeks — well before launch. You balanced speed and cost perfectly using multi-modal thinking.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: 10 }
                },
                {
                    label: 'Air Freight Everything (Speed Priority)',
                    outcomeText: 'Product arrived in a week with massive freight costs. You had 4 weeks of idle inventory sitting in the warehouse before launch.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: -2, unitCost: 1.5, customerSatisfaction: 5 }
                },
                {
                    label: 'Sea Freight to Save Money (Cost Priority)',
                    outcomeText: 'The shipment arrived one week after launch. Competitors captured first-mover demand. The cost savings didn\'t offset the lost revenue.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 3, unitCost: 0.85, customerSatisfaction: -15 }
                }
            ]
        },
        {
            id: 'trade_compliance_maze',
            title: 'Trade Compliance Maze',
            text: 'You\'re expanding into three new countries simultaneously. Each has different customs documentation, labeling requirements, and restricted-substance regulations. Your logistics team says they can handle it manually; your compliance officer says that\'s a recipe for seizures and fines.',
            highlightNode: 'truck',
            options: [
                {
                    label: 'Invest in Trade Management Software + Local Expertise',
                    outcomeText: 'You deployed a trade compliance platform and hired local customs brokers in each country. First shipments cleared without delays. The upfront cost was high, but zero seizures means zero revenue loss.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: 10 }
                },
                {
                    label: 'Handle Manually (Save on Software)',
                    outcomeText: 'Your team missed a restricted-substance declaration in Country B. An entire container was seized at customs for 6 weeks. The fine alone exceeded the software cost you "saved."',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 4, unitCost: 1.3, customerSatisfaction: -20 }
                },
                {
                    label: 'Launch in One Country First (Go Slow)',
                    outcomeText: 'You learned compliance lessons in one market before scaling. Slower expansion, but no costly mistakes. Competitors grabbed early market share in the other two countries.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.05, customerSatisfaction: 0 }
                }
            ]
        },
        {
            id: 'blockchain_freight',
            title: 'Blockchain Freight Tracking',
            text: 'Your freight passes through 5 carriers and 3 customs authorities per shipment. Disputes over handoff timing and cargo condition cost you $2M annually. A blockchain consortium promises immutable tracking across all parties — but requires every carrier to adopt the platform.',
            highlightNode: 'warehouse',
            options: [
                {
                    label: 'Join Consortium, Onboard Carriers Incrementally',
                    outcomeText: 'You joined with your two largest carriers first. Dispute resolution time dropped from weeks to hours for those lanes. Other carriers saw the transparency benefits and opted in within a quarter.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 15 }
                },
                {
                    label: 'Build Proprietary Tracking (Control the Data)',
                    outcomeText: 'You built your own system, but carriers refused to integrate with a customer-owned platform. You have great internal data and zero partner adoption. An expensive island of visibility.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.25, customerSatisfaction: -10 }
                },
                {
                    label: 'Wait for Industry Standard to Emerge',
                    outcomeText: 'You avoided early-mover risk but kept paying $2M in annual disputes. When the standard finally emerged two years later, early adopters had already optimized their networks.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -5 }
                }
            ]
        }
    ],

    // ===== CHAPTER 7: Quality Management =====
    quality_management: [
        {
            id: 'defect_discovery',
            title: 'Defect Discovery',
            text: 'Your quality team has detected a 4% defect rate in the latest production batch — double the acceptable threshold. The batch is worth $2M and is scheduled to ship tomorrow. Reworking will take 2 weeks; scrapping loses the full amount.',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Sort, Rework Defective Units, Ship Good Ones',
                    outcomeText: 'Intensive sorting found 96% of units were fine. You shipped the good ones on time and reworked the rest. Root cause analysis prevented recurrence.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 10 }
                },
                {
                    label: 'Scrap Entire Batch (Zero Tolerance)',
                    outcomeText: 'You destroyed $2M of mostly good product. Your quality reputation is pristine, but the CFO is asking hard questions about waste.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.5, customerSatisfaction: 5 }
                },
                {
                    label: 'Ship As-Is, Handle Returns Later',
                    outcomeText: 'Defective products reached customers. Return rates spiked, review scores plummeted, and a viral social media post showed your product failing. Returns cost 5x what rework would have.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -30 }
                }
            ]
        },
        {
            id: 'supplier_audit',
            title: 'Supplier Quality Audit',
            text: 'Annual audits reveal your primary supplier has been cutting corners on material testing. They\'re 20% cheaper than alternatives, but their process shortcuts could mean latent defects in your products. No customer complaints yet.',
            highlightNode: 'supplier',
            options: [
                {
                    label: 'Mandate Corrective Action Plan with Monitoring',
                    outcomeText: 'You gave the supplier 90 days to implement proper testing with your team embedded on-site. Quality improved, costs rose 5%, but the partnership strengthened. Prevention over detection.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 10 }
                },
                {
                    label: 'Switch Suppliers Immediately',
                    outcomeText: 'You cut ties and onboarded a new supplier. The transition took 8 weeks and cost more, but quality is now guaranteed. Decisive but expensive.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.25, customerSatisfaction: 5 }
                },
                {
                    label: 'Accept the Risk for Cost Savings',
                    outcomeText: 'Three months later, a batch of defective products triggered a recall. The "savings" cost 10x more than fixing the quality issue upfront.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 0.85, customerSatisfaction: -25 }
                }
            ]
        },
        {
            id: 'iot_quality_sensors',
            title: 'IoT Quality Sensors',
            text: 'Your quality team proposes installing IoT sensors and ML models on the production line for predictive quality — catching defects before they happen by monitoring vibration, temperature, and torque in real time. Piloting one line costs $200K; full deployment across 8 lines costs $1.2M.',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Pilot One Line, Validate ROI, Then Scale',
                    outcomeText: 'The pilot line\'s defect rate dropped 60% in three months. ML models identified a bearing wear pattern humans had missed for years. The data made the business case for full deployment undeniable.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 15 }
                },
                {
                    label: 'Full Deployment Across All Lines (Go Big)',
                    outcomeText: 'Sensors went everywhere, but your data team couldn\'t tune 8 ML models simultaneously. False positives caused unnecessary stoppages and operators started ignoring alerts. Technology without change management is noise.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.3, customerSatisfaction: -10 }
                },
                {
                    label: 'Keep Manual Inspection (Proven Process)',
                    outcomeText: 'Manual inspection keeps catching defects — after they\'re made. Scrap rates stay flat while competitors with predictive quality are achieving near-zero defects. The gap widens each quarter.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -5 }
                }
            ]
        },
        {
            id: 'quality_culture_clash',
            title: 'Quality Culture Clash',
            text: 'Your factory managers are incentivized on volume output; your quality team is incentivized on defect rates. Investigation reveals managers have been pressuring inspectors to "let borderline units pass" to hit production targets. It\'s a cultural problem, not a technical one.',
            highlightNode: 'warehouse',
            options: [
                {
                    label: 'Align Incentives: Shared Quality + Output KPIs',
                    outcomeText: 'You redesigned incentives so both teams share accountability for quality AND throughput. Within two quarters, defect rates dropped 35% while output stayed flat. When the goals align, the culture follows.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 15 }
                },
                {
                    label: 'Fire the Worst Offenders (Make an Example)',
                    outcomeText: 'You punished individuals, but the system that created the behavior remained. New managers faced the same perverse incentives. Fear replaced trust on the factory floor.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -15 }
                },
                {
                    label: 'Add More Inspectors (Increase Oversight)',
                    outcomeText: 'More inspectors caught more borderline units, but the adversarial dynamic deepened. Production and quality became warring factions. You\'re treating the symptom while the disease spreads.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: 0 }
                }
            ]
        }
    ],

    // ===== CHAPTER 8: Sustainability & Circular Economy =====
    sustainability_circular: [
        {
            id: 'carbon_reporting',
            title: 'Carbon Reporting Mandate',
            text: 'New regulations require Scope 3 carbon reporting across your entire supply chain within 12 months. Your current data covers only 30% of emissions. Full compliance requires supplier cooperation, new tracking systems, and process changes.',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Build Comprehensive Carbon Tracking System',
                    outcomeText: 'You invested in end-to-end carbon tracking and engaged suppliers early. Full compliance came in 8 months. The data revealed optimization opportunities that actually reduced costs by 8%.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 15 }
                },
                {
                    label: 'Hire Consultants for Minimum Compliance',
                    outcomeText: 'Consultants got you compliant on paper, but the data is estimates, not measurements. Regulators are increasing scrutiny, and you\'ll need to redo this properly.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: 0 }
                },
                {
                    label: 'Delay and Lobby for Extensions',
                    outcomeText: 'No extension was granted. You face penalties and are now scrambling to comply in 3 months instead of 12. Rush implementation costs triple.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -15 }
                }
            ]
        },
        {
            id: 'ethical_sourcing_crisis',
            title: 'Ethical Sourcing Crisis',
            text: 'An investigative report has exposed labor violations at a tier-2 supplier deep in your supply chain. You didn\'t know, but the public doesn\'t care about that distinction. Social media backlash is building. NGOs are tagging your brand.',
            highlightNode: 'supplier',
            options: [
                {
                    label: 'Immediate Audit + Transparent Public Response',
                    outcomeText: 'You deployed auditors within 48 hours, published findings, and committed to a remediation timeline. The transparency turned critics into cautious supporters. Long-term brand trust increased.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.2, customerSatisfaction: 10 }
                },
                {
                    label: 'Quietly Drop the Supplier, Issue Statement',
                    outcomeText: 'You cut ties and issued a careful PR statement. The crisis faded, but investigative journalists noted you didn\'t address systemic visibility gaps. The next tier-2 scandal is a matter of time.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.1, customerSatisfaction: 0 }
                },
                {
                    label: 'Deny Responsibility (Not Our Direct Supplier)',
                    outcomeText: 'The "not our problem" stance backfired spectacularly. Boycott campaigns went viral. Major retailers threatened to delist your products. Brand damage will take years to repair.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -30 }
                }
            ]
        },
        {
            id: 'green_workforce_transition',
            title: 'Green Workforce Transition',
            text: 'Your circular economy strategy requires skills your workforce doesn\'t have: reverse logistics, material recovery, refurbishment engineering, and lifecycle analysis. HR presents three approaches to building this capability. The choice shapes your team for years.',
            highlightNode: 'store',
            options: [
                {
                    label: 'Retrain Existing Staff + Hire Specialists (Blend)',
                    outcomeText: 'You upskilled motivated employees and brought in targeted hires for specialized roles. The blended team combined institutional knowledge with new expertise. Retention stayed high because people saw a future.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 15 }
                },
                {
                    label: 'Build Entirely New Green Team',
                    outcomeText: 'The new team had cutting-edge skills but no company context. They redesigned processes that clashed with existing operations. Experienced staff felt sidelined and key people left.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 1, unitCost: 1.25, customerSatisfaction: 0 }
                },
                {
                    label: 'Outsource Circular Operations',
                    outcomeText: 'The outsourced partner handled reverse logistics competently but treated it as a cost center. No internal learning occurred, and you\'re now dependent on a vendor for a core strategic capability.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: -10 }
                }
            ]
        },
        {
            id: 'circular_redesign',
            title: 'Circular Redesign',
            text: 'Your product design team presents two options for next generation: Design A maintains the current approach with minor efficiency gains. Design B uses modular components, recycled materials, and design-for-disassembly — but costs 15% more to produce.',
            highlightNode: 'factory',
            options: [
                {
                    label: 'Design B: Full Circular Design (Future-Proof)',
                    outcomeText: 'The circular design became a marketing advantage. Material costs dropped 20% over two years as recycled inputs replaced virgin materials. Modular design cut warranty repair costs in half.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.15, customerSatisfaction: 20 }
                },
                {
                    label: 'Hybrid: Current Design with Recycled Materials',
                    outcomeText: 'Swapping in recycled materials was a quick win with modest cost impact. But without modular design, end-of-life recycling remains difficult. A step forward, not a leap.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 5 }
                },
                {
                    label: 'Design A: Incremental Improvement Only',
                    outcomeText: 'You chose the safe path. But new circular economy regulations mean your product will need expensive redesign within 18 months anyway. The can was kicked, not crushed.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -5 }
                }
            ]
        }
    ],

    // ===== CHAPTER 5: Total Cost of Ownership & Strategy =====
    total_cost_strategy: [
        {
            id: 'perfect_storm',
            title: 'The Perfect Storm',
            text: 'A supplier delay, a demand spike, and a currency devaluation hit simultaneously. Your supply chain is being tested on every front. This is where all your learning comes together.',
            highlightNode: 'supplier',
            options: [
                {
                    label: 'Activate All Contingencies (Orchestrated Response)',
                    outcomeText: 'You used backup suppliers, adjusted forecasts, and hedged currency exposure. Costly but controlled. Every past lesson applied.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 1, unitCost: 1.2, customerSatisfaction: 10 }
                },
                {
                    label: 'Focus on Biggest Problem Only',
                    outcomeText: 'You triaged to the supplier delay but ignored the demand spike. One fire extinguished, another burning.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 2, unitCost: 1.3, customerSatisfaction: -5 }
                },
                {
                    label: 'Panic and Overreact on Everything',
                    outcomeText: 'Rush orders, premium freight, and emergency contracts on all fronts. You survived, but at triple the cost. The bullwhip lives.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 2.0, customerSatisfaction: 0 }
                }
            ]
        },
        {
            id: 'east_or_west',
            title: 'East or West?',
            text: 'You\'re choosing a new strategic supplier. Eastern Supplier offers 30% lower unit costs but 8-week lead times. Western Supplier costs more but delivers in 2 weeks with better quality scores. Total Cost of Ownership is the key.',
            highlightNode: 'supplier',
            options: [
                {
                    label: 'Western Supplier (TCO-Optimized)',
                    outcomeText: 'Higher unit cost, but shorter lead times, fewer defects, and lower holding costs made Western the true value leader.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: -2, unitCost: 1.15, customerSatisfaction: 15 }
                },
                {
                    label: 'Split Between Both (Dual Source)',
                    outcomeText: 'You hedged with both suppliers. Higher management overhead, but you have flexibility and redundancy.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 1, unitCost: 1.1, customerSatisfaction: 5 }
                },
                {
                    label: 'Eastern Supplier (Lowest Unit Price)',
                    outcomeText: 'The cheap price was attractive until quality issues and long lead times drove hidden costs above the Western option.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 4, unitCost: 0.85, customerSatisfaction: -10 }
                }
            ]
        },
        {
            id: 'currency_hedge_dilemma',
            title: 'The Hidden 12%',
            text: 'A TCO deep-dive reveals that currency fluctuations have silently added 12% to your procurement costs over the past year. Finance offers hedging contracts that lock exchange rates for 6 months — but they cost 3% upfront and you lose if rates move in your favor.',
            highlightNode: 'supplier',
            options: [
                {
                    label: 'Hedge 60% of Exposure (Balanced Protection)',
                    outcomeText: 'You hedged your largest currency exposures while leaving room to benefit from favorable moves. When the dollar swung 8%, your blended cost was stable. TCO thinking at its finest.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 10 }
                },
                {
                    label: 'No Hedging (Accept the Volatility)',
                    outcomeText: 'Currency moved against you again — another 10% cost surprise. The "free" option turned out to be the most expensive. Your TCO calculations are fiction without stable inputs.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.15, customerSatisfaction: -10 }
                },
                {
                    label: 'Hedge 100% (Maximum Certainty)',
                    outcomeText: 'You locked every contract. The 3% premium guaranteed cost certainty, but when rates moved favorably, competitors with partial hedges gained a cost edge. Over-insurance has its own cost.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: 5 }
                }
            ]
        },
        {
            id: 'change_management_rollout',
            title: 'Change Management Rollout',
            text: 'Your new TCO-based procurement strategy is ready — but regional procurement managers are resisting. They\'ve optimized for unit price for years, and their bonuses are tied to it. Rolling out TCO thinking requires changing metrics, mindsets, and habits across 4 regions.',
            highlightNode: 'store',
            options: [
                {
                    label: 'Pilot One Region, Build Champions, Then Scale',
                    outcomeText: 'You started with the most receptive region. Their 15% TCO savings became the proof point. Regional champions evangelized the approach, and adoption spread organically. People lead change best.',
                    conceptAlignment: 'optimal',
                    modifiers: { leadTime: 0, unitCost: 1.05, customerSatisfaction: 15 }
                },
                {
                    label: 'Mandate Immediate Global Rollout',
                    outcomeText: 'You forced the change everywhere at once. Two regions complied on paper but gamed the new metrics. One manager quit, taking key supplier relationships. Change without buy-in is just compliance theater.',
                    conceptAlignment: 'risky',
                    modifiers: { leadTime: 0, unitCost: 1.0, customerSatisfaction: -15 }
                },
                {
                    label: 'Delay Until Next Fiscal Year (Avoid Disruption)',
                    outcomeText: 'You waited for a "better time." The old unit-price mindset locked in another year of suboptimal sourcing. Meanwhile, the change champions you identified lost enthusiasm.',
                    conceptAlignment: 'cautious',
                    modifiers: { leadTime: 0, unitCost: 1.1, customerSatisfaction: -5 }
                }
            ]
        }
    ]
};

// Flat list of all scenarios for backward compatibility
export const SCENARIOS = Object.values(CHAPTER_SCENARIOS).flat();
