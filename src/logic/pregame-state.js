/**
 * Pure helpers for the pre-game page's save/resume logic (unit-tested).
 *
 * Two save formats exist (see logic/save-game.js):
 *   · legacy (v1) — chapter-boundary state written at the end of a chapter;
 *     resumes at the NEXT chapter's intro.
 *   · v2 snapshot — full state at any turn (device saves and cloud saves);
 *     resumes exactly where it was saved.
 * Saved runs live in logic/run-store.js; records are { savedAt, gameState }.
 */

import { GAME_PHASES } from './engine.js';
import { isSnapshot } from './save-game.js';

/** Email typed into the old (unverified) email backup — only used to pre-fill cloud-save verification. */
export const SAVE_EMAIL_KEY = 'scd_progress_email';

/**
 * Summarise a save record for display.
 * @param {Object} record — { found?, savedAt, gameState }
 * @param {Array}  chapters — all chapters in campaign order
 * @param {'device'|'email'} [source]
 */
export function describeSave(record, chapters, source = 'email') {
    const gs = (record?.found ?? true) ? record?.gameState : null;
    if (!gs || !gs.industryId) return null;
    const totalTurns = gs.maxTurns || 40;
    const base = { industryId: gs.industryId, savedAt: record.savedAt || null, totalTurns, gameState: gs, source };

    if (isSnapshot(gs)) {
        const st = gs.snapshot.state;
        const completed = gs.phase === GAME_PHASES.GAME_OVER || (st.turn ?? 1) > totalTurns;
        // A save on the chapter-summary screen resumes at the next chapter
        const chapterIndex = gs.phase === GAME_PHASES.CHAPTER_SUMMARY ? (gs.chapterIndex ?? 0) + 1 : (gs.chapterIndex ?? 0);
        const chapter = chapters[chapterIndex] || null;
        const quarter = chapter
            ? Math.min(chapter.turnsRange[1] - chapter.turnsRange[0] + 1, Math.max(1, (st.turn ?? 1) - chapter.turnsRange[0] + 1))
            : null;
        return {
            ...base,
            midChapter: true,
            resumable: !completed && Boolean(chapter),
            completed,
            nextChapterIndex: chapterIndex,
            nextChapter: chapter,
            quarter,
            cash: st.cash,
            turnsPlayed: Math.max(0, Math.min(totalTurns, (st.turn ?? 1) - 1)),
        };
    }

    const completed = (gs.turn ?? 1) > totalTurns || (gs.chapterIndex ?? 0) + 1 >= chapters.length;
    const nextIndex = (gs.chapterIndex ?? 0) + 1;
    return {
        ...base,
        midChapter: false,
        resumable: !completed,
        completed,
        nextChapterIndex: nextIndex,
        nextChapter: chapters[nextIndex] || null,
        quarter: 1,
        cash: gs.cash,
        turnsPlayed: Math.max(0, Math.min(totalTurns, (gs.turn ?? 1) - 1)),
    };
}

/**
 * Arguments for the dashboard launch callback
 * (industryId, chapterIndex, mode, statePatch, savedGame, { runId }).
 * Legacy chapter-end saves keep their original semantics (start the NEXT
 * chapter with the saved state patched in); v2 snapshots resume at the saved turn.
 */
export function runLaunchArgs(gs, runId) {
    return isSnapshot(gs)
        ? [gs.industryId, gs.chapterIndex ?? 0, 'story', null, gs, { runId }]
        : [gs.industryId, (gs.chapterIndex ?? 0) + 1, 'story', gs, null, { runId }];
}
