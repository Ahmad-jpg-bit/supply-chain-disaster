/**
 * Pure helpers for the pre-game page's save/resume logic (unit-tested).
 *
 * Two save formats exist (see logic/save-game.js):
 *   · legacy (v1) — chapter-boundary state written at the end of a chapter;
 *     resumes at the NEXT chapter's intro.
 *   · v2 snapshot — full state at any turn (local saves, manual saves and all
 *     new email backups); resumes exactly where it was saved.
 * /api/load-game returns { found, email, savedAt, version, gameState }; local
 * saves are { savedAt, gameState }.
 */

import { GAME_PHASES } from './engine.js';
import { isSnapshot } from './save-game.js';

export const SAVE_EMAIL_KEY = 'scd_progress_email';

export function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

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

/** Of two described saves, the one saved most recently (either may be null). */
export function newerSave(a, b) {
    if (!a) return b || null;
    if (!b) return a;
    return (b.savedAt || 0) > (a.savedAt || 0) ? b : a;
}

/**
 * Arguments for the dashboard launch callback (industryId, chapterIndex,
 * mode, statePatch, savedGame). Legacy saves keep the pre-redesign call
 * (next chapter + state patch); v2 snapshots resume at the saved turn.
 */
export function resumeLaunchArgs(save) {
    return save.midChapter
        ? [save.industryId, save.nextChapterIndex, 'story', null, save.gameState]
        : [save.industryId, save.nextChapterIndex, 'story', save.gameState];
}
