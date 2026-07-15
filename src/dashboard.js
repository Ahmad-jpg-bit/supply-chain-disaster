import { GameEngine, GAME_PHASES } from './logic/engine.js';
import { INDUSTRIES } from './logic/industries.js';
import { Analytics } from './logic/analytics.js';
import { CHAPTERS } from './data/chapters.js';
import { EXPANSION_CHAPTERS } from './data/expansion-chapters.js';
import { SUPPLIERS, SHIPPING_METHODS, PRICING_STRATEGIES, QUALITY_INSPECTIONS } from './data/procurement-options.js';
import { ConceptCard } from './ui/concept-card.js';
import { ChapterTransition } from './ui/chapter-transition.js';
import { SupplyChainFlow } from './graphics/supply-chain-flow.js';
import { getIcon } from './graphics/svg-icons.js';
import { LandingPage } from './ui/landing-page.js';
import { AnimatedCounter, showTrendBadge } from './ui/animated-counter.js';
import { GameOverScreen } from './ui/game-over-screen.js';
import { TerminationScreen } from './ui/termination-screen.js';
import { Paywall } from './ui/paywall.js';
import { PremiumManager } from './logic/premium.js';
import { markNavPremium, setNavMinimal } from './shared/nav.js';
import { updateCardSparkline } from './ui/sparkline.js';
import { SaveProgressModal } from './ui/save-progress-modal.js';
import { CrisisTicker } from './ui/crisis-ticker.js';
import { AudioHapticManager } from './ui/audio-haptic.js';
import { buildConsequenceData, showConsequenceOverlay } from './ui/consequence-overlay.js';
import { STARTING_ARCHETYPES } from './logic/crisis-engine.js';
import { EndlessDeathScreen } from './ui/endless-death-screen.js';
import { DefinitionCard } from './ui/definition-card.js';
import { TurnSummaryCard } from './ui/turn-summary-card.js';
import { DebriefScreen } from './ui/debrief-screen.js';
import { PredictionPrompt } from './ui/prediction-prompt.js';
import { BoardQuestion } from './ui/board-question.js';
import { RECALL_QUESTIONS } from './data/recall-questions.js';
import { getConceptInsight } from './logic/concept-insights.js';
import { updateWorkbench } from './ui/planning-workbench.js';
import { checkTurnAchievements, checkChapterAchievements } from './logic/achievements.js';
import { showAchievementToasts } from './ui/achievement-toast.js';
import { buildAllocationScenario, applyAllocation } from './logic/allocation.js';
import { AllocationOverlay } from './ui/allocation-overlay.js';
import { buildCrisisMessage, applyCrisisResponse, SENDERS as INBOX_SENDERS } from './logic/crisis-inbox.js';
import { CrisisInboxOverlay } from './ui/crisis-inbox.js';
import { assessTurn, adjustConfidence, renderConfidenceMeter } from './logic/board-confidence.js';
import { pickVignette } from './data/vignettes.js';
import { buildOpeningOffer, contractFromOffer } from './logic/negotiation.js';
import { NegotiationOverlay } from './ui/negotiation-overlay.js';
import { evaluateCareer, careerReview } from './logic/career.js';
import { renderRankChip, showCareerNotice } from './ui/career-hud.js';
import { CSCP_DEFINITIONS } from './data/cscp-definitions.js';
import { routeFromChoice, LOGISTICS_CHAPTERS } from './logic/route-planner.js';
import { RoutePlannerOverlay } from './ui/route-planner-overlay.js';
import { getWeeklyChallenge } from './logic/seeded-rng.js';
import { showLeaderboard, promptScoreSubmit } from './ui/leaderboard.js';

export class Dashboard {
    constructor(particleNetwork) {
        this.engine = new GameEngine();
        this.analytics = new Analytics(this.engine);
        this.selectedIndustryId = null;
        this.charts = {};
        this.particles = particleNetwork;

        this.conceptCard = new ConceptCard();
        this.chapterTransition = new ChapterTransition();
        this.definitionCard = new DefinitionCard();
        this.paywall = new Paywall();
        this.flowDiagram = null;
        this.counters = {};

        // Bind UI elements
        this.ui = {
            startScreen: document.getElementById('start-screen'),
            dashboard: document.getElementById('game-dashboard'),

            // Dynamic Containers
            mainView: document.querySelector('.main-view'),
            actionPanel: document.querySelector('.action-panel'),

            // Displays
            turnDisplay: document.getElementById('turn-display'),
            cashDisplay: document.getElementById('cash-display'),
            inventoryDisplay: document.getElementById('inventory-display'),
            demandDisplay: document.getElementById('demand-display'),
            profitDisplay: document.getElementById('profit-display'),

            // Modals
            gameOverModal: document.getElementById('game-over-modal'),
        };

        this.gameOverScreen     = new GameOverScreen(this.ui.gameOverModal);
        this.terminationScreen  = new TerminationScreen();
        this.saveProgressModal  = new SaveProgressModal();
        this.endlessDeathScreen = new EndlessDeathScreen();
        this.turnSummaryCard    = new TurnSummaryCard();
        this.debriefScreen      = new DebriefScreen();
        this.predictionPrompt   = new PredictionPrompt();
        this.boardQuestion      = new BoardQuestion();

        // Forecast-call session stats (running MAPE) + spaced-recall bookkeeping
        this._forecastStats       = { sumApe: 0, n: 0 };
        this._askedRecallChapters = new Set();

        // Dev-only hook for playtesting (stripped-dead in production builds)
        if (import.meta.env.DEV) window.__scd = this;

        this.init();
    }

    /**
     * Shows a one-time dismissible banner reminding premium users they can
     * restore access on another device via their purchase email.
     * Stores dismissal in localStorage so it only appears once.
     */
    _showRestoreNudge() {
        if (!PremiumManager.isPremium()) return;
        if (localStorage.getItem('scd_nudge_dismissed')) return;

        const dashboard = document.getElementById('game-dashboard');
        if (!dashboard) return;

        const nudge = document.createElement('div');
        nudge.className = 'restore-nudge';
        nudge.id = 'restore-nudge';
        nudge.innerHTML = `
            <span class="restore-nudge-icon">&#9432;</span>
            <span class="restore-nudge-text">
                <strong>Access is saved in this browser.</strong>
                On a new device, click <strong>Unlock → Restore access</strong> and enter your purchase email.
            </span>
            <button class="restore-nudge-dismiss" aria-label="Dismiss">✕</button>
        `;

        nudge.querySelector('.restore-nudge-dismiss').addEventListener('click', () => {
            nudge.remove();
            localStorage.setItem('scd_nudge_dismissed', '1');
        });

        // Insert at the very top of the dashboard, before the header
        dashboard.insertBefore(nudge, dashboard.firstChild);
    }

    /**
     * Saves the current engine state to localStorage before navigating to the
     * external checkout page, so it can be restored on return.
     */
    _savePreCheckoutState() {
        const s = this.engine.state;
        if (!s.industry) return;
        const resume = {
            industryId:         s.industry.id,
            chapterIndex:       s.chapterIndex,
            cash:               s.cash,
            inventory:          s.inventory,
            backlog:            s.backlog,
            inTransit:          s.inTransit,
            turn:               s.turn,
            maxTurns:           s.maxTurns,
            modifiers:          s.modifiers,
            archetypeModifiers: s.archetypeModifiers,
            procurementChoices: s.procurementChoices,
            startingArchetype:  s.startingArchetype,
            shuffledScenarios:  s.shuffledScenarios,
            history:            s.history,
            ts:                 Date.now(),
        };
        try { localStorage.setItem('scd_pending_resume', JSON.stringify(resume)); } catch { /* storage full */ }
    }

    /**
     * Fades out and removes the inline loading screen injected in index.html.
     * Safe to call multiple times — a second call is a no-op.
     */
    _dismissLoadingScreen() {
        const ls = document.getElementById('loading-screen');
        if (!ls) return;
        ls.style.transition = 'opacity 0.4s ease';
        ls.style.opacity    = '0';
        setTimeout(() => ls.remove(), 420);
    }

    /**
     * Called on page load. If the user is returning after a successful checkout,
     * restores their game at the next chapter with their saved financial state.
     * Returns true if a resume was performed (caller should skip landing page).
     */
    _tryResumeFromCheckout() {
        try {
            const raw = localStorage.getItem('scd_pending_resume');
            if (!raw) return false;
            const resume = JSON.parse(raw);
            // Expire stale saves (2 h)
            if (!resume.ts || Date.now() - resume.ts > 2 * 60 * 60 * 1000) {
                localStorage.removeItem('scd_pending_resume');
                return false;
            }
            // Only restore once premium is confirmed
            if (!PremiumManager.isPremium()) return false;
            localStorage.removeItem('scd_pending_resume');

            this.selectedIndustryId = resume.industryId;
            const nextChapterIndex  = resume.chapterIndex + 1;
            const patches = {
                cash:               resume.cash,
                inventory:          resume.inventory,
                backlog:            resume.backlog,
                inTransit:          resume.inTransit,
                turn:               resume.turn,
                maxTurns:           resume.maxTurns,
                modifiers:          resume.modifiers,
                archetypeModifiers: resume.archetypeModifiers,
                procurementChoices: resume.procurementChoices,
                startingArchetype:  resume.startingArchetype,
                shuffledScenarios:  resume.shuffledScenarios,
                history:            resume.history,
            };
            this.startGame(nextChapterIndex, 'story', patches);
            return true;
        } catch {
            localStorage.removeItem('scd_pending_resume');
            return false;
        }
    }

    init() {
        // Update nav if already premium
        if (PremiumManager.isPremium()) markNavPremium();

        // Listen for nav upgrade button click
        document.addEventListener('scd:open-paywall', () => {
            this.paywall.show(() => {
                markNavPremium();
                this.renderChapterProgress();
            });
        });

        // Weekly challenge: start a seeded run, or view the leaderboard
        document.addEventListener('scd:start-weekly', () => {
            setNavMinimal(false);
            this.startGame(0, 'weekly');
        });
        document.addEventListener('scd:show-leaderboard', () => {
            const wc = getWeeklyChallenge();
            showLeaderboard({ weekId: wc.weekId, industryId: wc.industryId });
        });

        // Handle ?upgrade=1 query param (e.g. clicking Upgrade from another page)
        if (new URLSearchParams(window.location.search).get('upgrade') === '1') {
            window.history.replaceState({}, '', '/');
            this.paywall.show(() => markNavPremium());
        }

        // Owner dev bypass: ?dev=nxt2026&chapter=N&industry=electronics|fmcg|pharma
        // Unlocks all chapters and jumps directly to the specified chapter.
        const _devParams = new URLSearchParams(window.location.search);
        if (_devParams.get('dev') === 'nxt2026') {
            const _devChapter  = Math.max(0, parseInt(_devParams.get('chapter') || '0', 10) - 1);
            const _devIndustry = _devParams.get('industry') || 'electronics';
            localStorage.setItem('scd_premium', JSON.stringify({ active: true, tier: 'expansion' }));
            markNavPremium();
            window.history.replaceState({}, '', '/');
            this.selectedIndustryId = _devIndustry;
            this.ui.startScreen.classList.add('hidden');
            this.ui.dashboard.classList.remove('hidden');
            this.startGame(_devChapter);
            this._dismissLoadingScreen();
            return;
        }

        // Tab Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });

        // Restore game state for users returning from a checkout redirect
        if (this._tryResumeFromCheckout()) {
            this._dismissLoadingScreen();
            return;
        }

        // Listen for email capture (in-game modal) → auto-save game state
        document.addEventListener('scd:email-captured', () => this._autoSave(true));

        // Mount the landing page (replaces the old onboarding wizard)
        // ?start=1 skips the marketing hero and goes straight to industry selection
        // (used by all homepage CTAs — direct /play navigation preserves the full landing page)
        const _skipHero = new URLSearchParams(window.location.search).get('start') === '1';
        if (_skipHero) window.history.replaceState({}, '', window.location.pathname);
        new LandingPage(this.ui.startScreen, (industryId, startChapterIndex = 0, mode = 'story', statePatches = null) => {
            this.selectedIndustryId = industryId;
            this.startGame(startChapterIndex, mode, statePatches);
        }, { skipHero: _skipHero });

        // Landing page is now rendered and visible — dismiss the loading screen.
        this._dismissLoadingScreen();
    }

    switchTab(tabId) {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector(`[data-tab="${tabId}"]`).classList.add('active');

        if (tabId === 'market') {
            document.getElementById('market-view').classList.remove('hidden');
            document.getElementById('analytics-view').classList.add('hidden');
        } else {
            document.getElementById('market-view').classList.add('hidden');
            document.getElementById('analytics-view').classList.remove('hidden');
            this.renderCharts();
        }
    }

    renderCharts() {
        if (!this.analytics) return;

        const bullwhipData = this.analytics.getBullwhipData();
        const cashData = this.analytics.getCashFlowData();

        const monoTicks = { color: '#94a3b8', font: { family: "'Roboto Mono', monospace", size: 10 } };
        const monoGrid  = { color: 'rgba(255,255,255,0.07)' };

        if (this.charts.bullwhip) {
            // Animate new data in — swap labels + dataset values, let Chart.js tween
            this.charts.bullwhip.data.labels = bullwhipData.labels;
            bullwhipData.datasets.forEach((ds, i) => {
                if (this.charts.bullwhip.data.datasets[i]) {
                    this.charts.bullwhip.data.datasets[i].data = ds.data;
                }
            });
            this.charts.bullwhip.update('active');
        } else {
            const ctxBullwhip = document.getElementById('bullwhipChart').getContext('2d');
            this.charts.bullwhip = new Chart(ctxBullwhip, {
                type: 'line',
                data: bullwhipData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 600, easing: 'easeInOutQuart' },
                    plugins: {
                        title: { display: true, text: 'The Bullwhip Effect (Demand vs Orders)', color: '#94a3b8', font: { family: "'Roboto Mono', monospace", size: 11 } },
                        legend: { labels: { color: '#94a3b8', font: { family: "'Roboto Mono', monospace", size: 10 } } }
                    },
                    scales: {
                        y: { beginAtZero: true, grid: monoGrid, ticks: monoTicks },
                        x: { grid: monoGrid, ticks: monoTicks }
                    }
                }
            });
        }

        if (this.charts.cash) {
            this.charts.cash.data.labels = cashData.labels;
            cashData.datasets.forEach((ds, i) => {
                if (this.charts.cash.data.datasets[i]) {
                    this.charts.cash.data.datasets[i].data = ds.data;
                }
            });
            this.charts.cash.update('active');
        } else {
            const ctxCash = document.getElementById('cashFlowChart').getContext('2d');
            this.charts.cash = new Chart(ctxCash, {
                type: 'line',
                data: cashData,
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 600, easing: 'easeInOutQuart' },
                    plugins: {
                        title: { display: true, text: 'Cash Flow Analysis', color: '#94a3b8', font: { family: "'Roboto Mono', monospace", size: 11 } },
                        legend: { labels: { color: '#94a3b8', font: { family: "'Roboto Mono', monospace", size: 10 } } }
                    },
                    scales: {
                        y: { grid: monoGrid, ticks: monoTicks },
                        x: { grid: monoGrid, ticks: monoTicks }
                    }
                }
            });
        }

        // Update live bullwhip ratio badge
        this._updateBullwhipRatio(this.analytics.getBullwhipRatio());
    }

    _updateBullwhipRatio(ratio) {
        const el = document.getElementById('bullwhip-ratio-display');
        if (!el) return;

        if (ratio === null) {
            el.innerHTML = `
                <div class="bwr-inner">
                    <span class="bwr-label">BULLWHIP RATIO</span>
                    <span class="bwr-value bwr--neutral">—</span>
                    <span class="bwr-desc">Play 3+ turns to unlock this metric</span>
                </div>`;
            return;
        }

        const rounded = ratio.toFixed(2);
        let cls, statusText, statusDetail;
        if (ratio > 2.5) {
            cls = 'bwr--danger';
            statusText = 'Severe Amplification';
            statusDetail = 'Your orders are wildly amplifying demand signals. Classic bullwhip.';
        } else if (ratio > 1.2) {
            cls = 'bwr--warning';
            statusText = 'Amplifying';
            statusDetail = 'Order variance exceeds demand variance — the bullwhip effect is active.';
        } else if (ratio >= 0.8) {
            cls = 'bwr--good';
            statusText = 'Stable';
            statusDetail = 'Orders track demand closely. Supply chain is well-calibrated.';
        } else {
            cls = 'bwr--good';
            statusText = 'Dampening';
            statusDetail = 'Orders are smoother than demand — excellent buffering.';
        }

        el.innerHTML = `
            <div class="bwr-inner">
                <span class="bwr-label">BULLWHIP RATIO</span>
                <span class="bwr-value ${cls}">${rounded}×</span>
                <span class="bwr-status ${cls}">${statusText}</span>
                <span class="bwr-desc">${statusDetail}</span>
                <span class="bwr-formula">Var(Orders) ÷ Var(Demand) — above 1.0 = amplification</span>
            </div>`;
    }

    startGame(startChapterIndex = 0, mode = 'story', _statePatches = null) {
        this._gameMode = mode;
        if (mode === 'weekly') {
            // Weekly challenge: fixed industry + shared seed for a comparable run
            const wc = getWeeklyChallenge();
            this._weekly = wc;
            this.selectedIndustryId = wc.industryId;
            this.engine.initEndless(wc.industryId, { seed: wc.seed, weekId: wc.weekId });
        } else if (mode === 'endless') {
            if (!this.selectedIndustryId) return;
            this.engine.initEndless(this.selectedIndustryId);
        } else {
            if (!this.selectedIndustryId) return;
            this.engine.init(this.selectedIndustryId, true, startChapterIndex);
        }

        // Restore financial/scenario state saved before a checkout redirect
        if (_statePatches) {
            Object.assign(this.engine.state, _statePatches);
        }

        this.ui.startScreen.classList.add('hidden');
        this.ui.dashboard.classList.remove('hidden');

        // Board confidence meter + career rank chip (campaign mode only)
        if (mode !== 'endless' && mode !== 'weekly') {
            renderConfidenceMeter(document.querySelector('.hud-right'), this.engine.state.boardConfidence);
            renderRankChip(document.querySelector('.hud-right'), this.engine.state.careerRankIndex ?? 0);
        }

        // Switch particles to ambient mode
        if (this.particles) {
            this.particles.setMode('ambient');
        }

        // Initialize flow diagram
        this.flowDiagram = new SupplyChainFlow('supply-chain-flow');
        if (this.engine.state.currentChapter) {
            this.flowDiagram.setActiveNodes(
                this.engine.state.currentChapter.activeNodes,
                this._deriveNodeStatuses()
            );
        }

        // Initialize animated counters
        const fmtMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
        const fmtNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

        this.counters.cash = new AnimatedCounter(this.ui.cashDisplay, { formatter: fmtMoney });
        this.counters.inventory = new AnimatedCounter(this.ui.inventoryDisplay, { formatter: fmtNum });
        this.counters.demand = new AnimatedCounter(this.ui.demandDisplay, { formatter: fmtNum });
        this.counters.profit = new AnimatedCounter(this.ui.profitDisplay, { formatter: fmtMoney });
        const inTransitEl = document.getElementById('in-transit-display');
        if (inTransitEl) this.counters.inTransit = new AnimatedCounter(inTransitEl, { formatter: fmtNum });

        // Set initial values without animation
        this.counters.cash.setImmediate(this.engine.state.cash);
        this.counters.inventory.setImmediate(this.engine.state.inventory);
        if (this.counters.inTransit) this.counters.inTransit.setImmediate(0);

        // Reset charts so they're rebuilt fresh for this new game session
        if (this.charts.bullwhip) { this.charts.bullwhip.destroy(); this.charts.bullwhip = null; }
        if (this.charts.cash) { this.charts.cash.destroy(); this.charts.cash = null; }
        if (this.charts.gantt) { this.charts.gantt.destroy(); this.charts.gantt = null; }
        if (this.charts.bullwhipLive) { this.charts.bullwhipLive.destroy(); this.charts.bullwhipLive = null; }

        // Reset outcome feedback tracking
        this._lastFeedbackTurn = 0;
        this._lastConsequenceTurn = 0;
        this._ambientState = 'safe';

        // Init audio/haptic. AudioContext is created eagerly inside init() so it
        // is warmed up within this user-gesture call stack. play() separately
        // awaits _ensureCtx() before firing oscillators, so no await is needed here.
        AudioHapticManager.init();

        // Reveal the crisis ticker now that the game is running
        CrisisTicker.init();
        CrisisTicker.show();

        this.renderChapterProgress();
        this.renderGameState();
        this._showRestoreNudge();
    }

    renderChapterProgress() {
        const container = document.getElementById('chapter-progress');
        if (!container) return;

        // Endless mode — replace chapter dots with wave/score HUD
        if (this.engine.state.isEndless) {
            const s   = this.engine.state;
            const sat = Math.max(0, s.endlessSatisfaction);
            const satColor = sat > 60 ? 'var(--success-color)' : sat > 30 ? 'var(--accent-color)' : 'var(--danger-color)';
            const chapterLabel = document.getElementById('hud-chapter-name');
            if (chapterLabel) {
                chapterLabel.innerHTML =
                    `<span class="hud-ch-num" style="color:var(--danger-color)">∞</span>` +
                    `<span class="hud-ch-sep">·</span>` +
                    `<span class="hud-ch-title">Endless Survival</span>`;
            }
            container.innerHTML = `
                <div class="endless-wave-hud">
                    <span class="endless-wave-badge">WAVE ${s.endlessWave}</span>
                    <span class="endless-score-display">▲ ${s.endlessScore.toLocaleString()}</span>
                    <div class="endless-sat-bar-wrap">
                        <span class="endless-sat-label">SAT</span>
                        <div class="endless-sat-bar">
                            <div class="endless-sat-fill" style="width:${sat}%;background:${satColor}"></div>
                        </div>
                        <span class="endless-sat-label" style="color:${satColor}">${Math.round(sat)}%</span>
                    </div>
                </div>`;
            return;
        }

        const currentChapterIdx = this.engine.state.chapterIndex;
        const allChapters = [...CHAPTERS, ...EXPANSION_CHAPTERS];

        // Update HUD chapter label
        const chapterLabel = document.getElementById('hud-chapter-name');
        if (chapterLabel && allChapters[currentChapterIdx]) {
            const ch = allChapters[currentChapterIdx];
            chapterLabel.innerHTML = `<span class="hud-ch-num">Ch ${ch.number}</span><span class="hud-ch-sep">·</span><span class="hud-ch-title">${ch.title}</span>`;
        }
        let html = '';
        allChapters.forEach((ch, idx) => {
            const isExpansionChapter = Boolean(ch.expansionOnly);
            const expansionLocked = false; // all chapters are free
            const premiumLocked   = false;
            const isLocked        = false;

            let cls = 'chapter-dot';
            if (isExpansionChapter) cls += ' expansion-chapter';
            if (isLocked) {
                cls += ' locked';
            } else if (idx < currentChapterIdx) {
                cls += ' completed';
            } else if (idx === currentChapterIdx) {
                cls += ' active';
            }

            // Segmented rail: only the active chapter carries a label,
            // the rest are slim segments (tooltip keeps the full title)
            const isActive = idx === currentChapterIdx && !isLocked;
            const titlePrefix = expansionLocked ? '✦ Expansion — ' : premiumLocked ? '🔒 Premium — ' : '';
            const labelHtml = isActive ? `<span>Ch ${ch.number}</span>` : '';
            html += `<div class="${cls}" title="${titlePrefix}Ch ${ch.number}: ${ch.title}">${labelHtml}</div>`;
        });
        container.innerHTML = html;

        // ── Turn progress text ─────────────────────────────────────────────────
        const turnTextEl  = document.getElementById('hud-turn-text');
        const progressBar  = document.getElementById('game-progress-bar');
        const progressFill = document.getElementById('game-progress-fill');

        if (allChapters[currentChapterIdx] && turnTextEl) {
            const ch = allChapters[currentChapterIdx];
            const turnsPerChapter = ch.turnsRange[1] - ch.turnsRange[0] + 1; // always 4
            // Clamp so CHAPTER_SUMMARY (turn already incremented past range) shows "Turn 4 of 4"
            const rawOffset  = this.engine.state.turn - ch.turnsRange[0];
            const displayTurn = Math.max(1, Math.min(rawOffset + 1, turnsPerChapter));

            const phase = this.engine.state.phase;
            const hideTurn = phase === GAME_PHASES.CHAPTER_SUMMARY ||
                             phase === GAME_PHASES.GAME_OVER ||
                             phase === GAME_PHASES.ENDLESS_DEATH;

            if (!hideTurn) {
                const isFreeGate  = currentChapterIdx === 1;       // Chapter 2 ends free access
                const isNearEnd   = displayTurn >= turnsPerChapter - 1; // turn 3 or 4 of 4
                const isLastTurn  = displayTurn >= turnsPerChapter;     // turn 4 of 4

                let signal = '';
                if (isFreeGate && isLastTurn) {
                    signal = `<span class="hud-turn-signal"> · Final turn coming</span>`;
                } else if (isNearEnd) {
                    signal = `<span class="hud-turn-signal"> · Ending soon</span>`;
                }

                turnTextEl.innerHTML =
                    `<span class="hud-tp-label">Chapter&nbsp;${ch.number}</span>` +
                    `<span class="hud-tp-sep">·</span>` +
                    `<span class="hud-tp-turn">Turn&nbsp;${displayTurn}&nbsp;of&nbsp;${turnsPerChapter}</span>` +
                    signal;
                turnTextEl.classList.add('visible');
            } else {
                turnTextEl.classList.remove('visible');
            }
        }

        // ── Global progress bar ────────────────────────────────────────────────
        if (progressBar && progressFill) {
            const totalTurns     = this.engine.state.maxTurns;
            const completedTurns = Math.max(0, Math.min(this.engine.state.turn - 1, totalTurns));
            progressFill.style.width = `${((completedTurns / totalTurns) * 100).toFixed(1)}%`;
            progressBar.classList.add('visible');
        }
    }

    /**
     * Run a DOM update inside a View Transition (soft cross-fade) when the
     * browser supports it and the user hasn't asked for reduced motion.
     */
    _withViewTransition(update) {
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (!reduceMotion && document.startViewTransition) {
            document.startViewTransition(update);
        } else {
            update();
        }
    }

    // --- CORE RENDER LOOP ---
    renderGameState() {
        // Cross-fade between phases; re-renders within a phase stay instant
        const { phase } = this.engine.state;
        const phaseChanged = phase !== this._lastRenderedPhase;
        this._lastRenderedPhase = phase;

        if (phaseChanged) {
            this._withViewTransition(() => this._renderGameStateNow());
        } else {
            this._renderGameStateNow();
        }
    }

    _renderGameStateNow() {
        this.updateMetrics();
        this.renderChapterProgress();

        // Refresh node statuses on every render cycle
        if (this.flowDiagram) {
            this.flowDiagram.setNodeStatuses(this._deriveNodeStatuses());
        }

        const { phase } = this.engine.state;

        // Toggle procurement layout mode on the dashboard grid
        const grid = document.querySelector('.dashboard-grid');
        if (phase === GAME_PHASES.PROCUREMENT) {
            grid?.classList.add('proc-mode');
        } else {
            grid?.classList.remove('proc-mode');
        }

        // Story-mode: these phases hide the legacy action panel, so collapse
        // its reserved 300px grid column and let content use the full stage
        const storyModePhases = [GAME_PHASES.CHAPTER_INTRO, GAME_PHASES.STORY, GAME_PHASES.CHAPTER_SUMMARY];
        grid?.classList.toggle('story-mode', storyModePhases.includes(phase));

        // Clear main view for redraw
        this.ui.mainView.innerHTML = '';
        this.ui.actionPanel.innerHTML = '';
        this.ui.actionPanel.style.display = '';

        switch (phase) {
            case GAME_PHASES.CHAPTER_INTRO:
                this.renderChapterIntro();
                break;
            case GAME_PHASES.STORY:
                this.renderStoryPhase();
                break;
            case GAME_PHASES.PROCUREMENT:
                this.renderProcurementPhase();
                break;
            case GAME_PHASES.CHAPTER_SUMMARY:
                this.renderChapterSummary();
                break;
            case GAME_PHASES.GAME_OVER:
                this.endGame();
                break;
            case GAME_PHASES.ENDLESS_DEATH:
                this._showEndlessDeath();
                break;
        }
    }

    renderChapterIntro() {
        const chapter = this.engine.state.currentChapter;
        if (!chapter) return;

        // Update flow diagram for new chapter
        if (this.flowDiagram) {
            this.flowDiagram.setActiveNodes(chapter.activeNodes, this._deriveNodeStatuses());
        }

        // Resolve industry-specific example
        const industryId = this.engine.state.industry.id;
        const resolvedChapter = {
            ...chapter,
            realWorldExample: typeof chapter.realWorldExample === 'object'
                ? (chapter.realWorldExample[industryId] || Object.values(chapter.realWorldExample)[0])
                : chapter.realWorldExample,
            // Pass expansion flag through so ConceptCard can optionally style it
            isExpansion: Boolean(chapter.expansionOnly)
        };

        // Intro flow: board recall question → negotiation → route lane → play
        const enterChapter = () => this._maybeAskBoardQuestion(chapter, () => {
            this._maybeOfferNegotiation(chapter, () => {
                this._maybePlanRoute(chapter, () => {
                    this.engine.advanceFromChapterIntro();
                    this.renderGameState();
                });
            });
        });

        // Show concept card overlay, unless player previously chose to skip it
        const skippedIntros = JSON.parse(localStorage.getItem('scd_skipped_intros') || '[]');
        if (skippedIntros.includes(chapter.number)) {
            enterChapter();
            return;
        }

        this.conceptCard.show(resolvedChapter, (skipNextTime) => {
            if (skipNextTime) {
                const updated = JSON.parse(localStorage.getItem('scd_skipped_intros') || '[]');
                if (!updated.includes(chapter.number)) {
                    updated.push(chapter.number);
                    localStorage.setItem('scd_skipped_intros', JSON.stringify(updated));
                }
            }
            enterChapter();
        });

        // Show a waiting message in the main view
        const archetype   = this.engine.state.startingArchetype;
        const archetypeHtml = (archetype && archetype.id !== 'balanced' && this.engine.state.chapterIndex === 0) ? `
            <div class="archetype-briefing">
                <div class="archetype-briefing-header">
                    <span class="archetype-icon">${archetype.icon}</span>
                    <span class="archetype-label">WORLD STATE: ${archetype.label.toUpperCase()}</span>
                </div>
                <p class="archetype-desc">${archetype.briefing}</p>
            </div>
        ` : '';

        this.ui.mainView.innerHTML = `
            <div class="chapter-waiting glass-panel" style="text-align: center; padding: 3rem;">
                <div style="color: var(--primary-color); margin-bottom: 1rem;">${getIcon(chapter.icon, 48)}</div>
                <h2>Chapter ${chapter.number}</h2>
                <p style="color: var(--text-muted)">${chapter.title}</p>
                ${archetypeHtml}
            </div>
        `;
        this.ui.actionPanel.style.display = 'none';
    }

    /** Build the Intelligence tab content from engine state + scenario */
    _buildIntelContent(scenario) {
        const s = this.engine.state;
        const last = s.lastTurnResult;
        const history = s.history;

        // Demand trend
        const recentDemands = history.slice(-3).map(h => h.demand);
        const avgDemand = recentDemands.length
            ? Math.round(recentDemands.reduce((a, b) => a + b, 0) / recentDemands.length)
            : 1000;
        const demandTrend = recentDemands.length >= 2
            ? (recentDemands[recentDemands.length - 1] > recentDemands[0] ? '↑ Rising' : '↓ Falling')
            : '— Insufficient data';
        const trendColor = demandTrend.includes('Rising') ? 'var(--success-color)' : demandTrend.includes('Falling') ? 'var(--danger-color)' : 'var(--text-muted)';

        // Lead time signal
        const leadMod = s.modifiers?.leadTime ?? 0;
        const leadSignal = leadMod > 1 ? `+${leadMod} turns delay (disrupted)` : leadMod === 0 ? 'Normal — no delays' : `+${leadMod} turn caution`;
        const leadColor = leadMod > 1 ? 'var(--danger-color)' : leadMod > 0 ? 'var(--accent-color)' : 'var(--success-color)';

        // Service level signal
        const satisfaction = s.customerSatisfaction ?? 0;
        const svcSignal = satisfaction >= 10 ? 'High — customers satisfied' : satisfaction >= 0 ? 'Moderate — watch inventory' : 'Low — stockouts risk churn';
        const svcColor = satisfaction >= 10 ? 'var(--success-color)' : satisfaction >= 0 ? 'var(--accent-color)' : 'var(--danger-color)';

        return `
            <div class="intel-grid">
                <div class="intel-source">
                    <div class="intel-source-label">${getIcon('chartUp', 14)} Demand forecast model</div>
                    <div class="intel-source-body">
                        <div class="intel-row">
                            <span>3-Turn Avg Demand</span>
                            <strong>${avgDemand.toLocaleString()} units</strong>
                        </div>
                        <div class="intel-row">
                            <span>Trend</span>
                            <strong style="color:${trendColor}">${demandTrend}</strong>
                        </div>
                        <div class="intel-note">Based on your last ${recentDemands.length || 1} turn(s) of actuals.</div>
                    </div>
                </div>
                <div class="intel-source">
                    <div class="intel-source-label">${getIcon('supplier', 14)} Supplier network report</div>
                    <div class="intel-source-body">
                        <div class="intel-row">
                            <span>Lead Time Status</span>
                            <strong style="color:${leadColor}">${leadSignal}</strong>
                        </div>
                        <div class="intel-row">
                            <span>In Transit</span>
                            <strong>${s.inTransit.reduce((sum, o) => sum + o.usableUnits, 0).toLocaleString()} units</strong>
                        </div>
                        <div class="intel-note">Upstream pipeline snapshot as of this turn.</div>
                    </div>
                </div>
                <div class="intel-source">
                    <div class="intel-source-label">${getIcon('globe', 14)} Market analyst brief</div>
                    <div class="intel-source-body">
                        <div class="intel-row">
                            <span>Service Level</span>
                            <strong style="color:${svcColor}">${svcSignal}</strong>
                        </div>
                        <div class="intel-row">
                            <span>Focus Area</span>
                            <strong>${scenario.highlightNode ? scenario.highlightNode.charAt(0).toUpperCase() + scenario.highlightNode.slice(1) : 'Full Chain'}</strong>
                        </div>
                        <div class="intel-note">Conflicting signals — use with judgement.</div>
                    </div>
                </div>
            </div>
        `;
    }

    /** Build the Financials tab content from last turn result */
    _buildFinancialsContent() {
        const last = this.engine.state.lastTurnResult;
        if (!last) {
            return `<div class="fin-empty">No financial data yet — complete your first procurement round to unlock cost analytics.</div>`;
        }
        const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n || 0);
        const profitColor = last.profit >= 0 ? 'var(--success-color)' : 'var(--danger-color)';
        return `
            <div class="fin-grid">
                <div class="fin-section">
                    <div class="fin-section-label">Cost breakdown — last turn</div>
                    <div class="fin-row"><span>Order Cost</span><span>${fmt(last.orderCost)}</span></div>
                    <div class="fin-row"><span>Shipping Cost</span><span>${fmt(last.shippingCost)}</span></div>
                    <div class="fin-row"><span>Inspection</span><span>${fmt(last.inspectionCost)}</span></div>
                    <div class="fin-row"><span>Holding Cost</span><span>${fmt(last.holdingCost)}</span></div>
                    <div class="fin-row fin-row--total"><span>Total Cost</span><span>${fmt(last.totalCost)}</span></div>
                </div>
                <div class="fin-section">
                    <div class="fin-section-label">Revenue & profit</div>
                    <div class="fin-row"><span>Revenue</span><span>${fmt(last.revenue)}</span></div>
                    <div class="fin-row"><span>Missed Sales</span><span style="color:var(--accent-color)">${last.missedSales?.toLocaleString() ?? 0} units</span></div>
                    <div class="fin-row fin-row--total" style="color:${profitColor}"><span>Net Profit</span><span>${fmt(last.profit)}</span></div>
                </div>
                <div class="fin-tip">
                    <strong>TCO Insight:</strong> Holding cost is ${last.holdingCost > last.shippingCost ? 'your largest cost driver — consider lean ordering' : 'lower than shipping — you may benefit from larger, less frequent orders'}.
                </div>
            </div>
        `;
    }

    /** Compute projected impact text for a story option */
    _computeProjectedImpact(opt) {
        const m = opt.modifiers || {};
        const unitCost = m.unitCost ?? 1.0;
        const leadTime = m.leadTime ?? 0;
        const satisfaction = m.customerSatisfaction ?? 0;
        const s = this.engine.state;
        const baseCash = s.cash;

        // Rough cost delta estimate based on last order or avg
        const lastQty = s.lastTurnResult?.orderQuantity || 1000;
        const baseUnitCost = 100;
        const costDelta = Math.round(lastQty * baseUnitCost * (unitCost - 1.0));
        const costStr = costDelta === 0 ? 'No change' : (costDelta > 0 ? `+$${Math.abs(costDelta).toLocaleString()}` : `-$${Math.abs(costDelta).toLocaleString()}`);

        const svcStr = satisfaction > 5 ? '↑ Improves' : satisfaction < -5 ? '↓ Degrades' : 'Neutral';
        const riskStr = opt.conceptAlignment === 'optimal' ? 'Low' : opt.conceptAlignment === 'cautious' ? 'Medium' : 'High';
        const riskColor = opt.conceptAlignment === 'optimal' ? 'var(--success-color)' : opt.conceptAlignment === 'cautious' ? 'var(--accent-color)' : 'var(--danger-color)';
        const leadStr = leadTime === 0 ? 'No delay' : `+${leadTime} turn${leadTime > 1 ? 's' : ''} lead time`;

        return { costStr, svcStr, riskStr, riskColor, leadStr };
    }

    /** Pick a briefing sender for a scenario based on the node it stresses. */
    _scenarioSender(scenario) {
        const byNode = {
            supplier:  'supplier',
            factory:   'ops',
            warehouse: 'ops',
            ship:      'logistics',
            truck:     'logistics',
            store:     'sales',
        };
        return INBOX_SENDERS[byNode[scenario.highlightNode]] || INBOX_SENDERS.ops;
    }

    renderStoryPhase() {
        const scenario = this.engine.state.currentScenario;
        const chapter = this.engine.state.currentChapter;

        // Update flow diagram
        if (this.flowDiagram && scenario.highlightNode) {
            this.flowDiagram.setScenarioState(
                scenario.highlightNode, false, this._deriveNodeStatuses()
            );
        }

        const storyCard = document.createElement('div');
        storyCard.className = 'story-card glass-panel';

        const chapterLabel = chapter
            ? `<div class="story-chapter-label">Chapter ${chapter.number} — Turn ${this.engine.state.scenarioIndex + 1} of 4</div>`
            : '';

        // Build options HTML (Mission tab content)
        const optionsHTML = scenario.options.map((opt, idx) => {
            const risk = this._deriveRiskCategory(opt);
            const impact = this._computeProjectedImpact(opt);
            return `
                <button class="story-option-btn" data-option-idx="${idx}"
                    data-cost="${impact.costStr}"
                    data-svc="${impact.svcStr}"
                    data-risk="${impact.riskStr}"
                    data-risk-color="${impact.riskColor}"
                    data-lead="${impact.leadStr}">
                    <span class="option-body"><strong>${opt.label}</strong></span>
                    <span class="risk-tag" style="color:${risk.accent};border-color:${risk.accent}55;background:${risk.accent}18;">${risk.label}</span>
                    <div class="impact-overlay" aria-hidden="true">
                        <div class="impact-row"><span class="impact-label">Cost Impact</span><span class="impact-val">${impact.costStr}</span></div>
                        <div class="impact-row"><span class="impact-label">Service Level</span><span class="impact-val">${impact.svcStr}</span></div>
                        <div class="impact-row"><span class="impact-label">Risk</span><span class="impact-val" style="color:${impact.riskColor}">${impact.riskStr}</span></div>
                        <div class="impact-row"><span class="impact-label">Lead Time</span><span class="impact-val">${impact.leadStr}</span></div>
                    </div>
                </button>
            `;
        }).join('');

        // Sender chip — the scenario arrives as a briefing from a named person
        const sender = this._scenarioSender(scenario);
        const initials = sender.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

        storyCard.innerHTML = `
            ${chapterLabel}
            <div class="story-title">${scenario.title}</div>
            <div class="story-brief-head">
                <span class="story-sender-avatar" aria-hidden="true">${initials}</span>
                <div class="story-sender-meta">
                    <span class="story-sender-name">${sender.name}</span>
                    <span class="story-sender-role">${sender.role}</span>
                </div>
                <div class="story-sheet-btns">
                    <button class="story-sheet-btn" data-sheet="intel">${getIcon('globe', 13)} Intelligence</button>
                    <button class="story-sheet-btn" data-sheet="financials">${getIcon('coins', 13)} Financials</button>
                </div>
            </div>
            <div class="story-text" aria-live="polite"></div>
            <div class="story-options story-options--pending">${optionsHTML}</div>
        `;

        // Typewriter reveal — fast, skippable, instant under reduced motion
        const textEl    = storyCard.querySelector('.story-text');
        const optionsEl = storyCard.querySelector('.story-options');
        const fullText  = scenario.text;
        const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        const finishReveal = () => {
            if (this._briefTimer) { clearInterval(this._briefTimer); this._briefTimer = null; }
            textEl.textContent = fullText;
            textEl.classList.remove('story-text--typing');
            optionsEl.classList.remove('story-options--pending');
        };

        if (reduceMotion || document.hidden) {
            finishReveal();
        } else {
            let shown = 0;
            const STEP = 3; // ~185 chars/s — newsroom pace, ~2.5s for a scenario
            textEl.classList.add('story-text--typing');
            this._briefTimer = setInterval(() => {
                if (!textEl.isConnected) { clearInterval(this._briefTimer); this._briefTimer = null; return; }
                shown += STEP;
                textEl.textContent = fullText.slice(0, shown);
                if (shown >= fullText.length) finishReveal();
            }, 16);
            // Any click on the card skips straight to the full briefing
            storyCard.addEventListener('click', finishReveal, { once: true });
        }

        // Intelligence / Financials as slide-in side sheets
        const sheetBackdrop = document.createElement('div');
        sheetBackdrop.className = 'story-sheet-backdrop';
        const sheet = document.createElement('aside');
        sheet.className = 'story-sheet';
        sheet.innerHTML = `
            <div class="story-sheet-head">
                <span class="story-sheet-title"></span>
                <button class="story-sheet-close" aria-label="Close panel">✕</button>
            </div>
            <div class="story-sheet-body"></div>
        `;

        const closeSheet = () => {
            sheet.classList.remove('story-sheet--open');
            sheetBackdrop.classList.remove('story-sheet-backdrop--open');
            document.removeEventListener('keydown', onSheetKey);
        };
        const onSheetKey = (e) => { if (e.key === 'Escape') closeSheet(); };
        const openSheet = (kind) => {
            sheet.querySelector('.story-sheet-title').textContent =
                kind === 'intel' ? 'Field intelligence' : 'Financials';
            sheet.querySelector('.story-sheet-body').innerHTML =
                kind === 'intel' ? this._buildIntelContent(scenario) : this._buildFinancialsContent();
            sheet.classList.add('story-sheet--open');
            sheetBackdrop.classList.add('story-sheet-backdrop--open');
            document.addEventListener('keydown', onSheetKey);
        };

        sheet.querySelector('.story-sheet-close').addEventListener('click', closeSheet);
        sheetBackdrop.addEventListener('click', closeSheet);
        storyCard.querySelectorAll('.story-sheet-btn').forEach(btn => {
            btn.addEventListener('click', () => openSheet(btn.dataset.sheet));
        });

        // Option click handlers
        storyCard.querySelectorAll('.story-option-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.handleOptionSelect(parseInt(btn.dataset.optionIdx));
            });
        });

        // Show warning banners from previous turn result
        const lastResult = this.engine.state.lastTurnResult;
        if (lastResult?.demandEvent === 'regulatory_spike') {
            const spikeAmt = Math.round((lastResult.demand / 1000 - 1) * 100);
            const banner = document.createElement('div');
            banner.className = 'demand-event-banner demand-event--spike';
            banner.innerHTML = `
                <span class="demand-event-icon">${getIcon('warning', 20)}</span>
                <div class="demand-event-body">
                    <strong>Regulatory Demand Spike</strong>
                    <span>Emergency procurement mandates drove a +${spikeAmt}% demand surge last quarter. Safety stock is now critical.</span>
                </div>
            `;
            this.ui.mainView.appendChild(banner);
        }

        if (lastResult?.backlog > 0) {
            const backlogBanner = document.createElement('div');
            backlogBanner.className = 'demand-event-banner demand-event--backlog';
            backlogBanner.innerHTML = `
                <span class="demand-event-icon">${getIcon('box', 20)}</span>
                <div class="demand-event-body">
                    <strong>Unfulfilled Backlog: ${lastResult.backlog.toLocaleString()} units</strong>
                    <span>Customers are waiting. Increase order quantity or replenish faster to clear the queue.</span>
                </div>
            `;
            this.ui.mainView.appendChild(backlogBanner);
        }

        if (lastResult?.safetyBreach) {
            const safetyBanner = document.createElement('div');
            safetyBanner.className = 'demand-event-banner demand-event--safety';
            safetyBanner.innerHTML = `
                <span class="demand-event-icon">${getIcon('shield', 20)}</span>
                <div class="demand-event-body">
                    <strong>Safety Stock Breach</strong>
                    <span>Post-sale inventory fell below your target of ${lastResult.safetyStockTarget?.toLocaleString()} units. Increase orders to rebuild your buffer.</span>
                </div>
            `;
            this.ui.mainView.appendChild(safetyBanner);
        }

        this.ui.mainView.appendChild(storyCard);
        this.ui.mainView.appendChild(sheetBackdrop);
        this.ui.mainView.appendChild(sheet);
        this.ui.actionPanel.style.display = 'none';

        // Consequence overlay — surfaces last turn's key financial outcome
        this._maybeShowConsequenceOverlay();
    }

    handleOptionSelect(index) {
        // 1. Capture scenario label before engine processes the decision
        const scenario = this.engine.state.currentScenario;
        const pickedOption = scenario?.options?.[index];

        // 2. Calculate result synchronously (fast, pure logic — no I/O)
        const { outcome, alignment } = this.engine.makeDecision(index);

        // 3. Optimistic metric flash + audio/haptic — immediate signal of decision direction
        this._flashMetricCards(alignment);
        if (alignment === 'optimal') {
            AudioHapticManager.play('good');
            AudioHapticManager.haptic('success');
        } else if (alignment === 'risky') {
            AudioHapticManager.play('bad');
            AudioHapticManager.haptic('warning');
        } else {
            AudioHapticManager.play('tick');
            AudioHapticManager.haptic('light');
        }

        // 4. Inject a live headline into the crisis ticker
        if (pickedOption) {
            CrisisTicker.inject(pickedOption.label, alignment, outcome);
        }

        // 5. Disable all option buttons; mark the selected one as executing
        const optionBtns = this.ui.mainView.querySelectorAll('.story-option-btn');
        optionBtns.forEach((btn, i) => {
            btn.disabled = true;
            if (i === index) {
                btn.classList.add('option-executing');
                btn.innerHTML = `<span class="executing-spinner">${getIcon('spinner', 14)}</span> Executing…`;
            } else {
                btn.style.opacity = '0.3';
            }
        });

        // 6. Short delay then reveal outcome — no full-page spinner replacement
        setTimeout(() => {
            const alignmentConfig = {
                optimal: { color: 'var(--success-color)', label: 'Optimal Decision', icon: 'checkmark' },
                cautious: { color: 'var(--accent-color)', label: 'Cautious Decision', icon: 'warning' },
                risky:   { color: 'var(--danger-color)', label: 'Risky Decision',    icon: 'chartDown' },
            };
            const feedback = alignmentConfig[alignment] || alignmentConfig.cautious;

            this._withViewTransition(() => {
                this.ui.mainView.innerHTML = `
                    <div class="outcome-panel glass-panel">
                        <div class="outcome-alignment" style="color: ${feedback.color}">
                            ${getIcon(feedback.icon, 28)}
                            <span>${feedback.label}</span>
                        </div>
                        <h2 class="outcome-text">Decision Executed</h2>
                        <p style="margin-bottom: 2rem; font-size: 1.2rem;">${outcome}</p>
                        <button id="continue-btn" class="btn-primary">Continue to Procurement →</button>
                    </div>
                `;
                document.getElementById('continue-btn').onclick = () => this.renderGameState();
            });
        }, 480);
    }

    /** Flash metric cards with a colour coded pulse based on decision alignment. */
    _flashMetricCards(alignment) {
        const cls = alignment === 'optimal' ? 'metric-flash--positive'
                  : alignment === 'risky'   ? 'metric-flash--negative'
                  :                           'metric-flash--neutral';
        const cards = [
            this.ui.cashDisplay?.closest('.metric-card'),
            this.ui.inventoryDisplay?.closest('.metric-card'),
        ];
        cards.forEach(card => {
            if (!card) return;
            card.classList.remove('metric-flash--positive', 'metric-flash--negative', 'metric-flash--neutral');
            // Force reflow so removing+re-adding the class restarts the animation
            void card.offsetHeight;
            card.classList.add(cls);
            // Clean up after animation completes (3 × 450ms ≈ 1.4s)
            setTimeout(() => card.classList.remove(cls), 1500);
        });
    }

    /** Flash a single metric card by its data-metric attribute. */
    _flashCard(metric, type) {
        const card = document.querySelector(`.metric-card[data-metric="${metric}"]`);
        if (!card) return;
        const cls = type === 'positive' ? 'metric-flash--positive'
                  : type === 'negative' ? 'metric-flash--negative'
                  :                       'metric-flash--neutral';
        card.classList.remove('metric-flash--positive', 'metric-flash--negative', 'metric-flash--neutral');
        void card.offsetHeight;
        card.classList.add(cls);
        setTimeout(() => card.classList.remove(cls), 1500);
    }

    /**
     * Threshold-based sensory feedback after each turn's results land.
     * Fires at most once per turn by tracking _lastFeedbackTurn.
     */
    _applyOutcomeFeedback(s) {
        if (!s.lastTurnResult) return;
        // `s.turn` has already been incremented past the completed turn
        const completedTurn = s.turn - 1;
        if (completedTurn <= this._lastFeedbackTurn) return;
        this._lastFeedbackTurn = completedTurn;

        const r = s.lastTurnResult;

        if (r.missedSales > 0) {
            // Stock-out — couldn't meet demand at all
            this._flashCard('inventory', 'negative');
            AudioHapticManager.play('alert');
            AudioHapticManager.haptic('error');
        } else if (s.cash < 80000) {
            // Cash critically low
            this._flashCard('cash', 'negative');
            AudioHapticManager.play('alert');
            AudioHapticManager.haptic('warning');
        } else if (r.safetyBreach) {
            // Inventory dipped below safety stock target
            this._flashCard('inventory', 'neutral');
            AudioHapticManager.play('bad');
            AudioHapticManager.haptic('warning');
        } else if (r.profit > 60000) {
            // Strong profitable turn
            this._flashCard('profit', 'positive');
            AudioHapticManager.play('good');
            AudioHapticManager.haptic('success');
        } else if (r.profit < -20000) {
            // Significant loss
            this._flashCard('profit', 'negative');
            AudioHapticManager.play('bad');
            AudioHapticManager.haptic('medium');
        }
    }

    /** Show consequence overlay for the last turn's result (once per turn). */
    _maybeShowConsequenceOverlay() {
        const r = this.engine.state.lastTurnResult;
        if (!r) return;
        // s.turn is already incremented; the completed turn number is in r.turn
        if (r.turn <= this._lastConsequenceTurn) return;
        this._lastConsequenceTurn = r.turn;

        const data = buildConsequenceData(r);
        if (data) showConsequenceOverlay(this.ui.mainView, data);
    }

    /**
     * Update ambient stress indicators — shifts the UI colour from cool blues
     * to warning oranges / crisis reds as cash or satisfaction enters danger zones.
     */
    _updateAmbientState(s) {
        const cash         = s.cash;
        const satisfaction = s.modifiers?.customerSatisfaction ?? 100;

        let newState;
        if (cash < 80000 || satisfaction < 35) {
            newState = 'critical';
        } else if (cash < 200000 || satisfaction < 60) {
            newState = 'warning';
        } else {
            newState = 'safe';
        }

        if (newState === this._ambientState) return;
        this._ambientState = newState;

        const overlay = document.getElementById('ambient-overlay');
        const dashboard = document.getElementById('game-dashboard');

        // Swap state classes
        ['safe', 'warning', 'critical'].forEach(c => {
            overlay?.classList.remove(`ambient--${c}`);
            dashboard?.classList.remove(`game-state--${c}`);
        });

        if (newState !== 'safe') {
            overlay?.classList.add(`ambient--${newState}`);
            dashboard?.classList.add(`game-state--${newState}`);
        }
    }

    // ── Live Bullwhip Widget ───────────────────────────────────────────────

    _initBullwhipLiveChart() {
        const canvas = document.getElementById('bullwhipLive');
        if (!canvas) return;

        const history     = this.engine.state.history;
        const currentTurn = this.engine.state.turn;

        const histLabels = history.map(h => `Q${h.turn}`);
        const allLabels  = [...histLabels, `Q${currentTurn}`];

        const demandData  = [...history.map(h => h.demand),        null];
        const ordersData  = [...history.map(h => h.orderQuantity), null];
        // Preview line: null until the current turn slot, connects from last historical point
        const previewData = history.length > 0
            ? [...history.map((h, i) => i === history.length - 1 ? h.orderQuantity : null), 0]
            : [0];

        const monoFont = { family: "'Roboto Mono', monospace", size: 9 };
        const monoTicks = { color: '#475569', font: monoFont };

        // Gradient area fill under the demand line (amber → transparent)
        const demandFill = (ctx) => {
            const { ctx: c, chartArea } = ctx.chart;
            if (!chartArea) return 'rgba(245,158,11,0.08)';
            const g = c.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            g.addColorStop(0, 'rgba(245,158,11,0.22)');
            g.addColorStop(1, 'rgba(245,158,11,0)');
            return g;
        };

        this.charts.bullwhipLive = new Chart(canvas, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: 'Demand',
                        data: demandData,
                        borderColor: '#f59e0b',
                        backgroundColor: demandFill,
                        tension: 0.35,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointBackgroundColor: '#f59e0b',
                        borderWidth: 2,
                        borderCapStyle: 'round',
                        fill: true,
                        order: 2,
                    },
                    {
                        label: 'Past Orders',
                        data: ordersData,
                        borderColor: '#3b82f6',
                        tension: 0.35,
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointBackgroundColor: '#3b82f6',
                        borderWidth: 2,
                        borderCapStyle: 'round',
                        fill: false,
                        order: 3,
                    },
                    {
                        label: 'This Order',
                        data: previewData,
                        borderColor: '#f97316',
                        borderDash: [5, 4],
                        tension: 0,
                        spanGaps: true,
                        pointRadius: (ctx) => ctx.dataIndex === allLabels.length - 1 ? 7 : 0,
                        pointBackgroundColor: '#f97316',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        borderWidth: 2,
                        fill: false,
                        order: 1,
                    },
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                // One-time draw-in; live qty updates use chart.update('none')
                animation: { duration: 600, easing: 'easeOutQuart' },
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                        align: 'end',
                        labels: {
                            color: '#64748b',
                            font: { family: "'Roboto Mono', monospace", size: 8 },
                            boxWidth: 10,
                            padding: 8,
                            usePointStyle: true,
                            pointStyleWidth: 8,
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(10, 14, 26, 0.92)',
                        borderColor: 'rgba(255,255,255,0.08)',
                        borderWidth: 1,
                        titleColor: '#94a3b8',
                        bodyColor: '#e2e8f0',
                        titleFont: monoFont,
                        bodyFont: monoFont,
                        padding: 10,
                        cornerRadius: 8,
                        displayColors: false,
                        callbacks: {
                            label: (item) => `${item.dataset.label}: ${item.parsed.y != null ? item.parsed.y.toLocaleString() : '—'}`
                        }
                    }
                },
                interaction: { mode: 'index', intersect: false },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255,255,255,0.04)' },
                        border: { display: false },
                        ticks: {
                            ...monoTicks,
                            callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
                        },
                    },
                    x: {
                        grid: { display: false },
                        border: { display: false },
                        ticks: monoTicks
                    }
                }
            }
        });
    }

    _updateBullwhipPreview(qty) {
        const chart = this.charts.bullwhipLive;
        if (!chart) return;

        const lastIdx = chart.data.labels.length - 1;
        chart.data.datasets[2].data[lastIdx] = qty;
        chart.update('none'); // no animation — needs to feel instantaneous while typing

        // Recompute bullwhip ratio including this preview order
        const history = this.engine.state.history;
        const demands  = history.map(h => h.demand);
        const orders   = [...history.map(h => h.orderQuantity), qty];
        const ratio    = this._computePreviewBullwhipRatio(demands, orders);

        const ratioEl = document.getElementById('bullwhip-live-ratio');
        if (!ratioEl) return;

        if (ratio === null || history.length < 2) {
            ratioEl.textContent = '—';
            ratioEl.className = 'bullwhip-live-ratio blr--neutral';
            return;
        }

        const r = ratio.toFixed(2);
        let cls, label;
        if (ratio > 2.5)       { cls = 'blr--danger';  label = `${r}× SEVERE`; }
        else if (ratio > 1.5)  { cls = 'blr--warning'; label = `${r}× HIGH`; }
        else if (ratio > 1.05) { cls = 'blr--caution'; label = `${r}× AMPLIFYING`; }
        else                   { cls = 'blr--good';    label = `${r}× STABLE`; }

        ratioEl.textContent = label;
        ratioEl.className = `bullwhip-live-ratio ${cls}`;
    }

    _computePreviewBullwhipRatio(demands, orders) {
        if (demands.length < 2) return null;
        const variance = (arr) => {
            const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
            return arr.reduce((s, x) => s + (x - mean) ** 2, 0) / arr.length;
        };
        const vd = variance(demands);
        if (vd === 0) return null;
        return variance(orders) / vd;
    }

    renderProcurementPhase() {
        const s          = this.engine.state;
        const industryId = s.industry.id;
        const suppliers  = SUPPLIERS[industryId] || SUPPLIERS.electronics;
        const prev       = s.procurementChoices;

        const fmtM  = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
        const fmtN  = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);

        // ── 1. In-transit total (KPI values now live in the global strip) ──
        const inTransit  = s.inTransit.reduce((sum, o) => sum + o.usableUnits + o.passedDefects, 0);

        // ── 2. Market conditions alert pill ───────────────────────────
        const costMod  = s.modifiers.unitCost  ?? 1.0;
        const leadMod  = s.modifiers.leadTime  ?? 0;
        const costPct  = Math.round((costMod - 1) * 100);
        const costText = costPct > 0 ? `Supplier costs +${costPct}%`
                       : costPct < 0 ? `Supplier costs ${costPct}%`
                       : 'Supplier costs standard';
        const leadText = leadMod > 0 ? `Lead times +${leadMod}wk`
                       : leadMod < 0 ? `Lead times ${leadMod}wk`
                       : 'Lead times normal';
        const alertBad  = costMod > 1.05 || leadMod > 0;
        const alertGood = costMod < 0.95 || leadMod < 0;
        const alertCls  = alertBad ? 'proc-kpi-alert--warn' : alertGood ? 'proc-kpi-alert--good' : 'proc-kpi-alert--neutral';

        // ── 3. Story context for header ────────────────────────────────
        const lastChoice   = s.lastStoryChoice;
        const alignColors  = { optimal: 'var(--success-color)', cautious: 'var(--accent-color)', risky: 'var(--danger-color)' };
        const storyCtxHtml = (!s.isEndless && lastChoice) ? `
            <div class="proc-story-context">
                <span class="proc-story-scenario">${lastChoice.scenarioTitle}</span>
                <span class="proc-story-arrow">→</span>
                <span class="proc-story-choice" style="color:${alignColors[lastChoice.alignment] || 'var(--text-muted)'}">
                    ${lastChoice.optionLabel}
                </span>
            </div>` : '';

        // ── Endless header ─────────────────────────────────────────────
        const endlessHtml = s.isEndless ? (() => {
            const sat = Math.max(0, s.endlessSatisfaction);
            const sc  = sat > 60 ? 'var(--success-color)' : sat > 30 ? 'var(--accent-color)' : 'var(--danger-color)';
            return `<div class="proc-endless-header">
                <span class="proc-endless-wave">⚡ WAVE ${s.endlessWave} · TURN ${s.endlessTurn + 1}</span>
                <span class="proc-endless-sat" style="color:${sc}">SAT ${Math.round(sat)}%</span>
                <span class="proc-endless-score">▲ ${s.endlessScore.toLocaleString()}</span>
            </div>`;
        })() : '';

        // ── 4. Supplier cards ─────────────────────────────────────────
        const SPEED_LABELS = { charter: 'FASTEST', express: 'FAST', standard: 'DEFAULT', economy: 'SLOW', intermodal: 'SLOWEST' };

        const supplierCardsHtml = suppliers.map(sup => {
            const sel        = sup.id === prev.supplierId ? ' psc--selected' : '';
            const defPct     = (sup.defectRate * 100).toFixed(1);
            const defCls     = sup.defectRate > 0.10 ? 'psc-stat--danger'
                             : sup.defectRate < 0.03 ? 'psc-stat--good'
                             : 'psc-stat--warn';
            const costPctVal = Math.round(sup.costMultiplier * 100);
            const costCls    = sup.costMultiplier > 1.1 ? 'psc-stat--warn'
                             : sup.costMultiplier < 0.9 ? 'psc-stat--good'
                             : '';
            const leadStr    = sup.leadTimeModifier === 0 ? 'Standard'
                             : (sup.leadTimeModifier > 0 ? '+' : '') + sup.leadTimeModifier + 'wk';
            const tierCls    = `psc-tier--${sup.tier.toLowerCase()}`;
            return `
            <div class="psc${sel}" data-group="supplier" data-id="${sup.id}" role="radio" aria-checked="${sup.id === prev.supplierId}" tabindex="0">
                <div class="psc-top">
                    <span class="psc-tier ${tierCls}">${sup.tier}</span>
                    <span class="psc-name">${sup.name}</span>
                </div>
                <div class="psc-stats">
                    <div class="psc-stat">
                        <span class="psc-stat-label">COST</span>
                        <span class="psc-stat-value ${costCls}">${costPctVal}%</span>
                    </div>
                    <div class="psc-stat">
                        <span class="psc-stat-label">DEFECT</span>
                        <span class="psc-stat-value ${defCls}">${defPct}%</span>
                    </div>
                    <div class="psc-stat">
                        <span class="psc-stat-label">LEAD</span>
                        <span class="psc-stat-value">${leadStr}</span>
                    </div>
                </div>
            </div>`;
        }).join('');

        // ── 5. Shipping cards (2-col) ─────────────────────────────────
        const shippingCardsHtml = SHIPPING_METHODS.map(m => {
            const sel      = m.id === prev.shippingId ? ' shc--selected' : '';
            const leadStr  = m.leadTimeModifier === 0 ? 'Standard'
                           : (m.leadTimeModifier > 0 ? '+' : '') + m.leadTimeModifier + 'wk';
            const speed    = SPEED_LABELS[m.id] || '';
            const speedCls = m.id === 'charter' ? 'shc-speed--fastest'
                           : m.id === 'express' ? 'shc-speed--fast'
                           : m.id === 'economy' || m.id === 'intermodal' ? 'shc-speed--slow'
                           : 'shc-speed--default';
            return `
            <div class="shc${sel}" data-group="shipping" data-id="${m.id}" role="radio" aria-checked="${m.id === prev.shippingId}" tabindex="0">
                <div class="shc-top">
                    <span class="shc-name">${m.name}</span>
                    <span class="shc-speed ${speedCls}">${speed}</span>
                </div>
                <div class="shc-stats">
                    <span class="shc-cost">$${m.costPerUnit}/unit</span>
                    <span class="shc-lead">${leadStr}</span>
                </div>
            </div>`;
        }).join('');

        // ── 6. Pricing cards ─────────────────────────────────────────
        const pricingCardsHtml = PRICING_STRATEGIES.map(p => {
            const sel = p.id === prev.pricingId ? ' option-card selected' : ' option-card';
            return `
            <div class="${sel.trim()}" data-group="pricing" data-id="${p.id}">
                <div class="option-card-name">${p.name}</div>
                <div class="option-card-stats">
                    <span>Price ×${p.priceMultiplier.toFixed(1)}</span>
                    <span>Demand ×${p.demandMultiplier.toFixed(1)}</span>
                </div>
            </div>`;
        }).join('');

        // ── 7. Inspection cards ───────────────────────────────────────
        const inspectionCardsHtml = QUALITY_INSPECTIONS.map(q => {
            const sel = q.id === prev.inspectionId ? ' option-card selected' : ' option-card';
            return `
            <div class="${sel.trim()}" data-group="inspection" data-id="${q.id}">
                <div class="option-card-name">${q.name}</div>
                <div class="option-card-stats">
                    <span>$${q.costPerUnit}/unit</span>
                    <span>Catch ${Math.round(q.defectCatchRate * 100)}%</span>
                </div>
            </div>`;
        }).join('');

        // ── Build initial summary labels ──────────────────────────────
        const initSupplier  = suppliers.find(x => x.id === prev.supplierId) || suppliers[1];
        const initShipping  = SHIPPING_METHODS.find(x => x.id === prev.shippingId) || SHIPPING_METHODS[2];
        const initPricing   = PRICING_STRATEGIES.find(x => x.id === prev.pricingId) || PRICING_STRATEGIES[1];
        const initInspect   = QUALITY_INSPECTIONS.find(x => x.id === prev.inspectionId) || QUALITY_INSPECTIONS[1];

        // ── In-transit sidebar list ───────────────────────────────────
        const transitListHtml = s.inTransit.length > 0 ? `
            <div class="proc-cp-divider"></div>
            <div class="proc-cp-label">IN TRANSIT (${s.inTransit.length})</div>
            <div class="in-transit-list">
                ${s.inTransit.map(o => {
                    const tl = o.arrivesOnTurn - s.turn;
                    const u  = (o.usableUnits + o.passedDefects).toLocaleString();
                    return `<div class="in-transit-item">
                        <span>${u} units</span>
                        <span class="in-transit-eta">T${o.arrivesOnTurn}<span class="in-transit-turns"> (+${tl})</span></span>
                    </div>`;
                }).join('')}
            </div>` : '';

        // ── Full layout HTML ──────────────────────────────────────────
        this.ui.mainView.innerHTML = `
        <div class="proc-layout">

            ${endlessHtml}
            ${storyCtxHtml}

            <!-- 1. Market conditions pill (KPI values live in the global strip) -->
            <div class="proc-alert-row">
                <div class="proc-kpi-alert ${alertCls}">
                    <span class="proc-kpi-alert-dot"></span>
                    <span class="proc-kpi-alert-text">${costText} · ${leadText}</span>
                </div>
            </div>

            <!-- 2. Demand chart -->
            <div class="proc-chart-block">
                <div class="proc-chart-head">
                    <span class="proc-chart-title">DEMAND vs ORDER SIGNAL</span>
                    <div class="proc-chart-legend">
                        <span class="pcl-item pcl-demand">—&nbsp;demand</span>
                        <span class="pcl-item pcl-orders">–&nbsp;–&nbsp;order signal</span>
                    </div>
                    <span id="bullwhip-live-ratio" class="bullwhip-live-ratio blr--neutral">—</span>
                </div>
                <div class="proc-chart-canvas-wrap">
                    <canvas id="bullwhipLive"></canvas>
                </div>
            </div>

            <!-- 3-8. Two-column body -->
            <div class="proc-body">

                <!-- LEFT: Accordion decisions -->
                <div class="proc-decisions">

                    <!-- Section 1: Supplier -->
                    <div class="proc-acc" data-acc="supplier">
                        <button class="proc-acc-hdr proc-acc-hdr--open" data-toggle="supplier">
                            <span class="proc-acc-num">1</span>
                            <span class="proc-acc-ttl">SUPPLIER</span>
                            <span class="proc-acc-summary" id="acc-sum-supplier">${initSupplier.tier} · ${initSupplier.name}</span>
                            <span class="proc-acc-chevron">&#8963;</span>
                        </button>
                        <div class="proc-acc-body proc-acc-body--open">
                            <div class="proc-supplier-grid">${supplierCardsHtml}</div>
                        </div>
                    </div>

                    <!-- Section 2: Shipping -->
                    <div class="proc-acc" data-acc="shipping">
                        <button class="proc-acc-hdr proc-acc-hdr--open" data-toggle="shipping">
                            <span class="proc-acc-num">2</span>
                            <span class="proc-acc-ttl">SHIPPING</span>
                            <span class="proc-acc-summary" id="acc-sum-shipping">${initShipping.name} · $${initShipping.costPerUnit}/unit</span>
                            <span class="proc-acc-chevron">&#8963;</span>
                        </button>
                        <div class="proc-acc-body proc-acc-body--open">
                            <div class="proc-ship-grid">${shippingCardsHtml}</div>
                        </div>
                    </div>

                    <!-- Section 3: Order Quantity -->
                    <div class="proc-acc" data-acc="quantity">
                        <button class="proc-acc-hdr proc-acc-hdr--open" data-toggle="quantity">
                            <span class="proc-acc-num">3</span>
                            <span class="proc-acc-ttl">ORDER QUANTITY</span>
                            <span class="proc-acc-summary" id="acc-sum-quantity">${fmtN(prev.orderQuantity)} units</span>
                            <span class="proc-acc-chevron">&#8963;</span>
                        </button>
                        <div class="proc-acc-body proc-acc-body--open">
                            <div class="qty-stepper">
                                <button class="qty-btn qty-btn--minus" id="qty-minus" aria-label="Decrease quantity">−</button>
                                <input type="number" id="order-input" value="${prev.orderQuantity}" min="0" step="100" aria-label="Order quantity">
                                <button class="qty-btn qty-btn--plus" id="qty-plus" aria-label="Increase quantity">+</button>
                            </div>
                            <p class="qty-hint">Safety stock target: <strong id="qty-hint-safety">${fmtN(prev.safetyStockTarget)}</strong> units &nbsp;·&nbsp; In transit: <strong>${fmtN(inTransit)}</strong> units</p>
                        </div>
                    </div>

                    <!-- Section 4: Pricing Strategy -->
                    <div class="proc-acc" data-acc="pricing">
                        <button class="proc-acc-hdr proc-acc-hdr--open" data-toggle="pricing">
                            <span class="proc-acc-num">4</span>
                            <span class="proc-acc-ttl">PRICING STRATEGY</span>
                            <span class="proc-acc-summary" id="acc-sum-pricing">${initPricing.name}</span>
                            <span class="proc-acc-chevron">&#8963;</span>
                        </button>
                        <div class="proc-acc-body proc-acc-body--open">
                            <div class="option-cards">${pricingCardsHtml}</div>
                        </div>
                    </div>

                    <!-- Section 5: Quality Inspection -->
                    <div class="proc-acc" data-acc="inspection">
                        <button class="proc-acc-hdr proc-acc-hdr--open" data-toggle="inspection">
                            <span class="proc-acc-num">5</span>
                            <span class="proc-acc-ttl">QUALITY INSPECTION</span>
                            <span class="proc-acc-summary" id="acc-sum-inspection">${initInspect.name}</span>
                            <span class="proc-acc-chevron">&#8963;</span>
                        </button>
                        <div class="proc-acc-body proc-acc-body--open">
                            <div class="option-cards">${inspectionCardsHtml}</div>
                        </div>
                    </div>

                    <!-- Section 6: Safety Stock -->
                    <div class="proc-acc" data-acc="safety">
                        <button class="proc-acc-hdr proc-acc-hdr--open" data-toggle="safety">
                            <span class="proc-acc-num">6</span>
                            <span class="proc-acc-ttl">SAFETY STOCK TARGET</span>
                            <span class="proc-acc-summary" id="acc-sum-safety">${fmtN(prev.safetyStockTarget)} units</span>
                            <span class="proc-acc-chevron">&#8963;</span>
                        </button>
                        <div class="proc-acc-body proc-acc-body--open">
                            <div class="safety-stock-control">
                                <input type="range" id="safety-stock-slider" min="0" max="2000" step="100" value="${prev.safetyStockTarget}">
                                <span id="safety-stock-value">${prev.safetyStockTarget} units</span>
                            </div>
                        </div>
                    </div>

                </div><!-- /proc-decisions -->

                <!-- RIGHT: Sticky cost panel -->
                <div class="proc-right">
                    <div class="proc-cost-panel">
                        <div class="proc-cp-label">LIVE COST ESTIMATE</div>
                        <div class="proc-cp-rows">
                            <div class="proc-cp-row"><span>Order Cost</span><span id="est-order">—</span></div>
                            <div class="proc-cp-row"><span>Shipping</span><span id="est-shipping">—</span></div>
                            <div class="proc-cp-row"><span>Inspection</span><span id="est-inspection">—</span></div>
                            <div class="proc-cp-divider"></div>
                            <div class="proc-cp-row proc-cp-total"><span>Total This Turn</span><span id="est-total" class="proc-cp-total-val">—</span></div>
                        </div>

                        <div class="proc-route" id="proc-route"></div>
                        <div class="proc-contract" id="proc-contract"></div>
                        <div class="proc-workbench" id="proc-workbench"></div>

                        <div class="proc-delivery-badge">
                            <div class="proc-del-row">
                                <span class="proc-del-label">ARRIVES</span>
                                <span id="est-arrival-turn" class="proc-del-value">—</span>
                            </div>
                            <div class="proc-del-row">
                                <span class="proc-del-label">LEAD TIME</span>
                                <span id="est-lead-turns" class="proc-del-value">—</span>
                            </div>
                        </div>

                        ${transitListHtml}

                        <button id="place-order-btn" class="proc-confirm-btn">
                            ✓ Confirm Order
                        </button>
                        <p class="proc-sidebar-note">Review all sections, then confirm to advance the quarter.</p>
                    </div>
                </div>

            </div><!-- /proc-body -->
        </div><!-- /proc-layout -->
        `;

        this.ui.actionPanel.style.display = 'none';
        this._initBullwhipLiveChart();
        // Calmer default view: only the two every-turn decisions open.
        // Collapsed sections keep their live summary in the header, and one
        // click reopens them — sensible defaults are pre-selected anyway.
        const DEFAULT_OPEN_SECTIONS = ['supplier', 'quantity'];
        document.querySelectorAll('.proc-acc').forEach(acc => {
            if (DEFAULT_OPEN_SECTIONS.includes(acc.dataset.acc)) return;
            acc.querySelector('.proc-acc-hdr')?.classList.remove('proc-acc-hdr--open');
            acc.querySelector('.proc-acc-body')?.classList.remove('proc-acc-body--open');
        });

        this.attachProcurementListeners();
        this.updateCostEstimate();
    }

    attachProcurementListeners() {
        // ── Accordion toggles ─────────────────────────────────────────
        document.querySelectorAll('.proc-acc-hdr').forEach(hdr => {
            hdr.addEventListener('click', () => {
                const key  = hdr.dataset.toggle;
                const acc  = hdr.closest('.proc-acc');
                const body = acc.querySelector('.proc-acc-body');
                const open = hdr.classList.contains('proc-acc-hdr--open');
                hdr.classList.toggle('proc-acc-hdr--open', !open);
                body.classList.toggle('proc-acc-body--open', !open);
            });
        });

        // ── Supplier cards ─────────────────────────────────────────────
        document.querySelectorAll('.psc').forEach(card => {
            const activate = () => {
                document.querySelectorAll('.psc').forEach(c => {
                    c.classList.remove('psc--selected');
                    c.setAttribute('aria-checked', 'false');
                });
                card.classList.add('psc--selected');
                card.setAttribute('aria-checked', 'true');
                this.updateCostEstimate();
            };
            card.addEventListener('click', activate);
            card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
        });

        // ── Shipping cards ─────────────────────────────────────────────
        document.querySelectorAll('.shc').forEach(card => {
            const activate = () => {
                document.querySelectorAll('.shc').forEach(c => {
                    c.classList.remove('shc--selected');
                    c.setAttribute('aria-checked', 'false');
                });
                card.classList.add('shc--selected');
                card.setAttribute('aria-checked', 'true');
                this.updateCostEstimate();
            };
            card.addEventListener('click', activate);
            card.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
        });

        // ── Generic option cards (pricing, inspection) ─────────────────
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', () => {
                const group = card.dataset.group;
                document.querySelectorAll(`.option-card[data-group="${group}"]`).forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.updateCostEstimate();
            });
        });

        // ── Order quantity ─────────────────────────────────────────────
        const orderInput = document.getElementById('order-input');
        if (orderInput) {
            orderInput.addEventListener('input', () => this.updateCostEstimate());
            const step = parseInt(orderInput.step) || 100;
            document.getElementById('qty-minus')?.addEventListener('click', () => {
                orderInput.value = Math.max(0, (parseInt(orderInput.value) || 0) - step);
                this.updateCostEstimate();
            });
            document.getElementById('qty-plus')?.addEventListener('click', () => {
                orderInput.value = (parseInt(orderInput.value) || 0) + step;
                this.updateCostEstimate();
            });
        }

        // ── Safety stock slider ────────────────────────────────────────
        const slider = document.getElementById('safety-stock-slider');
        if (slider) {
            slider.addEventListener('input', () => {
                const v = slider.value;
                const el = document.getElementById('safety-stock-value');
                if (el) el.textContent = `${parseInt(v).toLocaleString()} units`;
                const sum = document.getElementById('acc-sum-safety');
                if (sum) sum.textContent = `${parseInt(v).toLocaleString()} units`;
                const hint = document.getElementById('qty-hint-safety');
                if (hint) hint.textContent = parseInt(v).toLocaleString();
                this.updateCostEstimate();
            });
        }

        // ── Confirm order button ───────────────────────────────────────
        const btn = document.getElementById('place-order-btn');
        if (btn) {
            btn.addEventListener('click', () => {
                if (btn.disabled) return;
                btn.disabled = true;
                btn.textContent = 'Order confirmed ✓';
                btn.classList.add('proc-confirm-btn--done');
                this.handleProcurement();
            });
        }
    }

    getSelectedProcurementChoices() {
        const getSupplier  = () => document.querySelector('.psc.psc--selected')?.dataset.id  || 'standard';
        const getShipping  = () => document.querySelector('.shc.shc--selected')?.dataset.id  || 'standard';
        const getOption    = (g) => document.querySelector(`.option-card[data-group="${g}"].selected`)?.dataset.id || null;

        return {
            supplierId:       getSupplier(),
            shippingId:       getShipping(),
            orderQuantity:    parseInt(document.getElementById('order-input')?.value) || 0,
            pricingId:        getOption('pricing')    || 'standard',
            inspectionId:     getOption('inspection') || 'standard',
            safetyStockTarget: parseInt(document.getElementById('safety-stock-slider')?.value) || 500,
        };
    }

    updateCostEstimate() {
        const choices    = this.getSelectedProcurementChoices();
        const industryId = this.engine.state.industry.id;
        const suppliers  = SUPPLIERS[industryId] || SUPPLIERS.electronics;
        const supplier   = suppliers.find(s => s.id === choices.supplierId)  || suppliers[1];
        const shipping   = SHIPPING_METHODS.find(s => s.id === choices.shippingId) || SHIPPING_METHODS[2];
        const inspection = QUALITY_INSPECTIONS.find(q => q.id === choices.inspectionId) || QUALITY_INSPECTIONS[1];
        const pricing    = PRICING_STRATEGIES.find(p => p.id === choices.pricingId)    || PRICING_STRATEGIES[1];

        const baseCost     = 100;
        const storyMod     = this.engine.state.modifiers.unitCost || 1.0;
        const qty          = choices.orderQuantity;
        const routeFactor  = this.engine.state.activeRoute?.shippingCostFactor ?? 1.0;
        const orderCost    = qty * baseCost * supplier.costMultiplier * storyMod;
        const shippingCost = qty * shipping.costPerUnit * routeFactor;
        const inspectCost  = qty * inspection.costPerUnit;
        const total        = orderCost + shippingCost + inspectCost;

        const fmtM = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
        const fmtN = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setEl('est-order',    fmtM(orderCost));
        setEl('est-shipping', fmtM(shippingCost));
        setEl('est-inspection', fmtM(inspectCost));
        setEl('est-total',    fmtM(total));

        // Color total red when large relative to cash
        const totalEl = document.getElementById('est-total');
        if (totalEl) totalEl.style.color = 'var(--danger-color)';

        // Delivery timeline (chapter lane adds/removes whole turns)
        const routeLeadMod = this.engine.state.activeRoute?.leadTimeMod ?? 0;
        const leadTurns   = Math.max(1, this.engine._computeLeadTimeTurns(supplier, shipping, this.engine.state.modifiers.leadTime, industryId) + routeLeadMod);
        const arrivalTurn = this.engine.state.turn + leadTurns;
        setEl('est-arrival-turn', `Turn ${arrivalTurn}`);
        setEl('est-lead-turns',   leadTurns === 1 ? '1 turn' : `${leadTurns} turns`);

        // Section summary labels
        setEl('acc-sum-supplier',  `${supplier.tier} · ${supplier.name}`);
        setEl('acc-sum-shipping',  `${shipping.name} · $${shipping.costPerUnit}/unit`);
        setEl('acc-sum-quantity',  `${fmtN(qty)} units`);
        setEl('acc-sum-pricing',   pricing.name);
        setEl('acc-sum-inspection',inspection.name);

        this._renderGanttChart(leadTurns);
        this._updateBullwhipPreview(qty);

        // Active chapter-lane reminder
        const routeEl = document.getElementById('proc-route');
        if (routeEl) {
            const rt = this.engine.state.activeRoute;
            if (rt) {
                const cp = Math.round((rt.shippingCostFactor - 1) * 100);
                const cpLabel = cp === 0 ? 'baseline freight' : cp > 0 ? `+${cp}% freight` : `${cp}% freight`;
                routeEl.className = 'proc-route proc-route--on';
                routeEl.innerHTML = `🗺️ Lane: <strong>${rt.label}</strong> · ${cpLabel} · ${rt.leadTimeMod > 0 ? '+' + rt.leadTimeMod + ' turn transit' : rt.leadTimeMod < 0 ? rt.leadTimeMod + ' turn transit' : 'on schedule'}`;
            } else {
                routeEl.className = 'proc-route';
                routeEl.innerHTML = '';
            }
        }

        // Active supply-contract reminder (only for the contracted supplier)
        const contractEl = document.getElementById('proc-contract');
        if (contractEl) {
            const c = this.engine.state.activeContract;
            if (c && c.supplierId === choices.supplierId) {
                const meets = qty >= c.minVolume;
                contractEl.className = 'proc-contract ' + (meets ? 'proc-contract--ok' : 'proc-contract--miss');
                contractEl.innerHTML = `📑 ${c.supplierName} contract: <strong>−${c.discountPct}%</strong> if you order ≥ <strong>${c.minVolume.toLocaleString()}</strong> · you're at <strong>${qty.toLocaleString()}</strong> ${meets ? '✓' : '— shortfall fee applies'}`;
            } else {
                contractEl.className = 'proc-contract';
                contractEl.innerHTML = '';
            }
        }

        // Live planning workbench — inventory projection reacting to the
        // exact decisions the player is dragging right now
        const s = this.engine.state;
        const archMods = s.archetypeModifiers || {};
        const expectedDemand = Math.floor(
            1000
            * (s.modifiers.demandMultiplier ?? 1.0)
            * (archMods.demandMultiplier ?? 1.0)
            * pricing.demandMultiplier
        );
        const usableRate = 1 - supplier.defectRate; // defects removed regardless of catch point
        updateWorkbench(document.getElementById('proc-workbench'), {
            inventory:      s.inventory,
            backlog:        s.backlog,
            inTransit:      s.inTransit,
            currentTurn:    s.turn,
            orderQty:       qty,
            orderUsable:    Math.floor(qty * usableRate),
            leadTimeTurns:  leadTurns,
            expectedDemand,
            safetyStock:    choices.safetyStockTarget,
        });
    }

    _renderGanttChart(leadTurns) {
        const canvas = document.getElementById('leadTimeGantt');
        if (!canvas) return;

        const currentTurn = this.engine.state.turn;
        const inTransit = this.engine.state.inTransit;

        // Build bar labels, ranges, and colours
        const labels = [];
        const barData = [];
        const colors = [];

        inTransit.forEach(order => {
            const units = (order.usableUnits + order.passedDefects).toLocaleString();
            labels.push(`${units}u`);
            barData.push([currentTurn, order.arrivesOnTurn]);
            colors.push('rgba(59,130,246,0.65)');
        });

        // Preview bar for the order being configured
        labels.push('New Order');
        barData.push([currentTurn, currentTurn + leadTurns]);
        colors.push('rgba(249,115,22,0.75)');

        const maxTurn = Math.max(currentTurn + leadTurns, ...inTransit.map(o => o.arrivesOnTurn), currentTurn + 1);

        const monoTicks = { color: '#64748b', font: { family: "'Roboto Mono', monospace", size: 9 } };
        const monoGrid  = { color: 'rgba(255,255,255,0.05)' };
        const nowTurn   = currentTurn;

        const nowLinePlugin = {
            id: 'ganttNowLine',
            afterDraw(chart) {
                const xScale = chart.scales.x;
                if (!xScale) return;
                const ctx = chart.ctx;
                const x = xScale.getPixelForValue(nowTurn);
                ctx.save();
                ctx.strokeStyle = 'rgba(34,197,94,0.85)';
                ctx.lineWidth = 2;
                ctx.setLineDash([3, 4]);
                ctx.beginPath();
                ctx.moveTo(x, chart.chartArea.top);
                ctx.lineTo(x, chart.chartArea.bottom);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = 'rgba(34,197,94,0.85)';
                ctx.font = "8px 'Roboto Mono', monospace";
                ctx.fillText('NOW', x + 3, chart.chartArea.top + 9);
                ctx.restore();
            }
        };

        if (this.charts.gantt) {
            this.charts.gantt.data.labels = labels;
            this.charts.gantt.data.datasets[0].data = barData;
            this.charts.gantt.data.datasets[0].backgroundColor = colors;
            this.charts.gantt.data.datasets[0].borderColor = colors.map(c => c.replace('0.65', '0.9').replace('0.75', '0.95'));
            this.charts.gantt.options.scales.x.min = currentTurn - 0.5;
            this.charts.gantt.options.scales.x.max = maxTurn + 0.5;
            this.charts.gantt.update('active');
        } else {
            this.charts.gantt = new Chart(canvas, {
                type: 'bar',
                data: {
                    labels,
                    datasets: [{
                        data: barData,
                        backgroundColor: colors,
                        borderColor: colors.map(c => c.replace('0.65', '0.9').replace('0.75', '0.95')),
                        borderWidth: 1,
                        borderSkipped: false,
                        borderRadius: 3,
                    }]
                },
                options: {
                    indexAxis: 'y',
                    responsive: true,
                    maintainAspectRatio: false,
                    animation: { duration: 300 },
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            callbacks: {
                                title: (items) => items[0]?.label || '',
                                label: (item) => {
                                    const [start, end] = item.raw;
                                    const dur = end - start;
                                    return `Turn ${start} → ${end}  (${dur} turn${dur !== 1 ? 's' : ''})`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            min: currentTurn - 0.5,
                            max: maxTurn + 0.5,
                            grid: monoGrid,
                            ticks: { ...monoTicks, stepSize: 1, precision: 0 },
                            title: { display: true, text: 'Turn', color: '#64748b', font: { size: 9 } }
                        },
                        y: {
                            grid: { display: false },
                            ticks: monoTicks,
                        }
                    }
                },
                plugins: [nowLinePlugin]
            });
        }
    }

    formatModifier(val, unit) {
        if (val > 0) return `+${val} ${unit}`;
        if (val < 0) return `${val} ${unit}`;
        return `standard`;
    }

    handleProcurement() {
        const choices = this.getSelectedProcurementChoices();
        AudioHapticManager.play('confirm');
        AudioHapticManager.haptic('medium');

        // Endless mode keeps its fast loop — no prediction prompt
        if (this.engine.state.isEndless) {
            this._resolveTurn(choices, null);
            return;
        }

        // Predict-before-reveal: forecast the quarter's demand before it resolves
        const s = this.engine.state;
        const arriving = s.inTransit
            .filter(o => o.arrivesOnTurn <= s.turn)
            .reduce((sum, o) => sum + o.usableUnits + o.passedDefects, 0);

        this.predictionPrompt.show({
            onHand: s.inventory,
            arriving,
            recentDemand: s.history.slice(-3).map(h => h.demand),
            onCall: (forecast) => this._maybeCrisisInterrupt(choices, forecast),
        });
    }

    /**
     * After the order and forecast are locked, breaking news may interrupt:
     * the turn's crisis arrives as a message from a named colleague, with a
     * mitigation decision, BEFORE the quarter resolves.
     */
    _maybeCrisisInterrupt(choices, forecast) {
        const crisis = this.engine.prepareTurnCrisis();
        if (!crisis) {
            this._resolveTurn(choices, forecast, null);
            return;
        }

        const industryId = this.engine.state.industry.id;
        const suppliers  = SUPPLIERS[industryId] || SUPPLIERS.electronics;
        const supplier   = suppliers.find(sp => sp.id === choices.supplierId) || suppliers[1];

        AudioHapticManager.play('alert');
        new CrisisInboxOverlay().show({
            message: buildCrisisMessage(crisis, { supplierName: supplier.name }),
            turn: this.engine.state.turn,
            cash: this.engine.state.cash,
            onDone: (option) => {
                const response = applyCrisisResponse(this.engine.state, crisis, option);
                this._resolveTurn(choices, forecast, response);
            },
        });
    }

    /**
     * Resolve the quarter and show the summary card, decorated with the
     * forecast verdict and the concept-in-action insight.
     * @param {Object} choices
     * @param {number|null} forecastCall — player's demand forecast for the quarter
     * @param {Object|null} crisisResponse — from applyCrisisResponse
     */
    _resolveTurn(choices, forecastCall, crisisResponse = null) {
        if (this.charts.gantt) { this.charts.gantt.destroy(); this.charts.gantt = null; }
        if (this.charts.bullwhipLive) { this.charts.bullwhipLive.destroy(); this.charts.bullwhipLive = null; }
        this.engine.processTurn(choices);

        // Surface any micro-crisis that fired this turn into the live ticker
        const crisis = this.engine.state.lastTurnResult?.crisis;
        if (crisis) {
            const alignment = crisis.severity === 'positive' ? 'optimal' : 'risky';
            CrisisTicker.inject(crisis.name, alignment, crisis.ticker);
        }

        const result  = this.engine.state.lastTurnResult;
        const chapter = this.engine.state.currentChapter;

        // Forecast verdict — score the call as absolute percentage error
        if (typeof forecastCall === 'number' && result.demand > 0) {
            const ape = Math.abs(result.demand - forecastCall) / result.demand;
            this._forecastStats.sumApe += ape;
            this._forecastStats.n      += 1;
            const mapePct = (this._forecastStats.sumApe / this._forecastStats.n) * 100;
            result._forecast = {
                forecast: forecastCall,
                actual:   result.demand,
                apePct:   ape * 100,
                mapePct,
                n:        this._forecastStats.n,
            };
            AudioHapticManager.play(ape <= 0.10 ? 'good' : 'bad');
        }

        // Concept-in-action insight (also shown in endless mode)
        result._conceptInsight = getConceptInsight(result, this.engine.state.history);

        // Crisis response record + human vignette for the summary card
        if (crisisResponse) result._crisisResponse = crisisResponse;
        result._vignette = pickVignette(result);

        // Board confidence (campaign only) — the board watches every quarter
        if (!this.engine.state.isEndless) {
            const { delta } = assessTurn(result);
            adjustConfidence(this.engine.state, delta);
            renderConfidenceMeter(document.querySelector('.hud-right'), this.engine.state.boardConfidence);
        }

        // Concept-named achievements (turn-level)
        showAchievementToasts(checkTurnAchievements({
            result,
            forecastStats: this._forecastStats,
            worldMemory: this.engine.state.worldMemory,
        }));

        const showSummary = () => this.turnSummaryCard.show(result, chapter, () => {
            if (!this.engine.state.isEndless && this.engine.state.boardConfidence <= 0) {
                this._boardDismissal();
                return;
            }
            this.renderGameState();
        });

        // Significant shortage in campaign mode → ration the scarce units first
        if (!this.engine.state.isEndless && result.missedSales > 300 && result.sales > 0) {
            const scenario  = buildAllocationScenario(result);
            const allocator = new AllocationOverlay();
            allocator.show({
                scenario,
                missed: result.missedSales,
                onDone: (alloc) => {
                    const consequences = applyAllocation(this.engine.state, scenario, alloc);
                    allocator.showConsequences(consequences, showSummary);
                },
            });
            return;
        }

        showSummary();
    }

    /**
     * At chapter start a supplier you have a track record with may propose a
     * volume-commitment contract for the chapter. Relationship score (world
     * memory) shapes the terms and how far they'll move on a counter.
     * Falls through to proceed() when there's nothing to offer.
     * @param {Object} chapter
     * @param {Function} proceed
     */
    _maybeOfferNegotiation(chapter, proceed) {
        const s = this.engine.state;
        if (s.isEndless || s.activeContract) { proceed(); return; }

        // Most-ordered supplier this run, needing an established relationship
        const recs = s.worldMemory?.suppliers || {};
        const bestId = Object.keys(recs).sort((a, b) => recs[b].orders - recs[a].orders)[0];
        if (!bestId || recs[bestId].orders < 2) { proceed(); return; }

        // Offer sometimes, not every chapter
        if (Math.random() > 0.55 && !this._forceNegotiation) { proceed(); return; }
        this._forceNegotiation = false;

        const suppliers = SUPPLIERS[s.industry.id] || SUPPLIERS.electronics;
        const supplier  = suppliers.find(sp => sp.id === bestId);
        if (!supplier) { proceed(); return; }

        const offer = buildOpeningOffer(s.worldMemory, supplier);
        new NegotiationOverlay().show({
            offer,
            chapterNumber: chapter.number,
            onAccept: (finalOffer) => {
                s.activeContract = contractFromOffer(finalOffer, s.chapterIndex);
                adjustConfidence(s, 2);
                AudioHapticManager.play('confirm');
                proceed();
            },
            onDecline: () => proceed(),
        });
    }

    /**
     * At the start of a logistics chapter (6/9/10), design the primary
     * shipping lane for the chapter — an intermodal route whose composition
     * sets the chapter's shipping cost and lead time. Teaches intermodal
     * transportation and network design through direct manipulation.
     * @param {Object} chapter
     * @param {Function} proceed
     */
    _maybePlanRoute(chapter, proceed) {
        const s = this.engine.state;
        if (s.isEndless || !LOGISTICS_CHAPTERS.includes(chapter.number)) { proceed(); return; }

        new RoutePlannerOverlay().show({
            chapterNumber: chapter.number,
            onCommit: (longId, lastId) => {
                s.activeRoute = routeFromChoice(longId, lastId, s.chapterIndex);
                AudioHapticManager.play('confirm');
                proceed();
            },
        });
    }

    /**
     * The board has seen enough. Confidence hit zero — dismissal scene,
     * then straight to game over.
     */
    _boardDismissal() {
        const s = this.engine.state;
        const overlay = document.createElement('div');
        overlay.className = 'bdis-overlay';
        overlay.innerHTML = `
            <div class="bdis-card glass-panel">
                <div class="bdis-eyebrow">■ EMERGENCY BOARD SESSION — MINUTES</div>
                <h2 class="bdis-title">The board has voted.</h2>
                <p class="bdis-body">
                    Stockouts, losses, and broken promises finally outweighed the excuses.
                    The vote wasn't close. Security will walk you out; your badge stops
                    working at Q${s.turn}.
                </p>
                <p class="bdis-note">Board confidence reached zero. Every stockout, loss quarter,
                    and betrayed account moved the needle — it was all on the meter.</p>
                <button class="btn-primary bdis-btn">Clear Your Desk &rarr;</button>
            </div>`;
        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('bdis-overlay--visible'));
        overlay.querySelector('.bdis-btn').addEventListener('click', () => {
            overlay.remove();
            this.engine.state.phase = GAME_PHASES.GAME_OVER;
            this.renderGameState();
        });
    }

    /**
     * Spaced retrieval: at the start of a chapter, a board member asks one
     * question about a concept from an earlier chapter the player completed
     * this session. Correct answer earns a board-confidence cash bonus.
     * Falls through to proceed() when there is nothing eligible to ask.
     * @param {Object} chapter   — chapter about to start
     * @param {Function} proceed — continues into the chapter
     */
    _maybeAskBoardQuestion(chapter, proceed) {
        const BOARD_BONUS = 20000;

        if (this.engine.state.isEndless) { proceed(); return; }

        // Only ask about chapters actually played this session
        const completedNumbers = new Set(
            (this.engine.state.history || []).map(h => h.chapter)
        );
        const candidates = [...CHAPTERS, ...EXPANSION_CHAPTERS].filter(ch =>
            ch.number < chapter.number &&
            completedNumbers.has(ch.number) &&
            RECALL_QUESTIONS[ch.id] &&
            !this._askedRecallChapters.has(ch.id)
        );
        if (candidates.length === 0) { proceed(); return; }

        // Prefer the oldest un-asked concept — maximum spacing between
        // learning and retrieval is where the memory benefit lives.
        const source = candidates[0];
        this._askedRecallChapters.add(source.id);

        this.boardQuestion.show({
            question: RECALL_QUESTIONS[source.id],
            chapterNumber: chapter.number,
            bonus: BOARD_BONUS,
            onDone: (correct) => {
                if (correct) {
                    this.engine.state.cash += BOARD_BONUS;
                    adjustConfidence(this.engine.state, 3);
                    AudioHapticManager.play('good');
                }
                proceed();
            },
        });
    }

    /**
     * Analyse the player's chapter history and return the most instructive
     * diagnosis to show on the CSCP definition card.
     * Returns null if no strong pattern is found.
     * @param {number} chapterNum
     * @returns {{ icon, headline, detail, type } | null}
     */
    _computePlayerDiagnosis(chapterNum) {
        const history = this.engine.state.history || [];
        const turns   = history.filter(h => h.chapter === chapterNum);
        if (turns.length === 0) return null;

        const fmt = (n) => new Intl.NumberFormat('en-US', {
            style: 'currency', currency: 'USD', maximumFractionDigits: 0,
        }).format(Math.abs(n));

        const totalMissed   = turns.reduce((s, h) => s + (h.missedSales  || 0), 0);
        const totalHolding  = turns.reduce((s, h) => s + (h.holdingCost  || 0), 0);
        const totalShipping = turns.reduce((s, h) => s + (h.shippingCost || 0), 0);
        const totalDefects  = turns.reduce((s, h) => s + (h.defectsPassed|| 0), 0);
        const totalProfit   = turns.reduce((s, h) => s + (h.profit       || 0), 0);
        const safetyBreaches= turns.filter(h => h.safetyBreach).length;

        // Most impactful pain point wins
        if (totalMissed > 300) {
            const lostRevEst = turns.reduce((s, h) => {
                const perUnit = h.sales > 0 ? h.revenue / h.sales : 120;
                return s + (h.missedSales || 0) * perUnit;
            }, 0);
            return {
                icon: '⚠',
                headline: 'Your chapter had recurring stockouts',
                detail: `${totalMissed.toLocaleString()} units went unfulfilled this chapter — approximately ${fmt(lostRevEst)} in missed revenue. Stockouts happen when your order quantity or safety stock buffer is too low relative to actual demand.`,
                type: 'warn',
            };
        }

        if (totalHolding > totalShipping * 1.8 && totalHolding > 80000) {
            return {
                icon: '📦',
                headline: 'Overstock drove your costs this chapter',
                detail: `${fmt(totalHolding)} spent on holding costs — more than any other cost category. Excess inventory ties up cash and earns nothing. Tightening your order quantity to match real demand would have recovered a significant margin.`,
                type: 'warn',
            };
        }

        if (totalShipping > 120000) {
            return {
                icon: '✈',
                headline: 'Freight premiums compressed your margin',
                detail: `${fmt(totalShipping)} in shipping this chapter. Premium freight is useful for emergencies — but as a default setting it turns viable quarters into slim-margin ones. Sea or intermodal shipping cuts this cost by 60–80%.`,
                type: 'warn',
            };
        }

        if (totalDefects > 80) {
            return {
                icon: '🔴',
                headline: 'Defective units reached your customers',
                detail: `${totalDefects.toLocaleString()} defective units shipped this chapter. Each one erodes satisfaction and triggers costly returns. The fix is upstream — either a higher-quality supplier or rigorous inspection before goods leave the factory.`,
                type: 'warn',
            };
        }

        if (safetyBreaches >= 2) {
            return {
                icon: '⚠',
                headline: 'Safety stock breached in multiple turns',
                detail: `Your inventory dipped below the safety buffer ${safetyBreaches} times this chapter. A single demand spike or supplier delay during those windows would have caused a full stockout. Raising your safety stock target is the insurance premium against that scenario.`,
                type: 'warn',
            };
        }

        if (totalProfit > 200000) {
            return {
                icon: '✦',
                headline: 'Strong chapter — cost discipline paid off',
                detail: `${fmt(totalProfit)} net profit across ${turns.length} quarters. Your ordering, shipping, and quality decisions stayed efficient. This is what it looks like when inventory strategy aligns with real demand.`,
                type: 'good',
            };
        }

        return null;
    }

    /**
     * Silently saves the current engine state to the server, tied to the player's
     * captured email. Fire-and-forget — never blocks the game loop.
     * @param {boolean} [sendEmail=false] - send a confirmation email to the player
     */
    _autoSave(sendEmail = false) {
        const email = SaveProgressModal.getCapturedEmail();
        if (!email) return;

        const s = this.engine?.state;
        if (!s?.industry) return;

        const gameState = {
            industryId:         s.industry.id,
            chapterIndex:       s.chapterIndex,
            cash:               s.cash,
            inventory:          s.inventory,
            backlog:            s.backlog,
            inTransit:          s.inTransit,
            turn:               s.turn,
            maxTurns:           s.maxTurns,
            modifiers:          s.modifiers,
            archetypeModifiers: s.archetypeModifiers,
            procurementChoices: s.procurementChoices,
            startingArchetype:  s.startingArchetype,
            shuffledScenarios:  s.shuffledScenarios,
            history:            s.history,
            worldMemory:        s.worldMemory,
            boardConfidence:    s.boardConfidence,
            activeContract:     s.activeContract,
            activeRoute:        s.activeRoute,
            careerRankIndex:    s.careerRankIndex,
        };

        fetch('/api/save-game', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body:    JSON.stringify({ email, gameState, sendEmail }),
        }).catch(() => { /* fail silently */ });
    }

    renderChapterSummary() {
        const prevChapterIdx = this.engine.state.chapterIndex;
        const allChapters = [...CHAPTERS, ...EXPANSION_CHAPTERS];
        const summary = this.engine.mastery.getChapterSummary(
            allChapters[prevChapterIdx].id
        );

        // Auto-save progress to server at every chapter boundary
        this._autoSave();

        // Concept-named achievements (chapter-level)
        const chNumber = allChapters[prevChapterIdx].number;
        showAchievementToasts(checkChapterAchievements(
            this.engine.state.history.filter(h => h.chapter === chNumber)
        ));

        // Career review — rank tracks progress, nudged by board confidence
        const prevRank = this.engine.state.careerRankIndex ?? 0;
        const nextRank = evaluateCareer(prevChapterIdx + 1, this.engine.state.boardConfidence).rankIndex;
        const review = careerReview(prevRank, nextRank,
            CSCP_DEFINITIONS[allChapters[prevChapterIdx].id]?.domainFull || '');
        this.engine.state.careerRankIndex = nextRank;
        if (review) renderRankChip(document.querySelector('.hud-right'), nextRank);

        // All chapters are free — advance directly (through the career notice).
        const continueCallback = () => {
            const advance = () => { this.engine.advanceFromChapterSummary(); this.renderGameState(); };
            showCareerNotice(review, advance);
        };

        // Gate: show email capture after Chapter 2 if not yet captured.
        const industry = this.engine.state.industry?.id || 'electronics';
        console.log('[SaveProgress] prevChapterIdx:', prevChapterIdx, '| isCaptured:', SaveProgressModal.isCaptured());
        const gatedCallback = (prevChapterIdx === 1 && !SaveProgressModal.isCaptured())
            ? () => this.saveProgressModal.show({ chapter: 2, industry }, continueCallback)
            : continueCallback;

        // Wrap gatedCallback with the CSCP definition card.
        // Flow: ChapterTransition → DefinitionCard → gatedCallback (email / paywall / continue)
        const chapterId = allChapters[prevChapterIdx]?.id;
        const chapterNum = allChapters[prevChapterIdx]?.number;
        const playerDiagnosis = this._computePlayerDiagnosis(chapterNum);
        const withDefinition = () => this.definitionCard.show(chapterId, gatedCallback, playerDiagnosis);

        this.chapterTransition.show(prevChapterIdx, summary, { engineState: this.engine.state }, withDefinition);

        // Show waiting state in main view
        this.ui.mainView.innerHTML = `
            <div class="chapter-waiting glass-panel" style="text-align: center; padding: 3rem;">
                <div style="color: var(--success-color); margin-bottom: 1rem;">${getIcon('checkmark', 48)}</div>
                <h2>Chapter Complete</h2>
                <p style="color: var(--text-muted)">Review your performance</p>
            </div>
        `;
        this.ui.actionPanel.style.display = 'none';
    }

    updateMetrics() {
        const s = this.engine.state;
        const fmtMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
        const fmtNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
        const fmtCompact = (n) => {
            if (Math.abs(n) >= 1000) return (n / 1000).toFixed(1) + 'K';
            return String(Math.round(n));
        };

        this.ui.turnDisplay.textContent = s.turn;

        // Use animated counters if available
        if (this.counters.cash) {
            const cashDelta = this.counters.cash.set(s.cash);
            if (cashDelta !== 0) {
                showTrendBadge(
                    this.ui.cashDisplay.closest('.metric-card'),
                    cashDelta,
                    (d) => '$' + fmtCompact(d)
                );
            }
        } else {
            this.ui.cashDisplay.textContent = fmtMoney(s.cash);
        }

        if (this.counters.inventory) {
            const invDelta = this.counters.inventory.set(s.inventory);
            if (invDelta !== 0) {
                showTrendBadge(
                    this.ui.inventoryDisplay.closest('.metric-card'),
                    invDelta,
                    fmtCompact
                );
            }
        } else {
            this.ui.inventoryDisplay.textContent = fmtNum(s.inventory);
        }

        const transitUnits = s.inTransit.reduce((sum, o) => sum + o.usableUnits + o.passedDefects, 0);
        if (this.counters.inTransit) {
            this.counters.inTransit.set(transitUnits);
        } else {
            const el = document.getElementById('in-transit-display');
            if (el) el.textContent = fmtNum(transitUnits);
        }

        if (s.lastTurnResult) {
            if (this.counters.demand) {
                this.counters.demand.set(s.lastTurnResult.demand);
            } else {
                this.ui.demandDisplay.textContent = fmtNum(s.lastTurnResult.demand);
            }

            if (this.counters.profit) {
                const profitDelta = this.counters.profit.set(s.lastTurnResult.profit);
                if (profitDelta !== 0) {
                    showTrendBadge(
                        this.ui.profitDisplay.closest('.metric-card'),
                        profitDelta,
                        (d) => '$' + fmtCompact(d)
                    );
                }
            } else {
                this.ui.profitDisplay.textContent = fmtMoney(s.lastTurnResult.profit);
            }
        }

        // Threshold-based sensory feedback + ambient state after each completed turn
        this._applyOutcomeFeedback(s);
        this._updateAmbientState(s);

        // Sparklines — last 5 turns of cash, inventory & demand
        if (s.history.length >= 2) {
            const recent = s.history.slice(-5);
            updateCardSparkline(
                document.querySelector('.metric-card[data-metric="cash"]'),
                recent.map(h => h.cash),
                '#3b82f6'
            );
            updateCardSparkline(
                document.querySelector('.metric-card[data-metric="inventory"]'),
                recent.map(h => h.inventory),
                '#f59e0b'
            );
            updateCardSparkline(
                document.querySelector('.metric-card[data-metric="demand"]'),
                recent.map(h => h.demand),
                '#10b981'
            );
        }
    }

    endGame() {
        const summaries = this.engine.mastery.getAllSummaries();
        const overall   = this.engine.mastery.getOverallScore();
        const cash      = this.engine.state.cash;
        const history   = this.engine.state.history;

        const showMainResults = () => {
            const isPremium   = PremiumManager.isPremium();
            const industry    = this.engine.state.industry;
            const isExpansion = true; // all chapters always available

            // Build the debrief callback once so the closure captures the right state
            const openDebrief = () => {
                this.debriefScreen.show({
                    overall,
                    summaries,
                    cash,
                    industry,
                    isExpansion,
                    isPremium,
                });
            };

            this.gameOverScreen.show({
                cash,
                overall,
                summaries,
                industry,
                isExpansion,
                onDebrief: openDebrief,
            });
        };

        const showResults = () => {
            if (this.terminationScreen.shouldShow({ cash, overall, summaries, history })) {
                this.terminationScreen.show({ cash, overall, summaries, history }, showMainResults);
            } else {
                showMainResults();
            }
        };

        // Auto-save final state at game completion
        this._autoSave();

        // Secondary trigger: capture email at game-end if not yet collected.
        // High-emotion moment — player wants their certificate / guide.
        if (!SaveProgressModal.isCaptured()) {
            const industry = this.engine.state.industry?.id || 'electronics';
            const chapter  = this.engine.state.chapterIndex + 1;
            this.saveProgressModal.show({ chapter, industry }, showResults);
        } else {
            showResults();
        }
    }

    _showEndlessDeath() {
        const s = this.engine.state;
        const isWeekly = this._gameMode === 'weekly';
        const weeklyScore = s.endlessScore;
        this.endlessDeathScreen.show({
            cause:        s.endlessDeathCause,
            wave:         s.endlessWave,
            turns:        s.endlessTurn,
            score:        s.endlessScore,
            cash:         s.cash,
            satisfaction: s.endlessSatisfaction,
            industryId:   s.industry?.id || 'electronics',
            onLeaderboard: isWeekly ? () => {
                promptScoreSubmit({
                    weekId: this._weekly.weekId,
                    score: weeklyScore,
                    industryId: this._weekly.industryId,
                });
            } : null,
            onRestart: () => {
                this.startGame(0, isWeekly ? 'weekly' : 'endless');
            },
            onMenu: () => {
                // Reset to landing page
                this.ui.dashboard.classList.add('hidden');
                this.ui.startScreen.classList.remove('hidden');
                CrisisTicker.hide();
            },
        });

        // Show idle state in main view while overlay is up
        this.ui.mainView.innerHTML = `
            <div class="chapter-waiting glass-panel" style="text-align:center;padding:3rem;">
                <div style="font-size:3rem;margin-bottom:1rem;">💀</div>
                <h2>Run Ended</h2>
                <p style="color:var(--text-muted)">Wave ${s.endlessWave} · ${s.endlessTurn} turns</p>
            </div>`;
        this.ui.actionPanel.style.display = 'none';
    }

    /**
     * Derive a Risk Category tag for a story option button.
     * Uses a priority cascade over modifiers + conceptAlignment.
     *
     * Returns { label: string, accent: hex string }
     *
     * Categories:
     *   Financial Risk   — high cost multiplier or over-spending
     *   Operational Risk — lead time delays, execution challenges
     *   Market Risk      — customer satisfaction / demand exposure
     *   Inventory Risk   — lean/under-order → stockout exposure
     *   Supply Risk      — moderate lead time, upstream dependency
     *   Low Risk         — optimal, balanced, data-driven choices
     *   Strategic Risk   — calculated tradeoff, no dominant signal
     */
    _deriveRiskCategory(opt) {
        const m            = opt.modifiers || {};
        const leadTime     = m.leadTime           ?? 0;
        const unitCost     = m.unitCost            ?? 1.0;
        const satisfaction = m.customerSatisfaction ?? 0;
        const alignment    = opt.conceptAlignment;

        if (unitCost >= 1.25)       return { label: 'Financial Risk',   accent: '#ef4444' };
        if (leadTime >= 2)          return { label: 'Operational Risk', accent: '#f97316' };
        if (satisfaction <= -10)    return { label: 'Market Risk',      accent: '#a855f7' };
        if (unitCost < 0.92)        return { label: 'Inventory Risk',   accent: '#f59e0b' };
        if (leadTime > 0)           return { label: 'Supply Risk',      accent: '#f97316' };
        if (satisfaction < 0)       return { label: 'Market Risk',      accent: '#a855f7' };
        if (alignment === 'optimal') return { label: 'Low Risk',        accent: '#22c55e' };
        if (alignment === 'cautious') return { label: 'Financial Risk', accent: '#ef4444' };
        return                             { label: 'Strategic Risk',   accent: '#3b82f6' };
    }

    /**
     * Derive a per-node status map from current engine state.
     * Returns { nodeId: 'ok' | 'warning' | 'critical' | 'disrupted' | 'normal' | 'inactive' }
     *
     * Rules:
     *   inactive  — node not in current chapter's activeNodes
     *   disrupted — node has a broken upstream link (flowDiagram.disruptedLinks)
     *   critical  — severe threshold breach
     *   warning   — degraded but not severe
     *   ok        — healthy
     *   normal    — active, no data yet
     */
    _deriveNodeStatuses() {
        const s           = this.engine.state;
        const activeNodes = s.currentChapter?.activeNodes || [];
        const allNodeIds  = ['supplier', 'factory', 'warehouse', 'truck', 'store'];
        const statuses    = {};
        const lastResult  = s.lastTurnResult;
        const industry    = s.industry;
        const startCash   = industry?.startingCash || 500000;

        // Default: inactive or normal
        allNodeIds.forEach(id => {
            statuses[id] = activeNodes.includes(id) ? 'normal' : 'inactive';
        });

        // No turn results yet — keep everything 'normal'
        if (!lastResult) return statuses;

        // ── Warehouse: inventory-to-demand ratio ────────────────────────────
        if (activeNodes.includes('warehouse')) {
            const demand    = lastResult.demand || 1000;
            const inv       = s.inventory;
            const ratio     = inv / demand;

            if (ratio < 0.1)      statuses.warehouse = 'critical';   // near stockout
            else if (ratio < 0.4) statuses.warehouse = 'warning';    // low stock
            else if (ratio > 3.5) statuses.warehouse = 'warning';    // overstock
            else                  statuses.warehouse = 'ok';
        }

        // ── Factory: cash health ─────────────────────────────────────────────
        if (activeNodes.includes('factory')) {
            const cashRatio = s.cash / startCash;

            if (cashRatio < 0.1)       statuses.factory = 'critical';
            else if (cashRatio < 0.25) statuses.factory = 'warning';
            else if (lastResult.profit > 0) statuses.factory = 'ok';
        }

        // ── Supplier: disruption + lead-time modifier ────────────────────────
        if (activeNodes.includes('supplier')) {
            const supplierDisrupted = this.flowDiagram?.disruptedLinks?.some(
                l => l.startsWith('supplier')
            );
            if (supplierDisrupted) {
                statuses.supplier = 'disrupted';
            } else {
                const leadMod = s.modifiers?.leadTime ?? 0;
                if (leadMod >= 4)      statuses.supplier = 'warning';
                else if (leadMod >= 2) statuses.supplier = 'warning';
                else                   statuses.supplier = 'ok';
            }
        }

        // ── Transport: disruption check ──────────────────────────────────────
        if (activeNodes.includes('truck')) {
            const truckDisrupted = this.flowDiagram?.disruptedLinks?.some(
                l => l.includes('truck') || l === 'warehouse-truck'
            );
            if (truckDisrupted) statuses.truck = 'disrupted';
            else                statuses.truck = 'ok';
        }

        // ── Store: demand fill rate ──────────────────────────────────────────
        if (activeNodes.includes('store')) {
            const demand    = lastResult.demand || 1;
            const fulfilled = Math.min(demand, s.inventory + demand);  // approx
            const fillRate  = lastResult.profit < 0 ? 0.4 : (s.inventory < demand * 0.15 ? 0.6 : 1);

            if (fillRate < 0.5)      statuses.store = 'critical';
            else if (fillRate < 0.85) statuses.store = 'warning';
            else                      statuses.store = 'ok';
        }

        return statuses;
    }
}
