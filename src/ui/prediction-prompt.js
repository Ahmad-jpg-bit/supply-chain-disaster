/**
 * PredictionPrompt — one-tap forecast call shown when the player ends a turn,
 * before the quarter resolves (generation effect: predict → observe → encode).
 *
 * The player calls whether they will cover demand or stock out this quarter.
 * The verdict is rendered afterwards by TurnSummaryCard.
 */

export class PredictionPrompt {
    constructor() {
        this.overlay = null;
    }

    /**
     * @param {Object} opts
     * @param {number} opts.onHand    — units currently in inventory
     * @param {number} opts.arriving  — units arriving at the start of this turn
     * @param {number} opts.orderQty  — order just placed (arrives later; context only)
     * @param {Function} opts.onCall  — receives 'cover' | 'stockout'
     */
    show({ onHand, arriving, onCall }) {
        this._dismissed = false;
        this.overlay = document.createElement('div');
        this.overlay.className = 'pp-overlay';
        this.overlay.innerHTML = `
            <div class="pp-card glass-panel">
                <div class="pp-eyebrow">FORECAST CALL</div>
                <h3 class="pp-title">Before the quarter plays out — call it.</h3>
                <p class="pp-context">
                    On hand: <strong>${onHand.toLocaleString()}</strong> units
                    ${arriving > 0 ? ` · Arriving now: <strong>${arriving.toLocaleString()}</strong>` : ''}
                    · Baseline demand ≈ <strong>1,000</strong>/quarter, before volatility
                </p>
                <div class="pp-choices">
                    <button class="pp-btn pp-btn--cover" data-call="cover">
                        <span class="pp-btn-icon">✅</span>
                        <span class="pp-btn-label">We'll cover demand</span>
                    </button>
                    <button class="pp-btn pp-btn--stockout" data-call="stockout">
                        <span class="pp-btn-icon">⚠️</span>
                        <span class="pp-btn-label">We'll stock out</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('pp-overlay--visible'));

        this.overlay.querySelectorAll('.pp-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this._dismissed) return;
                this._dismissed = true;
                const call = btn.dataset.call;
                this._hide();
                onCall(call);
            });
        });
    }

    _hide() {
        if (!this.overlay) return;
        const el = this.overlay;
        this.overlay = null;
        el.classList.remove('pp-overlay--visible');
        setTimeout(() => el.remove(), 250);
    }
}
