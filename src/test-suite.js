import { GameEngine, GAME_PHASES } from './logic/engine.js';

export function runStorySimulation(industryId = 'electronics', turns = 32) {
    console.log(`Starting Story Simulation for ${industryId} (${turns} turns)...`);
    const engine = new GameEngine();
    try {
        engine.init(industryId);
    } catch (e) {
        console.error(e.message);
        return;
    }

    let totalProfit = 0;

    for (let i = 1; i <= turns; i++) {
        // Handle chapter intro if present
        if (engine.state.phase === GAME_PHASES.CHAPTER_INTRO) {
            const ch = engine.state.currentChapter;
            console.log(`\n=== CHAPTER ${ch.number}: ${ch.title} ===`);
            engine.advanceFromChapterIntro();
        }

        // Check Phase (Should be STORY)
        if (engine.state.phase !== GAME_PHASES.STORY) {
            console.warn(`Unexpected phase at start of turn ${i}: ${engine.state.phase}`);
            break;
        }

        const scenario = engine.state.currentScenario;
        console.log(`\nTurn ${i} Story: "${scenario.title}"`);
        console.log(`Scenario: ${scenario.text.substring(0, 50)}...`);

        // Make Decision (Randomly pick option 0, 1, or 2)
        const randomOption = Math.floor(Math.random() * scenario.options.length);
        const choice = scenario.options[randomOption];
        console.log(`Decision: ${choice.label} [${choice.conceptAlignment}]`);

        const { outcome } = engine.makeDecision(randomOption);
        console.log(`Outcome: ${outcome}`);

        // Procurement Phase
        if (engine.state.phase !== GAME_PHASES.PROCUREMENT) {
            console.error('Failed to transition to Procurement phase!');
            break;
        }

        // Pass full procurement choices
        const procurementChoices = {
            supplierId: ['budget', 'standard', 'premium'][Math.floor(Math.random() * 3)],
            shippingId: ['express', 'standard', 'economy'][Math.floor(Math.random() * 3)],
            orderQuantity: 800 + Math.floor(Math.random() * 400),
            pricingId: ['premium', 'standard', 'discount'][Math.floor(Math.random() * 3)],
            inspectionId: ['none', 'standard', 'rigorous'][Math.floor(Math.random() * 3)],
            safetyStockTarget: 500
        };

        const resultState = engine.processTurn(procurementChoices);
        const result = resultState.lastTurnResult;

        console.log(`Result: Profit $${Math.round(result.profit)}, Cash $${Math.round(result.cash)}, Sat: ${result.satisfaction}`);
        console.log(`  Costs: Order $${Math.round(result.orderCost)} | Ship $${Math.round(result.shippingCost)} | QC $${Math.round(result.inspectionCost)} | Hold $${Math.round(result.holdingCost)}`);
        console.log(`  Quality: ${result.defectsFound} caught, ${result.defectsPassed} passed | Supplier: ${result.supplier}`);
        totalProfit += result.profit;

        if (engine.state.phase === GAME_PHASES.GAME_OVER) {
            console.log('GAME OVER Reached');
            break;
        }

        // Handle chapter summary between chapters
        if (engine.state.phase === GAME_PHASES.CHAPTER_SUMMARY) {
            const chIdx = engine.state.chapterIndex;
            const summary = engine.mastery.getChapterSummary(engine.state.currentChapter.id);
            console.log(`\n--- Chapter ${chIdx + 1} Summary: Score ${summary.score}/${summary.maxScore} ${summary.mastered ? '[MASTERED]' : '[LEARNING]'} ---`);
            engine.advanceFromChapterSummary();
        }
    }

    console.log('\n--- Simulation Ended ---');
    console.log(`Final Cash: ${engine.state.cash}`);
    console.log(`Total Turns Played: ${engine.state.history.length}`);
    const overall = engine.mastery.getOverallScore();
    console.log(`Mastery: ${overall.masteredCount}/${overall.totalConcepts} concepts mastered (${overall.percentage}%)`);
    return engine.state;
}

if (typeof window !== 'undefined') {
    window.runStoryTest = runStorySimulation;
}
