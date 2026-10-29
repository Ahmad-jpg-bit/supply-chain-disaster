import { GameEngine, GAME_PHASES } from './logic/engine.js';
import { INDUSTRIES } from './logic/industries.js';
import { Analytics } from './logic/analytics.js';
import { CHAPTERS } from './data/chapters.js';
import { EXPANSION_CHAPTERS } from './data/expansion-chapters.js';
import { SUPPLIERS, SHIPPING_METHODS, PRICING_STRATEGIES, QUALITY_INSPECTIONS } from './data/procurement-options.js';
import { ConceptCard } from './ui/concept-card.js';
import { ChapterTransition } from './ui/chapter-transition.js';
import { SupplyChainFlow } from './graphics/supply-chain-flow.js';
import { getIcon, iconify } from './graphics/svg-icons.js';
import { PregamePage } from './ui/pregame-page.js';
import { track } from './shared/track.js';
import { buildSnapshot, restoreSnapshot, SAVEABLE_PHASES, PACKAGING_VERSION, LOCAL_SAVE_KEY } from './logic/save-game.js';
import * as RS from './logic/run-store.js';
import * as CS from './logic/cloud-sync.js';
import { SavePanel, showCloudPrompt, showConflict, showTabLock } from './ui/save-panel.js';
import { Entitlements } from './logic/entitlements.js';
import { FEATURE, FREE_INTRO, CORE_CATALOG } from './data/packages.js';
import { describeSave } from './logic/pregame-state.js';
import { IntroComplete } from './ui/intro-complete.js';
import { AnimatedCounter, showTrendBadge } from './ui/animated-counter.js';
import { GameOverScreen } from './ui/game-over-screen.js';
import { TerminationScreen } from './ui/termination-screen.js';
import { Paywall } from './ui/paywall.js';
import { PremiumManager } from './logic/premium.js';
import { markNavPremium, setNavMinimal } from './shared/nav.js';
import { updateCardSparkline } from './ui/sparkline.js';
import { CrisisTicker } from './ui/crisis-ticker.js';
import { AudioHapticManager } from './ui/audio-haptic.js';
import { buildConsequenceData, showConsequenceOverlay } from './ui/consequence-overlay.js';
import { STARTING_ARCHETYPES } from './logic/crisis-engine.js';
import { EndlessDeathScreen } from './ui/endless-death-screen.js';
import { DefinitionCard } from './ui/definition-card.js';
import { TurnSummaryCard } from './ui/turn-summary-card.js';
import { PredictionPrompt } from './ui/prediction-prompt.js';
import { BoardQuestion } from './ui/board-question.js';
import { RECALL_QUESTIONS } from './data/recall-questions.js';
import { getConceptInsight } from './logic/concept-insights.js';
import { computeProjection } from './ui/planning-workbench.js';
import { buildWorkspaceHTML, renderShipmentsHTML, renderProjectionRowsHTML, pickWarning, describeModifiers, turnGoal, turnNote, choicesSummary, fmtMoney, fmtMoney2, fmtNum } from './ui/procurement-workspace.js';
import { readGuide, writeGuide, isReturningPlayer, shouldAutoStart, currentStep, startGuide, nextGuide, skipGuide, finishGuide } from './logic/guide-state.js';
import { coachHTML, guideContent } from './ui/guide-coach.js';
import { openHelpDialog } from './ui/help-dialog.js';
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
import * as CM from './logic/community.js';
import { ReviewDialog, mountReviewPrompt } from './ui/review-form.js';

export class Dashboard {
    constructor(particleNetwork) {
        this.engine = new GameEngine();
        this.analytics = new Analytics(this.engine);
        this.selectedIndustryId = null;
        this.runId = null;                 // the story campaign's run (logic/run-store.js)
        this._tabId = RS.newId('tab');     // this tab, for multi-tab coordination
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
        this.endlessDeathScreen = new EndlessDeathScreen();
        this.turnSummaryCard    = new TurnSummaryCard();
        this.debriefScreen      = null; // lazy — pulls in jsPDF, loaded on first open
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
                On a new device, choose <strong>Core Game Pass → Restore a purchase</strong> and enter your purchase email.
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

    /** Show the HUD Unlock button only to non-premium players. */
    _syncUnlockButton() {
        const btn = document.getElementById('hud-unlock-btn');
        if (btn) btn.hidden = Entitlements.ownsCore();
    }

    /** Access changed (purchase confirmed, restore, promo, refund) — refresh access-dependent UI. */
    _onAccessChanged() {
        if (PremiumManager.isPremium()) markNavPremium();
        this._syncUnlockButton();
        this.renderChapterProgress();
    }

    /**
     * May this game start? Fresh campaigns need access to their starting
     * chapter; resumed saves started before the current packaging are
     * grandfathered; Endless and the weekly challenge need their features.
     * Opens the Core offer (and returns false) when access is missing.
     */
    _mayStart(startChapterIndex, mode, statePatches, savedGame, runMeta = null) {
        let ok;
        if (mode === 'weekly') ok = Entitlements.has(FEATURE.WEEKLY);
        else if (mode === 'endless') ok = Entitlements.has(FEATURE.ENDLESS);
        else if (savedGame || statePatches) {
            const chapterNumber = savedGame
                ? (describeSave({ gameState: savedGame }, [...CHAPTERS, ...EXPANSION_CHAPTERS])?.nextChapter?.number ?? 1)
                : startChapterIndex + 1;
            // Pre-packaging runs are recognised by the grant recorded once at migration —
            // editing flags inside a snapshot changes nothing
            ok = Boolean(runMeta?.legacyGrant) || Entitlements.canPlay(this.selectedIndustryId, chapterNumber);
        } else {
            ok = Entitlements.canPlay(this.selectedIndustryId, startChapterIndex + 1);
        }
        if (!ok) {
            track('paid_offer_open', { source: `locked_${mode}` });
            this.paywall.show(() => this._onAccessChanged(), null, { source: `locked_${mode}` });
        }
        return ok;
    }

    /** Can the current campaign continue into chapter `n`? */
    _canContinueTo(n) {
        const s = this.engine.state;
        return Boolean(this._runGrant()) || Entitlements.canPlay(s.industry?.id, n);
    }

    /** Pre-packaging grant recorded on the current run (see run-store migration), or null. */
    _runGrant() {
        return this.runId ? RS.getMeta(this.runId)?.legacyGrant || null : null;
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

    init() {
        // Update nav if already premium
        if (PremiumManager.isPremium()) markNavPremium();

        // Listen for nav upgrade button click
        document.addEventListener('scd:open-paywall', (e) => {
            track('paid_offer_open', { source: e.detail?.source || 'game' });
            this.paywall.show(() => this._onAccessChanged(), null, { source: e.detail?.source || 'game' });
        });
        Entitlements.onChange(() => this._onAccessChanged());
        // Re-validate cached access (refunds/expiry) and finish any checkout whose
        // confirmation arrived after the player left the return page.
        Entitlements.refresh();
        if (Entitlements.pendingClaim()) {
            Entitlements.checkClaim().then(r => { if (r.state === 'active' || r.state === 'not_active') Entitlements.clearClaim(); });
        }
        // Save & progress: status, Save now, cloud saves (never blocks play)
        this.savePanel = new SavePanel({
            currentRunId: () => (this._gameMode === 'story' ? this.runId : null),
            onSaveNow: () => this._saveLocal('manual'),
        });
        document.getElementById('hud-save-btn')?.addEventListener('click', () => this.savePanel.open({ source: 'hud' }));
        // Ratings & reviews (entry point on /play, prompts after milestones)
        this.reviewDialog = new ReviewDialog({
            savePanel: this.savePanel,
            currentRunId: () => (this._gameMode === 'story' ? this.runId : null),
            onChange: () => this._pregame?.reviews?.reload(),
        });
        CM.applyStatsParam();   // ?stats=off|on — exclude this browser's play from public counts
        // Flush pending local changes when the page is hidden (pagehide as a backstop)
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') this._saveLocal('hidden'); });
        window.addEventListener('pagehide', () => { this._saveLocal('hidden'); if (this.runId) RS.releaseRun(this.runId, this._tabId); });
        window.addEventListener('pageshow', (e) => { if (e.persisted && this.runId && !this._standingDown) RS.claimRun(this.runId, this._tabId); });
        // Leaving for checkout through our own controls: save, and come back to this run
        document.addEventListener('scd:before-checkout', () => {
            if (this._saveLocal('navigate') && this.runId) { try { localStorage.setItem('scd_resume_intent', this.runId); } catch { /* ignore */ } }
        });
        CS.setTabId(this._tabId);
        CS.start();
        CS.onChange((runId) => {
            if (runId && runId !== this.runId) return;
            this._renderSaveStatus();
            const m = this.runId ? RS.getMeta(this.runId) : null;
            if (m?.conflict && !this._conflictShown) {
                this._conflictShown = true;
                showConflict(this.runId, (choice) => { this._conflictShown = false; if (choice === 'cloud') this._reloadRun(this.runId); });
            }
        });
        // Another tab took over this campaign → stop saving here instead of overwriting
        RS.runsChannel?.addEventListener('message', (e) => {
            const d = e.data || {};
            if (!this.runId || d.runId !== this.runId || this._standingDown) return;
            if ((d.type === 'claimed' && d.tabId !== this._tabId) || (d.type === 'written' && d.localRev > (this._tabRev ?? 0))) this._standDown();
        });
        // Heartbeat: keep this tab's claim fresh so a crashed/frozen tab stops blocking others within ~90 s
        setInterval(() => this._heartbeat(), RS.HEARTBEAT_MS);
        document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') this._heartbeat(); });
        // Same signal through the storage event (fires in other tabs on every claim)
        window.addEventListener('storage', (e) => {
            if (!this.runId || this._standingDown || e.key !== `scd_run_lock:${this.runId}` || !e.newValue) return;
            try { if (JSON.parse(e.newValue).tabId !== this._tabId) this._standDown(); } catch { /* ignore */ }
        });

        // In-game header stand-in for the (hidden) nav upgrade button
        document.getElementById('hud-unlock-btn')?.addEventListener('click', () => {
            document.dispatchEvent(new CustomEvent('scd:open-paywall', { detail: { source: 'hud' } }));
        });

        // Help: how a turn works, plain-language glossary, guided-start controls
        document.getElementById('hud-help-btn')?.addEventListener('click', (e) => openHelpDialog({
            mode: this._gameMode,
            guideActive: this._guide?.status === 'active',
            onReplay: () => this._replayGuide(),
            onStop: () => this._stopGuide(),
            returnFocus: e.currentTarget,
        }));
        // "Explain" disclosures anywhere in the game (buttons built by explainHTML)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest?.('.gx-btn');
            const panel = btn && document.getElementById(btn.getAttribute('aria-controls'));
            if (!panel) return;
            const open = btn.getAttribute('aria-expanded') !== 'true';
            btn.setAttribute('aria-expanded', String(open));
            btn.textContent = open ? 'Hide' : 'Explain';
            panel.hidden = !open;
            if (open) this._guideTrack('guide_explain_open', { term: btn.dataset.explain }, btn.dataset.explain);
        });
        // State strip: secondary metrics behind "More details"
        document.getElementById('metrics-more')?.addEventListener('click', () => {
            this._metricsOpen = !this._metricsOpen;
            this._updateMetricSubs(this.engine.state);
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
            track('paid_offer_open', { source: 'upgrade_param' });
            this.paywall.show(() => this._onAccessChanged(), null, { source: 'upgrade_param' });
        }

        // Owner dev bypass: ?dev=nxt2026&chapter=N&industry=electronics|fmcg|pharma
        // Unlocks all chapters and jumps directly to the specified chapter.
        const _devParams = new URLSearchParams(window.location.search);
        if (import.meta.env.DEV && _devParams.get('dev') === 'nxt2026') {
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

        // Mount the pre-game page (what the game is, industry choice, resume)
        // ?start=1 (homepage CTAs) jumps straight to the industry picker on small screens
        // (used by all homepage CTAs — direct /play navigation preserves the full landing page)
        const _skipHero = new URLSearchParams(window.location.search).get('start') === '1';
        // Homepage industry cards link here with ?industry=… — preselect it (no game starts)
        const _preselect = new URLSearchParams(window.location.search).get('industry');
        if (_skipHero) window.history.replaceState({}, '', window.location.pathname);
        this._pregame = new PregamePage(this.ui.startScreen, (industryId, startChapterIndex = 0, mode = 'story', statePatches = null, savedGame = null, opts = {}) => {
            this.selectedIndustryId = industryId;
            this.startGame(startChapterIndex, mode, statePatches, savedGame, opts);
        }, { skipHero: _skipHero, savePanel: this.savePanel, reviewDialog: this.reviewDialog, preselect: _preselect });

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

    async renderCharts() {
        if (!this.analytics) return;
        const Chart = await this._getChart();

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

    /**
     * @param {number} startChapterIndex
     * @param {'story'|'endless'|'weekly'} mode
     * @param {Object|null} _statePatches — chapter-boundary state patch (legacy chapter-end saves)
     * @param {Object|null} savedGame — full v2 save (logic/save-game.js) to resume at the saved turn
     * @param {{ runId?: string }} [opts] — resume this run (otherwise a story game starts a new run)
     */
    startGame(startChapterIndex = 0, mode = 'story', _statePatches = null, savedGame = null, opts = {}) {
        const resumeMeta = opts.runId ? RS.getMeta(opts.runId) : null;
        if (!this._mayStart(startChapterIndex, mode, _statePatches, savedGame, resumeMeta)) return;
        if (this.runId) RS.releaseRun(this.runId, this._tabId);
        this._gameMode = mode;
        this.runId = null;
        this._standingDown = false;
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

        // Resume a full saved game at the exact turn it was saved
        if (savedGame && mode === 'story') {
            const ui = restoreSnapshot(this.engine, savedGame);
            if (ui.forecastStats) this._forecastStats = ui.forecastStats;
            this._askedRecallChapters = new Set(ui.askedRecallChapters || []);
            if (ui.draft) { this._draft = ui.draft; this._draftTurn = this.engine.state.turn; }
            else this._draftTurn = null;
        } else if (mode === 'story') {
            this._draftTurn = null; // fresh game: drafts start from the engine defaults
        }
        if (mode === 'story') this._attachRun(resumeMeta, Boolean(savedGame || _statePatches));
        this._initGuide(mode);

        this.ui.startScreen.classList.add('hidden');
        this.ui.dashboard.classList.remove('hidden');
        // In-game chrome: compact game header replaces the site nav
        document.body.classList.add('scd-playing');
        this._syncUnlockButton();

        // Save & progress is a campaign feature (endless/weekly runs aren't saved)
        const saveBtn = document.getElementById('hud-save-btn');
        if (saveBtn) saveBtn.hidden = mode !== 'story';
        this._renderSaveStatus();

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

        // Analytics: the game really started (distinct from a start-button click)
        this._firstTurnTracked = false;
        const startChapterNumber = mode === 'story' ? (this.engine.state.chapterIndex ?? startChapterIndex) + 1 : 0;
        track('game_start', {
            industry_id:   this.engine.state.industry?.id,
            mode,
            start_chapter: startChapterNumber,
            resumed:       Boolean(_statePatches || savedGame),
        });
        const isFreeContent = mode === 'story' && Entitlements.isFreeIntro(this.engine.state.industry?.id, startChapterNumber);
        if (!isFreeContent) {
            track('paid_campaign_open', { industry_id: this.engine.state.industry?.id, mode, start_chapter: startChapterNumber, grandfathered: Boolean(this.engine.state.grandfathered) });
        }
    }

    /* ── Saving ──────────────────────────────────────────────────────────── */

    /** Full v2 snapshot of the running campaign (logic/save-game.js). */
    _snapshot() {
        const inProcurement = this.engine.state.phase === GAME_PHASES.PROCUREMENT;
        return buildSnapshot(this.engine, {
            draft:               inProcurement && this._draftTurn === this.engine.state.turn ? this._draft : null,
            forecastStats:       this._forecastStats,
            askedRecallChapters: [...this._askedRecallChapters],
        });
    }

    /**
     * Bind the story game to a run: resume the given one or create a new run.
     * The pre-packaging grant lives on the run record (set once by migration).
     */
    _attachRun(resumeMeta, resumed) {
        const s = this.engine.state;
        if (resumeMeta) {
            this.runId = resumeMeta.runId;
            this._tabRev = resumeMeta.localRev;
            track('resume_succeeded', { run_id: this.runId, industry_id: s.industry?.id, chapter: (s.chapterIndex ?? 0) + 1, turn: s.turn, phase: s.phase, snapshot_version: resumeMeta.format === 'v1-chapter-end' ? 1 : 2, cloud: resumeMeta.cloud ? 'verified' : 'device' });
        } else {
            const session = CS.getSession();
            const meta = RS.createRun({
                industryId: s.industry.id,
                owner: session.signedIn ? session.owner : 'guest',
                extra: { contentVersion: CORE_CATALOG.version },
            });
            this.runId = meta?.runId || null;
            this._tabRev = meta ? 0 : undefined;
            if (meta) track('run_started', { run_id: meta.runId, industry_id: s.industry.id, mode: 'story', start_chapter: (s.chapterIndex ?? 0) + 1, cloud: meta.cloud ? 'verified' : 'device' });
        }
        s.packagingVersion = PACKAGING_VERSION;
        s.grandfathered = Boolean(this._runGrant());   // kept in saves for compatibility; never read for access
        this._localSaveError = this.runId ? null : 'blocked';
        if (this.runId) RS.claimRun(this.runId, this._tabId);
        this._saveLocal(resumed ? 'resume' : 'run_created');
    }

    /**
     * Save the campaign's run in this browser — at run creation, committed
     * choices, resolved quarters, phase changes, debounced draft edits, before
     * checkout and when the page is hidden. Never reports "saved" unless the
     * write succeeded; cloud sync is queued separately and never blocks play.
     * @param {string} trigger
     * @returns {boolean} true if saved
     */
    _saveLocal(trigger = 'phase') {
        const s = this.engine.state;
        if (this._gameMode !== 'story' || !s.industry || !SAVEABLE_PHASES.includes(s.phase) || this._standingDown) return false;
        if (!this.runId) { this._localSaveError = 'blocked'; this._renderSaveStatus(); return false; }
        // Ownership is checked before every write (backstop for missed tab messages,
        // and for a suspended tab waking after another tab took over — even if that claim is now stale)
        const lock = RS.rawLock(this.runId);
        if (lock && lock.tabId !== this._tabId) { this._standDown(); return false; }
        const checkpoint = trigger === 'turn' || (trigger === 'phase' && s.phase === GAME_PHASES.CHAPTER_SUMMARY);
        const res = RS.saveRun(this.runId, this._snapshot(), { tabRev: this._tabRev, checkpoint });
        if (res.ok) {
            this._tabRev = res.meta.localRev;
            this._localSaveError = null;
            CS.schedule(this.runId, trigger === 'draft' ? 'draft' : 'urgent');
        } else if (res.reason === 'stale_tab') {
            this._standDown();
            return false;
        } else {
            this._localSaveError = res.reason;
            RS.updateMeta(this.runId, { localError: res.reason });
            track('local_save_failed', { reason: res.reason, trigger, run_id: this.runId }, `lsf:${res.reason}`);
        }
        this._renderSaveStatus();
        return res.ok;
    }

    /** Debounced local save while the player edits procurement decisions. */
    _scheduleDraftSave() {
        clearTimeout(this._draftSaveTimer);
        this._draftSaveTimer = setTimeout(() => this._saveLocal('draft'), 800);
    }

    /** Header status: separate device and cloud states, from the run record. */
    _renderSaveStatus() {
        const el = document.getElementById('hud-save-status');
        if (!el) return;
        if (this._gameMode !== 'story') { el.textContent = ''; return; }
        const meta = this.runId ? RS.getMeta(this.runId) : null;
        const st = CS.statusFor(meta ? { ...meta, localError: this._localSaveError || null } : { localError: this._localSaveError, localRev: 0 });
        const short = st.local === 'failed' ? 'Not saved on this device'
            : ({ syncing: 'Syncing…', synced: 'Saved · synced', pending: 'Saved · sync pending', signin: 'Saved · sign in to sync', conflict: 'Saved · choose a version', deleted: 'Saved on this device', unavailable: 'Saved · cloud paused' }[st.cloud]
               || (st.local === 'saved' ? 'Saved on this device' : ''));
        el.textContent = short;
        el.title = st.text;
        el.dataset.state = st.local === 'failed' ? 'failed' : st.cloud;
    }

    /** Refresh this tab's claim on its run; stand down if another tab has taken it. */
    _heartbeat() {
        if (!this.runId || this._standingDown || this._gameMode !== 'story') return;
        if (!RS.touchRun(this.runId, this._tabId)) this._standDown();
    }

    /**
     * Another tab is playing this run: stop saving here (no silent overwrite).
     * If this tab holds progress the stored save doesn't have (e.g. it was
     * suspended and the player kept going here), offer to keep it as a copy.
     */
    _standDown() {
        if (this._standingDown) return;
        this._standingDown = true;
        clearTimeout(this._draftSaveTimer);
        const runId = this.runId;
        let unsaved = null;
        try {
            const mine = this._snapshot();
            const stored = RS.loadRun(runId);
            if (!stored.error && JSON.stringify(stored.snapshot) !== JSON.stringify(mine)) unsaved = mine;
        } catch { /* nothing to offer */ }
        showTabLock({
            onTakeOver: () => this._reloadRun(runId),
            onKeepCopy: unsaved ? () => {
                const m = RS.getMeta(runId);
                const copy = RS.createRun({ industryId: unsaved.industryId, owner: 'guest', extra: { copyOf: runId, copyLabel: 'tab', legacyGrant: m?.legacyGrant || null } });
                if (copy && RS.replaceRun(copy.runId, unsaved, { localRev: 1 }).ok) { track('save_copy_kept', { source: 'tab' }); return true; }
                return false;
            } : null,
        });
    }

    /** Re-open a run from its latest saved state (after another tab or a conflict choice). */
    _reloadRun(runId) {
        const loaded = RS.loadRun(runId);
        if (loaded.error) { window.location.href = '/play'; return; }
        this.selectedIndustryId = loaded.snapshot.industryId;
        this.startGame(loaded.snapshot.chapterIndex ?? 0, 'story', null, loaded.snapshot, { runId });
    }

    /** Opaque, de-duplicated progress events (a reload never re-sends them). */
    _progressEvent(name, key, params = {}) {
        if (!this.runId || this._gameMode !== 'story') return;
        if (!RS.markOnce(this.runId, key)) return;
        const s = this.engine.state;
        const session = CS.getSession();
        track(name, { run_id: this.runId, industry_id: s.industry?.id, mode: 'story', cloud: session.signedIn ? 'verified' : 'device', access: Entitlements.ownsCore() ? 'core' : (this._runGrant() ? 'pre_packaging' : 'free'), ...params });
    }

    /* ── Guided start (logic/guide-state.js, ui/guide-coach.js) ─────────── */

    /** At game start: should this player get the automatic guided start? */
    _initGuide(mode) {
        const s = this.engine.state;
        let g = readGuide();
        this._guideRun = 'none';   // this game's guide state, reported on first_turn_complete
        if (g.status === 'active' && !g.replay && s.history.length > 0) g = writeGuide(finishGuide());
        if (g.status === 'unseen') {
            let skippedIntros = false;
            let legacySave = false;
            try {
                skippedIntros = JSON.parse(localStorage.getItem('scd_skipped_intros') || '[]').length > 0;
                legacySave = Boolean(localStorage.getItem(LOCAL_SAVE_KEY));
            } catch { /* storage blocked: treat as new */ }
            const returning = isReturningPlayer({ metas: RS.allMetas(), currentRunId: this.runId, skippedIntros, legacySave });
            if (shouldAutoStart({ mode, historyLength: s.history.length, guide: g, returning })) {
                g = writeGuide(startGuide(false));
                this._guideTrack('guide_started', { trigger: 'auto' });
            }
        }
        if (g.status === 'active' && (mode === 'story' || g.replay)) this._guideRun = 'guided';
        this._guide = g;
    }

    /** Non-personal guide analytics: industry, mode, chapter, phase. */
    _guideTrack(name, params = {}, onceKey) {
        const s = this.engine.state;
        track(name, {
            industry_id: s.industry?.id,
            mode: this._gameMode,
            chapter: s.isEndless ? 0 : (s.chapterIndex ?? 0) + 1,
            phase: String(s.phase || '').replace('PHASE_', '').toLowerCase(),
            ...(this._gameMode === 'story' && this.runId ? { run_id: this.runId } : {}),
            ...params,
        }, onceKey);
    }

    _guideStep() {
        const s = this.engine.state;
        // Endless / weekly: only a guide the player replayed from Help
        if (this._gameMode !== 'story' && !this._guide?.replay) return null;
        const step = currentStep(this._guide, s.phase, s.history.length);
        if (step && step.index !== this._guide.step) this._guide = writeGuide({ ...this._guide, step: step.index });
        return step;
    }

    _guideContentFor(step) {
        const ctx = this.engine.state.phase === GAME_PHASES.PROCUREMENT && this._guideCtx ? this._guideCtx : { state: this.engine.state };
        return guideContent(step.id, ctx);
    }

    /** Place (or remove) the inline tip for the current phase. Never blocks play. */
    _renderGuide() {
        document.getElementById('gc-coach')?.remove();
        document.querySelectorAll('.gc-target').forEach(el => el.classList.remove('gc-target'));
        const step = this._guideStep();
        const content = step && this._guideContentFor(step);
        const anchor = content && document.querySelector(content.anchor);
        if (!anchor) return;
        anchor.insertAdjacentHTML(content.where, coachHTML(step, content));
        document.querySelectorAll(content.highlight).forEach(el => el.classList.add('gc-target'));
        const coach = document.getElementById('gc-coach');
        coach.querySelector('[data-gc="next"]').addEventListener('click', () => this._guideNext(step));
        coach.querySelector('[data-gc="skip"]').addEventListener('click', () => this._guideSkip(step));
        if (this._guideFocus) {
            this._guideFocus = false;
            coach.querySelector('.gc-title').focus();
        }
    }

    /** Keep live numbers in the current tip in step with the decision draft. */
    _refreshGuideText() {
        const coach = document.getElementById('gc-coach');
        if (!coach) return;
        const step = this._guideStep();
        const content = step && step.id === coach.dataset.step && this._guideContentFor(step);
        const el = coach.querySelector('#gc-text');
        if (content && el && el.innerHTML !== content.text) el.innerHTML = content.text;
    }

    _guideNext(step) {
        this._guide = writeGuide(nextGuide(this._guide, step.index));
        if (this._guide.status === 'done') {
            this._guideTrack('guide_completed', { how: 'finished', steps_seen: step.total });
            this._renderGuide();
            document.getElementById('place-order-btn')?.focus();
            return;
        }
        this._guideFocus = true;   // move focus to the next tip (now, or when its phase renders)
        this._renderGuide();
    }

    /** Focus the main control of the current phase after the guide goes away. */
    _focusPhaseControl() {
        const el = this.engine.state.phase === GAME_PHASES.STORY
            ? this.ui.mainView.querySelector('.story-option-btn')
            : document.getElementById('order-input');
        el?.focus();
    }

    _guideSkip(step) {
        this._guide = writeGuide(skipGuide());
        this._guideRun = 'skipped';
        this._guideFocus = false;
        this._guideTrack('guide_skipped', { step_id: step.id, step_index: step.index + 1 });
        this._renderGuide();
        this._focusPhaseControl();
    }

    /** Help → Replay the guided start (any mode, any turn; steps follow the current phase). */
    _replayGuide() {
        this._guide = writeGuide(startGuide(true));
        this._guideRun = 'guided';
        this._guideTrack('guide_started', { trigger: 'replay' });
        this._guideFocus = true;
        this._renderGuide();
    }

    /** Help → Stop guidance. */
    _stopGuide() {
        const step = this._guideStep();
        this._guide = writeGuide(skipGuide());
        this._guideRun = 'skipped';
        this._guideTrack('guide_skipped', { step_id: step?.id ?? 'none', step_index: (step?.index ?? -1) + 1, source: 'help' });
        this._renderGuide();
        this._focusPhaseControl();
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
     * Lazy Chart.js loader — the library (in the vendor-charts chunk) only
     * downloads the first time a chart is actually drawn, keeping it out of
     * the render-blocking path. Replaces the old synchronous CDN <script>.
     */
    async _getChart() {
        if (!this._ChartLib) {
            const mod = await import('chart.js/auto');
            this._ChartLib = mod.default;
        }
        return this._ChartLib;
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

        // Return the docked network diagram to its home band before clearing
        const flow = document.getElementById('supply-chain-flow');
        if (flow && this.ui.mainView.contains(flow)) {
            document.querySelector('.metrics-panel')?.after(flow);
        }

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
        this._saveLocal('phase');
    }

    renderChapterIntro() {
        const chapter = this.engine.state.currentChapter;
        if (chapter) this._progressEvent('chapter_started', `cs${chapter.number}`, { chapter: chapter.number });
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
                    <span class="archetype-icon">${iconify(archetype.icon, 18)}</span>
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
        this._renderGuide();

        // Consequence overlay — surfaces last turn's key financial outcome
        this._maybeShowConsequenceOverlay();
    }

    handleOptionSelect(index) {
        // 1. Capture scenario label before engine processes the decision
        const scenario = this.engine.state.currentScenario;
        const pickedOption = scenario?.options?.[index];

        // 2. Calculate result synchronously (fast, pure logic — no I/O)
        const { outcome, alignment } = this.engine.makeDecision(index);
        this._saveLocal('choice'); // the response is committed: a reload must not re-offer it

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
                        <button id="continue-btn" class="btn-primary">Next: plan this quarter's order →</button>
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

    async _initBullwhipLiveChart() {
        const canvas = document.getElementById('bullwhipLive');
        if (!canvas) return;
        const Chart = await this._getChart();
        if (!canvas.isConnected) return; // view re-rendered while the lib loaded

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

        const monoFont = { family: "'Inter', system-ui, sans-serif", size: 12 };
        const monoTicks = { color: '#94a3b8', font: monoFont };

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
                        label: 'This order (proposed)',
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
                    // Legend is rendered as HTML above the canvas (readable, wraps on narrow screens)
                    legend: { display: false },
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
                        grid: { color: 'rgba(255,255,255,0.06)' },
                        border: { display: false },
                        ticks: {
                            ...monoTicks,
                            callback: (v) => v >= 1e6 ? +(v / 1e6).toFixed(1) + 'M' : v >= 1000 ? +(v / 1000).toFixed(1) + 'k' : v
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

        // Plot the current draft quantity (the estimate may have run before Chart.js loaded)
        if (this._draft) this._updateBullwhipPreview(this._draft.orderQuantity);
    }

    _updateBullwhipPreview(qty) {
        // Text equivalent of the chart (also covers the brief moment before Chart.js loads)
        const textEl = document.getElementById('pw-chart-text');
        if (textEl) {
            const last = this.engine.state.history[this.engine.state.history.length - 1];
            textEl.textContent = last
                ? `Last quarter (Q${last.turn}): demand ${last.demand.toLocaleString()} units, you ordered ${last.orderQuantity.toLocaleString()}. Proposed order: ${qty.toLocaleString()}.`
                : `No demand history yet — the chart fills in as quarters resolve. Base demand is about 1,000 units a quarter before pricing and event effects. Proposed order: ${qty.toLocaleString()}.`;
        }

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
            ratioEl.textContent = 'Bullwhip ratio: needs 2+ quarters';
            ratioEl.className = 'bullwhip-live-ratio blr--neutral';
            return;
        }

        const r = ratio.toFixed(2);
        let cls, label;
        if (ratio > 2.5)       { cls = 'blr--danger';  label = `${r}× SEVERE`; }
        else if (ratio > 1.5)  { cls = 'blr--warning'; label = `${r}× HIGH`; }
        else if (ratio > 1.05) { cls = 'blr--caution'; label = `${r}× AMPLIFYING`; }
        else                   { cls = 'blr--good';    label = `${r}× STABLE`; }

        ratioEl.textContent = `Bullwhip ratio ${label.toLowerCase()}`;
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

        // One authoritative decision state per turn. Re-rendering the same
        // turn (or resizing / collapsing groups) never resets it.
        if (this._draftTurn !== s.turn || !this._draft) {
            this._draft     = { ...s.procurementChoices };
            this._draftTurn = s.turn;
        }
        this._qtyText    = String(this._draft.orderQuantity);
        this._submitting = false;
        this._openGroups = this._openGroups || { supply: true, pricing: false, protection: false };

        this.ui.mainView.innerHTML = buildWorkspaceHTML({
            state: s,
            suppliers,
            draft: this._draft,
            openGroups: this._openGroups,
        });
        this.ui.actionPanel.style.display = 'none';

        // The network diagram is the workspace's only network visual — dock it
        // into the situation column for this phase.
        const flow = document.getElementById('supply-chain-flow');
        const slot = this.ui.mainView.querySelector('.pw-flow-slot');
        if (flow && slot) slot.appendChild(flow);

        this._initBullwhipLiveChart();
        this.attachProcurementListeners();
        this.updateCostEstimate();
        this._renderGuide();
    }

    attachProcurementListeners() {
        const root = this.ui.mainView;

        // ── Group expand/collapse (state survives re-render) ───────────
        root.querySelectorAll('.pw-group-toggle').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.pw-group');
                const key   = group.dataset.group;
                const open  = btn.getAttribute('aria-expanded') !== 'true';
                btn.setAttribute('aria-expanded', String(open));
                group.classList.toggle('pw-group--open', open);
                document.getElementById(`pw-body-${key}`).hidden = !open;
                this._openGroups[key] = open;
            });
        });

        // ── Radio decisions → draft ────────────────────────────────────
        const RADIO_KEYS = {
            'pw-supplier': 'supplierId', 'pw-shipping': 'shippingId',
            'pw-pricing': 'pricingId', 'pw-inspection': 'inspectionId',
        };
        root.querySelectorAll('input[type="radio"]').forEach(input => {
            input.addEventListener('change', () => {
                if (!input.checked) return;
                this._draft[RADIO_KEYS[input.name]] = input.value;
                this.updateCostEstimate();
            });
        });

        // ── Order quantity (typed value or ± shortcuts) ────────────────
        const orderInput = document.getElementById('order-input');
        orderInput?.addEventListener('input', () => {
            this._qtyText = orderInput.value;
            this.updateCostEstimate();
        });
        root.querySelectorAll('[data-qty-add]').forEach(btn => {
            btn.addEventListener('click', () => {
                const base = parseInt(orderInput.value, 10);
                const next = Math.max(0, (Number.isNaN(base) ? 0 : base) + parseInt(btn.dataset.qtyAdd, 10));
                orderInput.value = next;
                this._qtyText = String(next);
                this.updateCostEstimate();
            });
        });

        // ── Safety stock slider ────────────────────────────────────────
        const slider = document.getElementById('safety-stock-slider');
        slider?.addEventListener('input', () => {
            this._draft.safetyStockTarget = parseInt(slider.value, 10);
            const out = document.getElementById('safety-stock-value');
            if (out) out.textContent = `${fmtNum(this._draft.safetyStockTarget)} units`;
            this.updateCostEstimate();
        });

        // ── Briefing detail view ───────────────────────────────────────
        document.getElementById('pw-view-briefing')?.addEventListener('click', (e) => this._openBriefing(e.currentTarget));

        // ── Confirm & advance (guards against duplicate submission) ────
        const btn = document.getElementById('place-order-btn');
        btn?.addEventListener('click', () => {
            if (this._submitting || btn.disabled) return;
            if (this._qtyError) {
                orderInput?.focus();
                return;
            }
            this._submitting = true;
            btn.disabled = true;
            btn.setAttribute('aria-busy', 'true');
            btn.textContent = 'Resolving quarter…';
            this.handleProcurement();
        });
    }

    /** Validate the typed quantity against the input's existing constraint (whole units, min 0). */
    _validateQuantity() {
        const raw = (this._qtyText ?? '').trim();
        const n   = parseInt(raw, 10);
        if (raw === '' || Number.isNaN(n)) return { error: 'Enter an order quantity (0 or more units).' };
        if (n < 0) return { error: 'Order quantity cannot be negative.' };
        return { value: n };
    }

    getSelectedProcurementChoices() {
        return { ...this._draft };
    }

    /** Earliest quarter any supplier + shipping combination could deliver (same engine estimate). */
    _earliestArrival(choices) {
        const suppliers = SUPPLIERS[this.engine.state.industry.id] || SUPPLIERS.electronics;
        let best = Infinity;
        suppliers.forEach(sup => SHIPPING_METHODS.forEach(m => {
            best = Math.min(best, this.engine.estimateTurn({ ...choices, supplierId: sup.id, shippingId: m.id, orderQuantity: 1 }).arrivesOnTurn);
        }));
        return best;
    }

    updateCostEstimate() {
        const s = this.engine.state;
        const industryId = s.industry.id;
        const suppliers  = SUPPLIERS[industryId] || SUPPLIERS.electronics;
        const setEl = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
        const setText = (sel, text) => { const el = document.querySelector(sel); if (el) el.textContent = text; };

        // Quantity validation — invalid input keeps the last valid value in the draft
        const v = this._validateQuantity();
        this._qtyError = v.error || null;
        if (!v.error) this._draft.orderQuantity = v.value;
        const orderInput = document.getElementById('order-input');
        const errEl = document.getElementById('order-error');
        if (errEl) { errEl.hidden = !v.error; errEl.textContent = v.error || ''; }
        orderInput?.setAttribute('aria-invalid', String(Boolean(v.error)));

        const choices = this.getSelectedProcurementChoices();
        const est     = this.engine.estimateTurn(choices);
        const qty     = est.orderQuantity;

        // ── Per-option comparison values (same engine estimate, one field varied) ──
        suppliers.forEach(sup => {
            const e = this.engine.estimateTurn({ ...choices, supplierId: sup.id });
            setText(`[data-sup-cost="${sup.id}"]`, `${fmtMoney2(e.unitCost)}/unit`);
            setText(`[data-sup-lead="${sup.id}"]`, `${e.leadTimeTurns} qtr${e.leadTimeTurns === 1 ? '' : 's'}`);
        });
        const routeFactor = s.activeRoute?.shippingCostFactor ?? 1.0;
        SHIPPING_METHODS.forEach(m => {
            const e = this.engine.estimateTurn({ ...choices, shippingId: m.id });
            setText(`[data-ship-cost="${m.id}"]`, `${fmtMoney2(m.costPerUnit * routeFactor)}/unit`);
            setText(`[data-ship-arr="${m.id}"]`, `Q${e.arrivesOnTurn}`);
        });
        PRICING_STRATEGIES.forEach(p => {
            const e = this.engine.estimateTurn({ ...choices, pricingId: p.id });
            setText(`[data-price="${p.id}"]`, `${fmtMoney2(e.unitPrice)}/unit`);
        });

        // ── Projection (existing planning model, fed by the engine estimate) ──
        const horizon = Math.min(6, Math.max(4, est.leadTimeTurns + 1));
        const rows = computeProjection({
            inventory:      s.inventory,
            backlog:        s.backlog,
            inTransit:      s.inTransit,
            currentTurn:    s.turn,
            orderQty:       qty,
            orderUsable:    est.arrivingUnits,
            leadTimeTurns:  est.leadTimeTurns,
            expectedDemand: est.expectedDemand,
            safetyStock:    choices.safetyStockTarget,
            horizon,
        });
        setEl('pw-shipments', renderShipmentsHTML(s, est));
        const tbody = document.querySelector('#pw-proj tbody');
        if (tbody) tbody.innerHTML = renderProjectionRowsHTML(rows, est, s.turn);
        setEl('pw-proj-assumptions',
            `Assumes customers want about ${fmtNum(est.expectedDemand)} units each quarter (base demand × your pricing and current event effects), ` +
            `shipments on time and no surprise events. Each quarter: shipments arrive → customers buy (waiting orders first) → your new order leaves the supplier.`);

        // ── Consequence summary ────────────────────────────────────────
        const cashAfter = s.cash - est.purchaseCost;
        const now       = rows[0];
        setEl('pw-c-total', fmtMoney(est.purchaseCost));
        setEl('pw-c-cash', fmtMoney(cashAfter));
        ['pw-c-total', 'pw-c-cash'].forEach(id => {
            const el = document.getElementById(id);
            el?.classList.toggle('pw-dd--long', el.textContent.length > 10);
        });
        document.getElementById('pw-c-cash-wrap')?.setAttribute('data-tone', cashAfter < 0 ? 'critical' : cashAfter < 80000 ? 'warn' : 'ok');
        setEl('pw-c-arrival', qty > 0 ? `Q${est.arrivesOnTurn}` : '—');
        setEl('pw-c-arrival-note', qty > 0
            ? `In ${est.leadTimeTurns} quarter${est.leadTimeTurns === 1 ? '' : 's'} · ready to sell in Q${est.arrivesOnTurn}`
            : 'No order placed');
        setEl('pw-c-inv', `${fmtNum(now.endInv)} units`);
        setEl('pw-c-inv-note', now.stockout
            ? `About ${fmtNum(now.short)} units short of expected demand`
            : `After expected demand of ${fmtNum(est.expectedDemand)}`);
        document.getElementById('pw-c-inv-wrap')?.setAttribute('data-tone', now.stockout ? 'critical' : now.belowSafety ? 'warn' : 'ok');

        const warning = pickWarning({ state: s, est, rows, cashAfter, safetyStock: choices.safetyStockTarget });
        const wEl = document.getElementById('pw-c-warning');
        if (wEl) {
            wEl.className = `pw-warning pw-warning--${warning.tone}`;
            const icon = { critical: '⛔', warn: '⚠', ok: '✓' }[warning.tone];
            wEl.innerHTML = `<span class="pw-warning-icon" aria-hidden="true">${icon}</span><span><span class="pw-visually-hidden">${warning.tone === 'ok' ? 'Status' : 'Warning'}: </span>${warning.text}</span>`;
        }

        const rowsHtml = [
            [`Purchase (${fmtNum(qty)} × ${fmtMoney2(est.unitCost)})`, est.orderCost],
            ['Shipping', est.shippingCost],
            ['Inspection', est.inspectionCost],
            [`Faulty-unit disposal (~${fmtNum(est.caughtDefects)} found)`, est.defectDisposalCost],
            ...(est.contractFee ? [['Contract shortfall fee', est.contractFee]] : []),
        ].map(([k, val]) => `<tr><th scope="row">${k}</th><td>${fmtMoney(val)}</td></tr>`).join('')
          + `<tr class="pw-bd-total"><th scope="row">This order costs</th><td>${fmtMoney(est.purchaseCost)}</td></tr>`
          + `<tr class="pw-bd-extra"><th scope="row">Also this quarter: storage cost (holding cost) on stock you have</th><td>${fmtMoney(est.holdingCost)}</td></tr>`;
        setEl('pw-breakdown-rows', rowsHtml);

        // ── Group summaries (always visible, incl. warnings when collapsed) ──
        const sumChip = (t, tone = '') => `<span class="pw-sum${tone ? ` pw-sum--${tone}` : ''}">${t}</span>`;
        const lateOrder = qty > 0 && rows.some(r => r.stockout && r.turn < est.arrivesOnTurn);
        setEl('pw-sum-supply', [
            sumChip(`${est.supplier.tier} · ${est.supplier.name}`),
            sumChip(`${est.shippingMethod.name}`),
            sumChip(`${fmtMoney2(est.landedUnitCost)}/unit incl. shipping`),
            sumChip(qty > 0 ? `Arrives Q${est.arrivesOnTurn}` : 'No order'),
            ...(lateOrder ? [sumChip('⚠ Arrives after an expected shortfall', 'warn')] : []),
            ...(est.contractApplies && est.contractHonoured === false ? [sumChip('⚠ Contract shortfall fee', 'warn')] : []),
        ].join(''));
        setEl('pw-sum-pricing', [
            sumChip(`${est.pricingStrategy.name} · you sell at ${fmtMoney2(est.unitPrice)}/unit`),
            sumChip(`Expected demand ${fmtNum(est.expectedDemand)}`),
        ].join(''));
        const firstBelow = rows.find(r => r.belowSafety);
        setEl('pw-sum-protection', [
            sumChip(`${est.inspection.name}${est.inspectionCost ? ` · ${fmtMoney(est.inspectionCost)}` : ''}`),
            sumChip(`Extra-stock target ${fmtNum(choices.safetyStockTarget)}`),
            ...(firstBelow ? [sumChip(`⚠ Below target in Q${firstBelow.turn}`, 'warn')] : []),
        ].join(''));

        // Turn brief, quantity hint and readable selections (all from the same estimate)
        const earliest = this._earliestArrival(choices);
        setEl('pw-brief-goal', turnGoal({ state: s, est, rows, earliest }));
        setEl('pw-brief-note', turnNote({ state: s, est, earliest }));
        setEl('pw-qty-hint', `Customers are expected to want about ${fmtNum(est.expectedDemand)} units a quarter at your current price${s.backlog > 0 ? `, plus ${fmtNum(s.backlog)} still waiting` : ''}.`);
        setEl('pw-choices-text', choicesSummary(est, choices.safetyStockTarget));
        this._guideCtx = { state: s, est, rows, earliest };
        this._refreshGuideText();

        setEl('pw-defect-est', qty > 0
            ? `This order: about ${fmtNum(est.totalDefective)} faulty units expected at ${est.supplier.name}'s ${(est.supplier.defectRate * 100).toFixed(1)}% rate — ` +
              `${fmtNum(est.caughtDefects)} found and thrown away (${fmtMoney(est.defectDisposalCost)}), ${fmtNum(est.passedDefects)} reach customers.`
            : 'No order this quarter.');

        // Chapter lane + contract reminders
        const routeEl = document.getElementById('pw-route-note');
        const rt = s.activeRoute;
        if (routeEl) {
            routeEl.hidden = !rt;
            if (rt) {
                const cp = Math.round((rt.shippingCostFactor - 1) * 100);
                routeEl.textContent = `Chapter lane: ${rt.label} — ${cp === 0 ? 'baseline freight' : cp > 0 ? `+${cp}% freight` : `${cp}% freight`}, ` +
                    `${rt.leadTimeMod > 0 ? `+${rt.leadTimeMod} quarter transit` : rt.leadTimeMod < 0 ? `${rt.leadTimeMod} quarter transit` : 'on schedule'} (included above).`;
            }
        }
        const contractEl = document.getElementById('pw-contract');
        const c = s.activeContract;
        if (contractEl) {
            contractEl.hidden = !c;
            if (c) {
                const own = c.supplierId === choices.supplierId;
                const meets = qty >= c.minVolume;
                contractEl.className = `pw-contract ${own ? (meets ? 'pw-contract--ok' : 'pw-contract--miss') : ''}`;
                contractEl.textContent = own
                    ? `${c.supplierName} contract: −${c.discountPct}% if you order at least ${fmtNum(c.minVolume)} units. You're at ${fmtNum(qty)} — ${meets ? 'discount applies.' : `${fmtMoney(c.shortfallFee)} shortfall fee applies.`}`
                    : `Contract with ${c.supplierName} applies only when you order from them.`;
            }
        }

        // Compact action-bar line (narrow layouts) + submit availability
        setEl('pw-actionbar-sum', `${qty > 0 ? `${fmtNum(qty)} units · ${fmtMoney(est.purchaseCost)} · arrives Q${est.arrivesOnTurn}` : 'No order'}${warning.tone === 'ok' ? '' : ' · see warning'}`);
        const btn = document.getElementById('place-order-btn');
        if (btn && !this._submitting) btn.disabled = Boolean(this._qtyError);

        this._updateBullwhipPreview(qty);
        this._scheduleDraftSave();
    }

    /** Full scenario briefing in an accessible dialog (narrative vs. actual game effects). */
    _openBriefing(returnFocusEl) {
        const s = this.engine.state;
        const scenario = s.currentScenario;
        const choice   = s.lastStoryChoice;
        if (!scenario || !choice) return;
        const picked = scenario.options.find(o => o.label === choice.optionLabel);
        const sender = this._scenarioSender(scenario);
        const effects = describeModifiers(s.modifiers);
        const alignText = { optimal: 'Optimal', cautious: 'Cautious', risky: 'Risky' }[choice.alignment] || '—';

        const dlg = document.createElement('dialog');
        dlg.className = 'pw-dialog';
        dlg.setAttribute('aria-labelledby', 'pw-dlg-title');
        dlg.innerHTML = `
            <div class="pw-dialog-head">
                <div>
                    <p class="pw-eyebrow">Briefing · from ${sender.name}, ${sender.role}</p>
                    <h2 id="pw-dlg-title">${scenario.title}</h2>
                </div>
                <button type="button" class="pw-dialog-close" aria-label="Close briefing">✕</button>
            </div>
            <div class="pw-dialog-body">
                <h3>Situation</h3>
                <p>${scenario.text}</p>
                <h3>Responses offered</h3>
                <ul class="pw-dlg-options">
                    ${scenario.options.map(o => `<li${o === picked ? ' class="pw-dlg-picked"' : ''}>${o.label}${o === picked ? ' <strong>— your response</strong>' : ''}</li>`).join('')}
                </ul>
                ${picked?.outcomeText ? `<h3>What happened (narrative)</h3><p>${picked.outcomeText}</p>` : ''}
                <h3>Game effects actually applied this quarter</h3>
                ${effects.length ? `<ul class="pw-chips">${effects.map(c => `<li class="pw-chip pw-chip--${c.tone}">${c.text}</li>`).join('')}</ul>` : '<p>No mechanical effect on costs, lead time or demand.</p>'}
                <p class="pw-note">Concept alignment: <strong>${alignText}</strong> — this scores how well the response applies the chapter's supply chain concept. It is not a prediction of this quarter's profit. Responses can't be changed once chosen.</p>
            </div>`;
        document.body.appendChild(dlg);
        const close = () => dlg.close();
        dlg.querySelector('.pw-dialog-close').addEventListener('click', close);
        dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
        dlg.addEventListener('close', () => { dlg.remove(); returnFocusEl?.focus(); });
        dlg.showModal();
    }

    formatModifier(val, unit) {
        if (val > 0) return `+${val} ${unit}`;
        if (val < 0) return `${val} ${unit}`;
        return `standard`;
    }

    handleProcurement() {
        const choices = this.getSelectedProcurementChoices();
        // Confirmed position at decision time — the results card's "before" values
        const s0 = this.engine.state;
        this._turnStart = { cash: s0.cash, inventory: s0.inventory, backlog: s0.backlog };
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
        if (this.charts.bullwhipLive) { this.charts.bullwhipLive.destroy(); this.charts.bullwhipLive = null; }
        const turnDone = this.engine.state.turn;
        const chapterOfTurn = (this.engine.state.chapterIndex ?? 0) + 1;
        const scenarioOfTurn = this.engine.state.currentScenario?.id;
        const chapterIdOfTurn = this.engine.state.currentChapter?.id;
        // Pre-resolution context for the results card (engine estimate + the event response in force)
        const expectedDemand = this.engine.estimateTurn(choices).expectedDemand;
        const storyEffects = this.engine.state.isEndless ? [] : describeModifiers(this.engine.state.modifiers).map(c => c.text);
        const storyResponse = this.engine.state.isEndless ? null : this.engine.state.lastStoryChoice?.optionLabel ?? null;
        const guideWasActive = this._guide?.status === 'active' && (this._gameMode === 'story' || this._guide.replay);
        this.engine.processTurn(choices);
        this._progressEvent('turn_completed', `t${turnDone}`, { chapter: chapterOfTurn, turn: turnDone, guide: this._guideRun || 'none' });
        // The guided turn is complete once it resolves
        if (guideWasActive) {
            this._guideTrack('guide_completed', { how: 'turn_confirmed', steps_seen: (this._guide.step ?? 0) + 1, phase: 'procurement' });
            this._guide = writeGuide(finishGuide());
            this._renderGuide();
        }
        // Public participation counts (campaigns only; the server deduplicates per run + scenario)
        if (this._gameMode === 'story' && this.runId) {
            CM.recordQuarter({ runId: this.runId, industryId: this.engine.state.industry?.id, chapterId: chapterIdOfTurn, scenarioId: scenarioOfTurn, turn: turnDone });
        }
        if (!this._firstTurnTracked) {
            this._firstTurnTracked = true;
            track('first_turn_complete', { industry_id: this.engine.state.industry?.id, mode: this._gameMode, chapter: chapterOfTurn, guide: this._guideRun || 'none' });
        }

        // Surface any micro-crisis that fired this turn into the live ticker
        const crisis = this.engine.state.lastTurnResult?.crisis;
        if (crisis) {
            const alignment = crisis.severity === 'positive' ? 'optimal' : 'risky';
            CrisisTicker.inject(crisis.name, alignment, crisis.ticker, 'crisis');
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

        // Shipments still en route after resolution, for the result card's "next" section
        result._nextArrivals = this.engine.state.inTransit
            .map(o => ({ units: o.usableUnits + o.passedDefects, turn: o.arrivesOnTurn }))
            .sort((a, b) => a.turn - b.turn);

        // Concept-in-action insight (also shown in endless mode)
        result._conceptInsight = getConceptInsight(result, this.engine.state.history);

        // "What happened / what contributed" inputs for the results card only —
        // kept off `result`, which is also the history entry saved in snapshots
        const storyCtx = {
            _before: this._turnStart || null,
            _expectedDemand: expectedDemand,
            _storyResponse: storyResponse,
            _storyEffects: storyEffects,
            _firstQuarter: this.engine.state.history.length === 1,
        };

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

        const savedTurn = this._saveLocal('turn'); // quarter resolved: save before any results screen
        if (savedTurn && this._gameMode === 'story' && RS.getMeta(this.runId)?.turn === 2) {
            showCloudPrompt({ onEnable: () => this.savePanel.open({ focus: 'email', adoptRunId: this.runId, source: 'first_turn_prompt' }) });
        }
        const showSummary = () => this.turnSummaryCard.show({ ...result, ...storyCtx }, chapter, () => {
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
                    this._saveLocal('choice');
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
     * The player finished the last chapter their access covers (normally the
     * free FMCG intro). Shows the completion debrief + Core offer; buying or
     * restoring continues straight into the next chapter.
     */
    _showAccessEnd(chapter, nextChapter, summary, proceed) {
        const s = this.engine.state;
        const turns = s.history.filter(h => h.chapter === chapter.number);
        const isFreeIntro = Entitlements.isFreeIntro(s.industry?.id, chapter.number);
        if (isFreeIntro) track('free_scenario_complete', { industry_id: s.industry?.id, chapter: chapter.number });
        const screen = this._introComplete || (this._introComplete = new IntroComplete());
        screen.show({
            isFreeIntro,
            chapter,
            nextChapter,
            stats: {
                quarters: turns.length,
                cash: s.cash,
                profit: turns.reduce((n, t) => n + (t.profit || 0), 0),
                missedSales: turns.reduce((n, t) => n + (t.missedSales || 0), 0),
                score: summary.score,
                maxScore: summary.maxScore,
                mastered: summary.mastered,
            },
            diagnosis: this._computePlayerDiagnosis(chapter.number),
            onUnlock: () => this.paywall.show(() => {
                this._onAccessChanged();
                if (this._canContinueTo(nextChapter.number)) { screen.hide(); proceed(); }
            }, null, { source: 'intro_complete' }),
            onReplay: () => {
                this.selectedIndustryId = FREE_INTRO.industryId;
                this.startGame(FREE_INTRO.chapterNumber - 1, 'story');
            },
            onMenu: () => { window.location.href = '/play'; },
        });
        if (isFreeIntro && this._gameMode === 'story') {
            mountReviewPrompt(screen.el?.querySelector('.ic-card'), { runId: this.runId, dialog: this.reviewDialog, source: 'intro_complete' });
        }
    }

    renderChapterSummary() {
        const prevChapterIdx = this.engine.state.chapterIndex;
        const allChapters = [...CHAPTERS, ...EXPANSION_CHAPTERS];
        const summary = this.engine.mastery.getChapterSummary(
            allChapters[prevChapterIdx].id
        );

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

        const advance = () => { this.engine.advanceFromChapterSummary(); this.renderGameState(); };
        const nextChapter = allChapters[prevChapterIdx + 1];
        const blocked = nextChapter && !this._canContinueTo(nextChapter.number);
        // Results, summary and concept card are always shown first; a player
        // whose access ends here then gets the completion screen + Core offer.
        const continueCallback = blocked
            ? () => this._showAccessEnd(allChapters[prevChapterIdx], nextChapter, summary, () => showCareerNotice(review, advance))
            : () => showCareerNotice(review, advance);

        this._progressEvent('chapter_completed', `cc${allChapters[prevChapterIdx].number}`, { chapter: allChapters[prevChapterIdx].number, turn: this.engine.state.turn - 1 });
        const gatedCallback = continueCallback;

        // Wrap gatedCallback with the CSCP definition card.
        // Flow: ChapterTransition → DefinitionCard → gatedCallback (email / paywall / continue)
        const chapterId = allChapters[prevChapterIdx]?.id;
        const chapterNum = allChapters[prevChapterIdx]?.number;
        const playerDiagnosis = this._computePlayerDiagnosis(chapterNum);
        const withDefinition = () => this.definitionCard.show(chapterId, gatedCallback, playerDiagnosis);

        this.chapterTransition.show(prevChapterIdx, summary, { engineState: this.engine.state, ctaLabel: blocked ? 'Continue' : null }, withDefinition);

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

        this._updateMetricSubs(s);

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

    /** Secondary lines under each state-strip value: timing, breakdowns and semantics. */
    _updateMetricSubs(s) {
        const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text; };
        const fmtN = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
        const fmtM = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

        set('cash-sub', s.cash < 0 ? 'Below zero' : s.cash < 80000 ? 'Low-cash alert level' : 'Available now');
        set('inventory-sub', s.backlog > 0 ? `${fmtN(s.backlog)} customer orders still waiting` : 'Units customers can buy now');

        // In-transit breakdown by arrival quarter
        const byTurn = new Map();
        s.inTransit.forEach(o => byTurn.set(o.arrivesOnTurn, (byTurn.get(o.arrivesOnTurn) || 0) + o.usableUnits + o.passedDefects));
        const parts = [...byTurn.entries()].sort((a, b) => a[0] - b[0]).map(([t, u]) => `${fmtN(u)} → Q${t}`);
        set('in-transit-sub', parts.length ? parts.slice(0, 3).join(' · ') + (parts.length > 3 ? ' …' : '') : 'No shipments on the way');

        // Money, stock and demand always show; stock on the way appears whenever
        // something is on the way, profit sits behind "More details"
        const open = Boolean(this._metricsOpen);
        const transitCard = document.getElementById('metric-in-transit');
        const profitCard = document.getElementById('metric-profit');
        if (transitCard) transitCard.hidden = !(open || byTurn.size > 0);
        if (profitCard) profitCard.hidden = !open;
        const more = document.getElementById('metrics-more');
        if (more) {
            more.setAttribute('aria-expanded', String(open));
            more.textContent = open ? 'Fewer details' : 'More details';
        }

        const last = s.lastTurnResult;
        if (last) {
            set('demand-sub', last.missedSales > 0
                ? `Q${last.turn}: ${fmtN(last.sales)} served, ${fmtN(last.missedSales)} short`
                : `Q${last.turn}: all ${fmtN(last.sales)} served`);
            const cumulative = s.history.reduce((sum, h) => sum + (h.profit || 0), 0);
            set('profit-sub', `Q${last.turn} result · run total ${fmtM(cumulative)}`);
        } else {
            set('demand-sub', 'None yet · base demand ≈ 1,000 a quarter');
            set('profit-sub', 'No quarter played yet');
        }
    }

    endGame() {
        const summaries = this.engine.mastery.getAllSummaries();
        const overall   = this.engine.mastery.getOverallScore();
        const cash      = this.engine.state.cash;
        const history   = this.engine.state.history;

        const showMainResults = () => {
            const isPremium   = Entitlements.has(FEATURE.ADVANCED_REPORT);
            const industry    = this.engine.state.industry;
            const isExpansion = true; // all chapters always available
            // Certificate: Core feature; runs started when it was free keep it
            const certificateAllowed = Entitlements.has(FEATURE.CERTIFICATE) || Boolean(this._runGrant());

            // Build the debrief callback once so the closure captures the right state
            const openDebrief = async () => {
                if (!this.debriefScreen) {
                    const { DebriefScreen } = await import('./ui/debrief-screen.js');
                    this.debriefScreen = new DebriefScreen();
                }
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
                certificateAllowed,
                onUnlock: () => this.paywall.show(() => this._onAccessChanged(), null, { source: 'certificate' }),
            });
            // Win or lose, the campaign is over: offer a review (never during decisions)
            if (this._gameMode === 'story') {
                mountReviewPrompt(this.gameOverScreen.modal.querySelector('.gameover-screen'), { runId: this.runId, dialog: this.reviewDialog, source: 'campaign_complete' });
            }
        };

        const showResults = () => {
            if (this.terminationScreen.shouldShow({ cash, overall, summaries, history })) {
                this.terminationScreen.show({ cash, overall, summaries, history }, showMainResults);
            } else {
                showMainResults();
            }
        };

        this._progressEvent('run_completed', 'done', { chapter: (this.engine.state.chapterIndex ?? 0) + 1 });
        showResults();
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
                    accessToken: Entitlements.token(),
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
                document.body.classList.remove('scd-playing');
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
