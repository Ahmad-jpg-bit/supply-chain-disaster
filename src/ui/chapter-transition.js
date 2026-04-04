import { getIcon } from '../graphics/svg-icons.js';
import { CHAPTERS } from '../data/chapters.js';
import { PremiumManager } from '../logic/premium.js';

export class ChapterTransition {
    constructor() {
        this.overlay = null;
    }

    show(chapterIndex, masterySummary, gameStats, onContinue) {
        const chapter = CHAPTERS[chapterIndex];
        const nextChapter = CHAPTERS[chapterIndex + 1] || null;

        this.overlay = document.createElement('div');
        this.overlay.className = 'chapter-transition-overlay';

        const scorePercent = Math.max(0, Math.min(100, (masterySummary.score / masterySummary.maxScore) * 100));
        const mastered = masterySummary.mastered;

        const nextIsLocked = nextChapter ? PremiumManager.isChapterLocked(nextChapter.number) : false;
        let nextChapterHtml = '';
        if (nextChapter) {
            nextChapterHtml = nextIsLocked ? `
                <div class="chapter-next-teaser chapter-next-teaser--locked">
                    <span class="next-label">Coming Next</span>
                    <div class="next-chapter-premium-badge">🔒 PREMIUM</div>
                    <h4>Chapter ${nextChapter.number}: ${nextChapter.title}</h4>
                    <p class="next-chapter-lock-note">Upgrade to unlock all 6 premium chapters</p>
                </div>
            ` : `
                <div class="chapter-next-teaser">
                    <span class="next-label">Coming Next</span>
                    <div class="next-chapter-icon">${getIcon(nextChapter.icon, 32)}</div>
                    <h4>Chapter ${nextChapter.number}: ${nextChapter.title}</h4>
                </div>
            `;
        }

        this.overlay.innerHTML = `
            <div class="chapter-transition glass-panel">
                <div class="chapter-complete-header">
                    <div class="chapter-complete-icon">${getIcon('checkmark', 40)}</div>
                    <h2>Chapter ${chapter.number} Complete</h2>
                    <h3>${chapter.title}</h3>
                </div>

                <div class="chapter-mastery-section">
                    <div class="mastery-label">Concept Mastery</div>
                    <div class="mastery-bar-container">
                        <div class="mastery-bar" style="width: ${scorePercent}%"></div>
                    </div>
                    <div class="mastery-score">
                        ${masterySummary.score} / ${masterySummary.maxScore} points
                        <span class="mastery-badge ${mastered ? 'mastered' : 'learning'}">
                            ${mastered ? 'Mastered' : 'Learning'}
                        </span>
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

                <button class="btn-primary chapter-continue-btn ${nextIsLocked ? 'btn-premium' : ''}">
                    ${nextIsLocked
                        ? '🔒 Unlock Chapter ' + nextChapter.number + ' — $14.99 one-time'
                        : nextChapter ? 'Continue to Chapter ' + nextChapter.number : 'See Final Results'}
                </button>
            </div>
        `;

        document.body.appendChild(this.overlay);

        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');
        });

        this.overlay.querySelector('.chapter-continue-btn').addEventListener('click', () => {
            this.hide();
            if (onContinue) onContinue();
        });
    }

    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            this.overlay.addEventListener('transitionend', () => {
                this.overlay.remove();
                this.overlay = null;
            }, { once: true });
        }
    }
}
