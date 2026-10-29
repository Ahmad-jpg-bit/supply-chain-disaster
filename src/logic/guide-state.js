/**
 * Guided start — preference and progress for the optional first-turn guide.
 *
 * Stored in this browser under one key, like the game's other scd_*
 * preferences. It is never written into a save snapshot, so saves, cloud
 * sync and conflict handling are unaffected; a reload resumes the guide at
 * the step that matches the current game phase.
 */

import { GAME_PHASES } from './engine.js';

export const GUIDE_KEY = 'scd_guide_v1';

/** Steps in play order; each belongs to the phase it explains. */
export const GUIDE_STEPS = [
    { id: 'story',   phase: GAME_PHASES.STORY },
    { id: 'brief',   phase: GAME_PHASES.PROCUREMENT },
    { id: 'stock',   phase: GAME_PHASES.PROCUREMENT },
    { id: 'order',   phase: GAME_PHASES.PROCUREMENT },
    { id: 'cost',    phase: GAME_PHASES.PROCUREMENT },
    { id: 'confirm', phase: GAME_PHASES.PROCUREMENT },
];

const PHASE_ORDER = [GAME_PHASES.STORY, GAME_PHASES.PROCUREMENT];
const STATUSES = ['unseen', 'active', 'skipped', 'done'];

/** @returns {{ status: 'unseen'|'active'|'skipped'|'done', step: number, replay: boolean }} */
export function readGuide(storage = globalThis.localStorage) {
    try {
        const g = JSON.parse(storage.getItem(GUIDE_KEY) || 'null');
        if (g && STATUSES.includes(g.status)) {
            const step = Number.isInteger(g.step) ? Math.max(0, Math.min(g.step, GUIDE_STEPS.length - 1)) : 0;
            return { status: g.status, step, replay: Boolean(g.replay) };
        }
    } catch { /* unreadable → treat as never seen */ }
    return { status: 'unseen', step: 0, replay: false };
}

export function writeGuide(guide, storage = globalThis.localStorage) {
    try { storage.setItem(GUIDE_KEY, JSON.stringify(guide)); } catch { /* storage blocked: guide still works this session */ }
    return guide;
}

/**
 * Someone who has played before (any other campaign past its first quarter,
 * a skipped chapter intro, or a pre-runs save) is not auto-guided.
 */
export function isReturningPlayer({ metas = [], currentRunId = null, skippedIntros = false, legacySave = false } = {}) {
    if (skippedIntros || legacySave) return true;
    return metas.some(m => m && m.runId !== currentRunId && (m.turn ?? 1) > 1);
}

/** Auto-start only on the first quarter of a fresh campaign for a new player. */
export function shouldAutoStart({ mode, historyLength, guide, returning }) {
    return mode === 'story' && historyLength === 0 && guide.status === 'unseen' && !returning;
}

/**
 * The step to show in `phase`, skipping steps that belong to phases already
 * passed (e.g. a reload after the event response was committed).
 * An automatic guide only runs before the first quarter resolves; a replay
 * from Help runs at any turn.
 * @returns {{ id: string, phase: string, index: number, total: number, last: boolean, phaseEnd: boolean } | null}
 */
export function currentStep(guide, phase, historyLength = 0) {
    if (!guide || guide.status !== 'active') return null;
    if (!guide.replay && historyLength > 0) return null;
    const target = PHASE_ORDER.indexOf(phase);
    if (target < 0) return null;
    let i = guide.step;
    while (i < GUIDE_STEPS.length && PHASE_ORDER.indexOf(GUIDE_STEPS[i].phase) < target) i++;
    if (i >= GUIDE_STEPS.length || GUIDE_STEPS[i].phase !== phase) return null;
    const last = i === GUIDE_STEPS.length - 1;
    // phaseEnd: the next tip only appears once the game reaches its phase
    return { ...GUIDE_STEPS[i], index: i, total: GUIDE_STEPS.length, last, phaseEnd: last || GUIDE_STEPS[i + 1].phase !== phase };
}

export const startGuide = (replay = false) => ({ status: 'active', step: 0, replay });
export const nextGuide = (guide, fromIndex) => (fromIndex >= GUIDE_STEPS.length - 1
    ? { status: 'done', step: 0, replay: false }
    : { ...guide, step: fromIndex + 1 });
export const skipGuide = () => ({ status: 'skipped', step: 0, replay: false });
export const finishGuide = () => ({ status: 'done', step: 0, replay: false });
