// 20 scenarios: 4 per chapter, played sequentially
// Each option has conceptAlignment: 'optimal' | 'cautious' | 'risky'

export const CHAPTER_SCENARIOS = {
    // ===== CHAPTER 1: Demand Forecasting & Inventory Basics =====
    demand_forecasting: [
        {
            id: 'steady_seas',
            title: 'Steady Seas',
            text: 'Q1 just closed with 987 units sold — nearly matching your 1,000-unit forecast. Your Shenzhen-based supplier confirmed on-time delivery for the next 3 months and your warehouse holds 1,450 units. The board wants a documented ordering policy before Q2 begins. How do you set your initial inventory strategy?',
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
            text: 'Three years of POS data shows Q4 demand averaging 2,340 units — 2.1× your Q1–Q3 baseline of 1,100. Marketing just confirmed a $200K Black Friday campaign launching in 6 weeks. Your current inventory sits at 800 units and your Shenzhen supplier needs 6 weeks lead time to fill a large order. Miss the window and you miss the quarter. How do you prepare?',
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
            text: 'VeloTech — a Singapore-based competitor backed by $40M in Series B funding — launched last week at pricing 12% below yours. Retail intelligence shows them winning shelf space at Target and Walmart already. Their first-month tracking data suggests they\'re taking roughly 15% of your category. Your forecast was built assuming sole market leadership. How do you adjust?',
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
            text: 'Crisp.co is pitching a demand sensing platform that ingests 3M daily POS signals, social trends, and weather data to forecast demand 30 days out. Their case study: a CPG brand cut forecast error from 22% MAPE to 8% in 6 months. Cost: $8,400/month. Catch: the model has never been trained on your product category and your planners have no idea how it weights signals. How do you deploy it?',
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
            text: 'A TikTok video showing your product used in a DIY hack hit 14M views in 48 hours. Your top 3 retail accounts — Costco, Amazon, and Home Depot — are now submitting a combined 9,200-unit rush order against their normal 3,100-unit quarterly cadence. Your demand planners pulled the actual POS data: consumer sell-through is up only 28%. The retailers are padding safety stock, not selling more product. Do you match the retailer orders or anchor to the consumer data?',
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
            text: 'You work with 14 logistics partners across 6 countries, but visibility ends the moment goods leave your factory dock. Last month, a shipment sat in a Busan warehouse for 11 days — you found out when a retail buyer called asking where their order was. A Resilinc control tower integration promises real-time shipment tracking, but every partner must open their WMS data to the platform. Two of your major distributors have already flagged data-sharing concerns. How do you roll it out?',
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
            text: 'The Thai baht fell 18% against the dollar overnight after an emergency rate cut. Your Bangkok distributor immediately placed a 4,200-unit rush order — 3× their normal quarterly volume — to lock in pre-devaluation pricing. Your ERP\'s auto-replenishment logic treated it as a real demand signal and began inflating orders across Europe and North America too. Your warehouse manager is flagging a potential $1.8M overstock exposure if this plays out globally. What do you do?',
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
            text: 'Three consecutive quarters of chaos: 800 units ordered, then 2,400, then 650 — with no change in underlying consumer demand. Your Guangzhou factory alternates between mandatory overtime and 40% idle capacity. The culprit: each distributor is re-ordering based on their own safety stock fear, not actual consumer pull. Your VP of Supply Chain proposes replacing quarterly batch orders with a VMI arrangement backed by real-time POS data sharing. Setup cost: $180,000. Expected bullwhip reduction: 40%. Do you commit?',
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
            text: 'Your CFO dropped a number in last week\'s board meeting: $2.1M in holding costs last fiscal year — 8.4% of total COGS, nearly double the industry benchmark of 4.5%. The COO wants to cut it in half with a full JIT rollout before Q3. Your 3 tier-1 suppliers delivered on time 94% of quarters. Your tier-2 raw material suppliers: 78%. JIT turns that 22% failure rate into a production stoppage. How aggressively do you roll out JIT?',
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
            text: 'Assembly Line 3 handles 6 different SKUs. Average changeover time: 87 minutes — a figure your Toyota Production System consultant called "career-ending." A Fanuc robotic cell would bring it to 9 minutes, but the $1.4M investment requires reducing headcount on that line by 30%. The union represents 340 workers at this facility and the rumor is already spreading. Your production manager needs a decision before the next union rep meeting in 5 days.',
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
            text: 'Friday 4:47pm — an email from Foxlink Technology, your primary PCB supplier and 65% of your component volume: their Zhengzhou facility is under an emergency lockdown. The $340,000 shipment scheduled to arrive Monday is frozen in their warehouse. Under your current JIT policy you have 3 days of production stock left. Your line goes dark Wednesday morning unless something changes. What\'s your move?',
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
            text: 'Six months of JIT data tells a clear story: 73% of your disruptions trace back to just 4 components — the main PCB, the power module, the display unit, and the housing seal. All 4 come from suppliers with the longest lead times and highest delivery variance. A hybrid model — JIT on everything else, strategic safety stock only on these 4 — would cost an additional $85,000/year in holding costs but could eliminate roughly $340,000/year in disruption-related expediting costs. How much safety stock do you hold?',
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
            text: 'Your Llamasoft digital twin is running a Monte Carlo simulation on the next 90 days. It\'s flagging a 68% probability of severe congestion at the Port of Los Angeles — vessel backlog is building and labor contract negotiations expire in 6 weeks. Pre-positioning inventory to East Coast ports would cost $420,000 in incremental freight. Staying the course costs nothing — unless the model is right. The last time you ignored a 68% signal, it cost $1.1M in air freight to recover. What do you do?',
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
            text: 'Monday morning: Tian Hao Industrial — your sole-source supplier for precision-stamped chassis components representing 60% of your BOM by cost — has filed for Chapter 11 in the Shenzhen courts. They hold $1.2M of your open purchase orders. Your current inventory of chassis parts will run out in 18 days. After that, the production line stops. Your risk management plan lists two pre-vetted options — but each has a cost.',
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
            text: 'A US trade delegation just announced a Section 301 review of electronics components from your primary manufacturing region — a process that historically precedes 25-45% tariffs within 9 months. Your Shenzhen line produces 78% of your volume at a landed cost of $48/unit. A Monterrey, Mexico facility quotes $56/unit with 2-week lead time (vs. 8 weeks from Asia). The Q3 capital allocation deadline is in 3 weeks. Once you commit capital, reversing course mid-year costs an additional $800,000.',
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
            text: 'The White House announced Section 232 tariffs of 25% on consumer electronics components from China, effective in 60 days. At your current run rate of 4,200 units/quarter, this adds $504,000/year to your cost base at today\'s volume. Your stock is down 8% on the news. Competitors are scrambling. The board wants a response strategy before markets open tomorrow.',
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
            text: 'Your 3PL invoice hit $1.4M this quarter — up 31% year-on-year. The breakdown is uncomfortable: last-mile delivery is $742,000, or 53% of total freight spend, averaging 8.3 miles per stop. Amazon\'s same-day delivery guarantee has permanently reset customer expectations. Your Columbus regional hub can\'t match it without going to premium courier rates that wipe out your margin. Three options are modelled out. Which do you choose?',
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
            text: 'Your Suzhou factory just finished a 6,400-unit production run for your biggest European retail account — a €2.1M order with a firm shelf date of October 15th. Today is September 1st. Ocean freight: 28-35 days, $4.20/kg. China-Europe rail: 18-22 days, $6.80/kg. Air freight: 5-7 days, $18.40/kg. The order weighs 14,200 kg. Miss the shelf date and you forfeit a €40,000 late penalty. Pick the wrong mode and you burn margin.',
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
            text: 'Your EU expansion goes live in 90 days: France, Germany, and Italy simultaneously. Each country requires country-specific REACH restricted-substance declarations, CE recertification, and customs broker documentation. Your US compliance team says they can handle it manually. Your EU customs consultant says you need a trade management software platform at €24,000 upfront — or you risk container seizures. A competitor\'s container was held 6 weeks in Hamburg last year over a single incorrect HS code classification, costing €310,000 in delays and penalties.',
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
            text: 'Freight disputes cost you $2.1M last year — mostly arguments over damage handoff liability between your 3 ocean carriers, 2 inland truckers, and 3 customs brokers. The TradeLens consortium (backed by Maersk and IBM) promises immutable event timestamps across all parties, cutting dispute resolution from weeks to hours. Your two largest ocean carriers — Maersk and Hapag-Lloyd — are already on the platform. Your inland trucking partners are not. How do you proceed?',
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
            text: '6:00pm Wednesday: your QA lead ran AQL Level II sampling on the latest production batch — 42,000 units scheduled to ship to Home Depot at 8:00am tomorrow. Result: 4.2% defect rate, double the 2.0% AQL threshold. Batch value: $1.8M. Full rework takes 12 days. Home Depot\'s penalty clause for a missed delivery is $45,000 plus potential delisting. Your team has 14 hours and three options.',
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
            text: 'Your annual audit of Dongguan Electronics — 68% of your critical components at $41/unit — flagged a material substitution: they\'ve been using a cheaper capacitor grade in 3 PCB positions without disclosure. No failure in current performance testing, but your reliability engineer projects an 18% reduction in mean-time-to-failure over a 3-year horizon. They\'re 20% cheaper than any alternative. No customer complaint has been filed. Yet.',
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
            text: 'Line 4 has a 3.8% defect rate — nearly double your factory average. Root cause: a torque variability issue on the press that only manifests during high-run-rate shifts. Human inspectors catch defects after they\'re already made. A Samsara IoT installation with an Azure ML model trained on vibration signatures could catch it in real time — $210,000 for Line 4 alone, $1.26M for all 6 lines. Your quality director has the ROI model ready. How do you proceed?',
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
            text: 'An internal audit at your Chengdu facility found that 14 of the last 20 quality rejection reports were overridden by floor managers. When questioned, three managers gave the same answer: "My quarterly bonus is $4,200 for hitting output targets. There\'s nothing in my comp plan for quality." Your quality director wants heads to roll. Your HR lead says the comp plan is the problem. Your operations VP says it\'s both. You have a Monday morning all-hands with the Chengdu team.',
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
            text: 'The EU Corporate Sustainability Reporting Directive (CSRD) applies to your fiscal year starting January 1st — 9 months away. You must report full Scope 3 emissions, covering your suppliers\' manufacturing footprint. Your current measurement covers Scope 1 and 2 only — about 28% of your actual carbon exposure. Accurate Scope 3 data requires emissions reports from 47 suppliers across 11 countries. Some of your largest suppliers have never measured their own emissions. Clock is ticking.',
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
            text: 'Sunday evening: The Guardian publishes a 3,000-word investigation linking your brand to forced overtime and below-minimum wages at a tier-2 stitching sub-contractor in Bangladesh — a factory you\'ve never audited because your tier-1 supplier manages that relationship. The article has 140,000 shares by Monday morning. Two activist groups are organizing a Twitter boycott. Your PR firm says you have a 6-hour window to set the narrative before the evening news cycle locks in the story.',
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
            text: 'Your circular economy program requires 3 competencies your 420-person supply chain team doesn\'t have: reverse logistics engineering, material recovery grading, and lifecycle cost analysis. LinkedIn market data puts specialists at $85,000–$110,000/year — 35% above your current supply chain average. Retraining existing staff takes 6-9 months. Hiring externally gets you to speed in 2 months but fractures team culture. Outsourcing is fastest but creates dependency on a vendor for a core strategic capability.',
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
            text: 'Product roadmap decision: Design A is a 3% cost reduction on the current architecture — fast to market in Q2, no surprises. Design B is modular, design-for-disassembly, 40% recycled aluminum — costs 15% more per unit, ships Q4, qualifies for the EU Eco-Design Regulation label, and eliminates a projected $380,000/year in end-of-life disposal costs. The EU label unlocks 3 major retail accounts currently blocked to you. Your board wants a decision today.',
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
            text: 'Tuesday morning — three alerts open simultaneously. (1) Kinpo Electronics flagged a 4-week delay on 2,000 units: typhoon damage at Kaohsiung Port. (2) A promotional email sent prematurely by marketing has generated 3,400 pre-orders against a 1,200-unit plan. (3) The yuan weakened 6% overnight, adding ~$62,000 to your open PO values. Your team is looking at you. Every lesson from the past 4 chapters leads to this moment. How do you respond?',
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
            text: 'You\'re down-selecting between two suppliers for a 3-year contract worth ~$4.8M in annual spend. Apex Manufacturing (Chengdu): $41/unit, 8-week lead time, 2.1% historical defect rate. Mesa Components (Monterrey): $54/unit, 2-week lead time, 0.4% defect rate. Apex looks cheaper on the invoice — but your TCO model, which folds in inspection costs, holding costs, and average stockout exposure, tells a different story. Which supplier earns the contract?',
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
            text: 'Your quarterly TCO review surfaced a number nobody had tracked: currency volatility added $217,000 to your procurement costs last year — 12.4% above your budget. Your CFO has arranged hedging contracts through HSBC that lock the USD/CNY rate for 6 months at a 3% premium (~$52,000). Analyst consensus: 60% probability the yuan weakens further (hedging saves you money), 40% it strengthens (hedging costs you extra). You\'re buying insurance on a coin flip — but the alternative is another $217K surprise.',
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
            text: 'Your new TCO scorecard is built and ready — but in yesterday\'s town hall, the APAC procurement director said it plainly: "My bonus is tied to unit price savings. This scorecard measures 6 metrics I\'ve never been held accountable for." Across 4 regions, 23 procurement managers have compensation tied to the metric you\'re replacing. You need 80% adoption within 90 days to hit the board\'s cost-reduction target. How do you execute the change?',
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
