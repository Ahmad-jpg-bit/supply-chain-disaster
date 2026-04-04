import Head from 'next/head';
import Link from 'next/link';
import { useState, useMemo } from 'react';

const TIERS = [
  { id: 'consumer',   label: 'Consumer Demand',    color: 'efficient' },
  { id: 'retailer',   label: 'Retailer Orders',    color: 'moderate'  },
  { id: 'wholesaler', label: 'Wholesaler Orders',  color: 'high'      },
  { id: 'mfg',        label: 'Manufacturer Output', color: 'critical'  },
];

const PERIODS = ['Q1', 'Q2', 'Q3', 'Q4', 'Q5'];

const DEFAULT_VALUES = {
  consumer:   [1000, 1050, 980,  1100, 1020],
  retailer:   [1000, 1200, 850,  1350, 950],
  wholesaler: [1000, 1400, 700,  1600, 800],
  mfg:        [1000, 1700, 600,  1900, 700],
};

function variance(arr) {
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.reduce((s, v) => s + (v - mean) ** 2, 0) / arr.length;
}

function getStatus(ratio) {
  if (ratio < 1.2)  return { label: 'EFFICIENT', cls: 'efficient' };
  if (ratio < 1.5)  return { label: 'MODERATE',  cls: 'moderate'  };
  if (ratio < 2.5)  return { label: 'HIGH',       cls: 'high'      };
  return                   { label: 'CRITICAL',   cls: 'critical'  };
}

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
  name: 'Bullwhip Effect Calculator',
  url: 'https://tools.supplychaindisaster.com/bullwhip-effect-calculator',
  description: 'Calculate your supply chain Bullwhip Effect ratio. Enter demand and order data across 4 tiers to measure variance amplification.',
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
};

export default function BullwhipEffectCalculator() {
  const [consumerDemand,   setConsumerDemand]   = useState([...DEFAULT_VALUES.consumer]);
  const [retailerOrders,   setRetailerOrders]   = useState([...DEFAULT_VALUES.retailer]);
  const [wholesalerOrders, setWholesalerOrders] = useState([...DEFAULT_VALUES.wholesaler]);
  const [mfgOutput,        setMfgOutput]        = useState([...DEFAULT_VALUES.mfg]);

  function updateTier(setter, i, val) {
    setter(prev => {
      const next = [...prev];
      next[i] = Number(val) || 0;
      return next;
    });
  }

  const calc = useMemo(() => {
    const consumerVar    = variance(consumerDemand);
    const retailerVar    = variance(retailerOrders);
    const wholesalerVar  = variance(wholesalerOrders);
    const mfgVar         = variance(mfgOutput);

    const retailerRatio   = consumerVar === 0 ? 1 : retailerVar   / consumerVar;
    const wholesalerRatio = consumerVar === 0 ? 1 : wholesalerVar / consumerVar;
    const mfgRatio        = consumerVar === 0 ? 1 : mfgVar        / consumerVar;
    const consumerRatio   = 1.0;

    return {
      rows: [
        { tier: 'Consumer Demand',     variance: consumerVar,   ratio: consumerRatio,   status: getStatus(consumerRatio)   },
        { tier: 'Retailer Orders',     variance: retailerVar,   ratio: retailerRatio,   status: getStatus(retailerRatio)   },
        { tier: 'Wholesaler Orders',   variance: wholesalerVar, ratio: wholesalerRatio, status: getStatus(wholesalerRatio) },
        { tier: 'Manufacturer Output', variance: mfgVar,        ratio: mfgRatio,        status: getStatus(mfgRatio)        },
      ],
      chainRatio: mfgRatio,
      maxRatio: Math.max(consumerRatio, retailerRatio, wholesalerRatio, mfgRatio),
    };
  }, [consumerDemand, retailerOrders, wholesalerOrders, mfgOutput]);

  const tierInputs = [
    { label: 'Consumer Demand',     data: consumerDemand,   setter: setConsumerDemand,   cls: 'efficient' },
    { label: 'Retailer Orders',     data: retailerOrders,   setter: setRetailerOrders,   cls: 'moderate'  },
    { label: 'Wholesaler Orders',   data: wholesalerOrders, setter: setWholesalerOrders, cls: 'high'      },
    { label: 'Manufacturer Output', data: mfgOutput,        setter: setMfgOutput,        cls: 'critical'  },
  ];

  return (
    <>
      <Head>
        <title>Bullwhip Effect Calculator — Supply Chain Variance Ratio Tracker | Supply Chain Disaster Tools</title>
        <meta name="description" content="Calculate your supply chain's Bullwhip Effect ratio. Enter demand and order data across 4 tiers to measure variance amplification and identify inefficiencies." />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://tools.supplychaindisaster.com/bullwhip-effect-calculator" />
        <meta property="og:title" content="Bullwhip Effect Calculator — Supply Chain Variance Ratio Tracker" />
        <meta property="og:description" content="Calculate your supply chain Bullwhip Effect ratio across 4 tiers to measure demand variance amplification." />
        <meta property="og:url" content="https://tools.supplychaindisaster.com/bullwhip-effect-calculator" />
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
          <span className="nav-title">Bullwhip Effect Calculator</span>
          <span className="nav-badge">FREE TOOL</span>
        </nav>

        <header className="calc-hero">
          <div className="calc-tool-badge">📊 Supply Chain Calculator</div>
          <h1>Bullwhip Effect Calculator: Measure Supply Chain Amplification</h1>
          <p className="calc-lead">
            Enter historical order quantities across all 4 supply chain tiers to calculate your Bullwhip Ratio — the measure of how demand variance amplifies as it travels upstream.
          </p>
        </header>

        {/* ── Tier Inputs ── */}
        <div className="glass-card calc-panel" style={{ marginBottom: '1.5rem' }}>
          <div className="calc-panel-title">Historical Order Data (5 periods)</div>

          {tierInputs.map(({ label, data, setter, cls }) => (
            <div key={label} className="bw-tier-inputs">
              <div className={`bw-tier-label bw-status--${cls}`} style={{ marginBottom: '0.5rem' }}>
                {label}
              </div>
              <div style={{ marginBottom: '0.25rem' }}>
                <div className="bw-inputs-row">
                  {PERIODS.map((p, i) => (
                    <div key={p}>
                      <div className="bw-period-label">{p}</div>
                      <input
                        type="number"
                        className="calc-input"
                        style={{ textAlign: 'center', padding: '0.4rem 0.3rem' }}
                        value={data[i]}
                        min={0}
                        onChange={e => updateTier(setter, i, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Critical Banner ── */}
        {calc.chainRatio > 1.5 && (
          <div className="bw-critical-banner">
            ⚠ CRITICAL: High Supply Chain Inefficiency Detected — Demand amplification exceeds safe thresholds. Review ordering policies upstream.
          </div>
        )}

        {/* ── Chain Summary ── */}
        <div className="glass-card calc-output" style={{ marginBottom: '1.5rem' }}>
          <div className="calc-output-grid" style={{ marginBottom: '1.5rem' }}>
            <div className="calc-big-stat">
              <div className="calc-big-label">Chain Bullwhip Ratio</div>
              <div className={`calc-big-val calc-big-val--${calc.chainRatio > 2.5 ? 'days' : 'cost'}`}
                style={{ color: calc.chainRatio > 2.5 ? 'var(--danger)' : calc.chainRatio > 1.5 ? 'var(--warning)' : calc.chainRatio > 1.2 ? 'var(--amber)' : 'var(--success)' }}
              >
                {calc.chainRatio.toFixed(2)}×
              </div>
            </div>
            <div className="calc-big-stat">
              <div className="calc-big-label">Chain Status</div>
              <div style={{ marginTop: '0.5rem' }}>
                <span className={`bw-status-badge bw-status--${getStatus(calc.chainRatio).cls}`}>
                  {getStatus(calc.chainRatio).label}
                </span>
              </div>
            </div>
          </div>

          {/* ── Results Table ── */}
          <table className="bw-ratio-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th>Variance</th>
                <th>Bullwhip Ratio</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {calc.rows.map(row => (
                <tr key={row.tier}>
                  <td style={{ fontWeight: 600 }}>{row.tier}</td>
                  <td style={{ fontFamily: 'var(--font-mono)' }}>{row.variance.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                  <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{row.ratio.toFixed(2)}×</td>
                  <td>
                    <span className={`bw-status-badge bw-status--${row.status.cls}`}>
                      {row.status.label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Bar Chart ── */}
        <div className="glass-card calc-panel" style={{ marginBottom: '1.5rem' }}>
          <div className="calc-panel-title">Bullwhip Ratio — Visual Comparison</div>
          <div className="bw-bar-chart">
            {calc.rows.map(row => {
              const pct = Math.min(100, (row.ratio / Math.max(calc.maxRatio, 1)) * 100);
              return (
                <div key={row.tier} className="bw-bar-row">
                  <div className="bw-bar-tier">{row.tier}</div>
                  <div className="bw-bar-track">
                    <div
                      className={`bw-bar-fill bw-bar-fill--${row.status.cls}`}
                      style={{ width: `${pct}%` }}
                    >
                      <span className="bw-bar-val">{row.ratio.toFixed(2)}×</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
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
          <p>Bullwhip Effect calculations use population variance. Default values are illustrative. Enter your own historical data for accurate results. Updated March 2026.</p>
          <Link href="/" className="footer-link">← All Trade Lane Tools</Link>
        </footer>
      </div>
    </>
  );
}
