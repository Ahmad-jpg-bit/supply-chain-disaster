import './shared/base.css';
import './shared/nav.css';
import './shared/pages.css';
import { createNav } from './shared/nav.js';
import { createFooter } from './shared/footer.js';
import { initAmbientParticles } from './shared/particles-lite.js';
import { FREIGHT_ORIGINS, EU_PORTS } from './data/freight-data.js';

const CRISIS_FACTORS = [
  { id: 'port-congestion',   label: 'Port Congestion',             days: 14, cost: 800  },
  { id: 'suez-disruption',   label: 'Suez Canal Disruption',       days: 10, cost: 1200 },
  { id: 'red-sea-rerouting', label: 'Red Sea Rerouting – Cape',    days: 12, cost: 2400 },
  { id: 'port-strike',       label: 'Port Strike',                 days: 16, cost: 1400 },
  { id: 'weather-delay',     label: 'Typhoon / Weather Delay',     days: 5,  cost: 300  },
  { id: 'customs-backlog',   label: 'Customs Backlog',             days: 7,  cost: 200  },
];

const SHIPPING_MODES = [
  { id: 'sea',  label: '🚢 Sea Freight',  daysMult: 1.0,  costMult: 1.0 },
  { id: 'air',  label: '✈️ Air Freight',   daysMult: 0.12, costMult: 7.5 },
  { id: 'rail', label: '🚂 Rail Freight',  daysMult: 0.55, costMult: 2.1 },
];

function getRiskLevel(count) {
  if (count === 0) return { level: 'LOW',      cls: 'low'      };
  if (count === 1) return { level: 'MEDIUM',   cls: 'medium'   };
  if (count === 2) return { level: 'HIGH',     cls: 'high'     };
  return                   { level: 'CRITICAL', cls: 'critical' };
}

const FAQ = [
  {
    q: 'What is freight lead time?',
    a: 'Freight lead time is the total time from placing a purchase order to receiving goods at the destination port or warehouse. It includes origin handling, ocean or air transit, and destination customs clearance. For sea freight from Asia to Europe, typical baseline lead times range from 18 to 35 days depending on the origin port.',
  },
  {
    q: 'How does the Suez Canal disruption affect lead times?',
    a: 'The Suez Canal disruption, driven by Houthi attacks in the Red Sea since late 2023, has forced many carriers to reroute vessels via the Cape of Good Hope. This adds approximately 10–14 days to Asia-Europe transit times and significantly increases fuel and operating costs, typically adding $1,200–$2,400 per TEU in additional freight surcharges.',
  },
  {
    q: 'What is the difference between sea freight and air freight lead time?',
    a: 'Sea freight from Shanghai to Hamburg takes approximately 28–35 days, while air freight covers the same route in 3–5 days. Air freight is roughly 7–8x faster but costs 6–8x more per TEU equivalent. Rail freight sits in between, taking 14–20 days from China to Europe via the China–Europe rail corridor at 2–2.5x sea freight cost.',
  },
  {
    q: 'How do port strikes affect supply chains?',
    a: 'Port strikes can add 14–20 days to lead times as vessels queue, divert to alternative ports, or wait for strike resolution. They also trigger emergency rerouting costs and demurrage charges. Major port strikes at Hamburg, Antwerp, or US East Coast have historically caused widespread supply chain disruption lasting weeks to months.',
  },
];

// ── State ──────────────────────────────────────────────────────────────────
let state = {
  originId: FREIGHT_ORIGINS[0].id,
  destId:   EU_PORTS[0].id,
  mode:     'sea',
  baseDays: 30,
  activeCrises: new Set(),
};

// ── Compute ────────────────────────────────────────────────────────────────
function compute() {
  const origin  = FREIGHT_ORIGINS.find(o => o.id === state.originId);
  const dest    = EU_PORTS.find(d => d.id === state.destId);
  const modeObj = SHIPPING_MODES.find(m => m.id === state.mode);

  const zone           = dest.zone;
  const baseFreightSea = origin.euZone[zone] ?? origin.euZone['north'];
  const modeAdjDays    = Math.round(state.baseDays * modeObj.daysMult);
  const baseFreight    = Math.round(baseFreightSea * modeObj.costMult);

  let crisisDays = 0;
  let crisisCost = 0;
  for (const c of CRISIS_FACTORS) {
    if (state.activeCrises.has(c.id)) {
      crisisDays += c.days;
      crisisCost += c.cost;
    }
  }

  const totalDays    = modeAdjDays + crisisDays;
  const totalCost    = baseFreight + crisisCost;
  const modeAdjLabel = modeObj.daysMult === 1.0
    ? `${state.baseDays}d × 1.0`
    : `${state.baseDays}d × ${modeObj.daysMult}`;

  return { modeAdjDays, crisisDays, totalDays, baseFreight, crisisCost, totalCost, modeAdjLabel };
}

// ── Render output ──────────────────────────────────────────────────────────
function renderOutput() {
  const r    = compute();
  const risk = getRiskLevel(state.activeCrises.size);
  const mode = SHIPPING_MODES.find(m => m.id === state.mode);

  document.getElementById('ltc-total-days').textContent  = `${r.totalDays} days`;
  document.getElementById('ltc-total-cost').textContent  = `$${r.totalCost.toLocaleString()}`;
  document.getElementById('ltc-crisis-days').textContent = `+${r.crisisDays}d`;
  document.getElementById('ltc-crisis-days').style.color = r.crisisDays > 0
    ? 'var(--danger-color)' : 'var(--success-color)';

  const badge = document.getElementById('ltc-risk-badge');
  badge.textContent  = risk.level;
  badge.className    = `calc-risk-badge calc-risk-badge--${risk.cls}`;

  document.getElementById('ltc-row-base').textContent    = `${state.baseDays}d`;
  document.getElementById('ltc-row-mode').textContent    = `${r.modeAdjLabel} = ${r.modeAdjDays}d`;
  document.getElementById('ltc-row-crisis').textContent  = `+${r.crisisDays}d`;
  document.getElementById('ltc-row-total').textContent   = `${r.totalDays}d`;
  document.getElementById('ltc-mode-label').textContent  = mode.label;
}

// ── Build DOM ──────────────────────────────────────────────────────────────
function mount(root) {
  root.innerHTML = `
    <div class="page-content">

      <header class="hero-section">
        <div class="calc-tool-badge">⏱ Freight Calculator</div>
        <h1>Freight Lead Time Calculator</h1>
        <p class="hero-subtitle">
          Enter your origin port, destination, and shipping mode to get an estimated transit time with
          crisis disruption factors including Red Sea rerouting, port strikes, and Suez Canal delays.
        </p>
      </header>

      <div class="calc-two-col">

        <!-- ── Route & Mode ── -->
        <div class="content-card calc-inputs-card">
          <h2>Route &amp; Mode</h2>

          <div class="calc-field">
            <label class="calc-label" for="ltc-origin">Origin Port</label>
            <select id="ltc-origin" class="calc-select">
              ${FREIGHT_ORIGINS.map(o => `<option value="${o.id}">${o.name}, ${o.country}</option>`).join('')}
            </select>
          </div>

          <div class="calc-field">
            <label class="calc-label" for="ltc-dest">Destination (EU Port)</label>
            <select id="ltc-dest" class="calc-select">
              ${EU_PORTS.map(d => `<option value="${d.id}">${d.name}, ${d.country}</option>`).join('')}
            </select>
          </div>

          <div class="calc-field">
            <label class="calc-label" for="ltc-mode">Shipping Mode</label>
            <select id="ltc-mode" class="calc-select">
              ${SHIPPING_MODES.map(m => `<option value="${m.id}">${m.label}</option>`).join('')}
            </select>
          </div>

          <div class="calc-field">
            <label class="calc-label" for="ltc-basedays">Base Lead Time (days)</label>
            <input id="ltc-basedays" type="number" class="calc-number-input"
              value="30" min="1" max="180" />
          </div>
        </div>

        <!-- ── Crisis Factors ── -->
        <div class="content-card calc-inputs-card">
          <h2>Crisis Factors</h2>
          <div class="crisis-list">
            ${CRISIS_FACTORS.map(c => `
              <label class="crisis-item" data-id="${c.id}">
                <input type="checkbox" class="crisis-check" data-id="${c.id}" />
                <span class="crisis-text">
                  <span class="crisis-name">${c.label}</span>
                  <span class="crisis-impact">+${c.days}d / +$${c.cost.toLocaleString()}/TEU</span>
                </span>
              </label>
            `).join('')}
          </div>
        </div>
      </div>

      <!-- ── Output ── -->
      <div class="content-card calc-output-card">
        <div class="calc-stats-grid">
          <div class="calc-stat">
            <div class="calc-stat-label">Total Lead Time</div>
            <div id="ltc-total-days" class="calc-stat-val calc-stat-val--days">30 days</div>
          </div>
          <div class="calc-stat">
            <div class="calc-stat-label">Risk Level</div>
            <div style="margin-top:0.5rem">
              <span id="ltc-risk-badge" class="calc-risk-badge calc-risk-badge--low">LOW</span>
            </div>
          </div>
          <div class="calc-stat">
            <div class="calc-stat-label">Freight Cost / TEU</div>
            <div id="ltc-total-cost" class="calc-stat-val calc-stat-val--cost">$0</div>
          </div>
          <div class="calc-stat">
            <div class="calc-stat-label">Crisis Days Added</div>
            <div id="ltc-crisis-days" class="calc-stat-val" style="color:var(--success-color)">+0d</div>
          </div>
        </div>

        <table class="calc-breakdown-table">
          <thead>
            <tr><th>Component</th><th>Days</th></tr>
          </thead>
          <tbody>
            <tr><td>Base Lead Time</td><td id="ltc-row-base">30d</td></tr>
            <tr><td>Mode Adjustment (<span id="ltc-mode-label">🚢 Sea Freight</span>)</td><td id="ltc-row-mode">-</td></tr>
            <tr><td>Crisis Days Added</td><td id="ltc-row-crisis">+0d</td></tr>
            <tr style="font-weight:700"><td>Total Lead Time</td><td id="ltc-row-total">-</td></tr>
          </tbody>
        </table>
      </div>

      <!-- ── FAQ ── -->
      <section class="calc-faq-section">
        <h2>Frequently Asked Questions</h2>
        ${FAQ.map(({ q, a }) => `
          <div class="calc-faq-item">
            <div class="calc-faq-q">${q}</div>
            <div class="calc-faq-a">${a}</div>
          </div>
        `).join('')}
      </section>

    </div>
  `;

  // ── Wire up events ──
  document.getElementById('ltc-origin').addEventListener('change', e => {
    state.originId = e.target.value;
    renderOutput();
  });
  document.getElementById('ltc-dest').addEventListener('change', e => {
    state.destId = e.target.value;
    renderOutput();
  });
  document.getElementById('ltc-mode').addEventListener('change', e => {
    state.mode = e.target.value;
    renderOutput();
  });
  document.getElementById('ltc-basedays').addEventListener('input', e => {
    const v = Math.max(1, Math.min(180, parseInt(e.target.value) || 1));
    state.baseDays = v;
    renderOutput();
  });
  root.querySelectorAll('.crisis-check').forEach(cb => {
    cb.addEventListener('change', e => {
      const id = e.target.dataset.id;
      if (e.target.checked) state.activeCrises.add(id);
      else state.activeCrises.delete(id);
      // toggle active class on label
      e.target.closest('.crisis-item').classList.toggle('crisis-item--active', e.target.checked);
      renderOutput();
    });
  });

  renderOutput();
}

// ── Init ───────────────────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  createNav('');
  mount(document.getElementById('calc-root'));
  createFooter();
  initAmbientParticles();
});
