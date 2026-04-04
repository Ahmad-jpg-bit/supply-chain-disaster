import './shared/base.css';
import './shared/nav.css';
import './shared/pages.css';
import { createNav } from './shared/nav.js';
import { createFooter } from './shared/footer.js';
import { initAmbientParticles } from './shared/particles-lite.js';

const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

const TIERS = [
  { id: 'consumer',   label: 'Consumer Demand',     cls: 'efficient', defaults: [1000, 1050, 980,  1100, 1020] },
  { id: 'retailer',   label: 'Retailer Orders',     cls: 'moderate',  defaults: [1000, 1200, 850,  1350, 950]  },
  { id: 'wholesaler', label: 'Wholesaler Orders',   cls: 'high',      defaults: [1000, 1400, 700,  1600, 800]  },
  { id: 'mfg',        label: 'Manufacturer Output', cls: 'critical',  defaults: [1000, 1700, 600,  1900, 700]  },
];

const FAQ = [
  {
    q: 'What is the Bullwhip Effect in supply chain management?',
    a: 'The Bullwhip Effect (also called the Forrester Effect) describes the phenomenon where small fluctuations in consumer demand cause increasingly large swings in orders as you move upstream through the supply chain — from retailer to wholesaler to manufacturer. It was first described by Jay Forrester at MIT in 1961 and remains one of the most significant causes of supply chain inefficiency.',
  },
  {
    q: 'How do you calculate the Bullwhip Effect ratio?',
    a: 'The Bullwhip Ratio is calculated as the variance of orders at a given tier divided by the variance of consumer demand. A ratio of 1.0 means no amplification (perfectly efficient), while a ratio of 3.0 means orders at that tier are three times as variable as consumer demand. The formula is: Bullwhip Ratio = Var(Tier Orders) / Var(Consumer Demand).',
  },
  {
    q: 'What is a good Bullwhip ratio?',
    a: 'A Bullwhip Ratio below 1.2 is considered efficient — there is minimal demand amplification. Ratios between 1.2 and 1.5 indicate moderate inefficiency that can often be addressed through better information sharing. Ratios above 1.5 are high and indicate significant ordering policy problems. Ratios above 2.5 are critical and typically require fundamental supply chain redesign.',
  },
  {
    q: 'How do you reduce the Bullwhip Effect?',
    a: 'Key strategies to reduce the Bullwhip Effect include: (1) sharing point-of-sale data upstream so all tiers react to actual consumer demand rather than orders; (2) implementing vendor-managed inventory (VMI) so suppliers can see end demand directly; (3) reducing lead times to decrease the need for safety stock buffers; (4) stabilising pricing to avoid order batching driven by promotions; and (5) using collaborative forecasting (CPFR) across tiers.',
  },
];

// ── State ──────────────────────────────────────────────────────────────────
const tierData = {};
TIERS.forEach(t => { tierData[t.id] = [...t.defaults]; });

// ── Math ───────────────────────────────────────────────────────────────────
function variance(arr) {
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
}

function getStatus(ratio) {
  if (ratio < 1.2) return { label: 'EFFICIENT', cls: 'efficient' };
  if (ratio < 1.5) return { label: 'MODERATE',  cls: 'moderate'  };
  if (ratio < 2.5) return { label: 'HIGH',       cls: 'high'      };
  return                   { label: 'CRITICAL',   cls: 'critical'  };
}

function compute() {
  const vars = {};
  TIERS.forEach(t => { vars[t.id] = variance(tierData[t.id]); });

  const consumerVar = vars.consumer;
  const rows = TIERS.map(t => {
    const ratio  = consumerVar === 0 ? 1 : vars[t.id] / consumerVar;
    return { tier: t.label, variance: vars[t.id], ratio, status: getStatus(ratio), cls: t.cls };
  });
  // consumer ratio is always 1.0
  rows[0].ratio = 1.0;
  rows[0].status = getStatus(1.0);

  const chainRatio = rows[3].ratio;
  const maxRatio   = Math.max(...rows.map(r => r.ratio));
  return { rows, chainRatio, maxRatio };
}

// ── Render output section ──────────────────────────────────────────────────
function renderOutput() {
  const { rows, chainRatio, maxRatio } = compute();
  const chainStatus = getStatus(chainRatio);

  // Chain summary
  document.getElementById('bw-chain-ratio').textContent = `${chainRatio.toFixed(2)}×`;
  document.getElementById('bw-chain-ratio').style.color =
    chainRatio > 2.5 ? 'var(--danger-color)' :
    chainRatio > 1.5 ? '#f97316' :
    chainRatio > 1.2 ? '#f59e0b' : 'var(--success-color)';
  const statusBadge = document.getElementById('bw-chain-status');
  statusBadge.textContent = chainStatus.label;
  statusBadge.className   = `bw-status-badge bw-status--${chainStatus.cls}`;

  // Critical banner
  const banner = document.getElementById('bw-critical-banner');
  banner.style.display = chainRatio > 1.5 ? 'block' : 'none';

  // Table rows
  rows.forEach(row => {
    const tr = document.getElementById(`bw-row-${row.tier.replace(/ /g, '-').toLowerCase()}`);
    if (!tr) return;
    tr.querySelector('.bw-td-variance').textContent = row.variance.toLocaleString(undefined, { maximumFractionDigits: 0 });
    tr.querySelector('.bw-td-ratio').textContent    = `${row.ratio.toFixed(2)}×`;
    const badge = tr.querySelector('.bw-status-badge');
    badge.textContent = row.status.label;
    badge.className   = `bw-status-badge bw-status--${row.status.cls}`;
  });

  // Bar chart
  rows.forEach(row => {
    const bar = document.getElementById(`bw-bar-${row.tier.replace(/ /g, '-').toLowerCase()}`);
    if (!bar) return;
    const pct = Math.min(100, (row.ratio / Math.max(maxRatio, 1)) * 100);
    bar.style.width     = `${pct}%`;
    bar.className       = `bw-bar-fill bw-bar-fill--${row.status.cls}`;
    bar.querySelector('.bw-bar-val').textContent = `${row.ratio.toFixed(2)}×`;
  });
}

// ── Build DOM ──────────────────────────────────────────────────────────────
function mount(root) {
  root.innerHTML = `
    <div class="page-content">

      <header class="hero-section">
        <div class="calc-tool-badge">📊 Supply Chain Calculator</div>
        <h1>Bullwhip Effect Calculator</h1>
        <p class="hero-subtitle">
          Enter historical order quantities across all 4 supply chain tiers to calculate your Bullwhip Ratio —
          the measure of how demand variance amplifies as it travels upstream.
        </p>
      </header>

      <!-- ── Tier Inputs ── -->
      <div class="content-card" style="margin-bottom:1.5rem">
        <h2>Historical Order Data (5 periods)</h2>
        ${TIERS.map(t => `
          <div class="bw-tier-block">
            <div class="bw-tier-label bw-status--${t.cls}">${t.label}</div>
            <div class="bw-inputs-row">
              ${PERIODS.map((p, i) => `
                <div class="bw-input-col">
                  <div class="bw-period-label">${p}</div>
                  <input type="number" class="calc-number-input bw-input"
                    data-tier="${t.id}" data-idx="${i}"
                    value="${t.defaults[i]}" min="0" />
                </div>
              `).join('')}
            </div>
          </div>
        `).join('')}
      </div>

      <!-- ── Critical Banner ── -->
      <div id="bw-critical-banner" class="bw-critical-banner" style="display:none">
        ⚠ CRITICAL: High Supply Chain Inefficiency Detected — Demand amplification exceeds safe thresholds. Review ordering policies upstream.
      </div>

      <!-- ── Chain Summary ── -->
      <div class="content-card calc-output-card" style="margin-bottom:1.5rem">
        <div class="calc-stats-grid calc-stats-grid--2">
          <div class="calc-stat">
            <div class="calc-stat-label">Chain Bullwhip Ratio</div>
            <div id="bw-chain-ratio" class="calc-stat-val" style="color:var(--success-color)">1.00×</div>
          </div>
          <div class="calc-stat">
            <div class="calc-stat-label">Chain Status</div>
            <div style="margin-top:0.5rem">
              <span id="bw-chain-status" class="bw-status-badge bw-status--efficient">EFFICIENT</span>
            </div>
          </div>
        </div>

        <!-- Results Table -->
        <table class="calc-breakdown-table bw-ratio-table">
          <thead>
            <tr><th>Tier</th><th>Variance</th><th>Bullwhip Ratio</th><th>Status</th></tr>
          </thead>
          <tbody>
            ${TIERS.map(t => `
              <tr id="bw-row-${t.label.replace(/ /g, '-').toLowerCase()}">
                <td style="font-weight:600">${t.label}</td>
                <td class="bw-td-variance bw-mono">0</td>
                <td class="bw-td-ratio bw-mono bw-bold">1.00×</td>
                <td><span class="bw-status-badge bw-status--${t.cls}">-</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- ── Bar Chart ── -->
      <div class="content-card" style="margin-bottom:1.5rem">
        <h2>Bullwhip Ratio — Visual Comparison</h2>
        <div class="bw-bar-chart">
          ${TIERS.map(t => `
            <div class="bw-bar-row">
              <div class="bw-bar-tier">${t.label}</div>
              <div class="bw-bar-track">
                <div id="bw-bar-${t.label.replace(/ /g, '-').toLowerCase()}"
                     class="bw-bar-fill bw-bar-fill--${t.cls}" style="width:25%">
                  <span class="bw-bar-val">1.00×</span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
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

  // ── Wire up tier inputs ──
  root.querySelectorAll('.bw-input').forEach(input => {
    input.addEventListener('input', e => {
      const tier = e.target.dataset.tier;
      const idx  = parseInt(e.target.dataset.idx);
      tierData[tier][idx] = Number(e.target.value) || 0;
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
