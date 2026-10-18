/**
 * CrisisTicker — optional news drawer for the game dashboard (HUD "News" button).
 * Lists background SCM headlines plus player-decision and crisis items. Kept out
 * of the decision path: gameplay-critical crisis info is shown in the workspace.
 */

const BASE_HEADLINES = [
  { text: 'RED SEA ALERT: Maersk & CMA CGM reroute via Cape of Good Hope — Asia-Europe transit +14 days', type: 'alert' },
  { text: 'FREIGHT RATES: Drewry World Container Index at $3,240/FEU — up 8.3% WoW on Trans-Pacific lane', type: 'data' },
  { text: 'TRADE WATCH: US-China tariff review stalls in Geneva — 25% duties on $370B goods remain in force', type: 'watch' },
  { text: 'PORT UPDATE: LA/Long Beach congestion index elevated — average container dwell time 4.2 days', type: 'update' },
  { text: 'SEMICONDUCTORS: Global lead times extend to 24 weeks per IPC supply chain survey Q1 2026', type: 'inventory' },
  { text: 'SURCHARGE: CMA CGM emergency fuel surcharge $180/TEU effective next quarter on all Asia lanes', type: 'logistics' },
  { text: 'NEARSHORING: Mexico surpasses China as #1 US import origin for third consecutive quarter — IHS Markit', type: 'data' },
  { text: 'RISK REPORT: World Bank flags geopolitical fragmentation as #1 supply chain threat in 2026 Global Trade Review', type: 'alert' },
  { text: 'REGULATORY: EU Carbon Border Adjustment Mechanism Phase 2 enforcement begins Q3 2026 — importers on notice', type: 'watch' },
  { text: 'AIR CARGO: Demand up 11% YoY as e-commerce surge strains belly capacity — yields at 14-month high', type: 'logistics' },
  { text: 'SUPPLIER: Foxconn India expansion adds 50K units/day — Apple dual-source strategy reduces single-point risk', type: 'update' },
  { text: 'WEATHER: Typhoon Kenji tracking toward Philippine Sea — contingency rerouting activated on affected lanes', type: 'alert' },
  { text: 'DEMAND SIGNAL: IHS Markit Global PMI 51.3 — purchasing managers report caution on forward inventory builds', type: 'data' },
  { text: 'QUALITY ALERT: FDA import alert issued on 14 API manufacturers citing cGMP violations — pharma buyers scramble', type: 'alert' },
  { text: 'COLD CHAIN: WHO reports 12% vaccine wastage attributable to last-mile temperature excursions in EM markets', type: 'watch' },
  { text: 'PROCUREMENT: Raw material spot prices stabilise after Q1 volatility — copper -3.2%, lithium -6.8% WoW', type: 'data' },
  { text: 'LOGISTICS: DHL Global Connectedness Index shows trade growth outpacing GDP for first time since 2019', type: 'update' },
  { text: 'INVENTORY: JIT adoption declining — 67% of manufacturers increasing safety stock buffers, Gartner survey finds', type: 'inventory' },
];

const DECISION_PREFIX = {
  optimal: '✓ EXEC:',
  cautious: '⚠ EXEC:',
  risky:   '⚡ HIGH-RISK:',
};

const DECISION_TYPE = {
  optimal: 'success',
  cautious: 'caution',
  risky:   'danger',
};

export const CrisisTicker = {
  _el: null,
  _track: null,
  _btn: null,
  _count: null,
  _unread: 0,
  _headlines: [...BASE_HEADLINES],
  _initialized: false,

  init() {
    this._el = document.getElementById('crisis-ticker');
    if (!this._el) return;
    this._track = this._el.querySelector('.ticker-track');
    this._btn   = document.getElementById('hud-news-btn');
    this._count = document.getElementById('hud-news-count');
    if (!this._initialized) {
      this._btn?.addEventListener('click', () => this.toggle());
      this._el.querySelector('.ticker-close')?.addEventListener('click', () => this.toggle(false));
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && this._el && !this._el.hidden) this.toggle(false);
      });
    }
    this._render();
    this._initialized = true;
  },

  /** Game is running — the News button becomes available (drawer stays closed). */
  show() {
    if (!this._initialized) this.init();
    if (this._btn) this._btn.hidden = false;
  },

  hide() {
    this.toggle(false);
    if (this._btn) this._btn.hidden = true;
  },

  /** Open/close the news drawer. */
  toggle(force) {
    if (!this._el) return;
    const open = force ?? this._el.hidden;
    this._el.hidden = !open;
    this._el.classList.toggle('active', open);
    this._btn?.setAttribute('aria-expanded', String(open));
    if (open) {
      this._unread = 0;
      this._updateCount();
      this._el.querySelector('.ticker-close')?.focus();
    } else if (this._el.contains(document.activeElement)) {
      this._btn?.focus();
    }
  },

  /**
   * Add a player-decision headline at the top of the feed.
   * @param {string} label     - The option label the player picked
   * @param {string} alignment - 'optimal' | 'cautious' | 'risky'
   * @param {string} outcome   - The outcome text (truncated if long)
   * @param {string} [kind]    - 'decision' (player choice) | 'crisis' (in-game event)
   */
  inject(label, alignment, outcome, kind = 'decision') {
    if (!this._initialized) this.init();
    const prefix = DECISION_PREFIX[alignment] || 'EXEC:';
    const short  = outcome && outcome.length > 90 ? outcome.slice(0, 90) + '…' : outcome || '';
    this._headlines.unshift({
      text:  `${prefix} ${label} — ${short}`,
      type:  DECISION_TYPE[alignment] || 'update',
      fresh: true,
      game:  kind,
    });
    // Cap the injected extras so base headlines still rotate
    const maxTotal = BASE_HEADLINES.length + 4;
    if (this._headlines.length > maxTotal) {
      this._headlines = this._headlines.slice(0, maxTotal);
    }
    if (this._el?.hidden) { this._unread++; this._updateCount(); }
    this._render();
    // Clear the "fresh" flag after the flash animation completes
    setTimeout(() => this._headlines.forEach(h => { h.fresh = false; }), 2500);
  },

  _updateCount() {
    if (!this._count) return;
    this._count.hidden = this._unread === 0;
    this._count.textContent = this._unread ? String(this._unread) : '';
    this._btn?.setAttribute('aria-label', this._unread ? `News, ${this._unread} new from your game` : 'News');
  },

  _render() {
    if (!this._track) return;
    const escape = (t) => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    this._track.innerHTML = this._headlines.map(h => {
      const tag = h.game === 'crisis' ? 'Crisis' : h.game ? 'Your decision' : h.type;
      return `<li class="ticker-item ticker-item--${h.type}${h.fresh ? ' ticker-item--fresh' : ''}${h.game ? ' ticker-item--game' : ''}">` +
        `<span class="ticker-label">${escape(tag)}</span><span class="ticker-text">${escape(h.text)}</span></li>`;
    }).join('');
  },
};
