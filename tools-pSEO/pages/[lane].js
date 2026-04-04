import Head from 'next/head';
import Link from 'next/link';
import { generateAllLanes, getLaneById, calculateLandedCost, getNearshoreAlternative, PRODUCT_CATEGORIES } from '../data/trade-lanes';
import { COMPLIANCE_ITEMS, DISASTER_SCENARIOS } from '../data/compliance';
import EUResilienceTool from '../components/EUResilienceTool';
import ComplianceBadge from '../components/ComplianceBadge';

export async function getStaticPaths() {
  const lanes = generateAllLanes();
  const paths = lanes.map(lane => ({
    params: { lane: lane.slug },
  }));
  return { paths, fallback: false };
}

export async function getStaticProps({ params }) {
  const lane = getLaneById(params.lane);
  if (!lane) return { notFound: true };

  const nearshoreLane = getNearshoreAlternative(lane.destination.id);

  // Pre-compute default costs (1,000 units, $50 FOB, electronics)
  const defaultCosts = {
    modeA: calculateLandedCost({ lane, orderQty: 1000, unitValueUSD: 50, productCategory: 'electronics' }),
    modeB: calculateLandedCost({ lane: nearshoreLane, orderQty: 1000, unitValueUSD: 60, productCategory: 'electronics' }),
    modeC: calculateLandedCost({ lane, orderQty: 1000, unitValueUSD: 50, productCategory: 'electronics', disasterMode: true }),
  };

  // Serialize (remove circular refs)
  const serializedLane = JSON.parse(JSON.stringify(lane));
  const serializedNearshore = JSON.parse(JSON.stringify(nearshoreLane));

  return {
    props: {
      lane: serializedLane,
      nearshoreLane: serializedNearshore,
      defaultCosts,
      complianceItems: COMPLIANCE_ITEMS,
      disasterScenarios: DISASTER_SCENARIOS,
    },
  };
}

export default function LanePage({ lane, nearshoreLane, defaultCosts, complianceItems, disasterScenarios }) {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: lane.title,
    description: lane.metaDescription,
    url: `https://tools.supplychaindisaster.com/${lane.slug}`,
    applicationCategory: 'BusinessApplication',
    operatingSystem: 'Web',
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
    publisher: {
      '@type': 'Organization',
      name: 'Supply Chain Disaster',
      url: 'https://www.supplychaindisaster.com',
    },
  };

  return (
    <>
      <Head>
        <title>{lane.title}</title>
        <meta name="description" content={lane.metaDescription} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href={`https://tools.supplychaindisaster.com/${lane.slug}`} />
        <meta property="og:type" content="website" />
        <meta property="og:title" content={lane.title} />
        <meta property="og:description" content={lane.metaDescription} />
        <meta property="og:url" content={`https://tools.supplychaindisaster.com/${lane.slug}`} />
        <meta property="og:image" content="https://www.supplychaindisaster.com/og-image.png" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={lane.title} />
        <meta name="twitter:description" content={lane.metaDescription} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="page-shell">
        {/* Top Nav */}
        <nav className="top-nav">
          <Link href="/" className="nav-back">← All Trade Lanes</Link>
          <span className="nav-title">{lane.origin.name} → {lane.destination.name}</span>
          <a href="https://www.supplychaindisaster.com" className="nav-cta">Play the Game →</a>
        </nav>

        {/* Header */}
        <header className="lane-header">
          <div className="lane-breadcrumb">
            <Link href="/">Tools</Link>
            <span>›</span>
            <span>{lane.origin.region}</span>
            <span>›</span>
            <span>{lane.origin.name} to {lane.destination.name}</span>
          </div>

          <div className="lane-mode-pill">
            {lane.freightMode.icon} {lane.freightMode.name}
          </div>

          <h1 className="lane-h1">{lane.h1}</h1>

          <div className="lane-quick-stats">
            <div className="qs-item">
              <span className="qs-label">Base Freight</span>
              <span className="qs-value">${lane.freightCostPerTEU.toLocaleString()}<span className="qs-unit">/TEU</span></span>
            </div>
            <div className="qs-item">
              <span className="qs-label">Transit Time</span>
              <span className="qs-value">{lane.transitDays}<span className="qs-unit">days</span></span>
            </div>
            <div className="qs-item">
              <span className="qs-label">Risk Level</span>
              <span className={`qs-value qs-risk qs-risk--${lane.riskZone.severity}`}>{lane.riskZone.severity.toUpperCase()}</span>
            </div>
            <div className="qs-item">
              <span className="qs-label">CBAM Status</span>
              <span className="qs-value">{lane.destination.cbamActive ? '✓ Active' : '—'}</span>
            </div>
          </div>

          {/* Risk Zone Alert */}
          {lane.riskZone.severity !== 'normal' && (
            <div className={`risk-alert risk-alert--${lane.riskZone.severity}`}>
              <span className="risk-alert-icon">⚠</span>
              <div>
                <strong>{lane.riskZone.name}</strong>
                <p>{lane.riskZone.description}</p>
              </div>
              <span className="risk-alert-mult">{lane.riskZone.multiplier}×</span>
            </div>
          )}
        </header>

        {/* Main Interactive Tool */}
        <main className="tool-main">
          <EUResilienceTool
            lane={lane}
            nearshoreLane={nearshoreLane}
            defaultCosts={defaultCosts}
            productCategories={PRODUCT_CATEGORIES}
            disasterScenarios={disasterScenarios}
          />
        </main>

        {/* Compliance Badge Section */}
        <ComplianceBadge
          items={complianceItems}
          lane={lane}
        />

        {/* SEO Content Section */}
        <section className="seo-content glass-card">
          <h2>About This Trade Lane</h2>
          <p>
            The <strong>{lane.origin.name} ({lane.origin.country}) to {lane.destination.name} ({lane.destination.country})</strong> {lane.freightMode.name.toLowerCase()} corridor is one of the {lane.origin.region}&apos;s primary export routes into the EU single market. The port of {lane.destination.port} serves as a key gateway for {lane.destination.hinterland}.
          </p>
          <p>
            In 2026, this lane is subject to <strong>EU CBAM carbon border adjustment</strong> for specific product categories, EU customs duties averaging {(EU_DUTY_RATES_AVG * 100).toFixed(1)}% on dutiable goods, and elevated freight insurance premiums due to {lane.riskZone.name} conditions.
          </p>
          <h3>Key Factors Affecting This Route in 2026</h3>
          <ul>
            <li><strong>Risk Zone:</strong> {lane.riskZone.name} — {lane.riskZone.description}</li>
            <li><strong>Freight Mode:</strong> {lane.freightMode.name} — typical transit {lane.transitDays} days</li>
            <li><strong>EU Entry Port:</strong> {lane.destination.port} — EU Zone: {lane.destination.euZone.toUpperCase()}</li>
            <li><strong>CBAM:</strong> {lane.destination.cbamActive ? 'Full CBAM reporting and payment required for applicable product categories (steel, aluminium, cement, fertilizers, hydrogen).' : 'Reduced CBAM applicability — verify by product category.'}</li>
          </ul>
          <h3>How to Use This Calculator</h3>
          <p>
            Enter your order quantity, per-unit FOB value, and select your product category. The tool calculates total landed cost including freight, insurance, EU customs duty, CBAM carbon levy, and port handling charges. Use the <strong>Disaster Scenario</strong> tab to simulate what happens to your landed cost and cash flow when a port strike or supply chain disruption hits this lane.
          </p>
        </section>

        <footer className="page-footer">
          <p>Freight data sourced from Freightos Baltic Index, Drewry World Container Index, and UNCTAD. CBAM rates per EU Regulation 2023/956. All costs are estimates for planning purposes — verify with your freight forwarder.</p>
          <a href="https://www.supplychaindisaster.com" className="footer-cta">Experience supply chain decisions in real-time → Play Supply Chain Disaster</a>
        </footer>
      </div>
    </>
  );
}

// Used in SEO content section
const EU_DUTY_RATES_AVG = 0.065;
