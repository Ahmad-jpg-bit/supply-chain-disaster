import Head from 'next/head';
import Link from 'next/link';
import { useState, useMemo } from 'react';
import { generateAllLanes, ORIGINS, EU_DESTINATIONS } from '../data/trade-lanes';

const REGION_CONFIG = [
  { label: 'East Asia',      emoji: '🇨🇳', match: r => r === 'East Asia' },
  { label: 'Southeast Asia', emoji: '🌏', match: r => r === 'Southeast Asia' },
  { label: 'South Asia',     emoji: '🇮🇳', match: r => r === 'South Asia' },
  { label: 'Middle East',    emoji: '🕌', match: r => r === 'Middle East' || r === 'Near East' },
  { label: 'Americas',       emoji: '🌎', match: r => r === 'North America' || r === 'South America' },
  { label: 'Africa',         emoji: '🌍', match: r => r.includes('Africa') },
];

export async function getStaticProps() {
  const allLanes = generateAllLanes();

  // Featured lanes
  const featuredSlugs = [
    'shanghai-to-rotterdam-sea-freight',
    'shanghai-to-hamburg-sea-freight',
    'shenzhen-to-antwerp-sea-freight',
    'mumbai-to-hamburg-sea-freight',
    'ho-chi-minh-to-rotterdam-sea-freight',
    'istanbul-to-hamburg-sea-freight',
    'dubai-to-rotterdam-sea-freight',
    'casablanca-to-barcelona-sea-freight',
    'shanghai-to-hamburg-air-freight',
    'shanghai-to-rotterdam-rail-freight',
    'busan-to-hamburg-sea-freight',
    'tokyo-to-rotterdam-sea-freight',
  ];

  const featured = featuredSlugs
    .map(slug => allLanes.find(l => l.id === slug))
    .filter(Boolean)
    .map(l => ({
      id: l.id,
      origin: { name: l.origin.name, country: l.origin.country, region: l.origin.region },
      destination: { name: l.destination.name },
      freightMode: { name: l.freightMode.name, icon: l.freightMode.icon },
      riskZone: { severity: l.riskZone.severity },
      transitDays: l.transitDays,
      freightCostPerTEU: l.freightCostPerTEU,
    }));

  // Lightweight search index — all lanes, minimal fields
  const searchIndex = allLanes.map(l => ({
    id: l.id,
    originName: l.origin.name,
    originCountry: l.origin.country,
    originRegion: l.origin.region,
    destName: l.destination.name,
    destCountry: l.destination.country,
    modeName: l.freightMode.name,
    modeIcon: l.freightMode.icon,
    riskSeverity: l.riskZone.severity,
    transitDays: l.transitDays,
    freightCostPerTEU: l.freightCostPerTEU,
    // pre-built search string for fast matching
    searchText: `${l.origin.name} ${l.origin.country} ${l.origin.region} ${l.destination.name} ${l.destination.country} ${l.freightMode.name}`.toLowerCase(),
  }));

  // Per-region representative lanes for the browse section
  const regionLanes = {};
  for (const cfg of REGION_CONFIG) {
    const originsInRegion = ORIGINS.filter(o => cfg.match(o.region));
    const lanes = [];
    for (const origin of originsInRegion) {
      const preferred = ['hamburg', 'rotterdam', 'antwerp', 'barcelona', 'piraeus'];
      for (const destId of preferred) {
        const slug = `${origin.id}-to-${destId}-sea-freight`;
        const lane = allLanes.find(l => l.id === slug);
        if (lane) {
          lanes.push({
            id: lane.id,
            origin: { name: lane.origin.name, country: lane.origin.country },
            destination: { name: lane.destination.name },
            freightMode: { name: lane.freightMode.name, icon: lane.freightMode.icon },
            riskZone: { severity: lane.riskZone.severity },
            transitDays: lane.transitDays,
            freightCostPerTEU: lane.freightCostPerTEU,
          });
          break;
        }
      }
    }
    regionLanes[cfg.label] = lanes;
  }

  return {
    props: {
      totalLanes: allLanes.length,
      featured,
      originCount: ORIGINS.length,
      destCount: EU_DESTINATIONS.length,
      regionLanes,
      searchIndex,
    },
  };
}

function LaneCard({ lane }) {
  return (
    <Link href={`/${lane.id}`} className="lane-card">
      <div className="lane-card-header">
        <span className="lane-mode-badge">{lane.modeIcon || lane.freightMode?.icon} {lane.modeName || lane.freightMode?.name}</span>
        <span className={`risk-dot risk-dot--${lane.riskSeverity || lane.riskZone?.severity}`} />
      </div>
      <div className="lane-route">
        <span className="lane-origin">{lane.originName || lane.origin?.name}</span>
        <span className="lane-arrow">→</span>
        <span className="lane-dest">{lane.destName || lane.destination?.name}</span>
      </div>
      <div className="lane-meta">
        <span>${lane.freightCostPerTEU.toLocaleString()}/TEU</span>
        <span>{lane.transitDays}d transit</span>
      </div>
    </Link>
  );
}

export default function HomePage({ totalLanes, featured, originCount, destCount, regionLanes, searchIndex }) {
  const [query, setQuery] = useState('');
  const [activeRegion, setActiveRegion] = useState(null);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    return searchIndex.filter(l => l.searchText.includes(q)).slice(0, 24);
  }, [query, searchIndex]);

  const isSearching = query.trim().length >= 2;
  const regionLaneList = !isSearching && activeRegion ? regionLanes[activeRegion] ?? [] : [];

  return (
    <>
      <Head>
        <title>EU Trade Lane Cost Calculator — 2026 Crisis Simulator | Supply Chain Disaster</title>
        <meta name="description" content={`Interactive freight cost calculators for ${totalLanes.toLocaleString()}+ global-to-EU trade lanes. Includes CBAM carbon costs, EU import duties, Red Sea risk multipliers, and disaster scenario simulations.`} />
        <meta name="robots" content="index, follow" />
        <link rel="canonical" href="https://tools.supplychaindisaster.com" />
        <meta property="og:title" content="EU Trade Lane Cost Calculator — 2026 Crisis Simulator" />
        <meta property="og:description" content={`${totalLanes.toLocaleString()}+ interactive freight calculators. Real CBAM rates, EU duties, disruption simulations.`} />
        <meta property="og:url" content="https://tools.supplychaindisaster.com" />
        <meta property="og:image" content="https://www.supplychaindisaster.com/og-image.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Roboto+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
      </Head>

      <div className="page-shell">
        <nav className="top-nav">
          <a href="https://www.supplychaindisaster.com" className="nav-back">← Supply Chain Disaster</a>
          <span className="nav-title">Trade Lane Tools</span>
          <span className="nav-badge">{totalLanes.toLocaleString()}+ Calculators</span>
        </nav>

        <header className="hero-section">
          <div className="hero-badge">⚡ LIVE 2026 DATA</div>
          <h1 className="hero-title">
            EU Trade Lane<br />
            <span className="hero-accent">Cost &amp; Crisis Simulator</span>
          </h1>
          <p className="hero-subtitle">
            Calculate landed costs for any global-to-EU freight lane — with real CBAM carbon levies, EU import duties, Red Sea risk multipliers, and live disaster scenario simulations.
          </p>
          <div className="hero-stats">
            <div className="stat-pill"><strong>{totalLanes.toLocaleString()}</strong> Trade Lanes</div>
            <div className="stat-pill"><strong>{originCount}</strong> Origins</div>
            <div className="stat-pill"><strong>{destCount}</strong> EU Ports</div>
            <div className="stat-pill"><strong>CBAM</strong> Included</div>
          </div>
        </header>

        {/* ── Search ── */}
        <section className="search-section">
          <div className="search-box">
            <svg className="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
            <input
              className="search-input"
              type="search"
              placeholder="Search by city, country, or freight mode… e.g. Tokyo, India air, Lagos Rotterdam"
              value={query}
              onChange={e => { setQuery(e.target.value); setActiveRegion(null); }}
              aria-label="Search trade lanes"
              autoComplete="off"
            />
            {query && (
              <button className="search-clear" onClick={() => setQuery('')} aria-label="Clear search">✕</button>
            )}
          </div>

          {isSearching && (
            <div className="search-results">
              {searchResults.length > 0 ? (
                <>
                  <p className="search-results-label">
                    {searchResults.length === 24 ? '24+ results' : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`} for <strong>&ldquo;{query.trim()}&rdquo;</strong>
                  </p>
                  <div className="lane-grid">
                    {searchResults.map(lane => <LaneCard key={lane.id} lane={lane} />)}
                  </div>
                </>
              ) : (
                <p className="search-empty">No lanes found for <strong>&ldquo;{query.trim()}&rdquo;</strong> — try a city name, country, or mode (sea / air / rail).</p>
              )}
            </div>
          )}
        </section>

        {/* ── Free Calculators (hidden while searching) ── */}
        {!isSearching && (
          <section className="calc-section">
            <h2 className="section-title">Free Supply Chain Calculators</h2>
            <div className="calc-grid">
              <Link href="/lead-time-calculator" className="calc-card">
                <div className="calc-card-icon">⏱</div>
                <h3>Lead Time Predictor</h3>
                <p>Estimate freight transit times with Red Sea, port strike &amp; Suez Canal disruption factors.</p>
                <span className="calc-cta">Open Calculator →</span>
              </Link>
              <Link href="/bullwhip-effect-calculator" className="calc-card">
                <div className="calc-card-icon">📊</div>
                <h3>Bullwhip Effect Tracker</h3>
                <p>Calculate your supply chain&apos;s demand amplification ratio across all 4 tiers.</p>
                <span className="calc-cta">Open Calculator →</span>
              </Link>
            </div>
          </section>
        )}

        {/* ── Featured (hidden while searching) ── */}
        {!isSearching && (
          <section className="featured-section">
            <h2 className="section-title">Featured Trade Lanes</h2>
            <div className="lane-grid">
              {featured.map(lane => <LaneCard key={lane.id} lane={lane} />)}
            </div>
          </section>
        )}

        {/* ── Browse by Region (hidden while searching) ── */}
        {!isSearching && (
          <section className="browse-section">
            <h2 className="section-title">Browse by Origin Region</h2>
            <p className="section-subtitle">Select a region to see available trade lanes to EU ports.</p>
            <div className="region-grid">
              {REGION_CONFIG.map(r => {
                const count = regionLanes[r.label]?.length ?? 0;
                const isActive = activeRegion === r.label;
                return (
                  <button
                    key={r.label}
                    className={`region-card${isActive ? ' region-card--active' : ''}`}
                    onClick={() => setActiveRegion(isActive ? null : r.label)}
                    aria-pressed={isActive}
                  >
                    <span className="region-emoji">{r.emoji}</span>
                    <span className="region-name">{r.label}</span>
                    <span className="region-count">{count} origins</span>
                  </button>
                );
              })}
            </div>

            {activeRegion && regionLaneList.length > 0 && (
              <div className="region-lanes">
                <h3 className="region-lanes-title">{activeRegion} → EU Ports</h3>
                <div className="lane-grid lane-grid--region">
                  {regionLaneList.map(lane => <LaneCard key={lane.id} lane={lane} />)}
                </div>
              </div>
            )}
          </section>
        )}

        <footer className="page-footer">
          <p>Data sourced from UNCTAD, Freightos Baltic Index, EU Taxation &amp; Customs Union, and Drewry World Container Index. Updated March 2026.</p>
          <a href="https://www.supplychaindisaster.com" className="footer-link">← Back to Supply Chain Disaster game</a>
        </footer>
      </div>
    </>
  );
}
