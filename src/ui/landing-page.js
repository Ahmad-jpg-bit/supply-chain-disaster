/**
 * LandingPage
 *
 * Replaces the onboarding wizard with a high-converting SaaS-style landing page.
 * Sections: Hero → Chapter Roadmap → Industry Bento → Intel Briefing → Upgrade CTA
 *
 * Usage:
 *   new LandingPage(container, (industryId, chapterIndex) => { ... });
 */

import './landing-page.css';
import { CHAPTERS } from '../data/chapters.js';
import { EXPANSION_CHAPTERS } from '../data/expansion-chapters.js';
import { INDUSTRIES } from '../logic/industries.js';
import { getIcon } from '../graphics/svg-icons.js';
import { PremiumManager } from '../logic/premium.js';
import { createFooter } from '../shared/footer.js';
import { setNavMinimal } from '../shared/nav.js';
import { showDemo } from './demo-modal.js';

const CHAPTER_OUTCOMES = [
    'Forecast demand to avoid stockouts & overstock',
    'Trace how small demand swings amplify upstream',
    'JIT & Safety Stock — master buffer calculations',
    'Dual-source vs single-source resilience trade-offs',
    'TCO — uncover the hidden costs beyond unit price',
    'Multi-modal routing and last-mile cost optimization',
    'Six Sigma defect thresholds & quality cost curves',
    'Circular loops, carbon reporting & reverse logistics',
];

const INDUSTRY_CONFIG = {
    electronics: {
        icon: getIcon('factory', 32),
        accent: '#d4d4d8',
        accentRgb: '212,212,216',
        label: 'Emergency Alert',
        tagline: 'Volatile demand · Long lead times · Chip shortages',
        stats: [
            { val: '2–4wk', label: 'Lead Time' },
            { val: '±40%', label: 'Demand Swing' },
            { val: '$1M', label: 'Capital' },
        ],
        difficulty: {
            label: 'Intermediate',
            rgb: '201,154,82',
            persona: "Best if you're familiar with volatile demand",
        },
    },
    fmcg: {
        icon: getIcon('store', 32),
        accent: '#d4d4d8',
        accentRgb: '212,212,216',
        label: 'High Volume',
        tagline: 'High volume · Tight margins · Rapid replenishment',
        stats: [
            { val: '1–2wk', label: 'Lead Time' },
            { val: '±20%', label: 'Demand Swing' },
            { val: '$500K', label: 'Capital' },
        ],
        difficulty: {
            label: 'Start here',
            rgb: '95,170,121',
            persona: 'Best for your first playthrough',
        },
        recommended: true,
    },
    pharma: {
        icon: getIcon('shield', 32),
        accent: '#d4d4d8',
        accentRgb: '212,212,216',
        label: 'Regulatory',
        tagline: 'Regulatory constraints · Safety stock · Cold chain',
        stats: [
            { val: '3–6wk', label: 'Lead Time' },
            { val: '±15%', label: 'Demand Swing' },
            { val: '$2M', label: 'Capital' },
        ],
        difficulty: {
            label: 'Advanced',
            rgb: '207,107,107',
            persona: 'Best for students with supply chain experience',
        },
    },
};

/**
 * Returns true if the player has no prior play history in localStorage.
 * Checks three existing keys: scd_skipped_intros (chapter intros seen),
 * scd_progress_email (saved progress), and scd_premium (purchased).
 * Absence of all three is the strongest available proxy for "never played".
 */
function isFirstTimePlayer() {
    try {
        const skipped = JSON.parse(localStorage.getItem('scd_skipped_intros') || '[]');
        if (skipped.length > 0) return false;
        if (localStorage.getItem('scd_progress_email')) return false;
        if (localStorage.getItem('scd_premium')) return false;
        return true;
    } catch {
        return true; // safe default: show guidance to unknown players
    }
}

export class LandingPage {
    constructor(container, onLaunch, options = {}) {
        this.container         = container;
        this.onLaunch          = onLaunch;
        this.skipHero          = options.skipHero || false;
        this.selectedChapterIndex = 0;
        this._loadedGameState  = null;
        this._render();
    }

    _render() {
        this.container.innerHTML = '';
        this.container.classList.remove('hidden');

        const page = document.createElement('div');
        page.className = 'lp-page';

        if (this.skipHero) {
            page.innerHTML =
                this._directEntryHTML() +
                this._industriesHTML();
        } else {
            page.innerHTML =
                this._heroHTML() +
                this._roadmapHTML() +
                this._industriesHTML() +
                this._survivalHTML() +
                this._intelHTML() +
                this._upgradeHTML();
        }

        this.container.appendChild(page);
        if (!this.skipHero) createFooter(this.container);
        setNavMinimal(true);
        this._attachListeners(page);
    }

    /* ── Section HTML ──────────────────────────────────────── */

    _directEntryHTML() {
        return `
        <div class="lp-direct-entry-header">
            Choose your industry to begin
        </div>`;
    }

    _heroHTML() {
        return `
        <section class="lp-hero">
            <div class="lp-hero-inner">
                <div class="lp-hero-left">
                    <div class="lp-crisis-badge">
                        <span class="lp-crisis-dot"></span>
                        Live Crisis Simulation
                    </div>
                    <h1 class="lp-hero-headline">
                        Supply Chain Strategy,<br>
                        <span class="lp-hero-accent">Learned Through Simulation.</span>
                    </h1>
                    <p class="lp-hero-sub">
                        Experience real supply chain crises through simulation. Work through
                        scenario-driven chapters that teach procurement, inventory strategy, and
                        supplier risk &mdash; the way professionals learn.
                    </p>
                    <div class="lp-hero-ctas">
                        <button class="btn-primary btn-glow lp-begin-btn">
                            Start Training: Chapter 1 &rarr;
                        </button>
                        <button class="lp-demo-btn" id="lp-demo-btn">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                            Watch 30s Demo
                        </button>
                    </div>
                    <span class="lp-free-label">Free &mdash; no account required</span>
                    <div class="lp-hero-stats">
                        <div class="lp-stat">
                            <span class="lp-stat-val">10</span>
                            <span class="lp-stat-label">Chapters</span>
                        </div>
                        <div class="lp-stat-divider"></div>
                        <div class="lp-stat">
                            <span class="lp-stat-val">3</span>
                            <span class="lp-stat-label">Industries</span>
                        </div>
                        <div class="lp-stat-divider"></div>
                        <div class="lp-stat">
                            <span class="lp-stat-val">40</span>
                            <span class="lp-stat-label">Decisions</span>
                        </div>
                        <div class="lp-stat-divider"></div>
                        <div class="lp-stat">
                            <span class="lp-stat-val">&lt;2.5h</span>
                            <span class="lp-stat-label">To Complete</span>
                        </div>
                    </div>
                </div>

                <div class="lp-hero-right" aria-hidden="true">
                    <div class="lp-terminal-label-badge">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                        Scenario-Based Training Module
                    </div>
                    <div class="lp-terminal">
                        <div class="lp-terminal-bar">
                            <span class="lp-term-dot lp-term-dot--red"></span>
                            <span class="lp-term-dot lp-term-dot--amber"></span>
                            <span class="lp-term-dot lp-term-dot--green"></span>
                            <span class="lp-term-title">SCM_CRISIS_MONITOR.exe</span>
                        </div>
                        <div class="lp-terminal-body">
                            <div class="lp-term-line lp-term-line--warn">
                                <span class="lp-term-tag">WARN</span>
                                <span>Port congestion detected &mdash; ETD delayed +14 days</span>
                            </div>
                            <div class="lp-term-line lp-term-line--danger">
                                <span class="lp-term-tag">CRIT</span>
                                <span>Inventory critical &mdash; 47 units remaining</span>
                            </div>
                            <div class="lp-term-line lp-term-line--warn">
                                <span class="lp-term-tag">WARN</span>
                                <span>Demand spike +340% &mdash; origin: viral campaign</span>
                            </div>
                            <div class="lp-term-line lp-term-line--danger">
                                <span class="lp-term-tag">CRIT</span>
                                <span>Primary supplier OFFLINE &mdash; lead time +8wk</span>
                            </div>
                            <div class="lp-term-line lp-term-line--info">
                                <span class="lp-term-tag">INFO</span>
                                <span>Cash flow: <span class="lp-term-red">-$127,400</span> this quarter</span>
                            </div>
                            <div class="lp-term-line lp-term-line--info">
                                <span class="lp-term-tag">INFO</span>
                                <span>Bullwhip ratio: <span class="lp-term-amber">2.7&times;</span> — critical threshold</span>
                            </div>
                            <div class="lp-term-line lp-term-line--prompt">
                                <span class="lp-term-prompt">&gt;</span>
                                <span class="lp-term-cursor">Awaiting your decision</span>
                            </div>
                        </div>
                        <div class="lp-terminal-metrics">
                            <div class="lp-term-metric">
                                <span class="lp-term-metric-label">CASH</span>
                                <span class="lp-term-metric-val lp-term-red">$873K</span>
                            </div>
                            <div class="lp-term-metric">
                                <span class="lp-term-metric-label">INVENTORY</span>
                                <span class="lp-term-metric-val lp-term-amber">47</span>
                            </div>
                            <div class="lp-term-metric">
                                <span class="lp-term-metric-label">SATISFACTION</span>
                                <span class="lp-term-metric-val lp-term-amber">62%</span>
                            </div>
                            <div class="lp-term-metric">
                                <span class="lp-term-metric-label">CHAPTER</span>
                                <span class="lp-term-metric-val">3 / 8</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            ${this._tickerHTML()}
        </section>`;
    }

    _tickerHTML() {
        const items = [
            `${getIcon('alertCircle', 12)} LIVE &nbsp;·&nbsp; Suez Canal congestion delays 340 vessels — estimated clearance: 4 days`,
            `${getIcon('warning', 12)} Port of Los Angeles strike enters Day 3 — container dwell time up 280%`,
            `${getIcon('box', 12)} Taiwan semiconductor lead times extend to 26 weeks — Q3 allocations frozen`,
            `${getIcon('ship', 12)} Red Sea diversions add $2,400/TEU surcharge — shippers absorbing costs`,
            `${getIcon('bolt', 12)} Cold chain disruption across EU pharma network — safety stock at critical level`,
            `${getIcon('warning', 12)} Demand spike +180% for consumer electronics — double-ordering detected upstream`,
        ];
        const sep = '<span class="lp-ticker-sep">◆</span>';
        // Duplicate for seamless loop
        const track = [...items, ...items]
            .map(t => `<span class="lp-ticker-item">${t}</span>${sep}`)
            .join('');
        return `
        <div class="lp-ticker" aria-hidden="true">
            <div class="lp-ticker-label">CRISIS FEED</div>
            <div class="lp-ticker-viewport">
                <div class="lp-ticker-track">${track}</div>
            </div>
        </div>`;
    }

    _roadmapHTML() {
        // All 10 chapters are free to play; the paid feature is the Advanced Report.
        const allChapters = [...CHAPTERS, ...EXPANSION_CHAPTERS];
        const nodes = allChapters.map((ch, i) => {
            const hasNext   = i < allChapters.length - 1;
            const outcome   = CHAPTER_OUTCOMES[i] || '';
            return `
            <div class="lp-roadmap-node lp-roadmap-node--free">
                <div class="lp-rn-icon">${getIcon(ch.icon, 20)}</div>
                ${hasNext ? '<div class="lp-rn-connector"></div>' : ''}
                <div class="lp-rn-body">
                    <div class="lp-rn-header">
                        <span class="lp-rn-num">Ch ${ch.number}</span>
                        <span class="lp-rn-badge lp-rn-badge--free">Free</span>
                    </div>
                    <div class="lp-rn-title">${ch.title}</div>
                    <div class="lp-rn-outcome">${outcome}</div>
                </div>
            </div>`;
        }).join('');

        return `
        <section class="lp-roadmap" id="lp-roadmap">
            <div class="lp-section-header">
                <div class="lp-section-label">Mission Briefing</div>
                <h2>Master the Full Supply Chain Arc</h2>
                <p class="lp-section-sub">10 chapters scaffolding from fundamentals to advanced strategy. Each chapter unlocks new crises, harder decisions, and deeper consequences.</p>
            </div>
            <div class="lp-roadmap-scroll">
                <div class="lp-roadmap-track">${nodes}</div>
            </div>
            <div class="lp-roadmap-legend">
                <span class="lp-rn-badge lp-rn-badge--free">Free</span>
                <span class="lp-roadmap-legend-text">All 10 chapters free — no account needed. Full Access adds the 5-page Advanced Report + certificate.</span>
            </div>
        </section>`;
    }

    _industriesHTML() {
        const firstTime = isFirstTimePlayer();

        const cards = Object.values(INDUSTRIES).map(ind => {
            const cfg = INDUSTRY_CONFIG[ind.id];
            if (!cfg) return '';
            const stats = cfg.stats.map(s =>
                `<div class="lp-ind-stat">
                    <span class="lp-ind-stat-val">${s.val}</span>
                    <span class="lp-ind-stat-label">${s.label}</span>
                </div>`
            ).join('');

            const isRecommended = firstTime && cfg.recommended;
            const recommendedTag = isRecommended
                ? `<div class="lp-ind-recommended-tag">&#10022; Recommended</div>`
                : '';
            const difficultyBadge = cfg.difficulty
                ? `<div class="lp-ind-difficulty" style="--diff-rgb:${cfg.difficulty.rgb}">${cfg.difficulty.label}</div>`
                : '';
            const personaLine = cfg.difficulty
                ? `<p class="lp-ind-persona">${cfg.difficulty.persona}</p>`
                : '';

            return `
            <div class="lp-ind-card${isRecommended ? ' lp-ind-card--recommended' : ''}" data-industry="${ind.id}"
                 style="--ind-accent:${cfg.accent}; --ind-accent-rgb:${cfg.accentRgb}">
                ${recommendedTag}
                <div class="lp-ind-badge-row">
                    <div class="lp-ind-badge">${cfg.label}</div>
                    ${difficultyBadge}
                </div>
                <div class="lp-ind-icon">${cfg.icon}</div>
                <h3 class="lp-ind-name">${ind.name}</h3>
                <p class="lp-ind-desc">${ind.description}</p>
                <div class="lp-ind-tagline">${cfg.tagline}</div>
                <div class="lp-ind-stats">${stats}</div>
                ${personaLine}
                <button class="lp-ind-btn" data-industry="${ind.id}">
                    Play ${ind.name} &rarr;
                </button>
            </div>`;
        }).join('');

        const chapterRows = CHAPTERS.map((ch, i) => {
            const isLocked = PremiumManager.isChapterLocked(ch.number);
            return `
            <div class="ch-select-card ${i === 0 ? 'ch-select-card--active' : ''} ${isLocked ? 'ch-select-card--locked' : ''}"
                 data-chapter-index="${i}" data-locked="${isLocked}">
                <div class="ch-select-num">Ch ${ch.number}</div>
                <div class="ch-select-icon">${getIcon(ch.icon, 20)}</div>
                <div class="ch-select-info">
                    <div class="ch-select-title">${ch.title}</div>
                    <div class="ch-select-outcome">${CHAPTER_OUTCOMES[i] || ''}</div>
                </div>
                ${isLocked ? `<div class="ch-select-lock">${getIcon('lock', 14)}</div>` : ''}
            </div>`;
        }).join('');

        const beginnerHint = firstTime
            ? `<p class="lp-beginner-hint">New to supply chain simulation? Start with <strong>Fast-Moving Consumer Goods.</strong></p>`
            : '';

        return `
        <section class="lp-industries" id="lp-industries">
            <div class="lp-section-header">
                <div class="lp-section-label">Choose Your Battlefield</div>
                <h2>Three Industries. Three Realities.</h2>
                <p class="lp-section-sub">Each industry has unique supply chain dynamics, cost structures, and risk profiles. The same decision that saves you in FMCG can be catastrophic in Pharma.</p>
                ${beginnerHint}
            </div>
            <div class="lp-ind-grid">${cards}</div>
            <div class="lp-chapter-jump">
                <button class="lp-chapter-jump-toggle" aria-expanded="false">
                    <span>Returning player? Jump to a specific chapter</span>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                </button>
                <div class="lp-chapter-jump-body" hidden>
                    <div class="ch-select-list" id="lp-ch-list">${chapterRows}</div>
                    <div class="ch-select-note" id="lp-ch-note">
                        Starting at <strong>Chapter 1</strong> — standard resources
                    </div>
                </div>
            </div>
        </section>`;
    }

    _survivalHTML() {
        const industryCards = Object.values(INDUSTRIES).map(ind => {
            const cfg = INDUSTRY_CONFIG[ind.id];
            if (!cfg) return '';
            return `
            <div class="lp-survival-card" data-survival-industry="${ind.id}" role="button" tabindex="0"
                 aria-label="Play Endless Survival — ${ind.name}">
                <span class="lp-survival-card-icon">${cfg.icon}</span>
                <span class="lp-survival-card-label">${ind.name}</span>
                <span class="lp-survival-card-sub">${cfg.tagline.split(' · ')[0]}</span>
            </div>`;
        }).join('');

        return `
        <section class="lp-survival" id="lp-survival">
            <div class="lp-survival-inner">
                <div class="lp-survival-badge">
                    <span class="lp-survival-badge-dot"></span>
                    ENDLESS MODE — EXPERIMENTAL
                </div>
                <h2>Endless Survival</h2>
                <p class="lp-survival-sub">
                    No chapters. No story safety net. Just you, the market, and an ever-escalating
                    supply chain. Every 5 turns difficulty spikes — survive as long as you can.
                    Cash hits zero or satisfaction collapses, it's over.
                </p>
                <div class="lp-survival-cards">
                    ${industryCards}
                </div>
                <p class="lp-survival-disclaimer">High score tracked per industry in your browser.</p>

                <div class="lp-weekly">
                    <div class="lp-weekly-badge">${getIcon('trophy', 13)} WEEKLY CHALLENGE</div>
                    <p class="lp-weekly-copy">Every player faces the <strong>same crisis sequence</strong> this week. One seed, one shot — climb the global leaderboard.</p>
                    <div class="lp-weekly-actions">
                        <button class="lp-weekly-play">Play This Week's Challenge &rarr;</button>
                        <button class="lp-weekly-board">View Leaderboard</button>
                    </div>
                </div>
            </div>
        </section>`;
    }

    _intelHTML() {
        const captured = localStorage.getItem('scd_progress_email') || '';
        return `
        <section class="lp-intel" id="lp-intel">
            <div class="lp-intel-inner">
                <div class="lp-intel-left">
                    <div class="lp-section-label">Save &amp; Resume</div>
                    <h2>Continue from any device</h2>
                    <p class="lp-intel-sub">Your game is saved locally. Enter your email to back it up — then pick up exactly where you left off on any device, any time.</p>
                    <ul class="lp-intel-benefits">
                        <li>${getIcon('checkmark', 15)} Progress backed up after each chapter</li>
                        <li>${getIcon('checkmark', 15)} Resume from any browser or device with your email</li>
                        <li>${getIcon('checkmark', 15)} Receive your personalized strategy debrief PDF</li>
                    </ul>
                </div>
                <div class="lp-intel-right">
                    <div class="lp-intel-terminal">
                        <div class="lp-terminal-bar">
                            <span class="lp-term-dot lp-term-dot--red"></span>
                            <span class="lp-term-dot lp-term-dot--amber"></span>
                            <span class="lp-term-dot lp-term-dot--green"></span>
                            <span class="lp-term-title">SESSION_RESTORE.exe</span>
                        </div>
                        <div class="lp-intel-form-body">
                            <div class="lp-intel-prompt">
                                <span class="lp-term-prompt">&gt;</span>
                                <span class="lp-intel-prompt-text">ENTER YOUR EMAIL TO SAVE OR RESUME</span>
                            </div>
                            <div class="lp-intel-input-row">
                                <input type="email" class="lp-intel-input" id="lp-intel-email"
                                       placeholder="you@example.com"
                                       autocomplete="email"
                                       value="${captured}" />
                                <button class="lp-intel-submit" id="lp-intel-submit">
                                    ${captured ? 'Check session &rarr;' : 'Save &amp; Restore &rarr;'}
                                </button>
                            </div>
                            <div class="lp-intel-status" id="lp-intel-status"></div>
                            <div id="lp-restore-wrap" style="display:none;margin-top:12px;"></div>
                            <div class="lp-intel-note">
                                <span class="lp-term-prompt">&gt;</span>
                                <span>No spam. Used only for session recovery and product updates.</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </section>`;
    }

    _upgradeHTML() {
        const check  = `<svg class="lp-tier-check" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`;
        const cross  = `<svg class="lp-tier-cross" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

        return `
        <section class="lp-upgrade">
            <div class="lp-section-header">
                <div class="lp-section-label">Pricing</div>
                <h2>All 10 chapters free. One-time upgrade.</h2>
                <p class="lp-section-sub">Play the entire game free — no account. A one-time Full Access purchase adds the 5-page Advanced Report and your certificate, for life. No subscription.</p>
            </div>
            <div class="lp-pricing-grid">

                <!-- FREE tier -->
                <div class="lp-tier lp-tier--free glass-panel">
                    <div class="lp-tier-header">
                        <span class="lp-tier-label">Free</span>
                        <div class="lp-tier-price">
                            <span class="lp-tier-amount">$0</span>
                        </div>
                        <p class="lp-tier-tagline">Start immediately. No card needed.</p>
                    </div>
                    <ul class="lp-tier-features">
                        <li>${check} <strong>All 10 chapters — 40-turn campaign</strong></li>
                        <li>${check} All 3 industries</li>
                        <li>${check} Live analytics dashboard</li>
                        <li>${check} Bullwhip Effect tracker</li>
                        <li>${check} In-browser performance debrief</li>
                        <li>${cross} <span class="lp-tier-locked">5-page Advanced Report (PDF)</span></li>
                        <li>${cross} <span class="lp-tier-locked">Certificate of Completion</span></li>
                    </ul>
                    <button class="lp-tier-cta lp-tier-cta--free lp-begin-btn-pricing">
                        Play Free &rarr;
                    </button>
                </div>

                <!-- FULL ACCESS tier -->
                <div class="lp-tier lp-tier--premium glass-panel">
                    <div class="lp-tier-badge-top">LIFETIME ACCESS</div>
                    <div class="lp-tier-header">
                        <span class="lp-tier-label">Full Access</span>
                        <div class="lp-tier-price">
                            <span class="lp-tier-amount lp-tier-amount--premium">$49.99</span>
                            <span class="lp-tier-period">one-time</span>
                        </div>
                        <p class="lp-tier-tagline">The full analysis layer. Lifetime access. No subscriptions.</p>
                    </div>
                    <ul class="lp-tier-features">
                        <li>${check} Everything in Free — all 10 chapters</li>
                        <li>${check} <strong>5-page Advanced Report (PDF debrief)</strong></li>
                        <li>${check} <strong>Turn-by-turn Decision Audit</strong></li>
                        <li>${check} <strong>Learning Summary &amp; Chapter Breakdown</strong></li>
                        <li>${check} <strong>Certificate of Completion</strong></li>
                        <li>${check} <strong>Lifetime Updates</strong></li>
                    </ul>
                    <button class="lp-tier-cta lp-tier-cta--premium btn-glow lp-upgrade-btn">
                        Unlock Everything — $49.99 ✦
                    </button>
                    <p class="lp-tier-guarantee">7-day refund policy &mdash; no questions asked</p>
                </div>

            </div>
        </section>`;
    }

    /* ── Event Listeners ───────────────────────────────────── */

    _attachListeners(page) {
        // Hero CTA → smooth scroll to industry section
        page.querySelector('.lp-begin-btn')?.addEventListener('click', () => {
            page.querySelector('#lp-industries').scrollIntoView({ behavior: 'smooth' });
        });

        // Pricing "Play Free" CTA → scroll to industries
        page.querySelector('.lp-begin-btn-pricing')?.addEventListener('click', () => {
            page.querySelector('#lp-industries').scrollIntoView({ behavior: 'smooth' });
        });

        // Demo button
        page.querySelector('#lp-demo-btn')?.addEventListener('click', () => showDemo({
            onStart: () => this.container.querySelector('#lp-industries')?.scrollIntoView({ behavior: 'smooth' }),
        }));

        // Industry card "Play X" buttons → launch game
        page.querySelectorAll('.lp-ind-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                setNavMinimal(false);
                this.onLaunch(btn.dataset.industry, this.selectedChapterIndex);
            });
        });

        // Clicking anywhere on the card also launches
        page.querySelectorAll('.lp-ind-card').forEach(card => {
            card.addEventListener('click', (e) => {
                if (e.target.closest('.lp-ind-btn')) return;
                setNavMinimal(false);
                this.onLaunch(card.dataset.industry, this.selectedChapterIndex);
            });
        });

        // Chapter jump accordion
        const jumpToggle = page.querySelector('.lp-chapter-jump-toggle');
        const jumpBody   = page.querySelector('.lp-chapter-jump-body');
        jumpToggle?.addEventListener('click', () => {
            const open = jumpToggle.getAttribute('aria-expanded') === 'true';
            jumpToggle.setAttribute('aria-expanded', String(!open));
            jumpBody.hidden = open;
        });

        // Chapter row selection
        page.querySelectorAll('#lp-ch-list .ch-select-card').forEach(card => {
            card.addEventListener('click', () => {
                if (card.dataset.locked === 'true') {
                    document.dispatchEvent(new CustomEvent('scd:open-paywall'));
                    return;
                }
                page.querySelectorAll('#lp-ch-list .ch-select-card')
                    .forEach(c => c.classList.remove('ch-select-card--active'));
                card.classList.add('ch-select-card--active');
                const idx = parseInt(card.dataset.chapterIndex, 10);
                this.selectedChapterIndex = idx;
                const ch  = CHAPTERS[idx];
                const note = page.querySelector('#lp-ch-note');
                if (note) {
                    note.innerHTML = idx === 0
                        ? `Starting at <strong>Chapter 1</strong> — standard resources`
                        : `Starting at <strong>Chapter ${ch.number}: ${ch.title}</strong> — boosted starting capital &amp; inventory`;
                }
            });
        });

        // Email save & restore
        const emailInput  = page.querySelector('#lp-intel-email');
        const submitBtn   = page.querySelector('#lp-intel-submit');
        const statusEl    = page.querySelector('#lp-intel-status');
        const restoreWrap = page.querySelector('#lp-restore-wrap');

        submitBtn?.addEventListener('click', () =>
            this._handleEmailSubmit(emailInput, submitBtn, statusEl, restoreWrap)
        );
        emailInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleEmailSubmit(emailInput, submitBtn, statusEl, restoreWrap);
        });

        // Upgrade button → paywall
        page.querySelector('.lp-upgrade-btn')?.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('scd:open-paywall'));
        });

        // Survival mode industry cards → launch endless mode
        page.querySelectorAll('.lp-survival-card').forEach(card => {
            const launch = () => { setNavMinimal(false); this.onLaunch(card.dataset.survivalIndustry, 0, 'endless'); };
            card.addEventListener('click', launch);
            card.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') launch(); });
        });

        // Weekly challenge → dispatch to the dashboard (seeded run / leaderboard)
        page.querySelector('.lp-weekly-play')?.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('scd:start-weekly'));
        });
        page.querySelector('.lp-weekly-board')?.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('scd:show-leaderboard'));
        });
    }


    async _handleEmailSubmit(input, btn, status, restoreWrap) {
        const INDUSTRY_LABELS = { electronics: 'Electronics', fmcg: 'Consumer Goods', pharma: 'Pharmaceuticals' };

        const email = input.value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            status.innerHTML = '<span class="lp-intel-status--error">&gt; ERROR: Invalid email format</span>';
            return;
        }

        btn.disabled     = true;
        btn.textContent  = 'Checking...';
        status.innerHTML = '';

        try {
            // Check for existing saved game state on the server
            const loadRes  = await fetch('/api/load-game', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email }),
            });
            const loadData = loadRes.ok ? await loadRes.json() : { found: false };

            // Always persist email locally
            localStorage.setItem('scd_progress_email', email);

            if (loadData.found && loadData.gameState?.industryId) {
                // Saved session found — offer to continue
                this._loadedGameState = loadData.gameState;
                const chNum    = (loadData.gameState.chapterIndex || 0) + 1;
                const indLabel = INDUSTRY_LABELS[loadData.gameState.industryId] || 'Unknown';

                status.innerHTML = `<span class="lp-intel-status--success">&gt; SESSION FOUND: Chapter ${chNum} &middot; ${indLabel}</span>`;
                btn.textContent  = 'Saved ✓';

                if (restoreWrap) {
                    restoreWrap.innerHTML = `<button
                        style="width:100%;padding:10px 16px;background:linear-gradient(135deg,var(--primary-color),var(--primary-dark));color:var(--text-inverse);border:none;border-radius:8px;font-size:13px;font-weight:700;cursor:pointer;letter-spacing:0.03em;"
                        id="lp-restore-btn">
                        Continue &mdash; Chapter ${chNum}: ${indLabel} &rarr;
                    </button>`;
                    restoreWrap.style.display = 'block';
                    restoreWrap.querySelector('#lp-restore-btn').addEventListener('click', () => {
                        const gs = this._loadedGameState;
                        if (!gs) return;
                        setNavMinimal(false);
                        this.onLaunch(gs.industryId, gs.chapterIndex + 1, 'story', gs);
                    });
                }
            } else {
                // No saved state — register the email
                await fetch('/api/save-game', {
                    method:  'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body:    JSON.stringify({ email, gameState: null, sendEmail: true }),
                });
                status.innerHTML = '<span class="lp-intel-status--success">&gt; SUCCESS: Email saved. Confirmation sent.</span>';
                btn.textContent  = 'Saved ✓';
            }
        } catch {
            btn.disabled    = false;
            btn.textContent = localStorage.getItem('scd_progress_email') ? 'Check session →' : 'Save & Restore →';
            status.innerHTML = '<span class="lp-intel-status--error">&gt; ERROR: Backup failed. Try again.</span>';
        }
    }
}
