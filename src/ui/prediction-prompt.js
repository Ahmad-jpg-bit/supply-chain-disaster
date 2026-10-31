/**
 * PredictionPrompt — the player forecasts next quarter's demand on a slider
 * before the quarter resolves (generation effect: predict → observe → encode).
 *
 * The call is scored afterwards as an absolute percentage error, and the
 * running session MAPE is rendered by TurnSummaryCard. The player *is* the
 * forecaster — MAPE stops being a flashcard and becomes their own score.
 */
import { holdModal, readyAfter } from './modal-focus.js';

const MIN_FORECAST = 500;
const MAX_FORECAST = 1600;
const STEP = 10;

export class PredictionPrompt {
    constructor() {
        this.overlay = null;
    }

    /**
     * @param {Object} opts
     * @param {number} opts.onHand         — units currently in inventory
     * @param {number} opts.arriving       — units arriving at the start of this turn
     * @param {number[]} [opts.recentDemand] — last few quarters' actual demand (oldest → newest)
     * @param {Function} opts.onCall       — receives the forecast number
     */
    show({ onHand, arriving, recentDemand = [], onCall }) {
        this._dismissed = false;

        const last = recentDemand[recentDemand.length - 1];
        const initial = Math.min(MAX_FORECAST, Math.max(MIN_FORECAST,
            Math.round((last ?? 1000) / STEP) * STEP));

        const historyLine = recentDemand.length
            ? `Recent demand: ${recentDemand.slice(-3).map(d => d.toLocaleString()).join(' → ')}`
            : 'No demand history yet — baseline is ≈ 1,000 units/quarter';

        this.overlay = document.createElement('div');
        this.overlay.className = 'pp-overlay';
        this.overlay.innerHTML = `
            <div class="pp-card glass-panel">
                <div class="pp-eyebrow">DEMAND FORECAST</div>
                <h3 class="pp-title">Call the quarter. What will demand be?</h3>
                <p class="pp-context">
                    ${historyLine}<br/>
                    On hand: <strong>${onHand.toLocaleString()}</strong> units
                    ${arriving > 0 ? ` · Arriving now: <strong>${arriving.toLocaleString()}</strong>` : ''}
                </p>

                <div class="pp-forecast-value" id="pp-forecast-value">${initial.toLocaleString()}</div>

                <input type="range" class="pp-slider" id="pp-forecast-slider"
                       min="${MIN_FORECAST}" max="${MAX_FORECAST}" step="${STEP}" value="${initial}"
                       aria-label="Demand forecast" />
                <div class="pp-slider-scale">
                    <span>${MIN_FORECAST.toLocaleString()}</span>
                    <span>1,000 baseline</span>
                    <span>${MAX_FORECAST.toLocaleString()}</span>
                </div>

                <button class="btn-primary pp-confirm-btn">Lock Forecast &rarr;</button>
                <p class="pp-note">This guess doesn't change sales or costs. Your accuracy is tracked as MAPE — the same metric real planners are graded on.</p>
            </div>
        `;

        document.body.appendChild(this.overlay);
        this._release = holdModal(this.overlay, this.overlay.querySelector('#pp-forecast-slider'));
        requestAnimationFrame(() => this.overlay?.classList.add('pp-overlay--visible'));

        const slider  = this.overlay.querySelector('#pp-forecast-slider');
        const valueEl = this.overlay.querySelector('#pp-forecast-value');
        slider.addEventListener('input', () => {
            valueEl.textContent = parseInt(slider.value, 10).toLocaleString();
        });

        const ready = readyAfter();   // ignore the tail of a double-click on Confirm
        this.overlay.querySelector('.pp-confirm-btn').addEventListener('click', () => {
            if (this._dismissed || !ready()) return;
            this._dismissed = true;
            const forecast = parseInt(slider.value, 10);
            this._hide();
            onCall(forecast);
        });
    }

    /**
     * Beginner Chapter 1, first quarter: a conceptual check in place of the
     * demand guess — will this order reach this quarter's customers? Optional;
     * the answer is only reflected back after the quarter (no marking here).
     * @param {Object} opts
     * @param {number} opts.turn          — current quarter
     * @param {number} opts.qty           — units being ordered
     * @param {Function} opts.onAnswer    — receives 'yes' | 'no' | null (skipped)
     */
    askArrival({ turn, qty, onAnswer }) {
        this._dismissed = false;
        this.overlay = document.createElement('div');
        this.overlay.className = 'pp-overlay';
        this.overlay.innerHTML = `
            <div class="pp-card glass-panel" role="dialog" aria-modal="true" aria-labelledby="pp-arrival-title">
                <div class="pp-eyebrow">QUICK CHECK · OPTIONAL</div>
                <h3 class="pp-title" id="pp-arrival-title">Will your order of ${qty.toLocaleString()} units arrive in time for Q${turn}'s customers?</h3>
                <p class="pp-context">There's no score for this — you'll see how it played out in the results.</p>
                <div class="pp-choices">
                    <button type="button" class="pp-choice" data-answer="yes">Yes, in time for this quarter</button>
                    <button type="button" class="pp-choice" data-answer="no">No, it arrives later</button>
                </div>
                <button type="button" class="pp-skip" data-answer="">Skip and play the quarter</button>
            </div>
        `;
        document.body.appendChild(this.overlay);
        this._release = holdModal(this.overlay, this.overlay.querySelector('.pp-choice'));
        requestAnimationFrame(() => this.overlay?.classList.add('pp-overlay--visible'));
        const ready = readyAfter();   // ignore the tail of a double-click on Confirm
        this.overlay.querySelectorAll('[data-answer]').forEach(btn => btn.addEventListener('click', () => {
            if (this._dismissed || !ready()) return;
            this._dismissed = true;
            this._hide();
            onAnswer(btn.dataset.answer || null);
        }));
    }

    _hide() {
        this._release?.();
        this._release = null;
        if (!this.overlay) return;
        const el = this.overlay;
        this.overlay = null;
        el.classList.remove('pp-overlay--visible');
        setTimeout(() => el.remove(), 250);
    }
}
