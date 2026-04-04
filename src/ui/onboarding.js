/**
 * 4-step onboarding wizard replacing the simple start screen.
 * Steps: Welcome → What You'll Learn → Choose Industry → Launch
 */
import { CHAPTERS } from '../data/chapters.js';
import { INDUSTRIES } from '../logic/industries.js';
import { getIcon } from '../graphics/svg-icons.js';
import { PremiumManager } from '../logic/premium.js';

const INDUSTRY_ACCENTS = {
    electronics: { color: '#f59e0b', label: 'Amber' },
    fmcg: { color: '#22c55e', label: 'Green' },
    pharma: { color: '#a855f7', label: 'Purple' },
};

const DIFFICULTY_MAP = {
    Easy: 1,
    Medium: 2,
    Hard: 3,
};

// Difficulty pip counts per chapter (1–5 scale)
const CHAPTER_DIFFICULTY = [1, 2, 3, 3, 4, 4, 4, 5];

// One-line learning outcome per chapter
const CHAPTER_OUTCOMES = [
    'Forecast demand to avoid stockouts & overstock',
    'Trace how small demand swings amplify upstream',
    'JIT & Safety Stock — Master buffer calculations',
    'Dual-source vs single-source resilience trade-offs',
    'TCO — uncover the hidden costs beyond unit price',
    'Multi-modal routing and last-mile cost optimization',
    'Six Sigma defect thresholds & quality cost curves',
    'Circular loops, carbon reporting & reverse logistics',
];

export class Onboarding {
    /**
     * @param {HTMLElement} container     – the #start-screen element
     * @param {function}    onLaunch      – called with (industryId, startChapterIndex)
     *
     * Two-step flow:  Welcome → Setup (industry + optional chapter select) → Game
     */
    constructor(container, onLaunch) {
        this.container = container;
        this.onLaunch = onLaunch;
        this.currentStep = 0;
        this.selectedIndustryId = null;
        this.selectedChapterIndex = 0;
        this.totalSteps = 2;
        this.render();
    }

    render() {
        this.container.innerHTML = '';
        this.container.classList.remove('hidden');

        const wrapper = document.createElement('div');
        wrapper.className = 'onboarding-wrapper';

        const viewport = document.createElement('div');
        viewport.className = 'onboarding-viewport';
        this.viewport = viewport;

        this.steps = [
            this._buildWelcome(),
            this._buildSetup(),
        ];

        this.steps.forEach((step, i) => {
            step.classList.add('onboarding-step');
            step.dataset.step = i;
            viewport.appendChild(step);
        });

        wrapper.appendChild(viewport);

        const dots = document.createElement('div');
        dots.className = 'onboarding-dots';
        for (let i = 0; i < this.totalSteps; i++) {
            const dot = document.createElement('span');
            dot.className = 'onboarding-dot';
            if (i === 0) dot.classList.add('active');
            dots.appendChild(dot);
        }
        this.dots = dots;
        wrapper.appendChild(dots);

        this.container.appendChild(wrapper);
        this._goToStep(0, false);
    }

    /* ──────── Step Builders ──────── */

    _buildWelcome() {
        const step = document.createElement('div');
        step.innerHTML = `
            <div class="onboarding-welcome">
                <div class="welcome-hero-logo">
                    <div class="hero-glow-ring"></div>
                    <img src="/logo.png" alt="Supply Chain Disaster" class="welcome-logo-img" />
                </div>
                <div class="welcome-type-badge">STRATEGIC SIMULATION</div>
                <p class="welcome-tagline">Master the flow. Survive the market.</p>
                <p class="welcome-authority-sub">Bridge the gap between theory and crisis management with our interactive strategic simulation.</p>
                <div class="welcome-stats" style="gap: 1.5rem;">
                    <span class="welcome-stat-pill"><span class="text-orange-500 font-bold" style="margin-right: 0.5rem;">8</span> Chapters</span>
                    <span class="welcome-stat-pill"><span class="text-orange-500 font-bold" style="margin-right: 0.5rem;">3</span> Industries</span>
                    <span class="welcome-stat-pill"><span class="text-orange-500 font-bold" style="margin-right: 0.5rem;">32</span> Decisions</span>
                </div>
                <div class="welcome-industry-preview">
                    <div class="ind-preview-card ind-preview--electronics">
                        <span class="ind-preview-icon">⚡</span>
                        <span class="ind-preview-name">Electronics</span>
                        <span class="ind-preview-trait">Volatile demand · Long lead times</span>
                    </div>
                    <div class="ind-preview-card ind-preview--fmcg">
                        <span class="ind-preview-icon">📦</span>
                        <span class="ind-preview-name">FMCG</span>
                        <span class="ind-preview-trait">High volume · Tight margins</span>
                    </div>
                    <div class="ind-preview-card ind-preview--pharma">
                        <span class="ind-preview-icon">💊</span>
                        <span class="ind-preview-name">Pharma</span>
                        <span class="ind-preview-trait">Regulatory · Safety stock</span>
                    </div>
                </div>
                <div class="hero-cta-row">
                    <button class="btn-primary btn-glow onboarding-next-btn">Begin Your Journey</button>
                    <button class="btn-secondary-ghost welcome-demo-btn">&#9654; See a Scenario</button>
                </div>
                <button class="btn-premium-cta welcome-upgrade-btn">Unlock Professional Tier ✦<span class="upgrade-feature-hints">Advanced Analytics · Certificate · All 8 Chapters</span></button>
                <div class="welcome-scroll-hint" role="button" tabindex="0" title="See what you'll learn" aria-label="Explore curriculum">
                    <span class="scroll-hint-label">What You'll Learn</span>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </div>
            </div>
        `;
        // Title is embedded in the logo image — no character reveal needed

        step.querySelector('.onboarding-next-btn').onclick = () => this._next();
        step.querySelector('.welcome-demo-btn').onclick = () => this._showScenarioDemo();
        step.querySelector('.welcome-upgrade-btn').onclick = () => {
            document.dispatchEvent(new CustomEvent('scd:open-paywall'));
        };

        // Scroll hint → advance to "What You'll Learn" step
        const scrollHint = step.querySelector('.welcome-scroll-hint');
        scrollHint.addEventListener('click', () => this._next());
        scrollHint.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); this._next(); }
        });

        return step;
    }

    _buildSetup() {
        const step = document.createElement('div');
        const allChapters = [...CHAPTERS];

        // Industry cards
        const industryCards = Object.values(INDUSTRIES).map(ind => {
            const accent = INDUSTRY_ACCENTS[ind.id] || INDUSTRY_ACCENTS.electronics;
            const diff = DIFFICULTY_MAP[ind.difficulty] || 1;
            const iconName = { electronics: 'factory', fmcg: 'truck', pharma: 'warehouse' }[ind.id] || 'store';
            const segments = [1, 2, 3].map(s => {
                const filled = s <= diff;
                const segColor = s === 1 ? '#22c55e' : s === 2 ? '#f59e0b' : '#ef4444';
                return `<span class="diff-seg ${filled ? 'filled' : ''}" style="${filled ? `background:${segColor}` : ''}"></span>`;
            }).join('');
            return `
                <div class="industry-card-v2 glass-panel" data-industry="${ind.id}" style="--accent: ${accent.color}">
                    <div class="ind-card-icon" style="color: ${accent.color}">${getIcon(iconName, 40)}</div>
                    <h3>${ind.name}</h3>
                    <p class="ind-card-desc">${ind.description}</p>
                    <div class="ind-card-diff">
                        <span class="diff-label">Difficulty</span>
                        <div class="diff-bar">${segments}</div>
                        <span class="diff-text">${ind.difficulty}</span>
                    </div>
                </div>
            `;
        }).join('');

        // Chapter list (for accordion)
        const chapterRows = allChapters.map((ch, i) => {
            const isLocked = PremiumManager.isChapterLocked(ch.number);
            const diffCount = CHAPTER_DIFFICULTY[i] || 1;
            const pips = Array.from({ length: 5 }, (_, p) =>
                `<span class="diff-pip ${p < diffCount ? 'diff-pip--filled' : ''}"></span>`
            ).join('');
            return `
                <div class="ch-select-card ${i === 0 ? 'ch-select-card--active' : ''} ${isLocked ? 'ch-select-card--locked' : ''}"
                     data-chapter-index="${i}" data-locked="${isLocked}">
                    <div class="ch-select-num">Ch ${ch.number}</div>
                    <div class="ch-select-icon">${getIcon(ch.icon, 20)}</div>
                    <div class="ch-select-info">
                        <div class="ch-select-title">${ch.title}</div>
                        <div class="ch-select-outcome">${CHAPTER_OUTCOMES[i] || ''}</div>
                    </div>
                    <div class="ch-select-diff">${pips}</div>
                    ${isLocked ? '<div class="ch-select-lock">🔒</div>' : ''}
                </div>
            `;
        }).join('');

        step.innerHTML = `
            <div class="onboarding-setup">
                <h2>Choose Your Industry</h2>
                <p class="industry-subtitle">Each industry has unique challenges and dynamics</p>
                <div class="industry-cards-v2">${industryCards}</div>

                <div class="setup-chapter-accordion">
                    <button class="setup-chapter-toggle" aria-expanded="false">
                        <span class="setup-chapter-toggle-label">Returning player? Choose starting chapter</span>
                        <svg class="setup-chapter-chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                    </button>
                    <div class="setup-chapter-body" hidden>
                        <div class="ch-select-list">${chapterRows}</div>
                        <div class="ch-select-note" id="setup-ch-note">
                            Starting at <strong>Chapter 1</strong> — standard resources
                        </div>
                    </div>
                </div>

                <button class="btn-primary btn-glow setup-start-btn" disabled>
                    Start Playing &rarr;
                </button>
                <button class="btn-secondary setup-back-btn" style="margin-top:0.5rem;">Back</button>
            </div>
        `;

        // Industry selection
        step.querySelectorAll('.industry-card-v2').forEach(card => {
            card.addEventListener('click', () => {
                step.querySelectorAll('.industry-card-v2').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedIndustryId = card.dataset.industry;
                step.querySelector('.setup-start-btn').disabled = false;
            });
        });

        // Chapter accordion toggle
        const toggle = step.querySelector('.setup-chapter-toggle');
        const body   = step.querySelector('.setup-chapter-body');
        toggle.addEventListener('click', () => {
            const expanded = toggle.getAttribute('aria-expanded') === 'true';
            toggle.setAttribute('aria-expanded', String(!expanded));
            body.hidden = expanded;
            toggle.classList.toggle('setup-chapter-toggle--open', !expanded);
        });

        // Chapter row selection
        step.querySelectorAll('.ch-select-card').forEach(card => {
            card.addEventListener('click', () => {
                if (card.dataset.locked === 'true') {
                    document.dispatchEvent(new CustomEvent('scd:open-paywall'));
                    return;
                }
                step.querySelectorAll('.ch-select-card').forEach(c => c.classList.remove('ch-select-card--active'));
                card.classList.add('ch-select-card--active');
                const idx = parseInt(card.dataset.chapterIndex, 10);
                this.selectedChapterIndex = idx;
                const ch = allChapters[idx];
                const note = step.querySelector('#setup-ch-note');
                if (note) {
                    note.innerHTML = idx === 0
                        ? `Starting at <strong>Chapter 1</strong> — standard resources`
                        : `Starting at <strong>Chapter ${ch.number}: ${ch.title}</strong> — boosted starting capital &amp; inventory`;
                }
            });
        });

        // Start
        step.querySelector('.setup-start-btn').addEventListener('click', () => {
            if (this.selectedIndustryId && this.onLaunch) {
                this.onLaunch(this.selectedIndustryId, this.selectedChapterIndex);
            }
        });

        step.querySelector('.setup-back-btn').onclick = () => this._prev();
        return step;
    }

    _buildLearnOverview() {
        const step = document.createElement('div');
        const isPremium = PremiumManager.isPremium();
        const FREE_COUNT = 2;
        const total = CHAPTERS.length;
        const unlockedCount = isPremium ? total : FREE_COUNT;
        const progressPct = Math.round((unlockedCount / total) * 100);

        const grid = CHAPTERS.map((ch, i) => {
            const isLocked = PremiumManager.isChapterLocked(ch.number);
            const diffCount = CHAPTER_DIFFICULTY[i] || 1;
            const pips = Array.from({ length: 5 }, (_, p) => {
                const filled = p < diffCount;
                return `<span class="diff-pip ${filled ? 'diff-pip--filled' : ''}" data-level="${p + 1}"></span>`;
            }).join('');
            const outcome = CHAPTER_OUTCOMES[i] || '';

            return `
                <div class="learn-card ${isLocked ? 'learn-card--locked' : ''}" style="animation-delay: ${i * 0.07}s" data-chapter="${ch.number}" data-locked="${isLocked}">
                    <div class="learn-card-difficulty">${pips}</div>
                    <div class="learn-card-icon">${getIcon(ch.icon, 28)}</div>
                    <span class="learn-card-num">Ch ${ch.number}</span>
                    <span class="learn-card-title">${ch.title}</span>
                    <span class="learn-card-outcome">${outcome}</span>
                    ${isLocked ? '<div class="learn-card-lock-overlay"><span class="learn-card-lock-icon">🔒</span></div>' : ''}
                </div>
            `;
        }).join('');

        step.innerHTML = `
            <div class="onboarding-learn">
                <h2>What You'll Learn</h2>
                <p class="learn-subtitle">8 chapters covering the full supply chain lifecycle</p>
                <div class="chapter-curriculum-bar">
                    <div class="chapter-curriculum-bar__track">
                        <div class="chapter-curriculum-bar__fill" style="width: ${progressPct}%"></div>
                    </div>
                    <span class="chapter-curriculum-bar__label">${unlockedCount} / ${total} chapters unlocked</span>
                </div>
                <div class="learn-grid">${grid}</div>
                <div class="skills-mastery-grid">
                    <div class="skill-tile"><span class="skill-tile-icon">⏱</span><span class="skill-tile-name">Lead Time Optimization</span></div>
                    <div class="skill-tile"><span class="skill-tile-icon">🛡</span><span class="skill-tile-name">Risk Mitigation</span></div>
                    <div class="skill-tile"><span class="skill-tile-icon">📊</span><span class="skill-tile-name">Inventory Management</span></div>
                    <div class="skill-tile"><span class="skill-tile-icon">📈</span><span class="skill-tile-name">Demand Forecasting</span></div>
                    <div class="skill-tile"><span class="skill-tile-icon">🤝</span><span class="skill-tile-name">Supplier Strategy</span></div>
                    <div class="skill-tile"><span class="skill-tile-icon">💰</span><span class="skill-tile-name">Cost Optimization</span></div>
                </div>
                <div class="learn-lead-magnet">
                    Not ready to play? <a href="/blog" class="learn-blog-link">Explore our supply chain blog →</a>
                </div>
                <div class="onboarding-nav-row">
                    <button class="btn-secondary onboarding-back-btn">Back</button>
                    <button class="btn-primary onboarding-next-btn">Next</button>
                </div>
            </div>
        `;

        step.querySelector('.onboarding-back-btn').onclick = () => this._prev();
        step.querySelector('.onboarding-next-btn').onclick = () => this._next();

        // Locked card clicks open paywall
        step.querySelectorAll('.learn-card--locked').forEach(card => {
            card.addEventListener('click', () => {
                document.dispatchEvent(new CustomEvent('scd:open-paywall'));
            });
        });

        return step;
    }

    _buildIndustrySelect() {
        const step = document.createElement('div');

        const cards = Object.values(INDUSTRIES).map(ind => {
            const accent = INDUSTRY_ACCENTS[ind.id] || INDUSTRY_ACCENTS.electronics;
            const diff = DIFFICULTY_MAP[ind.difficulty] || 1;
            const iconName = { electronics: 'factory', fmcg: 'truck', pharma: 'warehouse' }[ind.id] || 'store';

            const segments = [1, 2, 3].map(s => {
                const filled = s <= diff;
                const segColor = s === 1 ? '#22c55e' : s === 2 ? '#f59e0b' : '#ef4444';
                return `<span class="diff-seg ${filled ? 'filled' : ''}" style="${filled ? `background:${segColor}` : ''}"></span>`;
            }).join('');

            return `
                <div class="industry-card-v2 glass-panel" data-industry="${ind.id}" style="--accent: ${accent.color}">
                    <div class="ind-card-icon" style="color: ${accent.color}">${getIcon(iconName, 40)}</div>
                    <h3>${ind.name}</h3>
                    <p class="ind-card-desc">${ind.description}</p>
                    <div class="ind-card-diff">
                        <span class="diff-label">Difficulty</span>
                        <div class="diff-bar">${segments}</div>
                        <span class="diff-text">${ind.difficulty}</span>
                    </div>
                </div>
            `;
        }).join('');

        step.innerHTML = `
            <div class="onboarding-industry">
                <h2>Choose Your Industry</h2>
                <p class="industry-subtitle">Each industry has unique challenges and dynamics</p>
                <div class="industry-cards-v2">${cards}</div>
                <div class="onboarding-nav-row">
                    <button class="btn-secondary onboarding-back-btn">Back</button>
                    <button class="btn-primary onboarding-next-btn" disabled>Next</button>
                </div>
            </div>
        `;

        // Card click handlers
        step.querySelectorAll('.industry-card-v2').forEach(card => {
            card.addEventListener('click', () => {
                step.querySelectorAll('.industry-card-v2').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.selectedIndustryId = card.dataset.industry;
                step.querySelector('.onboarding-next-btn').disabled = false;
            });
        });

        step.querySelector('.onboarding-back-btn').onclick = () => this._prev();
        step.querySelector('.onboarding-next-btn').onclick = () => {
            if (this.selectedIndustryId) {
                this._updateLaunchStep();
                this._next();
            }
        };
        return step;
    }

    _buildChapterSelect() {
        const step = document.createElement('div');
        const allChapters = [...CHAPTERS];

        const cards = allChapters.map((ch, i) => {
            const isLocked = PremiumManager.isChapterLocked(ch.number);
            const diffCount = CHAPTER_DIFFICULTY[i] || 1;
            const pips = Array.from({ length: 5 }, (_, p) =>
                `<span class="diff-pip ${p < diffCount ? 'diff-pip--filled' : ''}"></span>`
            ).join('');

            return `
                <div class="ch-select-card ${i === 0 ? 'ch-select-card--active' : ''} ${isLocked ? 'ch-select-card--locked' : ''}"
                     data-chapter-index="${i}" data-locked="${isLocked}">
                    <div class="ch-select-num">Ch ${ch.number}</div>
                    <div class="ch-select-icon">${getIcon(ch.icon, 22)}</div>
                    <div class="ch-select-info">
                        <div class="ch-select-title">${ch.title}</div>
                        <div class="ch-select-outcome">${CHAPTER_OUTCOMES[i] || ''}</div>
                    </div>
                    <div class="ch-select-diff">${pips}</div>
                    ${isLocked ? '<div class="ch-select-lock">🔒</div>' : ''}
                </div>
            `;
        }).join('');

        step.innerHTML = `
            <div class="onboarding-ch-select">
                <h2>Where Would You Like to Begin?</h2>
                <p class="ch-select-subtitle">Start from Chapter 1 or jump ahead. Earlier chapters build foundational skills — later chapters are harder.</p>
                <div class="ch-select-list">${cards}</div>
                <div class="ch-select-note" id="ch-select-note">
                    Starting at <strong>Chapter 1</strong> — standard resources
                </div>
                <div class="onboarding-nav-row">
                    <button class="btn-secondary onboarding-back-btn">Back</button>
                    <button class="btn-primary onboarding-next-btn">Next</button>
                </div>
            </div>
        `;

        // Card selection
        step.querySelectorAll('.ch-select-card').forEach(card => {
            card.addEventListener('click', () => {
                const isLocked = card.dataset.locked === 'true';
                if (isLocked) {
                    document.dispatchEvent(new CustomEvent('scd:open-paywall'));
                    return;
                }
                step.querySelectorAll('.ch-select-card').forEach(c => c.classList.remove('ch-select-card--active'));
                card.classList.add('ch-select-card--active');
                const idx = parseInt(card.dataset.chapterIndex, 10);
                this.selectedChapterIndex = idx;
                const ch = allChapters[idx];
                const note = step.querySelector('#ch-select-note');
                if (note) {
                    note.innerHTML = idx === 0
                        ? `Starting at <strong>Chapter 1</strong> — standard resources`
                        : `Starting at <strong>Chapter ${ch.number}: ${ch.title}</strong> — boosted starting capital &amp; inventory`;
                }
                this._updateLaunchStep();
            });
        });

        step.querySelector('.onboarding-back-btn').onclick = () => this._prev();
        step.querySelector('.onboarding-next-btn').onclick = () => {
            this._updateLaunchStep();
            this._next();
        };
        return step;
    }

    _buildLaunch() {
        const step = document.createElement('div');
        step.innerHTML = `
            <div class="onboarding-launch">
                <div class="launch-icon">${getIcon('rocket', 56)}</div>
                <h2>Ready for Launch</h2>
                <p class="launch-industry-name"></p>
                <p class="launch-meta">8 chapters, 32 decisions await</p>
                <button class="btn-primary btn-glow btn-launch onboarding-launch-btn">Take Control</button>
                <div class="onboarding-nav-row" style="margin-top: 1rem;">
                    <button class="btn-secondary onboarding-back-btn">Back</button>
                </div>
            </div>
        `;

        step.querySelector('.onboarding-back-btn').onclick = () => this._prev();
        step.querySelector('.onboarding-launch-btn').onclick = () => {
            if (this.selectedIndustryId && this.onLaunch) {
                this.onLaunch(this.selectedIndustryId, this.selectedChapterIndex);
            }
        };
        return step;
    }

    _showScenarioDemo() {
        const overlay = document.createElement('div');
        overlay.className = 'scenario-demo-overlay';
        overlay.innerHTML = `
            <div class="scenario-demo-modal glass-panel">
                <div class="scenario-demo-header">
                    <span class="scenario-demo-badge">CHAPTER 1 · PREVIEW</span>
                    <button class="scenario-demo-close" aria-label="Close">✕</button>
                </div>
                <h3 class="scenario-demo-title">The Demand Spike</h3>
                <p class="scenario-demo-text">Your electronics distributor reports a 40% spike in retailer orders. Historical demand was steady at 1,000 units/quarter. Is this a real trend — or the bullwhip effect in action?</p>
                <div class="scenario-demo-options">
                    <div class="scenario-demo-option">
                        <span class="scenario-option-risk risk-low">Low Risk</span>
                        <span>Order 1,200 units — modest increase, maintain safety stock</span>
                    </div>
                    <div class="scenario-demo-option">
                        <span class="scenario-option-risk risk-inventory">Inventory Risk</span>
                        <span>Order 1,800 units — match the spike to avoid a potential stockout</span>
                    </div>
                    <div class="scenario-demo-option">
                        <span class="scenario-option-risk risk-financial">Financial Risk</span>
                        <span>Order 2,500 units — aggressively front-load inventory ahead of demand</span>
                    </div>
                </div>
                <p class="scenario-demo-cta-hint">Every decision ripples through your supply chain. Start the simulation to see the consequences.</p>
                <button class="btn-primary scenario-demo-start-btn">Start Playing Free →</button>
            </div>
        `;
        document.body.appendChild(overlay);
        overlay.querySelector('.scenario-demo-close').onclick = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
        overlay.querySelector('.scenario-demo-start-btn').onclick = () => {
            overlay.remove();
            this._next();
        };
    }

    _updateLaunchStep() {
        // No-op — launch step removed; start fires directly from _buildSetup.
    }

    /* ──────── Navigation ──────── */

    _next() {
        if (this.currentStep < this.totalSteps - 1) {
            this._goToStep(this.currentStep + 1, true);
        }
    }

    _prev() {
        if (this.currentStep > 0) {
            this._goToStep(this.currentStep - 1, true);
        }
    }

    _goToStep(index, animate) {
        this.currentStep = index;
        // Slide viewport
        this.viewport.style.transform = `translateX(-${index * 100}%)`;

        // Update dots
        if (this.dots) {
            this.dots.querySelectorAll('.onboarding-dot').forEach((d, i) => {
                d.classList.toggle('active', i === index);
            });
        }
    }
}
