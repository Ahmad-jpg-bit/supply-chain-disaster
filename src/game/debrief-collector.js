/**
 * debrief-collector.js
 * Singleton that silently captures all gameplay data needed for the post-game
 * debrief report.  No UI — pure data collection and localStorage persistence.
 *
 * localStorage key: scd_debrief_v1
 *
 * Public API
 * ----------
 * DebriefCollector.init(meta)                  — call at game start
 * DebriefCollector.recordStoryDecision(data)   — call in engine.makeDecision()
 * DebriefCollector.recordDecision(quarterData) — call after each processTurn()
 * DebriefCollector.recordChapterEnd(summary)   — call when phase → CHAPTER_SUMMARY
 * DebriefCollector.recordCrisisEvent(event)    — call whenever a crisis fires
 * DebriefCollector.getFullReport()             — returns the complete data object
 * DebriefCollector.clear()                     — wipe localStorage + in-memory state
 */

const LS_KEY = 'scd_debrief_v1';

class _DebriefCollector {
    constructor() {
        /** @type {DebriefReport|null} */
        this._data = null;
    }

    // ─── Initialisation ───────────────────────────────────────────────────────

    /**
     * Start a fresh debrief session.  Must be called once per game (init /
     * initEndless) before any other methods.
     *
     * @param {object} meta
     * @param {string}  meta.industry          - industry id ('electronics'|'fmcg'|'pharma')
     * @param {number}  meta.chapterIndex       - starting chapter index (0-based)
     * @param {string}  meta.startTime          - ISO 8601 timestamp
     * @param {number}  meta.initialCash        - cash at game start
     * @param {number}  meta.initialInventory   - inventory at game start
     * @param {string}  meta.startingArchetype  - archetype id rolled at start
     * @param {boolean} [meta.expansionActive]  - true if expansion bundle active
     * @param {boolean} [meta.isEndless]        - true for endless survival mode
     */
    init(meta) {
        this._data = {
            // ── Session metadata ──
            industry:          meta.industry,
            startChapterIndex: meta.chapterIndex,
            startTime:         meta.startTime || new Date().toISOString(),
            initialCash:       meta.initialCash,
            initialInventory:  meta.initialInventory,
            startingArchetype: meta.startingArchetype,
            expansionActive:   meta.expansionActive ?? false,
            isEndless:         meta.isEndless ?? false,

            // ── Per-turn records ──
            // One entry per quarter (procurement turn), in play order.
            quarters: [],

            // ── Story decision log ──
            // One entry per makeDecision() call — fixes the audit's biggest blind
            // spot: the story choice is otherwise overwritten each turn.
            storyDecisions: [],

            // ── Chapter-end snapshots ──
            // One entry per chapter completion (not populated in endless mode).
            chapters: [],

            // ── Crisis log ──
            // All micro-crisis events that fired, across all turns.
            crisisEvents: [],
        };

        this._persist();
    }

    // ─── Per-turn recording ───────────────────────────────────────────────────

    /**
     * Record the story decision made before each procurement turn.
     * Call from engine.makeDecision() after mastery.recordDecision() and
     * before changing the phase.
     *
     * @param {object} data
     * @param {number}  data.turn           - current turn number
     * @param {number}  data.chapter        - current chapter number
     * @param {string}  data.scenarioId     - scenario.id
     * @param {string}  data.scenarioTitle  - scenario.title
     * @param {number}  data.optionIndex    - 0-based index of the chosen option
     * @param {string}  data.optionLabel    - choice.label
     * @param {string}  data.optionText     - choice.outcomeText
     * @param {string}  data.alignment      - 'optimal' | 'cautious' | 'risky'
     */
    recordStoryDecision(data) {
        if (!this._data) return;
        this._data.storyDecisions.push({
            turn:          data.turn,
            chapter:       data.chapter,
            scenarioId:    data.scenarioId,
            scenarioTitle: data.scenarioTitle,
            optionIndex:   data.optionIndex,
            optionLabel:   data.optionLabel,
            optionText:    data.optionText,
            alignment:     data.alignment,
            timestamp:     new Date().toISOString(),
        });
        this._persist();
    }

    /**
     * Record the operational outcome of a completed procurement quarter.
     * Call from engine.processTurn() after the result object is built.
     *
     * Expected shape (all fields optional — missing ones are omitted):
     * {
     *   quarter, chapter,
     *   playerOrder, optimalOrder, orderDeviation,
     *   inventoryLevel, demandActual, demandForecast,
     *   serviceLevel, cashPosition,
     *   supplierSelected, qualityInspectionEnabled,
     *   inspectionTier, shippingMethod, pricingStrategy,
     *   timestamp
     * }
     *
     * @param {object} quarterData
     */
    recordDecision(quarterData) {
        if (!this._data) return;
        this._data.quarters.push({
            ...quarterData,
            timestamp: quarterData.timestamp || new Date().toISOString(),
        });
        this._persist();
    }

    // ─── Chapter-end snapshot ─────────────────────────────────────────────────

    /**
     * Record the aggregate performance snapshot for a completed chapter.
     * Call from engine.processTurn() when phase transitions to CHAPTER_SUMMARY.
     *
     * Expected shape:
     * {
     *   chapter, chapterId, chapterTitle, industry,
     *   finalScore, mastered,
     *   decisionsTotal, decisionsOptimal, decisionsCautious, decisionsRisky,
     *   avgServiceLevel, totalStockouts, totalOverstock,
     *   cashStart, cashEnd, cashDelta,
     *   bullwhipRatio,
     *   crisisEvents[],
     *   completedAt
     * }
     *
     * @param {object} chapterSummary
     */
    recordChapterEnd(chapterSummary) {
        if (!this._data) return;
        this._data.chapters.push({
            ...chapterSummary,
            completedAt: chapterSummary.completedAt || new Date().toISOString(),
        });
        this._persist();
    }

    // ─── Crisis event log ─────────────────────────────────────────────────────

    /**
     * Record a micro-crisis event that fired this turn.
     * Call from engine.processTurn() immediately after CrisisEngine.rollMicroCrisis()
     * returns a non-null result.
     *
     * @param {object} event
     * @param {number}  event.turn      - turn number when the crisis fired
     * @param {number}  event.chapter   - chapter number
     * @param {string}  event.id        - crisis.id
     * @param {string}  event.name      - crisis.name
     * @param {string}  event.severity  - 'low' | 'medium' | 'high' | 'positive'
     * @param {object}  event.effects   - shallow copy of crisis.effects
     * @param {string}  event.timestamp - ISO 8601
     */
    recordCrisisEvent(event) {
        if (!this._data) return;
        this._data.crisisEvents.push({
            ...event,
            timestamp: event.timestamp || new Date().toISOString(),
        });
        this._persist();
    }

    // ─── Report retrieval ─────────────────────────────────────────────────────

    /**
     * Return a shallow copy of the full debrief data object, or null if no
     * session has been initialised.
     *
     * @returns {DebriefReport|null}
     */
    getFullReport() {
        if (!this._data) return null;
        return {
            ...this._data,
            quarters:       [...this._data.quarters],
            storyDecisions: [...this._data.storyDecisions],
            chapters:       [...this._data.chapters],
            crisisEvents:   [...this._data.crisisEvents],
        };
    }

    // ─── Persistence helpers ──────────────────────────────────────────────────

    /**
     * Load a previously persisted session from localStorage into memory.
     * Safe to call on page load — no-ops if nothing is stored.
     */
    load() {
        try {
            const raw = localStorage.getItem(LS_KEY);
            if (raw) this._data = JSON.parse(raw);
        } catch {
            this._data = null;
        }
    }

    /**
     * Wipe both the in-memory state and the localStorage entry.
     * Call before starting a new game if you want a clean slate.
     */
    clear() {
        this._data = null;
        try { localStorage.removeItem(LS_KEY); } catch { /* quota errors are safe to ignore */ }
    }

    /** @private — write current state to localStorage. */
    _persist() {
        if (!this._data) return;
        try {
            localStorage.setItem(LS_KEY, JSON.stringify(this._data));
        } catch {
            // Storage quota exceeded — silently skip.
            // The in-memory _data is still intact for getFullReport().
        }
    }
}

/**
 * Singleton instance — import and use directly:
 *
 *   import { DebriefCollector } from '../game/debrief-collector.js';
 *   DebriefCollector.init({ industry: 'electronics', ... });
 */
export const DebriefCollector = new _DebriefCollector();
