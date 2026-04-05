import { INDUSTRIES } from './industries.js';
import { CHAPTER_SCENARIOS } from '../data/scenarios-expanded.js';
import { EXPANSION_CHAPTER_SCENARIOS } from '../data/expansion-scenarios.js';
import { CHAPTERS } from '../data/chapters.js';
import { EXPANSION_CHAPTERS } from '../data/expansion-chapters.js';
import { MasteryTracker } from './mastery.js';
import { SUPPLIERS, SHIPPING_METHODS, PRICING_STRATEGIES, QUALITY_INSPECTIONS } from '../data/procurement-options.js';
import { CrisisEngine } from './crisis-engine.js';

export const GAME_PHASES = {
    CHAPTER_INTRO: 'PHASE_CHAPTER_INTRO',
    STORY: 'PHASE_STORY',
    DECISION: 'PHASE_DECISION',
    PROCUREMENT: 'PHASE_PROCUREMENT',
    RESULTS: 'PHASE_RESULTS',
    CHAPTER_SUMMARY: 'PHASE_CHAPTER_SUMMARY',
    GAME_OVER: 'PHASE_GAME_OVER',
    ENDLESS_DEATH: 'PHASE_ENDLESS_DEATH',
};

export function getDefaultProcurementChoices() {
    return {
        supplierId: 'standard',
        shippingId: 'standard',
        orderQuantity: 1000,
        pricingId: 'standard',
        inspectionId: 'standard',
        safetyStockTarget: 500
    };
}

export class GameEngine {
    constructor() {
        this.state = {
            // Core State
            turn: 1,
            maxTurns: 32,
            phase: GAME_PHASES.CHAPTER_INTRO,

            // Chapter tracking
            currentChapter: null,
            chapterIndex: 0,
            scenarioIndex: 0,

            // Financials
            cash: 0,
            inventory: 0,
            backlog: 0,
            // In-transit pipeline: orders placed but not yet arrived
            // Each entry: { usableUnits, passedDefects, orderQuantity, arrivesOnTurn, supplierName, shippingName }
            inTransit: [],

            // Global Modifiers
            modifiers: {
                leadTime: 0,
                unitCost: 1.0,
                customerSatisfaction: 100
            },

            // Procurement choices (persisted between turns)
            procurementChoices: getDefaultProcurementChoices(),

            // Current Context
            industry: null,
            currentScenario: null,
            lastTurnResult: null,
            lastStoryChoice: null,   // { scenarioTitle, optionLabel, alignment }
            history: [],

            // Crisis Engine
            startingArchetype: null,    // archetype rolled at game start
            archetypeModifiers: {},     // persists across all turns (unlike story modifiers)
            lastCrisisId: null,         // prevents back-to-back same event
            activeCrisis: null,         // crisis that fired this turn (cleared each turn)

            // Endless Survival Mode
            isEndless: false,
            endlessWave: 1,
            endlessTurn: 0,
            endlessSatisfaction: 100,
            endlessScore: 0,
            endlessDeathCause: null,    // 'bankruptcy' | 'satisfaction' | null
        };

        this._allChapters = CHAPTERS;
        this._expansionActivated = false;
        this.mastery = new MasteryTracker();
    }

    /**
     * @param {string} industryId
     * @param {boolean} [expansionActive=false] - true if the user has the Expansion Bundle.
     */
    init(industryId, expansionActive = false, startChapterIndex = 0) {
        const industry = Object.values(INDUSTRIES).find(i => i.id === industryId);
        if (!industry) throw new Error('Invalid Industry');

        this._expansionActivated = false;
        this._allChapters = CHAPTERS;

        if (expansionActive) {
            this.activateExpansion();
        }

        const clampedStart = Math.max(0, Math.min(startChapterIndex, this._allChapters.length - 1));
        const startChapter  = this._allChapters[clampedStart];

        this.state.industry = industry;

        // Roll a starting archetype (only for a fresh game from chapter 1;
        // mid-game chapter jumps get a balanced baseline scaled for chapter depth).
        const archetype = clampedStart === 0
            ? CrisisEngine.rollStartingConditions()
            : { id: 'balanced', cashMultiplier: 1.0, inventoryMultiplier: 1.0, modifiers: {} };

        // Base capital + inventory scales for mid-game chapter unlocks
        const baseCash      = Math.round(industry.metrics.initialCapital * (1 + clampedStart * 0.2));
        const baseInventory = 1500 + clampedStart * 300;

        this.state.startingArchetype  = archetype;
        this.state.archetypeModifiers = { ...archetype.modifiers };
        this.state.cash      = Math.round(baseCash      * archetype.cashMultiplier);
        this.state.inventory = Math.round(baseInventory * archetype.inventoryMultiplier);
        this.state.inTransit = [];
        this.state.backlog   = 0;
        this.state.turn      = startChapter.turnsRange[0];
        this.state.maxTurns  = expansionActive ? 40 : 32;
        this.state.history   = [];
        this.state.chapterIndex   = clampedStart;
        this.state.scenarioIndex  = 0;
        this.state.currentChapter = startChapter;
        this.state.procurementChoices = getDefaultProcurementChoices();
        this.state.lastCrisisId  = null;
        this.state.activeCrisis  = null;

        // Shuffle scenarios for this playthrough to ensure uniqueness
        this._shuffleScenarios();

        this.mastery = new MasteryTracker();

        // Start with chapter intro
        this.state.phase = GAME_PHASES.CHAPTER_INTRO;
    }

    /**
     * Extends the game to include expansion chapters 9-10 (turns 33-40).
     * Safe to call multiple times — idempotent.
     */
    activateExpansion() {
        if (this._expansionActivated) return;
        this._allChapters = [...CHAPTERS, ...EXPANSION_CHAPTERS];
        this.state.maxTurns = 40;
        this._expansionActivated = true;
        // Shuffle expansion scenarios into the existing shuffled map
        for (const [chapterId, scenarios] of Object.entries(EXPANSION_CHAPTER_SCENARIOS)) {
            const shuffled = [...scenarios];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            if (!this.state.shuffledScenarios) this.state.shuffledScenarios = {};
            this.state.shuffledScenarios[chapterId] = shuffled;
        }
    }

    /**
     * Initialise an Endless Survival session.
     * No chapters, no story — pure procurement loop until cash < 0 or satisfaction reaches 0.
     */
    initEndless(industryId) {
        const industry = Object.values(INDUSTRIES).find(i => i.id === industryId);
        if (!industry) throw new Error('Invalid Industry');

        const archetype = CrisisEngine.rollStartingConditions();
        const baseCash      = Math.round(industry.metrics.initialCapital);
        const baseInventory = 1500;

        this.state.industry           = industry;
        this.state.isEndless          = true;
        this.state.endlessWave        = 1;
        this.state.endlessTurn        = 0;
        this.state.endlessSatisfaction = 100;
        this.state.endlessScore       = 0;
        this.state.endlessDeathCause  = null;

        this.state.startingArchetype  = archetype;
        this.state.archetypeModifiers = { ...archetype.modifiers };
        this.state.cash               = Math.round(baseCash      * archetype.cashMultiplier);
        this.state.inventory          = Math.round(baseInventory * archetype.inventoryMultiplier);
        this.state.inTransit          = [];
        this.state.backlog            = 0;
        this.state.turn               = 1;
        this.state.maxTurns           = Infinity;
        this.state.history            = [];
        this.state.chapterIndex       = 0;
        this.state.scenarioIndex      = 0;
        this.state.currentChapter     = null;
        this.state.currentScenario    = null;
        this.state.shuffledScenarios  = {};
        this.state.procurementChoices = getDefaultProcurementChoices();
        this.state.modifiers          = { leadTime: 0, unitCost: 1.0, customerSatisfaction: 100 };
        this.state.lastCrisisId       = null;
        this.state.activeCrisis       = null;
        this.state.lastTurnResult     = null;
        this.state.lastStoryChoice    = null;

        this.mastery = new MasteryTracker();

        // Begin immediately in procurement — no intros, no stories
        this.state.phase = GAME_PHASES.PROCUREMENT;
    }

    /** Compute current endless survival score. */
    _computeEndlessScore() {
        const turns = this.state.endlessTurn;
        const wave  = this.state.endlessWave;
        const cash  = Math.max(0, this.state.cash);
        const sat   = Math.max(0, this.state.endlessSatisfaction);
        return Math.round(turns * 100 + (wave - 1) * 500 + Math.floor(cash / 1000) * 5 + sat * 20);
    }

    _shuffleScenarios() {
        this.state.shuffledScenarios = {};
        const allScenarios = this._expansionActivated
            ? { ...CHAPTER_SCENARIOS, ...EXPANSION_CHAPTER_SCENARIOS }
            : CHAPTER_SCENARIOS;
        for (const [chapterId, scenarios] of Object.entries(allScenarios)) {
            // Fisher-Yates shuffle
            const shuffled = [...scenarios];
            for (let i = shuffled.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
            }
            this.state.shuffledScenarios[chapterId] = shuffled;
        }
    }

    // --- Internal chapter lookup (uses _allChapters to support expansion) ---
    _getChapterIndex(turn) {
        return this._allChapters.findIndex(ch => turn >= ch.turnsRange[0] && turn <= ch.turnsRange[1]);
    }

    _isLastTurnOfChapter(turn) {
        return this._allChapters.some(ch => ch.turnsRange[1] === turn);
    }

    // --- Get current chapter's scenarios ---
    getCurrentChapterScenarios() {
        const chapter = this.state.currentChapter;
        if (!chapter) return [];
        return this.state.shuffledScenarios[chapter.id] || [];
    }

    // --- PHASE: CHAPTER INTRO ---
    advanceFromChapterIntro() {
        this.state.phase = GAME_PHASES.STORY;
        this.triggerStoryPhase();
        return this.state;
    }

    // --- PHASE: STORY ---
    triggerStoryPhase() {
        this.state.phase = GAME_PHASES.STORY;

        // Determine current chapter from turn (supports base + expansion chapters)
        const chapterIdx = this._getChapterIndex(this.state.turn);
        if (chapterIdx >= 0) {
            this.state.chapterIndex = chapterIdx;
            this.state.currentChapter = this._allChapters[chapterIdx];
        }

        // Get scenario sequentially within the chapter using SHUFFLED list
        const chapter = this.state.currentChapter;
        const scenarios = this.state.shuffledScenarios[chapter.id] || [];
        const turnWithinChapter = this.state.turn - chapter.turnsRange[0];
        this.state.scenarioIndex = turnWithinChapter;

        const scenario = scenarios[turnWithinChapter];
        if (scenario) {
            this.state.currentScenario = scenario;
        } else {
            // Fallback: use first scenario if index out of bounds (shouldn't happen if data aligns)
            this.state.currentScenario = scenarios[0];
        }

        return this.state;
    }

    // --- PHASE: DECISION ---
    makeDecision(optionIndex) {
        if (this.state.phase !== GAME_PHASES.STORY) throw new Error('Not in Story Phase');

        const scenario = this.state.currentScenario;
        const choice = scenario.options[optionIndex];
        if (!choice) throw new Error('Invalid Option');

        // Apply Modifiers
        this.state.modifiers = { ...choice.modifiers };

        // Store story choice for procurement context banner
        this.state.lastStoryChoice = {
            scenarioTitle: scenario.title,
            optionLabel: choice.label,
            alignment: choice.conceptAlignment,
        };

        // Record mastery alignment
        if (choice.conceptAlignment && this.state.currentChapter) {
            this.mastery.recordDecision(this.state.currentChapter.id, choice.conceptAlignment);
        }

        this.state.phase = GAME_PHASES.PROCUREMENT;
        return {
            outcome: choice.outcomeText,
            alignment: choice.conceptAlignment,
            newState: this.state
        };
    }

    /**
     * Generate demand variance multiplier based on industry characteristics.
     * Returns { multiplier: number, event: string|null }
     *
     * Electronics: ±25%  — volatile consumer demand, seasonal spikes
     * FMCG:        ±8%   — steady replenishment, predictable
     * Pharma:      ±5%   baseline, but 15% chance of +40–60% regulatory demand spike
     */
    _generateDemandVariance(industryId) {
        switch (industryId) {
            case 'electronics':
                return { multiplier: 1 + (Math.random() * 0.5 - 0.25), event: null };
            case 'fmcg':
                return { multiplier: 1 + (Math.random() * 0.16 - 0.08), event: null };
            case 'pharma': {
                if (Math.random() < 0.15) {
                    // Regulatory/emergency demand spike: +40% to +60%
                    return { multiplier: 1 + 0.4 + Math.random() * 0.2, event: 'regulatory_spike' };
                }
                return { multiplier: 1 + (Math.random() * 0.1 - 0.05), event: null };
            }
            default:
                return { multiplier: 1 + (Math.random() * 0.2 - 0.1), event: null };
        }
    }

    /**
     * Compute how many turns an order will take to arrive.
     * Base lead time comes from the industry; supplier and shipping modifiers
     * (stored as weeks in the data) are converted at ~2 weeks per turn.
     * The scenario story modifier (storyLeadMod, also in weeks) is included too.
     * Minimum 1 turn — no same-turn delivery, even with premium + charter.
     */
    _computeLeadTimeTurns(supplier, shippingMethod, storyLeadMod, industryId) {
        const BASE_TURNS = { electronics: 2, fmcg: 1, pharma: 3 };
        const base = BASE_TURNS[industryId] ?? 2;
        // Positive delays round up; negative reductions round down
        const weekToTurn = (w) => w > 0 ? Math.ceil(w / 2) : Math.floor(w / 2);
        const total = base
            + weekToTurn(supplier.leadTimeModifier)
            + weekToTurn(shippingMethod.leadTimeModifier)
            + weekToTurn(storyLeadMod || 0);
        return Math.max(1, total);
    }

    // --- PHASE: PROCUREMENT & RESULTS ---
    processTurn(choices) {
        if (this.state.phase !== GAME_PHASES.PROCUREMENT) throw new Error('Not in Procurement Phase');

        // Support legacy call: processTurn(number)
        if (typeof choices === 'number') {
            choices = { ...this.state.procurementChoices, orderQuantity: choices };
        }

        // Save choices for next turn defaults
        this.state.procurementChoices = { ...choices };

        // Clear last turn's crisis
        this.state.activeCrisis = null;

        const { industry, modifiers, archetypeModifiers } = this.state;
        const industryId = industry.id;

        // Merge story-decision modifiers with persistent archetype modifiers
        const effectiveMods = {
            leadTime:             (modifiers.leadTime || 0)         + (archetypeModifiers?.leadTime || 0),
            unitCost:             (modifiers.unitCost ?? 1.0)        * (archetypeModifiers?.unitCost ?? 1.0),
            customerSatisfaction:  modifiers.customerSatisfaction ?? 100,
            demandMultiplier:     (modifiers.demandMultiplier ?? 1.0) * (archetypeModifiers?.demandMultiplier ?? 1.0),
        };

        // Endless mode: scale difficulty by wave
        if (this.state.isEndless && this.state.endlessWave > 1) {
            const wave = this.state.endlessWave;
            effectiveMods.demandMultiplier *= (1 + (wave - 1) * 0.05);  // +5% demand per wave
            effectiveMods.unitCost         *= (1 + (wave - 1) * 0.04);  // +4% cost per wave
        }

        // Roll micro-crisis for this turn
        // In endless mode use wave as an analogue of chapter depth for crisis scaling
        const crisisChapterDepth = this.state.isEndless
            ? Math.max(0, this.state.endlessWave - 1)
            : this.state.chapterIndex;
        const crisis = CrisisEngine.rollMicroCrisis(this.state, crisisChapterDepth);
        if (crisis) {
            this.state.activeCrisis = crisis;
            this.state.lastCrisisId = crisis.id;
        } else {
            this.state.lastCrisisId = null;
        }

        // Resolve procurement options
        const suppliers = SUPPLIERS[industryId] || SUPPLIERS.electronics;
        const supplier = suppliers.find(s => s.id === choices.supplierId) || suppliers[1];
        const shippingMethod = SHIPPING_METHODS.find(s => s.id === choices.shippingId) || SHIPPING_METHODS[1];
        const pricingStrategy = PRICING_STRATEGIES.find(p => p.id === choices.pricingId) || PRICING_STRATEGIES[1];
        const inspection = QUALITY_INSPECTIONS.find(q => q.id === choices.inspectionId) || QUALITY_INSPECTIONS[1];
        const orderQuantity = choices.orderQuantity || 0;

        // 0. Receive any in-transit orders arriving this turn
        const arrivingOrders = this.state.inTransit.filter(o => o.arrivesOnTurn <= this.state.turn);
        this.state.inTransit = this.state.inTransit.filter(o => o.arrivesOnTurn > this.state.turn);
        const unitsReceived = arrivingOrders.reduce((sum, o) => sum + o.usableUnits + o.passedDefects, 0);
        this.state.inventory = Math.max(0, this.state.inventory + unitsReceived);

        // 1. Calculate Costs with Modifiers (+ crisis overlays)
        const baseCost = 100;
        const unitCost = baseCost * supplier.costMultiplier * effectiveMods.unitCost
            * (crisis?.effects?.costMultiplier ?? 1.0);
        const orderCost = orderQuantity * unitCost;
        const shippingCost = orderQuantity * shippingMethod.costPerUnit
            * (crisis?.effects?.shippingCostBoost ?? 1.0);
        const inspectionCost = orderQuantity * inspection.costPerUnit;

        // 2. Defect handling — crisis can boost effective defect rate; endless wave scales it further
        const waveDefectBonus = this.state.isEndless ? (this.state.endlessWave - 1) * 0.015 : 0;
        const effectiveDefectRate = supplier.defectRate + (crisis?.effects?.defectRateBoost ?? 0) + waveDefectBonus;
        const totalDefective = Math.floor(orderQuantity * effectiveDefectRate);
        const caughtDefects = Math.floor(totalDefective * inspection.defectCatchRate);
        const passedDefects = totalDefective - caughtDefects;
        const usableUnits = orderQuantity - totalDefective;
        const defectDisposalCost = caughtDefects * (baseCost * 0.3);

        // 3. Demand Generation (Base + Industry Volatility + Story Modifier + Pricing + Crisis)
        const demandBase = 1000;
        const { multiplier: demVolMult, event: demandEvent } = this._generateDemandVariance(industryId);
        const demand = Math.floor(
            demandBase
            * demVolMult
            * effectiveMods.demandMultiplier
            * pricingStrategy.demandMultiplier
            * (crisis?.effects?.demandMultiplier ?? 1.0)
        );

        // 3b. Crisis inventory loss (cold chain failure, recall) — applied before sales
        let crisisInventoryLost = 0;
        if (crisis?.effects?.inventoryLoss) {
            crisisInventoryLost = Math.floor(this.state.inventory * crisis.effects.inventoryLoss);
            this.state.inventory = Math.max(0, this.state.inventory - crisisInventoryLost);
        }

        // 3c. Supplier capacity cut — reduces effective order quantity dispatched
        const effectiveOrderQty = crisis?.effects?.capacityCut
            ? Math.floor(orderQuantity * (1 - crisis.effects.capacityCut))
            : orderQuantity;

        // 4. Fulfill Demand (including backlog carry-over from previous turn)
        const effectiveDemand = demand + this.state.backlog;
        const sales = Math.min(this.state.inventory, effectiveDemand);
        const missedSales = Math.max(0, demand - this.state.inventory);
        const newBacklog = Math.max(0, effectiveDemand - sales);
        const backlogSatisfactionPenalty = newBacklog > 0 ? Math.min(25, newBacklog * 0.01) : 0;

        // 5. Revenue & Financials
        const basePrice = baseCost * (1 + industry.metrics.baseMargin);
        const revenue = sales * basePrice * pricingStrategy.priceMultiplier;
        // Option 7: industry-specific holding costs
        const HOLDING_RATES = { electronics: 0.07, fmcg: 0.04, pharma: 0.09 };
        const holdingRate = HOLDING_RATES[industryId] ?? 0.05;
        const holdingCost = (this.state.inventory * baseCost) * holdingRate;

        const totalCost = orderCost + shippingCost + inspectionCost + defectDisposalCost + holdingCost;
        const profit = revenue - totalCost;

        // 6. Customer satisfaction: defects + backlog + safety stock breach
        const defectSatisfactionPenalty = passedDefects > 0 ? Math.min(passedDefects * 0.5, 20) : 0;
        const postSaleInventory = Math.max(0, this.state.inventory - sales);
        const safetyStockTarget = choices.safetyStockTarget ?? 500;
        const safetyBreach = postSaleInventory < safetyStockTarget;
        const safetyBreachPenalty = safetyBreach
            ? Math.min(15, (safetyStockTarget - postSaleInventory) * 0.015)
            : 0;
        const netSatisfaction = (effectiveMods.customerSatisfaction || 0)
            - defectSatisfactionPenalty
            - backlogSatisfactionPenalty
            - safetyBreachPenalty;

        // 7. Compute lead time and dispatch new order (with crisis capacity cut applied)
        const leadTimeTurns = this._computeLeadTimeTurns(supplier, shippingMethod, effectiveMods.leadTime, industryId);
        const arrivesOnTurn = this.state.turn + leadTimeTurns;
        if (effectiveOrderQty > 0) {
            this.state.inTransit.push({
                usableUnits:   Math.floor(usableUnits   * (effectiveOrderQty / (orderQuantity || 1))),
                passedDefects: Math.floor(passedDefects * (effectiveOrderQty / (orderQuantity || 1))),
                orderQuantity: effectiveOrderQty,
                arrivesOnTurn,
                supplierName: supplier.name,
                shippingName: shippingMethod.name
            });
        }

        // 7b. Transit delay crisis — delays all pending in-transit orders
        if (crisis?.effects?.transitDelay) {
            this.state.inTransit.forEach(o => {
                o.arrivesOnTurn += crisis.effects.transitDelay;
            });
        }

        // 8. Update state — inventory decreases by sales only; new order is in transit, not on shelf yet
        this.state.cash += profit;

        // 8b. Crisis cash adjustments (penalty or windfall)
        if (crisis?.effects?.cashPenalty) this.state.cash -= crisis.effects.cashPenalty;
        if (crisis?.effects?.cashBonus)   this.state.cash += crisis.effects.cashBonus;

        this.state.inventory = Math.max(0, this.state.inventory - sales);
        this.state.backlog = newBacklog;

        // 9. Record Result
        const result = {
            turn: this.state.turn,
            chapter: this.state.currentChapter ? this.state.currentChapter.number : 0,
            scenario: this.state.currentScenario?.title ?? `Wave ${this.state.endlessWave}`,
            demand,
            demandEvent,
            sales,
            missedSales,
            backlog: newBacklog,
            safetyBreach,
            safetyStockTarget,
            orderQuantity,
            usableUnits,
            // Cost breakdown
            orderCost,
            shippingCost,
            inspectionCost,
            defectDisposalCost,
            holdingCost,
            totalCost,
            revenue,
            profit,
            cash: this.state.cash,
            inventory: this.state.inventory,
            satisfaction: netSatisfaction,
            // Quality metrics
            defectsFound: caughtDefects,
            defectsPassed: passedDefects,
            // Lead time data
            leadTimeTurns,
            arrivesOnTurn,
            unitsReceived,
            unitsInTransit: this.state.inTransit.reduce((sum, o) => sum + o.usableUnits + o.passedDefects, 0),
            // Choices made
            supplier: supplier.name,
            shipping: shippingMethod.name,
            pricing: pricingStrategy.name,
            inspection: inspection.name,
            // Active crisis (null if none fired this turn)
            crisis: crisis ? {
                id:              crisis.id,
                name:            crisis.name,
                ticker:          crisis.ticker,
                severity:        crisis.severity,
                consequenceText: crisis.consequenceText,
                effects:         crisis.effects,
                crisisInventoryLost,
            } : null,
        };

        this.state.history.push(result);
        this.state.lastTurnResult = result;

        // 9. Advance Turn
        this.state.turn++;

        if (this.state.isEndless) {
            // Update cumulative satisfaction (carries over between turns)
            const totalPenalty = defectSatisfactionPenalty + backlogSatisfactionPenalty + safetyBreachPenalty;
            const baseRecovery = 2; // small per-turn recovery
            this.state.endlessSatisfaction = Math.min(100, Math.max(0,
                this.state.endlessSatisfaction - totalPenalty + baseRecovery
            ));

            // Advance endless turn counter and derive wave
            this.state.endlessTurn++;
            this.state.endlessWave = Math.floor((this.state.endlessTurn - 1) / 5) + 1;

            // Update score
            this.state.endlessScore = this._computeEndlessScore();

            // Patch result with live endless state
            result.endlessWave          = this.state.endlessWave;
            result.endlessTurn          = this.state.endlessTurn;
            result.endlessSatisfaction  = this.state.endlessSatisfaction;
            result.endlessScore         = this.state.endlessScore;

            // Death conditions
            if (this.state.cash < 0) {
                this.state.endlessDeathCause = 'bankruptcy';
                this.state.phase = GAME_PHASES.ENDLESS_DEATH;
            } else if (this.state.endlessSatisfaction <= 0) {
                this.state.endlessDeathCause = 'satisfaction';
                this.state.phase = GAME_PHASES.ENDLESS_DEATH;
            } else {
                // Loop straight back to procurement — no story phases
                this.state.phase = GAME_PHASES.PROCUREMENT;
            }
        } else {
            const wasLastTurnOfChapter = this._isLastTurnOfChapter(this.state.turn - 1);
            if (this.state.turn > this.state.maxTurns) {
                this.state.phase = GAME_PHASES.GAME_OVER;
            } else if (wasLastTurnOfChapter) {
                this.state.phase = GAME_PHASES.CHAPTER_SUMMARY;
            } else {
                this.triggerStoryPhase();
            }
        }

        return this.state;
    }

    // --- PHASE: CHAPTER SUMMARY ---
    advanceFromChapterSummary() {
        // Move to next chapter's intro (supports base + expansion chapters)
        const nextChapterIdx = this.state.chapterIndex + 1;
        if (nextChapterIdx < this._allChapters.length) {
            this.state.chapterIndex = nextChapterIdx;
            this.state.currentChapter = this._allChapters[nextChapterIdx];
            this.state.phase = GAME_PHASES.CHAPTER_INTRO;
        } else {
            this.state.phase = GAME_PHASES.GAME_OVER;
        }
        return this.state;
    }
}
