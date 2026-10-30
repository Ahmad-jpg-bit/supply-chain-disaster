import { getIcon } from '../graphics/svg-icons.js';
import { CHAPTERS } from '../data/chapters.js';
import { EXPANSION_CHAPTERS } from '../data/expansion-chapters.js';

export class ChapterTransition {
    constructor() {
        this.overlay = null;
    }

    /**
     * @param {Object} [gameStats] — { engineState, ctaLabel, beginner }
     *   beginner: beginner Chapter 1 — no auto-advance (read at your own pace) and
     *   "Concepts practised" wording; the points measure event-response alignment,
     *   not mastery.
     */
    show(chapterIndex, masterySummary, gameStats, onContinue) {
        const beginner = Boolean(gameStats?.beginner);
        const allChapters = [...CHAPTERS, ...EXPANSION_CHAPTERS];
        const chapter     = allChapters[chapterIndex];
        if (!chapter) { console.error(`ChapterTransition: invalid chapterIndex ${chapterIndex}`); return; }
        const nextChapter = allChapters[chapterIndex + 1] || null;

        this.overlay = document.createElement('div');
        this.overlay.className = 'chapter-transition-overlay';

        const scorePercent = Math.max(0, Math.min(100, (masterySummary.score / masterySummary.maxScore) * 100));
        const mastered = masterySummary.mastered;

        // ── Key stats from engine state ───────────────────────────────────────
        const engineState = gameStats?.engineState;
        const fmtMoney = (n) => new Intl.NumberFormat('en-US', {
            style: 'currency', currency: 'USD', maximumFractionDigits: 0
        }).format(n || 0);

        let keyStatsHtml = '';
        let narrativeHtml = '';
        if (engineState) {
            const finalCash         = engineState.cash ?? 0;
            const history           = engineState.history ?? [];
            const chNum             = chapter.number;
            const chapterTurns      = history.filter(h => h.chapter === chNum);
            const chapterProfit     = chapterTurns.reduce((s, h) => s + (h.profit || 0), 0);
            const totalMissedSales  = chapterTurns.reduce((s, h) => s + (h.missedSales || 0), 0);
            const profitCls         = chapterProfit >= 0 ? 'positive' : 'negative';

            keyStatsHtml = `
                <div class="chapter-key-stats">
                    <div class="cks-item">
                        <span class="cks-label">Final Cash</span>
                        <span class="cks-value">${fmtMoney(finalCash)}</span>
                    </div>
                    <div class="cks-item">
                        <span class="cks-label">Chapter Profit</span>
                        <span class="cks-value ${profitCls}">${fmtMoney(chapterProfit)}</span>
                    </div>
                    <div class="cks-item">
                        <span class="cks-label">Missed Sales</span>
                        <span class="cks-value">${totalMissedSales.toLocaleString()} units</span>
                    </div>
                </div>`;

            // Narrative consequence line
            let narrativeText;
            if (scorePercent >= 75 && chapterProfit >= 0) {
                narrativeText = 'Your inventory management kept the chain stable.';
            } else if (totalMissedSales > 500 || chapterProfit < -50000) {
                narrativeText = 'Stockouts cost you customer satisfaction this chapter.';
            } else if (nextChapter) {
                narrativeText = `A steady chapter. Chapter ${nextChapter.number} brings new pressures.`;
            } else {
                narrativeText = 'A steady run. Every decision shaped your chain.';
            }
            narrativeHtml = `<p class="chapter-narrative">${narrativeText}</p>`;
        }

        // ── Next-chapter teaser ───────────────────────────────────────────────
        // The teaser never shows a lock or a price: when the next chapter needs
        // the Core Game Pass, Dashboard shows that after the concept card.
        const nextChapterHtml = nextChapter ? `
                <div class="chapter-next-teaser">
                    <span class="next-label">Coming Next</span>
                    <div class="next-chapter-icon">${getIcon(nextChapter.icon, 32)}</div>
                    <h4>Chapter ${nextChapter.number}: ${nextChapter.title}</h4>
                </div>` : '';

        // gameStats.ctaLabel: set when the next chapter needs more access (free intro end)
        const ctaBtnLabel = gameStats?.ctaLabel || (nextChapter ? 'Continue to Chapter ' + nextChapter.number : 'See Final Results');

        this.overlay.innerHTML = `
            <div class="chapter-transition glass-panel">
                <div class="chapter-complete-header">
                    <div class="chapter-complete-icon">${getIcon('checkmark', 40)}</div>
                    <h2>Chapter ${chapter.number} Complete</h2>
                    <h3>${chapter.title}</h3>
                </div>

                ${keyStatsHtml}
                ${narrativeHtml}

                <div class="chapter-mastery-section">
                    <div class="mastery-label">${beginner ? 'Concepts practised · points from your 4 event responses' : 'Concept Mastery'}</div>
                    <div class="mastery-bar-container">
                        <div class="mastery-bar" style="width: ${scorePercent}%"></div>
                    </div>
                    <div class="mastery-score">
                        ${masterySummary.score} / ${masterySummary.maxScore} points
                        ${beginner
                            ? '<span class="mastery-badge learning">Chapter completed</span>'
                            : `<span class="mastery-badge ${mastered ? 'mastered' : 'learning'}">${mastered ? 'Mastered' : 'Learning'}</span>`}
                    </div>
                </div>

                <div class="chapter-stats">
                    <div class="stat-item">
                        <span class="stat-value">${masterySummary.decisions.optimal}</span>
                        <span class="stat-label">Optimal</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${masterySummary.decisions.cautious}</span>
                        <span class="stat-label">Cautious</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${masterySummary.decisions.risky}</span>
                        <span class="stat-label">Risky</span>
                    </div>
                </div>

                ${nextChapterHtml}

                <button class="btn-primary chapter-continue-btn">
                    ${ctaBtnLabel}
                </button>
                ${beginner ? '' : `<div class="chapter-auto-bar-wrap" aria-hidden="true">
                    <div class="chapter-auto-bar"></div>
                </div>`}
            </div>
        `;

        document.body.appendChild(this.overlay);

        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');
        });

        // Advance exactly once — the timer, rapid clicks and the fading overlay
        // (still in the DOM until its transition ends) can't call onContinue twice
        let advanced = false;
        const advance = () => {
            if (advanced) return;
            advanced = true;
            clearTimeout(autoTimer);
            this.hide();
            if (onContinue) onContinue();
        };
        // Auto-advance after 6 s (not for beginner Chapter 1: the recap follows and needs reading time)
        const autoTimer = beginner ? null : setTimeout(advance, 6000);

        const btn = this.overlay.querySelector('.chapter-continue-btn');
        btn.addEventListener('click', advance);
        if (beginner) btn.focus({ preventScroll: true });
    }

    hide() {
        const el = this.overlay;
        if (!el) return;
        this.overlay = null;
        el.classList.remove('visible');
        el.querySelector('.chapter-continue-btn')?.setAttribute('disabled', '');
        const remove = () => el.remove();
        el.addEventListener('transitionend', remove, { once: true });
        setTimeout(remove, 600);   // no transition (reduced motion / hidden tab): remove anyway
    }
}
