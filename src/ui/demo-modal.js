import { getIcon } from '../graphics/svg-icons.js';

/**
 * 30-second interactive product demo — a self-contained dark "player" modal
 * that walks through one turn of the game (Decision → Outcome → Performance),
 * auto-advancing across three ~10s slides.
 *
 * Shared by the in-game landing screen (landing-page.js) and the marketing
 * homepage (home.js). The modal pins itself to the dark game palette (see the
 * `.lp-demo-overlay` token overrides in landing-page.css), so it renders
 * correctly whether the host page is dark (game) or light (homepage).
 *
 * @param {object}   [opts]
 * @param {Function} [opts.onStart] Called when the viewer clicks "Start Playing
 *                                  Free" (after the modal closes). Homepage
 *                                  navigates to /play; the game landing scrolls
 *                                  to its industry picker.
 */
export function showDemo({ onStart } = {}) {
    const SLIDE_MS     = 10_000;
    const TOTAL_SLIDES = 3;
    const slides       = [
        demoSlideDecision(),
        demoSlideOutcome(),
        demoSlideSummary(),
    ];
    const badges = [
        'CHAPTER 2 · DECISION SCREEN',
        'CHAPTER 2 · OUTCOME LOG',
        'CHAPTER 2 · PERFORMANCE REPORT',
    ];

    const overlay = document.createElement('div');
    overlay.className = 'lp-demo-overlay';
    overlay.innerHTML = `
        <div class="lp-demo-modal" role="dialog" aria-modal="true" aria-label="Supply Chain Disaster — 30 second demo">
            <div class="lp-demo-header">
                <div class="lp-demo-header-left">
                    <span class="lp-demo-badge" id="lp-demo-badge">${badges[0]}</span>
                    <button class="lp-demo-close" aria-label="Close">&times;</button>
                </div>
            </div>
            <div class="lp-demo-progress-bar">
                <div class="lp-demo-progress-fill" id="lp-demo-fill"></div>
            </div>
            <div class="lp-demo-slides" id="lp-demo-slides">${slides[0]}</div>
            <div class="lp-demo-nav">
                <div class="lp-demo-dots" id="lp-demo-dots">
                    ${slides.map((_, i) =>
                        `<button class="lp-demo-dot ${i === 0 ? 'lp-demo-dot--active' : ''}"
                                 data-slide="${i}" aria-label="Slide ${i + 1}"></button>`
                    ).join('')}
                </div>
                <button class="btn-primary btn-glow lp-demo-start-btn">
                    Start Playing Free &rarr;
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));

    let current     = 0;
    let startTime   = performance.now();
    let rafId       = null;
    let selectTimer = null;

    const slidesEl = overlay.querySelector('#lp-demo-slides');
    const fillEl   = overlay.querySelector('#lp-demo-fill');
    const dotsEl   = overlay.querySelector('#lp-demo-dots');
    const badgeEl  = overlay.querySelector('#lp-demo-badge');

    const goTo = (idx) => {
        current = Math.max(0, Math.min(idx, TOTAL_SLIDES - 1));
        clearTimeout(selectTimer);
        badgeEl.textContent = badges[current];
        slidesEl.innerHTML  = slides[current];
        dotsEl.querySelectorAll('.lp-demo-dot').forEach((d, i) =>
            d.classList.toggle('lp-demo-dot--active', i === current)
        );
        startTime = performance.now();
        if (current === 0) scheduleAutoSelect();
    };

    const scheduleAutoSelect = () => {
        selectTimer = setTimeout(() => {
            const opt = slidesEl.querySelector('.lp-demo-option--mid');
            if (opt) opt.classList.add('lp-demo-option--chosen');
        }, 3000);
    };

    const tick = () => {
        const frac = Math.min((performance.now() - startTime) / SLIDE_MS, 1);
        fillEl.style.width = `${((current + frac) / TOTAL_SLIDES) * 100}%`;
        if (frac >= 1 && current < TOTAL_SLIDES - 1) goTo(current + 1);
        if (overlay.isConnected) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    scheduleAutoSelect();

    dotsEl.querySelectorAll('.lp-demo-dot').forEach(dot =>
        dot.addEventListener('click', () => goTo(Number(dot.dataset.slide)))
    );

    const close = () => {
        cancelAnimationFrame(rafId);
        clearTimeout(selectTimer);
        document.removeEventListener('keydown', onKey);
        overlay.classList.remove('visible');
        // Remove on the fade-out transition, with a timeout fallback so the
        // overlay can never linger if transitionend is missed (reduced-motion,
        // a backgrounded tab, or an interrupted transition).
        let removed = false;
        const finish = () => { if (removed) return; removed = true; overlay.remove(); };
        overlay.addEventListener('transitionend', finish, { once: true });
        setTimeout(finish, 400);
    };

    const onKey = (e) => { if (e.key === 'Escape') close(); };
    document.addEventListener('keydown', onKey);

    overlay.querySelector('.lp-demo-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.lp-demo-start-btn').addEventListener('click', () => {
        close();
        onStart?.();
    });
}

function demoSlideDecision() {
    return `
    <div class="lp-demo-game-ui">
        <div class="lp-demo-terminal-bar">
            <span class="lp-term-dot lp-term-dot--red"></span>
            <span class="lp-term-dot lp-term-dot--amber"></span>
            <span class="lp-term-dot lp-term-dot--green"></span>
            <span class="lp-term-title">PROCUREMENT_DECISION.exe &nbsp;·&nbsp; Electronics · Q2 · Turn 5 of 8</span>
        </div>
        <div class="lp-demo-metrics">
            <div class="lp-demo-metric">
                <span class="lp-demo-metric-label">CASH</span>
                <span class="lp-demo-metric-val" style="color:var(--text-main)">$847,200</span>
            </div>
            <div class="lp-demo-metric">
                <span class="lp-demo-metric-label">INVENTORY</span>
                <span class="lp-demo-metric-val" style="color:var(--danger-color)">312 units</span>
            </div>
            <div class="lp-demo-metric">
                <span class="lp-demo-metric-label">DEMAND SIGNAL</span>
                <span class="lp-demo-metric-val">1,840 units</span>
            </div>
            <div class="lp-demo-metric">
                <span class="lp-demo-metric-label">IN TRANSIT</span>
                <span class="lp-demo-metric-val">0 units</span>
            </div>
        </div>
        <div class="lp-demo-scenario">
            <div class="lp-demo-scenario-label">${getIcon('warning', 12)} SCENARIO ALERT</div>
            <h3 class="lp-demo-scenario-title">The Retailer Panic</h3>
            <p class="lp-demo-scenario-text">Your three largest retail accounts have each doubled their orders after a competitor stockout made headlines. Demand signal jumped 84% in a single quarter — is this real demand or the Bullwhip Effect?</p>
        </div>
        <div class="lp-demo-options">
            <div class="lp-demo-option">
                <div class="lp-demo-opt-header">
                    <span class="lp-demo-risk-tag lp-demo-risk--low">Low Risk</span>
                    <span class="lp-demo-opt-title">Hold steady — order 1,200 units</span>
                </div>
                <p>Trust historical demand. Protect cash, risk stockout if signal is real.</p>
            </div>
            <div class="lp-demo-option lp-demo-option--mid">
                <div class="lp-demo-opt-header">
                    <span class="lp-demo-risk-tag lp-demo-risk--supply">Supply Risk</span>
                    <span class="lp-demo-opt-title">Match signal — order 2,000 units</span>
                </div>
                <p>Respond to retailers. Risk over-ordering if demand normalises next quarter.</p>
            </div>
            <div class="lp-demo-option">
                <div class="lp-demo-opt-header">
                    <span class="lp-demo-risk-tag lp-demo-risk--financial">Financial Risk</span>
                    <span class="lp-demo-opt-title">Panic-order 3,500 units</span>
                </div>
                <p>Front-load aggressively. Ties up $350K and amplifies bullwhip upstream.</p>
            </div>
        </div>
        <p class="lp-demo-hint-text">Auto-selecting in 3s&hellip;</p>
    </div>`;
}

function demoSlideOutcome() {
    return `
    <div class="lp-demo-game-ui">
        <div class="lp-demo-terminal-bar">
            <span class="lp-term-dot lp-term-dot--red"></span>
            <span class="lp-term-dot lp-term-dot--amber"></span>
            <span class="lp-term-dot lp-term-dot--green"></span>
            <span class="lp-term-title">OUTCOME_LOG.exe &nbsp;·&nbsp; Turn 5 resolved</span>
        </div>
        <div class="lp-demo-outcome-chosen">
            <span class="lp-demo-risk-tag lp-demo-risk--supply">Your Decision</span>
            <span>Matched demand signal — ordered 2,000 units at $107/unit</span>
        </div>
        <div class="lp-demo-kpi-grid">
            <div class="lp-demo-kpi lp-demo-kpi--warn">
                <span class="lp-demo-kpi-label">Cash Flow</span>
                <span class="lp-demo-kpi-val">−$214,000</span>
                <span class="lp-demo-kpi-sub">Order cost this turn</span>
            </div>
            <div class="lp-demo-kpi lp-demo-kpi--good">
                <span class="lp-demo-kpi-label">Units Incoming</span>
                <span class="lp-demo-kpi-val">+2,000</span>
                <span class="lp-demo-kpi-sub">Lead time: 2 weeks</span>
            </div>
            <div class="lp-demo-kpi lp-demo-kpi--good">
                <span class="lp-demo-kpi-label">Customer Score</span>
                <span class="lp-demo-kpi-val">+8%</span>
                <span class="lp-demo-kpi-sub">Stockout risk reduced</span>
            </div>
            <div class="lp-demo-kpi lp-demo-kpi--warn">
                <span class="lp-demo-kpi-label">Bullwhip Ratio</span>
                <span class="lp-demo-kpi-val">1.84×</span>
                <span class="lp-demo-kpi-sub">Amplification detected</span>
            </div>
        </div>
        <div class="lp-demo-outcome-log">
            <div class="lp-term-line lp-term-line--info" style="opacity:1;animation:none">
                <span class="lp-term-tag">INFO</span>
                <span>Order confirmed — 2,000 units dispatched from Shenzhen facility</span>
            </div>
            <div class="lp-term-line lp-term-line--warn" style="opacity:1;animation:none">
                <span class="lp-term-tag">WARN</span>
                <span>Demand signal still rising — retailers placing follow-on orders</span>
            </div>
            <div class="lp-term-line lp-term-line--danger" style="opacity:1;animation:none">
                <span class="lp-term-tag">CRIT</span>
                <span>Bullwhip cascade risk: supplier lead times extending to 4 weeks</span>
            </div>
        </div>
    </div>`;
}

function demoSlideSummary() {
    return `
    <div class="lp-demo-game-ui lp-demo-summary">
        <div class="lp-demo-summary-score">
            <div class="lp-demo-score-ring">
                <span class="lp-demo-score-val">74</span>
                <span class="lp-demo-score-denom">/100</span>
            </div>
            <div class="lp-demo-score-meta">
                <span class="lp-demo-score-title">Chapter 2 Performance</span>
                <span class="lp-demo-score-sub">Balanced decision-maker &mdash; above average</span>
            </div>
        </div>
        <div class="lp-demo-mastery-grid">
            <div class="lp-demo-mastery-item">
                <div class="lp-demo-mastery-header">
                    <span class="lp-demo-mastery-label">Demand Forecasting</span>
                    <span class="lp-demo-mastery-pct">68%</span>
                </div>
                <div class="lp-demo-mastery-bar">
                    <div class="lp-demo-mastery-fill" style="width:68%;background:var(--primary-color)"></div>
                </div>
            </div>
            <div class="lp-demo-mastery-item">
                <div class="lp-demo-mastery-header">
                    <span class="lp-demo-mastery-label">Cash Flow Control</span>
                    <span class="lp-demo-mastery-pct">52%</span>
                </div>
                <div class="lp-demo-mastery-bar">
                    <div class="lp-demo-mastery-fill" style="width:52%;background:var(--text-muted)"></div>
                </div>
            </div>
            <div class="lp-demo-mastery-item">
                <div class="lp-demo-mastery-header">
                    <span class="lp-demo-mastery-label">Bullwhip Resistance</span>
                    <span class="lp-demo-mastery-pct">41%</span>
                </div>
                <div class="lp-demo-mastery-bar">
                    <div class="lp-demo-mastery-fill" style="width:41%;background:#ef4444"></div>
                </div>
            </div>
            <div class="lp-demo-mastery-item">
                <div class="lp-demo-mastery-header">
                    <span class="lp-demo-mastery-label">Customer Satisfaction</span>
                    <span class="lp-demo-mastery-pct">79%</span>
                </div>
                <div class="lp-demo-mastery-bar">
                    <div class="lp-demo-mastery-fill" style="width:79%;background:var(--primary-color)"></div>
                </div>
            </div>
        </div>
        <p class="lp-demo-summary-cta-text">6 more chapters of escalating crises await &mdash; dual-sourcing, supplier bankruptcy, Just-In-Time failure, and more.</p>
    </div>`;
}
