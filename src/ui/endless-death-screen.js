/**
 * EndlessDeathScreen — arcade-style overlay shown when the player's Endless
 * Survival run ends (cash < 0 = bankruptcy, satisfaction = 0 = customer revolt).
 * Persists high score per industry in localStorage.
 */

const BEST_KEY = (industryId) => `scd_endless_best_${industryId}`;

const CAUSE_COPY = {
    bankruptcy: {
        headline: 'BANKRUPT',
        sub: 'Cash reserves hit zero — the business has collapsed.',
        icon: '💸',
        color: '#ef4444',
    },
    satisfaction: {
        headline: 'CUSTOMER REVOLT',
        sub: 'Satisfaction reached zero — customers abandoned the brand.',
        icon: '🔴',
        color: '#f59e0b',
    },
};

function fmt(n) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0
    }).format(n);
}

function getBestScore(industryId) {
    try {
        return parseInt(localStorage.getItem(BEST_KEY(industryId)) || '0', 10);
    } catch { return 0; }
}

function saveBestScore(industryId, score) {
    try { localStorage.setItem(BEST_KEY(industryId), String(score)); } catch {}
}

export class EndlessDeathScreen {
    constructor() {
        this._el = null;
    }

    /**
     * @param {object} params
     * @param {string}   params.cause      - 'bankruptcy' | 'satisfaction'
     * @param {number}   params.wave       - wave reached
     * @param {number}   params.turns      - total endless turns survived
     * @param {number}   params.score      - final score
     * @param {number}   params.cash       - final cash
     * @param {number}   params.satisfaction - final satisfaction %
     * @param {string}   params.industryId
     * @param {Function} params.onRestart  - called when "Restart Survival" clicked
     * @param {Function} params.onMenu     - called when "Main Menu" clicked
     */
    show({ cause, wave, turns, score, cash, satisfaction, industryId, onRestart, onMenu }) {
        this.hide();

        const prev   = getBestScore(industryId);
        const isNew  = score > prev;
        if (isNew) saveBestScore(industryId, score);
        const best   = isNew ? score : prev;

        const copy   = CAUSE_COPY[cause] || CAUSE_COPY.bankruptcy;

        const el = document.createElement('div');
        el.className = 'eds-overlay';
        el.innerHTML = `
            <div class="eds-modal">
                <div class="eds-scanlines" aria-hidden="true"></div>

                <div class="eds-cause" style="color:${copy.color}">
                    <span class="eds-cause-icon">${copy.icon}</span>
                    <span class="eds-cause-headline">${copy.headline}</span>
                </div>
                <p class="eds-sub">${copy.sub}</p>

                <div class="eds-score-block">
                    <div class="eds-score-value">${score.toLocaleString()}</div>
                    <div class="eds-score-label">SCORE</div>
                    ${isNew ? '<div class="eds-new-best">NEW BEST ★</div>' : `<div class="eds-best-prev">Best: ${best.toLocaleString()}</div>`}
                </div>

                <div class="eds-stats">
                    <div class="eds-stat">
                        <span class="eds-stat-val">${wave}</span>
                        <span class="eds-stat-label">Wave Reached</span>
                    </div>
                    <div class="eds-stat">
                        <span class="eds-stat-val">${turns}</span>
                        <span class="eds-stat-label">Turns Survived</span>
                    </div>
                    <div class="eds-stat">
                        <span class="eds-stat-val">${fmt(cash)}</span>
                        <span class="eds-stat-label">Final Cash</span>
                    </div>
                    <div class="eds-stat">
                        <span class="eds-stat-val">${Math.round(satisfaction)}%</span>
                        <span class="eds-stat-label">Satisfaction</span>
                    </div>
                </div>

                <div class="eds-actions">
                    <button class="eds-btn eds-btn--primary" id="eds-restart">
                        ↺ Restart Survival
                    </button>
                    <button class="eds-btn eds-btn--ghost" id="eds-menu">
                        ← Main Menu
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(el);
        this._el = el;

        // Animate in after paint
        requestAnimationFrame(() => el.classList.add('eds-overlay--visible'));

        el.querySelector('#eds-restart').addEventListener('click', () => {
            this.hide();
            onRestart?.();
        });
        el.querySelector('#eds-menu').addEventListener('click', () => {
            this.hide();
            onMenu?.();
        });
    }

    hide() {
        if (!this._el) return;
        const el = this._el;
        this._el = null;
        el.classList.remove('eds-overlay--visible');
        el.addEventListener('transitionend', () => el.remove(), { once: true });
        setTimeout(() => el.remove(), 500);
    }
}
