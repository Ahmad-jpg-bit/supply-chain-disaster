/**
 * Save game — full campaign snapshots that can resume at any turn.
 *
 * Format (saveVersion 2) is a SUPERSET of the original chapter-boundary
 * gameState written by Dashboard._autoSave(): the legacy top-level fields stay
 * (so /api/save-game emails, recall-cron and older readers keep working) and a
 * `snapshot` adds everything needed to continue mid-chapter — the rest of the
 * engine state, the mastery tracker, the debrief log and a few UI extras.
 *
 * Used for both the automatic local save (this browser) and the email backup.
 */

import { GAME_PHASES } from './engine.js';
import { DebriefCollector } from '../game/debrief-collector.js';

export const LOCAL_SAVE_KEY = 'scd_local_save_v1';
export const SAVE_VERSION = 2;

/**
 * Packaging version stamped into every campaign started under the free-intro /
 * Core Game Pass model. Saves WITHOUT it were started when the whole campaign
 * was free, so they stay playable to the end (grandfathered). Never deleted.
 */
export const PACKAGING_VERSION = 2;

/** True when a stored gameState predates the current packaging (→ grandfathered). */
export function isPrePackagingSave(gs) {
    const state = gs?.snapshot?.state;
    if (state?.grandfathered) return true;
    return !(Number(state?.packagingVersion) >= PACKAGING_VERSION);
}

/** Phases a campaign can be saved in (and resumed from). */
export const SAVEABLE_PHASES = [
    GAME_PHASES.CHAPTER_INTRO, GAME_PHASES.STORY, GAME_PHASES.PROCUREMENT,
    GAME_PHASES.CHAPTER_SUMMARY, GAME_PHASES.GAME_OVER,
];

/**
 * Build a v2 gameState from a running campaign engine.
 * @param {GameEngine} engine
 * @param {Object} [ui] — { draft, forecastStats, askedRecallChapters }
 */
export function buildSnapshot(engine, ui = {}) {
    const s = engine.state;
    // history + shuffledScenarios already travel at top level — don't duplicate them
    const { history, shuffledScenarios, ...rest } = s;
    return {
        // ── legacy chapter-boundary fields (unchanged meaning) ──
        industryId:         s.industry.id,
        chapterIndex:       s.chapterIndex,
        cash:               s.cash,
        inventory:          s.inventory,
        backlog:            s.backlog,
        inTransit:          s.inTransit,
        turn:               s.turn,
        maxTurns:           s.maxTurns,
        modifiers:          s.modifiers,
        archetypeModifiers: s.archetypeModifiers,
        procurementChoices: s.procurementChoices,
        startingArchetype:  s.startingArchetype,
        shuffledScenarios,
        history,
        worldMemory:        s.worldMemory,
        boardConfidence:    s.boardConfidence,
        activeContract:     s.activeContract,
        activeRoute:        s.activeRoute,
        careerRankIndex:    s.careerRankIndex,
        // ── v2: resume anywhere ──
        saveVersion: SAVE_VERSION,
        phase:       s.phase,
        snapshot: JSON.parse(JSON.stringify({
            state:   rest,
            mastery: { scores: engine.mastery.scores, decisions: engine.mastery.decisions },
            debrief: DebriefCollector.getFullReport(),
            ui: {
                draft:               ui.draft ?? null,
                forecastStats:       ui.forecastStats ?? null,
                askedRecallChapters: ui.askedRecallChapters ?? [],
            },
        })),
    };
}

/** True when a stored gameState carries a full v2 snapshot. */
export function isSnapshot(gs) {
    return Boolean(gs && gs.saveVersion === SAVE_VERSION && gs.snapshot?.state);
}

/**
 * Restore a v2 snapshot into an engine that was just init()-ed for the same
 * industry (so expansion chapters and RNG wiring are already set up).
 * @returns {Object} the saved UI extras ({ draft, forecastStats, askedRecallChapters })
 */
export function restoreSnapshot(engine, gs) {
    const snap = gs.snapshot;
    Object.assign(engine.state, snap.state, {
        history:           gs.history || [],
        shuffledScenarios: gs.shuffledScenarios || engine.state.shuffledScenarios,
    });
    if (snap.mastery) {
        Object.assign(engine.mastery.scores, snap.mastery.scores || {});
        Object.assign(engine.mastery.decisions, snap.mastery.decisions || {});
    }
    if (snap.debrief) DebriefCollector.restore(snap.debrief);
    // A save taken on the chapter-summary screen resumes at the next chapter's intro
    if (engine.state.phase === GAME_PHASES.CHAPTER_SUMMARY) engine.advanceFromChapterSummary();
    return snap.ui || {};
}

/* ── This-browser storage ───────────────────────────────────────────── */

/** @returns {{ savedAt: number, gameState: Object } | null} */
export function readLocalSave() {
    try {
        const raw = localStorage.getItem(LOCAL_SAVE_KEY);
        if (!raw) return null;
        const rec = JSON.parse(raw);
        return rec?.gameState?.industryId ? rec : null;
    } catch {
        return null;
    }
}

/** @returns {boolean} whether the write succeeded */
export function writeLocalSave(gameState) {
    try {
        localStorage.setItem(LOCAL_SAVE_KEY, JSON.stringify({ savedAt: Date.now(), gameState }));
        return true;
    } catch {
        return false; // storage full or blocked
    }
}
