import Head from 'next/head';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { ORIGINS, EU_DESTINATIONS } from '../data/trade-lanes';

const CRISIS_FACTORS = [
  { id: 'port-congestion',   label: 'Port Congestion',                    days: 14, cost: 800  },
  { id: 'suez-disruption',   label: 'Suez Canal Disruption',              days: 10, cost: 1200 },
  { id: 'red-sea-rerouting', label: 'Red Sea Rerouting – Cape',           days: 12, cost: 2400 },
  { id: 'port-strike',       label: 'Port Strike',                        days: 16, cost: 1400 },
  { id: 'weather-delay',     label: 'Typhoon / Weather Delay',            days: 5,  cost: 300  },
  { id: 'customs-backlog',   label: 'Customs Backlog',                    days: 7,  cost: 200  },
];

const SHIPPING_MODES = [
  { id: 'sea',  label: '🚢 Sea Freight',  daysMult: 1.0,  costMult: 1.0 },
  { id: 'air',  label: '✈️ Air Freight',   daysMult: 0.12, costMult: 7.5 },
  { id: 'rail', label: '🚂 Rail Freight',  daysMult: 0.55, costMult: 2.1 },
];

function getRiskLevel(activeCrisisCount) {
  if (activeCrisisCount === 0) return { level: 'LOW',      cls: 'low' };
  if (activeCrisisCount === 1) return { level: 'MEDIUM',   cls: 'medium' };
  if (activeCrisisCount === 2) return { level: 'HIGH',     cls: 'high' };
  return                              { level: 'CRITICAL', cls: 'critical' };
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

const faqSchema = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({
    '@type': 'Question',
    name: q,
    acceptedAnswer: { '@type': 'Answer', text: a },
  })),
};

const appSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebApplication',
  name: 'Freight Lead Time Calculator',
  url: 'https://tools.supplychaindisaster.com/lead-time-calculator',
  description: 'Free freight lead time calculator with Red Sea, Suez Canal, port strike and other disruption factors.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function LeadTimeCalculator() {
  const [originId,    setOriginId]    = useState(ORIGINS[0].id);
  const [destId,      setDestId]      = useState(EU_DESTINATIONS[0].id);
  const [mode,        setMode]        = useState('sea');
  const [baseDays,    setBaseDays]    = useState(30);
  const [activeCrises, setActiveCrises] = useState(new Set());

  function toggleCrisis(id) {
    setActiveCrises(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const result = useMemo(() => {
    const origin = ORIGINS.find(o => o.id === originId);
    const dest   = EU_DESTINATIONS.find(d => d.id === destId);
    const modeObj = SHIPPING_MODES.find(m => m.id === mode);

    const euZone = dest.euZone;
    const baseFreightSea = origin.baseFreightSea[euZone] ?? origin.baseFreightSea['north'];

    const modeAdjDays  = Math.round(baseDays * modeObj.daysMult);
    const baseFreight  = Math.round(baseFreightSea * modeObj.costMult);

    let crisisDays = 0;
    let crisisCost = 0;
    for (const c of CRISIS_FACTORS) {
      if (activeCrises.has(c.id)) {
        crisisDays += c.days;
        crisisCost += c.cost;
      }
    }

    const totalDays    = modeAdjDays + crisisDays;
    const totalCost    = baseFreight + crisisCost;
    const modeAdjLabel = modeObj.daysMult === 1.0
      ? `${baseDays}d × 1.0`
      : `${baseDays}d × ${modeObj.daysMult}`;

    return { modeAdjDays, crisisDays, totalDays, baseFreight, crisisCost, totalCost, modeAdjLabel };
  }, [originId, destId, mode, baseDays, activeCrises]);

  const risk = getRiskLevel(activeCrises.size);

  return (
    <>
      <Head>
        <title>Lead Time Calculator — Freight &amp; Shipping Delay Estimator 2026 | Supply Chain Disaster Tools</title>
        <meta name="description" content="Free freight lead time calculator. Enter origin port, destination, and shipping mode to get estimated transit times with Red Sea, Suez Canal, and port strike disruption factors." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://tools.supplychaindisaster.com/lead-time-calculator" />
        <meta property="og:title" content="Lead Time Calculator — Freight & Shipping Delay Estimator 2026" />
        <meta property="og:description" content="Free freight lead time calculator with Red Sea, Suez Canal and port strike disruption factors." />
        <meta property="og:url" content="https://tools.supplychaindisaster.com/lead-time-calculator" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="page-shell calc-page">
        <nav className="top-nav">
          <Link href="/" className="nav-back">← All Trade Lane Tools</Link>
          <span className="nav-title">Lead Time Calculator</span>
          <span className="nav-badge">FREE TOOL</span>
        </nav>

        <header className="calc-hero">
          <div className="calc-tool-badge">⏱ Freight Calculator</div>
          <h1>Freight Lead Time Calculator: Predict Shipping Delays in 2026</h1>
          <p className="calc-lead">
            Enter your origin port, destination, and shipping mode to get an estimated transit time with crisis disruption factors including Red Sea rerouting, port strikes, and Suez Canal delays.
          </p>
        </header>

        <div className="calc-grid-layout">
          {/* ── Inputs ── */}
          <div className="glass-card calc-panel">
            <div className="calc-panel-title">Route & Mode</div>

            <div className="calc-field">
              <label className="calc-label" htmlFor="origin-select">Origin Port</label>
              <select
                id="origin-select"
                className="calc-select"
                value={originId}
                onChange={e => setOriginId(e.target.value)}
              >
                {ORIGINS.map(o => (
                  <option key={o.id} value={o.id}>{o.name}, {o.country}</option>
                ))}
              </select>
            </div>

            <div className="calc-field">
              <label className="calc-label" htmlFor="dest-select">Destination (EU Port)</label>
              <select
                id="dest-select"
                className="calc-select"
                value={destId}
                onChange={e => setDestId(e.target.value)}
              >
                {EU_DESTINATIONS.map(d => (
                  <option key={d.id} value={d.id}>{d.name}, {d.country}</option>
                ))}
              </select>
            </div>

            <div className="calc-field">
              <label className="calc-label" htmlFor="mode-select">Shipping Mode</label>
              <select
                id="mode-select"
                className="calc-select"
                value={mode}
                onChange={e => setMode(e.target.value)}
              >
                {SHIPPING_MODES.map(m => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>

            <div className="calc-field">
              <label className="calc-label" htmlFor="base-days">Base Lead Time (days)</label>
              <input
                id="base-days"
                type="number"
                className="calc-input"
                value={baseDays}
                min={1}
                max={180}
                onChange={e => setBaseDays(Math.max(1, Math.min(180, Number(e.target.value) || 1)))}
              />
            </div>
          </div>

          {/* ── Crisis Factors ── */}
          <div className="glass-card calc-panel">
            <div className="calc-panel-title">Crisis Factors</div>
            <div className="crisis-list">
              {CRISIS_FACTORS.map(c => {
                const active = activeCrises.has(c.id);
                return (
                  <label
                    key={c.id}
                    className={`crisis-item${active ? ' crisis-item--active' : ''}`}
                  >
                    <input
                      type="checkbox"
                      className="crisis-check"
                      checked={active}
                      onChange={() => toggleCrisis(c.id)}
                    />
                    <span className="crisis-text">
                      <span className="crisis-name">{c.label}</span>
                      <span className="crisis-impact">+{c.days}d / +${c.cost.toLocaleString()}/TEU</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── Output ── */}
        <div className="glass-card calc-output">
          <div className="calc-output-grid">
            <div className="calc-big-stat">
              <div className="calc-big-label">Total Lead Time</div>
              <div className="calc-big-val calc-big-val--days">{result.totalDays} days</div>
            </div>
            <div className="calc-big-stat">
              <div className="calc-big-label">Risk Level</div>
              <div style={{ marginTop: '0.5rem' }}>
                <span className={`risk-badge risk-badge--${risk.cls}`}>{risk.level}</span>
              </div>
            </div>
            <div className="calc-big-stat">
              <div className="calc-big-label">Freight Cost / TEU</div>
              <div className="calc-big-val calc-big-val--cost">${result.totalCost.toLocaleString()}</div>
            </div>
            <div className="calc-big-stat">
              <div className="calc-big-label">Crisis Days Added</div>
              <div className="calc-big-val" style={{ color: result.crisisDays > 0 ? 'var(--danger)' : 'var(--success)' }}>
                +{result.crisisDays}d
              </div>
            </div>
          </div>

          <table className="calc-breakdown">
            <thead>
              <tr>
                <th>Component</th>
                <th>Days</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Base Lead Time</td>
                <td>{baseDays}d</td>
              </tr>
              <tr>
                <td>Mode Adjustment ({SHIPPING_MODES.find(m => m.id === mode)?.label})</td>
                <td>{result.modeAdjLabel} = {result.modeAdjDays}d</td>
              </tr>
              <tr>
                <td>Crisis Days Added</td>
                <td>+{result.crisisDays}d</td>
              </tr>
              <tr>
                <td>Total Lead Time</td>
                <td>{result.totalDays}d</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── FAQ ── */}
        <section className="calc-faq">
          <h2 className="calc-faq-title">Frequently Asked Questions</h2>
          {FAQ.map(({ q, a }) => (
            <div key={q} className="calc-faq-item">
              <div className="calc-faq-q">{q}</div>
              <div className="calc-faq-a">{a}</div>
            </div>
          ))}
        </section>

        <footer className="page-footer" style={{ marginTop: '3rem' }}>
          <p>Lead time estimates are based on industry-average transit times. Actual times may vary by carrier, season, and port conditions. Data updated March 2026.</p>
          <Link href="/" className="footer-link">← All Trade Lane Tools</Link>
        </footer>
      </div>
    </>
  );
}
