// Scenario briefings: statements about the player's current position come
// from live game state, and saved copies of old wording are not shown.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { withSeed } from './helpers.mjs';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';
import { CHAPTER_SCENARIOS } from '../src/data/scenarios-expanded.js';
import { EXPANSION_CHAPTER_SCENARIOS } from '../src/data/expansion-scenarios.js';
import { scenarioText } from '../src/logic/scenario-text.js';
import { buildSnapshot, restoreSnapshot } from '../src/logic/save-game.js';

const ALL = [...Object.values(CHAPTER_SCENARIOS), ...Object.values(EXPANSION_CHAPTER_SCENARIOS)].flat();
const byId = (id) => ALL.find(s => s.id === id);

/** Engine in the story phase of its first quarter with `scenarioId` as the briefing. */
function storyEngine(industryId, startChapter, scenarioId) {
    const engine = new GameEngine();
    engine.init(industryId, true, startChapter);
    engine.advanceFromChapterIntro();
    assert.equal(engine.state.phase, GAME_PHASES.STORY);
    if (scenarioId) engine.state.currentScenario = byId(scenarioId);
    return engine;
}

test('FMCG opening briefing states the real stock, baseline and next quarter', () => {
    withSeed(4, () => {
        const engine = storyEngine('fmcg', 0, 'steady_seas');
        engine.state.inventory = 270;   // a low-stock starting archetype
        const text = scenarioText(engine.state.currentScenario, engine.state);
        assert.match(text, /your warehouse holds 270 units/);
        assert.match(text, /^Your baseline forecast is about 1,000 units a quarter\./);
        assert.match(text, /before Q2 begins/);
        assert.doesNotMatch(text, /1,450|987 units|\{/);
    });
});

test('later-chapter briefings use that run\'s state (last quarter, stock, next quarter)', () => {
    withSeed(6, () => {
        const engine = storyEngine('pharma', 4, 'steady_seas');
        const s = engine.state;
        s.lastTurnResult = { demand: 1234, sales: 1100 };
        const text = scenarioText(s.currentScenario, s);
        assert.match(text, /^Last quarter's demand was 1,234 units\./);
        assert.match(text, new RegExp(`holds ${s.inventory.toLocaleString('en-US')} units`));
        assert.match(text, new RegExp(`before Q${s.turn + 1} begins`));

        const holiday = scenarioText(byId('holiday_approaching'), s);
        assert.match(holiday, new RegExp(`You hold ${s.inventory.toLocaleString('en-US')} units, and an order placed now can't arrive before Q${s.turn + 1}`));
        assert.match(holiday, /past POS data/, 'historical figures are labelled as history');
    });
});

test('Electronics expansion briefing reports stock on the way from state', () => {
    withSeed(9, () => {
        const engine = storyEngine('electronics', 8, 'red_sea_rerouting');
        const s = engine.state;
        assert.match(scenarioText(s.currentScenario, s), /with nothing on the way\./);
        s.inTransit = [
            { usableUnits: 900, passedDefects: 12, arrivesOnTurn: s.turn + 2 },
            { usableUnits: 400, passedDefects: 0, arrivesOnTurn: s.turn + 1 },
        ];
        assert.match(scenarioText(s.currentScenario, s), new RegExp(`You hold ${s.inventory.toLocaleString('en-US')} units, with 1,312 units on the way \\(the next due in Q${s.turn + 1}\\)\\.`));
    });
});

test('a saved copy with outdated wording shows the corrected briefing after resume', () => {
    withSeed(12, () => {
        const engine = storyEngine('fmcg', 0, 'steady_seas');
        // Older saves carry the pre-fix wording inside currentScenario / shuffledScenarios
        engine.state.currentScenario = { ...byId('steady_seas'), text: 'Q1 just closed with 987 units sold … your warehouse holds 1,450 units.' };
        engine.state.inventory = 270;
        const snap = JSON.parse(JSON.stringify(buildSnapshot(engine)));
        const resumed = new GameEngine();
        resumed.init('fmcg', true, 0);
        restoreSnapshot(resumed, snap);
        assert.equal(resumed.state.currentScenario.text.includes('1,450'), true, 'the save itself is untouched');
        const text = scenarioText(resumed.state.currentScenario, resumed.state);
        assert.match(text, /holds 270 units/);
        assert.doesNotMatch(text, /1,450/);
    });
});

test('every briefing renders without leftover tokens or fixed current-position numbers', () => {
    withSeed(2, () => {
        const engine = storyEngine('fmcg', 0);
        for (const sc of ALL) {
            assert.doesNotMatch(scenarioText(sc, engine.state), /\{\w+\}/, sc.id);
            // Statements of the player's current stock / inbound shipments must come from state, not fixed numbers
            assert.doesNotMatch(sc.text, /warehouse holds \d|inventory sits at \d|\d+ days of stock|your inbound shipments|run rate of [\d,]+ units/i, sc.id);
        }
        // An unknown scenario still renders its own text
        assert.equal(scenarioText({ id: 'nope', text: 'Plain {stock}' }, engine.state), `Plain ${engine.state.inventory.toLocaleString('en-US')}`);
    });
});
