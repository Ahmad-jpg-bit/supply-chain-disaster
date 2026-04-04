/**
 * TerminationScreen
 *
 * Displays a humorous corporate "Termination Letter" overlay when the player
 * fails a major objective. Includes a Breaking News ticker, sarcastic message,
 * cause-of-death label, and key stats. Designed to look great as a screenshot.
 *
 * Usage:
 *   const ts = new TerminationScreen();
 *   ts.show({ cash, overall, summaries, history }, onViewResultsCallback);
 */
import './termination-screen.css';
import { getCauseOfDeath, getFailureMessage } from '../data/failure-messages.js';

function fmtMoney(n) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0,
    }).format(n);
}

function todayStr() {
    return new Intl.DateTimeFormat('en-US', {
        year:  'numeric',
        month: 'long',
        day:   'numeric',
    }).format(new Date());
}

function randomRef() {
    return `HR-${Math.floor(Math.random() * 90000) + 10000}-TERM`;
}

export class TerminationScreen {
    constructor() {
        this.overlay = null;
    }

    /**
     * Returns true if the termination screen should be shown for this run.
     * @param {{ cash, overall, summaries, history }} params
     */
    shouldShow({ cash, overall, summaries, history }) {
        return getCauseOfDeath({ cash, overall, summaries, history }) !== null;
    }

    /**
     * Show the termination screen, or skip straight to onViewResults if no failure.
     * @param {{ cash, overall, summaries, history }} params
     * @param {Function} onViewResults — called when "View Full Results" is clicked
     */
    show({ cash, overall, summaries, history }, onViewResults) {
        const cause = getCauseOfDeath({ cash, overall, summaries, history });
        if (!cause) {
            onViewResults?.();
            return;
        }

        const msg = getFailureMessage(cause);
        this._render(msg, { cash, overall }, onViewResults);
    }

    hide() {
        if (!this.overlay) return;
        this.overlay.classList.remove('visible');
        this.overlay.addEventListener('transitionend', () => {
            this.overlay?.remove();
            this.overlay = null;
        }, { once: true });
    }

    // ── Private ────────────────────────────────────────────────────────────

    _render(msg, { cash, overall }, onViewResults) {
        if (this.overlay) this.overlay.remove();

        const cashClass    = cash < 0              ? 'term-stat-pill--danger' : '';
        const masteryClass = overall.percentage < 35 ? 'term-stat-pill--danger' : 'term-stat-pill--warn';

        // Duplicate ticker text so it fills the bar when the window is wide
        const tickerContent = [msg.headline, 'NexTrack Global Logistics', 'Shareholder Call Cancelled', msg.headline]
            .join(' \u00a0•\u00a0 ');

        this.overlay = document.createElement('div');
        this.overlay.className = 'term-overlay';
        this.overlay.innerHTML = `
            <div class="term-modal">

                <!-- Breaking News ticker -->
                <div class="term-breaking-news" role="marquee" aria-label="Breaking news">
                    <span class="term-breaking-tag">BREAKING</span>
                    <div class="term-ticker-wrap">
                        <span class="term-ticker-text">${tickerContent}</span>
                    </div>
                </div>

                <!-- Termination Letter -->
                <div class="term-letter">

                    <!-- Red TERMINATED stamp -->
                    <div class="term-stamp" aria-hidden="true">TERMINATED</div>

                    <!-- Letterhead -->
                    <div class="term-letterhead">
                        <div class="term-company-name">NexTrack Global Logistics Corp.</div>
                        <div class="term-dept">Office of Human Resources &amp; Performance Management</div>
                        <div class="term-divider"></div>
                    </div>

                    <!-- Document meta -->
                    <div class="term-meta">
                        <span>DATE: ${todayStr()}</span>
                        <span>REF: ${randomRef()}</span>
                    </div>

                    <p class="term-subject">
                        RE: <strong>Immediate Termination of Employment — Supply Chain Manager</strong>
                    </p>

                    <p class="term-salutation">Dear Supply Chain Manager,</p>

                    <p class="term-body">${msg.body}</p>

                    <!-- Key stats -->
                    <div class="term-stats">
                        <div class="term-stat-pill ${cashClass}">
                            <span class="term-stat-label">Final Balance</span>
                            <span class="term-stat-value">${fmtMoney(cash)}</span>
                        </div>
                        <div class="term-stat-pill ${masteryClass}">
                            <span class="term-stat-label">Mastery Score</span>
                            <span class="term-stat-value">${overall.percentage}%</span>
                        </div>
                        <div class="term-stat-pill term-stat-pill--danger">
                            <span class="term-stat-label">Cause of Termination</span>
                            <span class="term-stat-value">${msg.causeLabel}</span>
                        </div>
                    </div>

                    <!-- Signature -->
                    <p class="term-closing">
                        Please return your access badge, company laptop, and any remaining sense of
                        professional dignity to reception by end of business today.<br><br>
                        Regards,<br>
                        <strong>${msg.sign}</strong><br>
                        <em>NexTrack Global Logistics Corp.</em>
                    </p>

                    <!-- Actions -->
                    <div class="term-actions">
                        <button class="term-btn-primary" onclick="location.reload()">Try Again</button>
                        <button class="term-btn-secondary js-view-results">View Full Results</button>
                    </div>

                    <p class="term-footnote">
                        This notice was generated by the Automated Performance Termination System (APTS v2.4).
                        If you believe this is an error, you are incorrect.
                    </p>
                </div>

            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('visible'));

        this.overlay.querySelector('.js-view-results').addEventListener('click', () => {
            this.hide();
            onViewResults?.();
        });
    }
}
