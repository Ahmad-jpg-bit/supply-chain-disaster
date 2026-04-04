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
import { markNavPremium } from './shared/nav.js';
import { updateCardSparkline } from './ui/sparkline.js';
import { SaveProgressModal } from './ui/save-progress-modal.js';
import { CrisisTicker } from './ui/crisis-ticker.js';
import { AudioHapticManager } from './ui/audio-haptic.js';
import { buildConsequenceData, showConsequenceOverlay } from './ui/consequence-overlay.js';
import { STARTING_ARCHETYPES } from './logic/crisis-engine.js';
import { EndlessDeathScreen } from './ui/endless-death-screen.js';
import { DefinitionCard } from './ui/definition-card.js';

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

        this.init();
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
            localStorage.setItem('scd_premium', JSON.stringify({ tier: 'expansion' }));
            markNavPremium();
            window.history.replaceState({}, '', '/');
            this.selectedIndustryId = _devIndustry;
            this.ui.startScreen.classList.add('hidden');
            this.ui.dashboard.classList.remove('hidden');
            this.startGame(_devChapter);
            return;
        }

        // Mount the landing page (replaces the old onboarding wizard)
        new LandingPage(this.ui.startScreen, (industryId, startChapterIndex = 0, mode = 'story') => {
            this.selectedIndustryId = industryId;
            this.startGame(startChapterIndex, mode);
        });

        // Tab Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
        });
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

    startGame(startChapterIndex = 0, mode = 'story') {
        if (!this.selectedIndustryId) return;

        this._gameMode = mode;
        if (mode === 'endless') {
            this.engine.initEndless(this.selectedIndustryId);
        } else {
            this.engine.init(this.selectedIndustryId, PremiumManager.isExpansion(), startChapterIndex);
        }

        this.ui.startScreen.classList.add('hidden');
        this.ui.dashboard.classList.remove('hidden');

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
    }

    renderChapterProgress() {
        const container = document.getElementById('chapter-progress');
        if (!container) return;

        // Endless mode — replace chapter dots with wave/score HUD
        if (this.engine.state.isEndless) {
            const s   = this.engine.state;
            const sat = Math.max(0, s.endlessSatisfaction);
            const satColor = sat > 60 ? '#22c55e' : sat > 30 ? '#f59e0b' : '#ef4444';
            const chapterLabel = document.getElementById('hud-chapter-name');
            if (chapterLabel) {
                chapterLabel.innerHTML =
                    `<span class="hud-ch-num" style="color:#ef4444">∞</span>` +
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
            const expansionLocked = isExpansionChapter && !PremiumManager.isExpansion();
            const premiumLocked = !isExpansionChapter && PremiumManager.isChapterLocked(ch.number);
            const isLocked = expansionLocked || premiumLocked;

            let cls = 'chapter-dot';
            if (isExpansionChapter) cls += ' expansion-chapter';
            if (isLocked) {
                cls += ' locked';
            } else if (idx < currentChapterIdx) {
                cls += ' completed';
            } else if (idx === currentChapterIdx) {
                cls += ' active';
            }

            const label = isLocked ? '🔒' : ch.number;
            const titlePrefix = expansionLocked ? '✦ Expansion — ' : premiumLocked ? '🔒 Premium — ' : '';
            html += `<div class="${cls}" title="${titlePrefix}Ch ${ch.number}: ${ch.title}"><span>${label}</span></div>`;
        });
        container.innerHTML = html;
    }

    // --- CORE RENDER LOOP ---
    renderGameState() {
        this.updateMetrics();
        this.renderChapterProgress();

        // Refresh node statuses on every render cycle
        if (this.flowDiagram) {
            this.flowDiagram.setNodeStatuses(this._deriveNodeStatuses());
        }

        const { phase } = this.engine.state;

        // Clear main view for redraw
        this.ui.mainView.innerHTML = '';
        this.ui.actionPanel.innerHTML = '';

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

        // Show concept card overlay, unless player previously chose to skip it
        const skippedIntros = JSON.parse(localStorage.getItem('scd_skipped_intros') || '[]');
        if (skippedIntros.includes(chapter.number)) {
            this.engine.advanceFromChapterIntro();
            this.renderGameState();
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
            this.engine.advanceFromChapterIntro();
            this.renderGameState();
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
        const trendColor = demandTrend.includes('Rising') ? '#22c55e' : demandTrend.includes('Falling') ? '#ef4444' : '#94a3b8';

        // Lead time signal
        const leadMod = s.modifiers?.leadTime ?? 0;
        const leadSignal = leadMod > 1 ? `+${leadMod} turns delay (disrupted)` : leadMod === 0 ? 'Normal — no delays' : `+${leadMod} turn caution`;
        const leadColor = leadMod > 1 ? '#ef4444' : leadMod > 0 ? '#f59e0b' : '#22c55e';

        // Service level signal
        const satisfaction = s.customerSatisfaction ?? 0;
        const svcSignal = satisfaction >= 10 ? 'High — customers satisfied' : satisfaction >= 0 ? 'Moderate — watch inventory' : 'Low — stockouts risk churn';
        const svcColor = satisfaction >= 10 ? '#22c55e' : satisfaction >= 0 ? '#f59e0b' : '#ef4444';

        return `
            <div class="intel-grid">
                <div class="intel-source">
                    <div class="intel-source-label">📊 DEMAND FORECAST MODEL</div>
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
                    <div class="intel-source-label">🔗 SUPPLIER NETWORK REPORT</div>
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
                    <div class="intel-source-label">📡 MARKET ANALYST BRIEF</div>
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
        const profitColor = last.profit >= 0 ? '#22c55e' : '#ef4444';
        return `
            <div class="fin-grid">
                <div class="fin-section">
                    <div class="fin-section-label">COST BREAKDOWN — Last Turn</div>
                    <div class="fin-row"><span>Order Cost</span><span>${fmt(last.orderCost)}</span></div>
                    <div class="fin-row"><span>Shipping Cost</span><span>${fmt(last.shippingCost)}</span></div>
                    <div class="fin-row"><span>Inspection</span><span>${fmt(last.inspectionCost)}</span></div>
                    <div class="fin-row"><span>Holding Cost</span><span>${fmt(last.holdingCost)}</span></div>
                    <div class="fin-row fin-row--total"><span>Total Cost</span><span>${fmt(last.totalCost)}</span></div>
                </div>
                <div class="fin-section">
                    <div class="fin-section-label">REVENUE & PROFIT</div>
                    <div class="fin-row"><span>Revenue</span><span>${fmt(last.revenue)}</span></div>
                    <div class="fin-row"><span>Missed Sales</span><span style="color:#f59e0b">${last.missedSales?.toLocaleString() ?? 0} units</span></div>
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
        const riskColor = opt.conceptAlignment === 'optimal' ? '#22c55e' : opt.conceptAlignment === 'cautious' ? '#f59e0b' : '#ef4444';
        const leadStr = leadTime === 0 ? 'No delay' : `+${leadTime} turn${leadTime > 1 ? 's' : ''} lead time`;

        return { costStr, svcStr, riskStr, riskColor, leadStr };
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

        storyCard.innerHTML = `
            ${chapterLabel}
            <div class="story-title">${scenario.title}</div>
            <nav class="story-tabs" role="tablist">
                <button class="story-tab-btn story-tab-btn--active" data-tab="mission" role="tab">Mission</button>
                <button class="story-tab-btn" data-tab="intel" role="tab">Intelligence</button>
                <button class="story-tab-btn" data-tab="financials" role="tab">Financials</button>
            </nav>
            <div class="story-tab-panels">
                <div class="story-tab-panel story-tab-panel--active" data-panel="mission">
                    <div class="story-text">${scenario.text}</div>
                    <div class="story-options">${optionsHTML}</div>
                </div>
                <div class="story-tab-panel" data-panel="intel">
                    ${this._buildIntelContent(scenario)}
                </div>
                <div class="story-tab-panel" data-panel="financials">
                    ${this._buildFinancialsContent()}
                </div>
            </div>
        `;

        // Tab switching
        storyCard.querySelectorAll('.story-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                storyCard.querySelectorAll('.story-tab-btn').forEach(b => b.classList.remove('story-tab-btn--active'));
                storyCard.querySelectorAll('.story-tab-panel').forEach(p => p.classList.remove('story-tab-panel--active'));
                btn.classList.add('story-tab-btn--active');
                storyCard.querySelector(`.story-tab-panel[data-panel="${btn.dataset.tab}"]`).classList.add('story-tab-panel--active');
            });
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
                <span class="demand-event-icon">⚠</span>
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
                <span class="demand-event-icon">📦</span>
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
                <span class="demand-event-icon">🛡</span>
                <div class="demand-event-body">
                    <strong>Safety Stock Breach</strong>
                    <span>Post-sale inventory fell below your target of ${lastResult.safetyStockTarget?.toLocaleString()} units. Increase orders to rebuild your buffer.</span>
                </div>
            `;
            this.ui.mainView.appendChild(safetyBanner);
        }

        this.ui.mainView.appendChild(storyCard);
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
                btn.innerHTML = `<span class="executing-spinner">⚙</span> EXECUTING…`;
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

            this.ui.mainView.innerHTML = `
                <div class="outcome-panel glass-panel" style="animation: fadeIn 0.4s ease-out;">
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
        const monoGrid  = { color: 'rgba(255,255,255,0.05)' };

        this.charts.bullwhipLive = new Chart(canvas, {
            type: 'line',
            data: {
                labels: allLabels,
                datasets: [
                    {
                        label: 'Demand',
                        data: demandData,
                        borderColor: '#f59e0b',
                        tension: 0.35,
                        pointRadius: 3,
                        pointBackgroundColor: '#f59e0b',
                        borderWidth: 2,
                        fill: false,
                        order: 2,
                    },
                    {
                        label: 'Past Orders',
                        data: ordersData,
                        borderColor: '#3b82f6',
                        tension: 0.35,
                        pointRadius: 3,
                        pointBackgroundColor: '#3b82f6',
                        borderWidth: 2,
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
                animation: { duration: 0 },
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
                        callbacks: {
                            label: (item) => `${item.dataset.label}: ${item.parsed.y != null ? item.parsed.y.toLocaleString() : '—'}`
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: monoGrid,
                        ticks: {
                            ...monoTicks,
                            callback: (v) => v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v
                        },
                    },
                    x: { grid: monoGrid, ticks: monoTicks }
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
        const industryId = this.engine.state.industry.id;
        const suppliers = SUPPLIERS[industryId] || SUPPLIERS.electronics;
        const prevChoices = this.engine.state.procurementChoices;

        // ── Market Conditions banner data ──────────────────────────────
        const costMod  = this.engine.state.modifiers.unitCost;
        const leadMod  = this.engine.state.modifiers.leadTime;
        const costPct  = Math.round(costMod * 100);
        const isElevated  = costMod > 1.0;
        const isFavorable = costMod < 1.0;
        const bannerMod   = isElevated ? 'warn' : isFavorable ? 'good' : 'neutral';
        const bannerIcon  = isElevated ? '⚠' : isFavorable ? '↗' : '≡';
        const costDesc    = isElevated
            ? `Supplier costs are elevated by <strong>${costPct - 100}%</strong>.`
            : isFavorable
                ? `Supplier costs are reduced by <strong>${100 - costPct}%</strong>.`
                : `Supplier costs are at <strong>standard rates</strong>.`;
        const leadDesc = leadMod === 0
            ? `Lead times remain <strong>standard</strong>.`
            : leadMod > 0
                ? `Lead times are <strong>extended by ${leadMod} wk</strong>.`
                : `Lead times are <strong>shortened by ${Math.abs(leadMod)} wk</strong>.`;

        const renderOptionCards = (items, groupName, selectedId, displayFn) => {
            return items.map(item => {
                const sel = item.id === selectedId ? ' selected' : '';
                return `<div class="option-card${sel}" data-group="${groupName}" data-id="${item.id}">
                    ${displayFn(item)}
                </div>`;
            }).join('');
        };

        const supplierCards = renderOptionCards(suppliers, 'supplier', prevChoices.supplierId, s =>
            `<div class="option-card-tier">${s.tier}</div>
             <div class="option-card-name">${s.name}</div>
             <div class="option-card-stats">
                <span>Cost: ${Math.round(s.costMultiplier * 100)}%</span>
                <span>Defects: ${(s.defectRate * 100).toFixed(1)}%</span>
                <span>Lead: ${s.leadTimeModifier > 0 ? '+' : ''}${s.leadTimeModifier}wk</span>
             </div>`
        );

        const shippingCards = renderOptionCards(SHIPPING_METHODS, 'shipping', prevChoices.shippingId, s =>
            `<div class="option-card-name">${s.name}</div>
             <div class="option-card-stats">
                <span>$${s.costPerUnit}/unit</span>
                <span>${s.leadTimeModifier > 0 ? '+' : ''}${s.leadTimeModifier === 0 ? 'Standard' : s.leadTimeModifier + 'wk'}</span>
             </div>`
        );

        const pricingCards = renderOptionCards(PRICING_STRATEGIES, 'pricing', prevChoices.pricingId, p =>
            `<div class="option-card-name">${p.name}</div>
             <div class="option-card-stats">
                <span>Price: ${Math.round(p.priceMultiplier * 100)}%</span>
                <span>Demand: ${Math.round(p.demandMultiplier * 100)}%</span>
             </div>`
        );

        const inspectionCards = renderOptionCards(QUALITY_INSPECTIONS, 'inspection', prevChoices.inspectionId, q =>
            `<div class="option-card-name">${q.name}</div>
             <div class="option-card-stats">
                <span>$${q.costPerUnit}/unit</span>
                <span>Catch: ${Math.round(q.defectCatchRate * 100)}%</span>
             </div>`
        );

        // ── STEP 3: Procurement stepper steps ─────────────────────────
        const PROC_STEPS = ['Supplier', 'Shipping', 'Quantity', 'Pricing', 'Inspection', 'Safety Stock'];
        const stepperHtml = PROC_STEPS.map((s, i) =>
            `<button class="proc-step ${i === 0 ? 'proc-step--active' : ''}" data-proc-step="${i}">
                <span class="proc-step-num">${i + 1}</span>
                <span class="proc-step-label">${s}</span>
             </button>`
        ).join('<span class="proc-step-divider">›</span>');

        // ── Main scrollable form ───────────────────────────────────────
        const endlessHeaderHtml = this.engine.state.isEndless ? (() => {
            const s = this.engine.state;
            const sat = Math.max(0, s.endlessSatisfaction);
            const satColor = sat > 60 ? '#22c55e' : sat > 30 ? '#f59e0b' : '#ef4444';
            return `
            <div class="proc-endless-header">
                <span class="proc-endless-wave">⚡ WAVE ${s.endlessWave} · TURN ${s.endlessTurn + 1}</span>
                <span class="proc-endless-sat" style="color:${satColor}">SAT ${Math.round(sat)}%</span>
                <span class="proc-endless-score">▲ ${s.endlessScore.toLocaleString()}</span>
            </div>`;
        })() : '';

        const html = `
            <div class="procurement-panel">
                <div class="procurement-header">
                    <h3>${this.engine.state.isEndless ? 'Survival Procurement' : 'Procurement Decisions'}</h3>
                </div>
                ${endlessHeaderHtml}

                <!-- CHANGE 2: Market Conditions Banner -->
                <div class="market-conditions-banner market-conditions-banner--${bannerMod}" role="alert">
                    <span class="market-conditions-icon" aria-hidden="true">${bannerIcon}</span>
                    <div class="market-conditions-text">
                        <strong>Current Market Conditions:</strong>
                        ${costDesc} ${leadDesc}
                    </div>
                </div>

                <!-- Live Bullwhip Signal Widget -->
                <div class="bullwhip-live-section">
                    <div class="bullwhip-live-header">
                        <span class="bullwhip-live-title">◈ DEMAND vs ORDER SIGNAL</span>
                        <span id="bullwhip-live-ratio" class="bullwhip-live-ratio blr--neutral">—</span>
                    </div>
                    <div class="bullwhip-live-chart-wrap">
                        <canvas id="bullwhipLive" class="bullwhip-live-canvas"></canvas>
                    </div>
                    <p class="bullwhip-live-hint">Orange dot tracks live as you adjust order quantity below</p>
                </div>

                <!-- CHANGE 3: Procurement Step Indicator -->
                <div class="proc-stepper" role="navigation" aria-label="Procurement steps">
                    ${stepperHtml}
                </div>

                <div class="procurement-section" data-proc-section="0" id="proc-sec-supplier">
                    <h4>Supplier Selection</h4>
                    <div class="option-cards">${supplierCards}</div>
                </div>

                <div class="procurement-section" data-proc-section="1" id="proc-sec-shipping">
                    <h4>Shipping Method</h4>
                    <div class="option-cards">${shippingCards}</div>
                </div>

                <!-- CHANGE 4: Order Quantity +/- stepper -->
                <div class="procurement-section" data-proc-section="2" id="proc-sec-quantity">
                    <h4>Order Quantity</h4>
                    <div class="qty-stepper">
                        <button class="qty-btn qty-btn--minus" id="qty-minus" aria-label="Decrease quantity">−</button>
                        <input type="number" id="order-input" value="${prevChoices.orderQuantity}" min="0" step="100" aria-label="Order quantity">
                        <button class="qty-btn qty-btn--plus" id="qty-plus" aria-label="Increase quantity">+</button>
                    </div>
                </div>

                <div class="procurement-section" data-proc-section="3" id="proc-sec-pricing">
                    <h4>Pricing Strategy</h4>
                    <div class="option-cards">${pricingCards}</div>
                </div>

                <div class="procurement-section" data-proc-section="4" id="proc-sec-inspection">
                    <h4>Quality Inspection</h4>
                    <div class="option-cards">${inspectionCards}</div>
                </div>

                <div class="procurement-section" data-proc-section="5" id="proc-sec-safety">
                    <h4>Safety Stock Target</h4>
                    <div class="safety-stock-control">
                        <input type="range" id="safety-stock-slider" min="0" max="2000" step="100" value="${prevChoices.safetyStockTarget}">
                        <span id="safety-stock-value">${prevChoices.safetyStockTarget} units</span>
                    </div>
                </div>
            </div>
        `;

        this.ui.mainView.innerHTML = html;
        this._initBullwhipLiveChart();

        // ── Sticky Cost + Confirm in right action panel ──────
        const currentTransit = this.engine.state.inTransit;
        const inTransitHtml = currentTransit.length > 0 ? `
            <div class="proc-sidebar-divider"></div>
            <div class="proc-sidebar-label">IN TRANSIT (${currentTransit.length})</div>
            <div class="in-transit-list">
                ${currentTransit.map(o => {
                    const turnsLeft = o.arrivesOnTurn - this.engine.state.turn;
                    const units = (o.usableUnits + o.passedDefects).toLocaleString();
                    return `<div class="in-transit-item">
                        <span>${units} units</span>
                        <span class="in-transit-eta">T${o.arrivesOnTurn} <span class="in-transit-turns">(+${turnsLeft})</span></span>
                    </div>`;
                }).join('')}
            </div>
        ` : '';

        this.ui.actionPanel.style.display = '';
        this.ui.actionPanel.innerHTML = `
            <div class="proc-sidebar-label">ESTIMATED COSTS</div>
            <div class="cost-estimate" id="cost-estimate">
                <div class="cost-row"><span>Order Cost</span><span id="est-order">—</span></div>
                <div class="cost-row"><span>Shipping</span><span id="est-shipping">—</span></div>
                <div class="cost-row"><span>Inspection</span><span id="est-inspection">—</span></div>
                <div class="cost-row cost-total"><span>Total</span><span id="est-total">—</span></div>
            </div>
            <div class="proc-sidebar-divider"></div>
            <div class="proc-sidebar-label">DELIVERY TIMELINE</div>
            <div class="gantt-chart-wrap">
                <canvas id="leadTimeGantt" class="lead-time-gantt"></canvas>
            </div>
            <div class="lead-time-display">
                <div class="lead-time-row">
                    <span>Arrives Turn</span>
                    <span id="est-arrival-turn" class="lead-time-value">—</span>
                </div>
                <div class="lead-time-row">
                    <span>Lead Time</span>
                    <span id="est-lead-turns" class="lead-time-value">—</span>
                </div>
            </div>
            ${inTransitHtml}
            <button id="place-order-btn" class="btn-primary width-full proc-confirm-btn">
                ✓ Confirm Order
            </button>
            <p class="proc-sidebar-note">Review all selections, then confirm to process the quarter.</p>
        `;

        this.attachProcurementListeners();
        this.updateCostEstimate();
    }

    attachProcurementListeners() {
        // Option card selection
        document.querySelectorAll('.option-card').forEach(card => {
            card.addEventListener('click', () => {
                const group = card.dataset.group;
                document.querySelectorAll(`.option-card[data-group="${group}"]`).forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                this.updateCostEstimate();
            });
        });

        // Order quantity input + +/- stepper buttons
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

        // Safety stock slider
        const slider = document.getElementById('safety-stock-slider');
        const sliderValue = document.getElementById('safety-stock-value');
        if (slider) {
            slider.addEventListener('input', () => {
                sliderValue.textContent = `${slider.value} units`;
            });
        }

        // Place order
        document.getElementById('place-order-btn').addEventListener('click', () => {
            this.handleProcurement();
        });

        // Procurement step indicator — click scrolls to section; IntersectionObserver updates active
        const panel = this.ui.mainView.querySelector('.procurement-panel');
        const stepBtns = document.querySelectorAll('.proc-step');
        const sections = document.querySelectorAll('.procurement-section[data-proc-section]');

        stepBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const idx = parseInt(btn.dataset.procStep);
                sections[idx]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            });
        });

        if ('IntersectionObserver' in window && sections.length) {
            const io = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const secIdx = entry.target.dataset.procSection;
                        stepBtns.forEach(b => b.classList.toggle('proc-step--active', b.dataset.procStep === secIdx));
                    }
                });
            }, { root: panel, threshold: 0.4 });
            sections.forEach(s => io.observe(s));
        }
    }

    getSelectedProcurementChoices() {
        const getSelected = (group) => {
            const el = document.querySelector(`.option-card[data-group="${group}"].selected`);
            return el ? el.dataset.id : null;
        };

        return {
            supplierId: getSelected('supplier') || 'standard',
            shippingId: getSelected('shipping') || 'standard',
            orderQuantity: parseInt(document.getElementById('order-input')?.value) || 0,
            pricingId: getSelected('pricing') || 'standard',
            inspectionId: getSelected('inspection') || 'standard',
            safetyStockTarget: parseInt(document.getElementById('safety-stock-slider')?.value) || 500
        };
    }

    updateCostEstimate() {
        const choices = this.getSelectedProcurementChoices();
        const industryId = this.engine.state.industry.id;
        const suppliers = SUPPLIERS[industryId] || SUPPLIERS.electronics;
        const supplier = suppliers.find(s => s.id === choices.supplierId) || suppliers[1];
        const shipping = SHIPPING_METHODS.find(s => s.id === choices.shippingId) || SHIPPING_METHODS[1];
        const inspection = QUALITY_INSPECTIONS.find(q => q.id === choices.inspectionId) || QUALITY_INSPECTIONS[1];

        const baseCost = 100;
        const storyMod = this.engine.state.modifiers.unitCost || 1.0;
        const qty = choices.orderQuantity;

        const orderCost = qty * baseCost * supplier.costMultiplier * storyMod;
        const shippingCost = qty * shipping.costPerUnit;
        const inspectionCost = qty * inspection.costPerUnit;
        const total = orderCost + shippingCost + inspectionCost;

        const fmt = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
        const setEl = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

        setEl('est-order', fmt(orderCost));
        setEl('est-shipping', fmt(shippingCost));
        setEl('est-inspection', fmt(inspectionCost));
        setEl('est-total', fmt(total));

        // Delivery timeline — live ETA based on current supplier + shipping selection
        const leadTurns = this.engine._computeLeadTimeTurns(
            supplier, shipping, this.engine.state.modifiers.leadTime, industryId
        );
        const arrivalTurn = this.engine.state.turn + leadTurns;
        const turnLabel = leadTurns === 1 ? '1 turn' : `${leadTurns} turns`;
        setEl('est-arrival-turn', `Turn ${arrivalTurn}`);
        setEl('est-lead-turns', turnLabel);

        this._renderGanttChart(leadTurns);
        this._updateBullwhipPreview(qty);
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
        if (this.charts.gantt) { this.charts.gantt.destroy(); this.charts.gantt = null; }
        if (this.charts.bullwhipLive) { this.charts.bullwhipLive.destroy(); this.charts.bullwhipLive = null; }
        this.engine.processTurn(choices);

        // Surface any micro-crisis that fired this turn into the live ticker
        const crisis = this.engine.state.lastTurnResult?.crisis;
        if (crisis) {
            const alignment = crisis.severity === 'positive' ? 'optimal' : 'risky';
            CrisisTicker.inject(crisis.name, alignment, crisis.ticker);
        }

        this.renderGameState();
    }

    renderChapterSummary() {
        const prevChapterIdx = this.engine.state.chapterIndex;
        const allChapters = [...CHAPTERS, ...EXPANSION_CHAPTERS];
        const summary = this.engine.mastery.getChapterSummary(
            allChapters[prevChapterIdx].id
        );

        const nextChapterIdx = prevChapterIdx + 1;
        const nextChapter = allChapters[nextChapterIdx] || null;
        const nextIsExpansionLocked = nextChapter?.expansionOnly && !PremiumManager.isExpansion();
        const nextIsLocked = nextChapter && !nextIsExpansionLocked
            ? PremiumManager.isChapterLocked(nextChapter.number)
            : false;

        // After Chapter 2 (index 1), gate on email capture before continuing.
        // This is the highest-conversion moment: player is invested, the free
        // content is done, and they need to "secure" their data to keep going.
        const continueCallback = () => {
            if (nextIsExpansionLocked) {
                    // Show paywall for Expansion Bundle upsell
                    this.paywall.show(() => {
                        // Grant expansion tier in local storage after successful auth
                        const data = PremiumManager.getPremiumData();
                        PremiumManager.setPremium({
                            email: data?.email,
                            customerId: data?.customerId,
                            tier: 'expansion'
                        });
                        markNavPremium();
                        this.engine.activateExpansion();
                        this.engine.advanceFromChapterSummary();
                        this.renderGameState();
                    });
                } else if (nextIsLocked) {
                    // Show paywall for standard premium gate
                    this.paywall.show(() => {
                        markNavPremium();
                        this.engine.advanceFromChapterSummary();
                        this.renderGameState();
                    });
                } else {
                    this.engine.advanceFromChapterSummary();
                    this.renderGameState();
                }
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
        const withDefinition = () => this.definitionCard.show(chapterId, gatedCallback);

        this.chapterTransition.show(prevChapterIdx, summary, {}, withDefinition);

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
            this.gameOverScreen.show({
                cash,
                overall,
                summaries,
                industry:    this.engine.state.industry,
                isExpansion: PremiumManager.isExpansion(),
            });
        };

        const showResults = () => {
            if (this.terminationScreen.shouldShow({ cash, overall, summaries, history })) {
                this.terminationScreen.show({ cash, overall, summaries, history }, showMainResults);
            } else {
                showMainResults();
            }
        };

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
        this.endlessDeathScreen.show({
            cause:        s.endlessDeathCause,
            wave:         s.endlessWave,
            turns:        s.endlessTurn,
            score:        s.endlessScore,
            cash:         s.cash,
            satisfaction: s.endlessSatisfaction,
            industryId:   s.industry?.id || 'electronics',
            onRestart: () => {
                this.startGame(0, 'endless');
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
