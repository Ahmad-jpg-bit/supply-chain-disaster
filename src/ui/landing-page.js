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
import { INDUSTRIES } from '../logic/industries.js';
import { getIcon } from '../graphics/svg-icons.js';
import { PremiumManager } from '../logic/premium.js';
import { createFooter } from '../shared/footer.js';
import { setNavMinimal } from '../shared/nav.js';

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
        accent: '#f59e0b',
        accentRgb: '245,158,11',
        label: 'Emergency Alert',
        tagline: 'Volatile demand · Long lead times · Chip shortages',
        stats: [
            { val: '2–4wk', label: 'Lead Time' },
            { val: '±40%', label: 'Demand Swing' },
            { val: '$1M', label: 'Capital' },
        ],
        difficulty: {
            label: 'Intermediate',
            rgb: '245,158,11',
            persona: "Best if you're familiar with volatile demand",
        },
    },
    fmcg: {
        icon: getIcon('store', 32),
        accent: '#3b82f6',
        accentRgb: '59,130,246',
        label: 'High Volume',
        tagline: 'High volume · Tight margins · Rapid replenishment',
        stats: [
            { val: '1–2wk', label: 'Lead Time' },
            { val: '±20%', label: 'Demand Swing' },
            { val: '$500K', label: 'Capital' },
        ],
        difficulty: {
            label: 'Start here',
            rgb: '34,197,94',
            persona: 'Best for your first playthrough',
        },
        recommended: true,
    },
    pharma: {
        icon: getIcon('shield', 32),
        accent: '#22c55e',
        accentRgb: '34,197,94',
        label: 'Regulatory',
        tagline: 'Regulatory constraints · Safety stock · Cold chain',
        stats: [
            { val: '3–6wk', label: 'Lead Time' },
            { val: '±15%', label: 'Demand Swing' },
            { val: '$2M', label: 'Capital' },
        ],
        difficulty: {
            label: 'Advanced',
            rgb: '239,68,68',
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
        this.container  = container;
        this.onLaunch   = onLaunch;
        this.skipHero   = options.skipHero || false;
        this.selectedChapterIndex = 0;
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
                            <span class="lp-stat-val">8</span>
                            <span class="lp-stat-label">Chapters</span>
                        </div>
                        <div class="lp-stat-divider"></div>
                        <div class="lp-stat">
                            <span class="lp-stat-val">3</span>
                            <span class="lp-stat-label">Industries</span>
                        </div>
                        <div class="lp-stat-divider"></div>
                        <div class="lp-stat">
                            <span class="lp-stat-val">32</span>
                            <span class="lp-stat-label">Decisions</span>
                        </div>
                        <div class="lp-stat-divider"></div>
                        <div class="lp-stat">
                            <span class="lp-stat-val">&lt;2h</span>
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
            '🔴 LIVE &nbsp;·&nbsp; Suez Canal congestion delays 340 vessels — estimated clearance: 4 days',
            '⚠ Port of Los Angeles strike enters Day 3 — container dwell time up 280%',
            '📦 Taiwan semiconductor lead times extend to 26 weeks — Q3 allocations frozen',
            '🚢 Red Sea diversions add $2,400/TEU surcharge — shippers absorbing costs',
            '⚡ Cold chain disruption across EU pharma network — safety stock at critical level',
            '⚠ Demand spike +180% for consumer electronics — double-ordering detected upstream',
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
        const nodes = CHAPTERS.map((ch, i) => {
            const hasNext   = i < CHAPTERS.length - 1;
            const outcome   = CHAPTER_OUTCOMES[i] || '';
            return `
            <div class="lp-roadmap-node lp-roadmap-node--free">
                <div class="lp-rn-icon">${getIcon(ch.icon, 20)}</div>
                ${hasNext ? '<div class="lp-rn-connector"></div>' : ''}
                <div class="lp-rn-body">
                    <div class="lp-rn-header">
                        <span class="lp-rn-num">Ch ${ch.number}</span>
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
                <p class="lp-section-sub">8 chapters scaffolding from fundamentals to advanced strategy. All free — no paywall, no account required.</p>
            </div>
            <div class="lp-roadmap-scroll">
                <div class="lp-roadmap-track">${nodes}</div>
            </div>
            <div class="lp-roadmap-legend">
                <span class="lp-rn-badge lp-rn-badge--free">Free</span>
                <span class="lp-roadmap-legend-text">All 8 chapters &mdash; no account needed</span>
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
                ${isLocked ? '<div class="ch-select-lock">🔒</div>' : ''}
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
            </div>
        </section>`;
    }

    _intelHTML() {
        const captured = localStorage.getItem('scd_progress_email') || '';
        return `
        <section class="lp-intel" id="lp-intel">
            <div class="lp-intel-inner">
                <div class="lp-intel-left">
                    <div class="lp-section-label">Save Progress</div>
                    <h2>Save Your Progress</h2>
                    <p class="lp-intel-sub">Your game progress is stored in your browser. Enter your email to back it up and recover across devices if your browser data is ever cleared.</p>
                    <ul class="lp-intel-benefits">
                        <li>${getIcon('checkmark', 15)} Progress backup after each chapter</li>
                        <li>${getIcon('checkmark', 15)} Receive your personalized strategy debrief PDF</li>
                        <li>${getIcon('checkmark', 15)} Get notified when Expansion chapters go live</li>
                    </ul>
                </div>
                <div class="lp-intel-right">
                    <div class="lp-intel-terminal">
                        <div class="lp-terminal-bar">
                            <span class="lp-term-dot lp-term-dot--red"></span>
                            <span class="lp-term-dot lp-term-dot--amber"></span>
                            <span class="lp-term-dot lp-term-dot--green"></span>
                            <span class="lp-term-title">PROGRESS_BACKUP.exe</span>
                        </div>
                        <div class="lp-intel-form-body">
                            <div class="lp-intel-prompt">
                                <span class="lp-term-prompt">&gt;</span>
                                <span class="lp-intel-prompt-text">ENTER YOUR EMAIL</span>
                            </div>
                            <div class="lp-intel-input-row">
                                <input type="email" class="lp-intel-input" id="lp-intel-email"
                                       placeholder="you@example.com"
                                       autocomplete="email"
                                       value="${captured}" />
                                <button class="lp-intel-submit" id="lp-intel-submit">
                                    ${captured ? 'Saved ✓' : 'Save Progress &rarr;'}
                                </button>
                            </div>
                            <div class="lp-intel-status" id="lp-intel-status">
                                ${captured ? `<span class="lp-intel-status--success">&gt; SUCCESS: Progress already saved</span>` : ''}
                            </div>
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

        return `
        <section class="lp-upgrade">
            <div class="lp-section-header">
                <div class="lp-section-label">Pricing</div>
                <h2>Choose Your Access Level</h2>
                <p class="lp-section-sub">Start free today. Upgrade when you're ready for the full arc.</p>
            </div>
            <div class="lp-pricing-grid">

                <!-- FREE tier -->
                <div class="lp-tier lp-tier--free glass-panel">
                    <div class="lp-tier-header">
                        <span class="lp-tier-label">Free</span>
                        <div class="lp-tier-price">
                            <span class="lp-tier-amount">$0</span>
                        </div>
                        <p class="lp-tier-tagline">The full game. No card needed.</p>
                    </div>
                    <ul class="lp-tier-features">
                        <li>${check} <strong>Full 8-chapter game</strong></li>
                        <li>${check} All 3 industries</li>
                        <li>${check} Live analytics dashboard</li>
                        <li>${check} Bullwhip Effect tracker</li>
                        <li>${check} Core performance summary</li>
                    </ul>
                    <button class="lp-tier-cta lp-tier-cta--free lp-begin-btn-pricing">
                        Play Free &rarr;
                    </button>
                </div>

                <!-- STANDARD tier -->
                <div class="lp-tier lp-tier--premium glass-panel">
                    <div class="lp-tier-badge-top">MOST POPULAR</div>
                    <div class="lp-tier-header">
                        <span class="lp-tier-label">Standard</span>
                        <div class="lp-tier-price">
                            <span class="lp-tier-amount lp-tier-amount--premium">$14.99</span>
                            <span class="lp-tier-period">one-time</span>
                        </div>
                        <p class="lp-tier-tagline">Deep post-game analytics. Lifetime access.</p>
                    </div>
                    <ul class="lp-tier-features">
                        <li>${check} Everything in Free</li>
                        <li>${check} <strong>Full Debrief Report</strong></li>
                        <li>${check} <strong>Decision Audit (all turns)</strong></li>
                        <li>${check} <strong>PDF Download</strong></li>
                        <li>${check} <strong>Lifetime Updates</strong></li>
                    </ul>
                    <button class="lp-tier-cta lp-tier-cta--premium btn-glow lp-upgrade-btn">
                        Unlock Debrief Report ✦
                    </button>
                    <p class="lp-tier-guarantee">30-day refund policy &mdash; no questions asked</p>
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
        page.querySelector('#lp-demo-btn')?.addEventListener('click', () => this._showDemo());

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

        // Email capture
        const emailInput = page.querySelector('#lp-intel-email');
        const submitBtn  = page.querySelector('#lp-intel-submit');
        const statusEl   = page.querySelector('#lp-intel-status');

        // If already captured, disable the button
        if (submitBtn && localStorage.getItem('scd_progress_email')) {
            submitBtn.disabled = true;
        }

        submitBtn?.addEventListener('click', () =>
            this._handleEmailSubmit(emailInput, submitBtn, statusEl)
        );
        emailInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleEmailSubmit(emailInput, submitBtn, statusEl);
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
    }

    _showDemo() {
        const SLIDE_MS     = 10_000;
        const TOTAL_SLIDES = 3;
        const slides       = [
            this._demoSlideDecision(),
            this._demoSlideOutcome(),
            this._demoSlideSummary(),
        ];
        const badges = [
            'CHAPTER 2 · DECISION SCREEN',
            'CHAPTER 2 · OUTCOME LOG',
            'CHAPTER 2 · PERFORMANCE REPORT',
        ];

        const overlay = document.createElement('div');
        overlay.className = 'lp-demo-overlay';
        overlay.innerHTML = `
            <div class="lp-demo-modal">
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
            if (current === 0) _scheduleAutoSelect();
        };

        const _scheduleAutoSelect = () => {
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
        _scheduleAutoSelect();

        dotsEl.querySelectorAll('.lp-demo-dot').forEach(dot =>
            dot.addEventListener('click', () => goTo(Number(dot.dataset.slide)))
        );

        const close = () => {
            cancelAnimationFrame(rafId);
            clearTimeout(selectTimer);
            overlay.classList.remove('visible');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        };

        overlay.querySelector('.lp-demo-close').addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
        overlay.querySelector('.lp-demo-start-btn').addEventListener('click', () => {
            close();
            this.container.querySelector('#lp-industries')?.scrollIntoView({ behavior: 'smooth' });
        });
    }

    _demoSlideDecision() {
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
                    <span class="lp-demo-metric-val" style="color:#f59e0b">$847,200</span>
                </div>
                <div class="lp-demo-metric">
                    <span class="lp-demo-metric-label">INVENTORY</span>
                    <span class="lp-demo-metric-val" style="color:#ef4444">312 units</span>
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
                <div class="lp-demo-scenario-label">⚠ SCENARIO ALERT</div>
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

    _demoSlideOutcome() {
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

    _demoSlideSummary() {
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
                        <div class="lp-demo-mastery-fill" style="width:68%;background:#3b82f6"></div>
                    </div>
                </div>
                <div class="lp-demo-mastery-item">
                    <div class="lp-demo-mastery-header">
                        <span class="lp-demo-mastery-label">Cash Flow Control</span>
                        <span class="lp-demo-mastery-pct">52%</span>
                    </div>
                    <div class="lp-demo-mastery-bar">
                        <div class="lp-demo-mastery-fill" style="width:52%;background:#f59e0b"></div>
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
                        <div class="lp-demo-mastery-fill" style="width:79%;background:#22c55e"></div>
                    </div>
                </div>
            </div>
            <p class="lp-demo-summary-cta-text">6 more chapters of escalating crises await &mdash; dual-sourcing, supplier bankruptcy, Just-In-Time failure, and more.</p>
        </div>`;
    }

    async _handleEmailSubmit(input, btn, status) {
        const email = input.value.trim();
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            status.innerHTML = '<span class="lp-intel-status--error">&gt; ERROR: Invalid email format</span>';
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Saving...';
        status.innerHTML = '';

        try {
            const res = await fetch('/api/save-progress', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, chapter: 0, industry: 'general' }),
            });
            if (!res.ok) throw new Error();

            localStorage.setItem('scd_progress_email', email);
            status.innerHTML = '<span class="lp-intel-status--success">&gt; SUCCESS: Progress saved. Confirmation sent.</span>';
            btn.textContent  = 'Saved ✓';
        } catch {
            btn.disabled    = false;
            btn.textContent = 'Save Progress →';
            status.innerHTML = '<span class="lp-intel-status--error">&gt; ERROR: Backup failed. Try again.</span>';
        }
    }
}
