import { useState, useMemo, useCallback } from 'react';
import { calculateLandedCost, PRODUCT_CATEGORIES } from '../data/trade-lanes';

const EUR_USD = 1.08; // approximate 2026 exchange rate

function fmt(n, currency = 'USD') {
  if (currency === 'EUR') n = n / EUR_USD;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(n);
}

export default function EUResilienceTool({ lane, nearshoreLane, defaultCosts, disasterScenarios }) {
  const [orderQty, setOrderQty] = useState(1000);
  const [unitValue, setUnitValue] = useState(50);
  const [productCategory, setProductCategory] = useState('electronics');
  const [currency, setCurrency] = useState('USD');
  const [disasterActive, setDisasterActive] = useState(false);
  const [selectedDisaster, setSelectedDisaster] = useState(disasterScenarios[0]);
  const [activeTab, setActiveTab] = useState('comparison');

  // Nearshore unit cost is 20% higher FOB (production premium)
  const nearshoreUnitValue = useMemo(() => Math.round(unitValue * 1.20), [unitValue]);

  const costs = useMemo(() => {
    const modeA = calculateLandedCost({ lane, orderQty, unitValueUSD: unitValue, productCategory });
    const modeB = calculateLandedCost({ lane: nearshoreLane, orderQty, unitValueUSD: nearshoreUnitValue, productCategory });
    const modeC = disasterActive
      ? calculateLandedCost({ lane, orderQty, unitValueUSD: unitValue, productCategory, disasterMode: true,
          disasterMultiplier: selectedDisaster.freightMultiplier,
          disasterDelay: selectedDisaster.extraDelayDays,
          disasterDemurrage: selectedDisaster.demurragePerTEU,
        })
      : modeA;
    return { modeA, modeB, modeC };
  }, [lane, nearshoreLane, orderQty, unitValue, nearshoreUnitValue, productCategory, disasterActive, selectedDisaster]);

  const maxCost = Math.max(costs.modeA.totalLandedCost, costs.modeB.totalLandedCost, costs.modeC.totalLandedCost);

  const handleDisasterToggle = useCallback(() => {
    setDisasterActive(prev => !prev);
  }, []);

  return (
    <div className="resilience-tool">
      {/* Tool Header */}
      <div className="rt-header">
        <span className="rt-header-label">⚡ EU Resilience Simulator</span>
        <span className="rt-title">3-Mode Total Landed Cost Comparison</span>
        <div className="currency-toggle">
          <button
            className={`currency-btn ${currency === 'USD' ? 'currency-btn--active' : ''}`}
            onClick={() => setCurrency('USD')}
          >$ USD</button>
          <button
            className={`currency-btn ${currency === 'EUR' ? 'currency-btn--active' : ''}`}
            onClick={() => setCurrency('EUR')}
          >€ EUR</button>
        </div>
      </div>

      {/* Inputs */}
      <div className="rt-inputs">
        <div className="input-group">
          <label className="input-label">Order Quantity</label>
          <span className="input-value-display">{orderQty.toLocaleString()} units</span>
          <input
            type="range"
            className="input-slider"
            min={100}
            max={10000}
            step={100}
            value={orderQty}
            onChange={e => setOrderQty(Number(e.target.value))}
            style={{ '--pct': `${((orderQty - 100) / (10000 - 100)) * 100}%` }}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Unit FOB Value ({currency})</label>
          <span className="input-value-display">
            {currency === 'USD' ? `$${unitValue}` : `€${Math.round(unitValue / EUR_USD)}`}
          </span>
          <input
            type="range"
            className="input-slider"
            min={5}
            max={500}
            step={5}
            value={unitValue}
            onChange={e => setUnitValue(Number(e.target.value))}
            style={{ '--pct': `${((unitValue - 5) / (500 - 5)) * 100}%` }}
          />
        </div>
        <div className="input-group">
          <label className="input-label">Product Category</label>
          <select
            className="input-select"
            value={productCategory}
            onChange={e => setProductCategory(e.target.value)}
          >
            {PRODUCT_CATEGORIES.map(cat => (
              <option key={cat.id} value={cat.id}>
                {cat.name}{cat.cbamApplies ? ' ⚡ CBAM' : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Three Scenario Cards */}
      <div className="rt-scenarios">
        {/* MODE A — Traditional Offshoring */}
        <div className="scenario-card scenario-card--a">
          <div className="sc-label sc-label--a">Mode A</div>
          <div className="sc-title">Traditional Offshoring</div>
          <div className="sc-subtitle">
            {lane.origin.name} → {lane.destination.name}<br />
            Long lead, low unit cost, HIGH risk exposure
          </div>
          <div className="sc-breakdown">
            <div className="sc-row"><span className="sc-row-label">FOB Value</span><span className="sc-row-val">{fmt(costs.modeA.fobValue, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">Freight ({lane.freightMode.icon})</span><span className="sc-row-val">{fmt(costs.modeA.freightCost, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">Insurance</span><span className="sc-row-val">{fmt(costs.modeA.insurance, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">EU Customs Duty</span><span className="sc-row-val">{fmt(costs.modeA.customsDuty, currency)}</span></div>
            {costs.modeA.cbamCost > 0 && (
              <div className="sc-row"><span className="sc-row-label">CBAM Carbon Levy</span><span className="sc-row-val sc-row-val--cbam">{fmt(costs.modeA.cbamCost, currency)}</span></div>
            )}
            <div className="sc-row"><span className="sc-row-label">Port Handling</span><span className="sc-row-val">{fmt(costs.modeA.portHandling, currency)}</span></div>
          </div>
          <div className="sc-total">
            <div>
              <div className="sc-total-label">Total Landed Cost</div>
              <div className="sc-per-unit">{fmt(costs.modeA.costPerUnit, currency)}/unit</div>
            </div>
            <div className="sc-total-val sc-total-val--a">{fmt(costs.modeA.totalLandedCost, currency)}</div>
          </div>
          <div className="sc-badges">
            <span className="sc-badge sc-badge--transit">🕐 {costs.modeA.transitDays}d transit</span>
            <span className={`sc-badge sc-badge--risk-${lane.riskZone.severity === 'normal' ? 'low' : 'high'}`}>
              {lane.riskZone.multiplier}× risk
            </span>
          </div>
        </div>

        {/* MODE B — Nearshoring */}
        <div className="scenario-card scenario-card--b">
          <div className="sc-label sc-label--b">Mode B</div>
          <div className="sc-title">Nearshoring</div>
          <div className="sc-subtitle">
            {nearshoreLane.origin.name} → {lane.destination.name}<br />
            Short lead, +20% unit cost, LOW risk exposure
          </div>
          <div className="sc-breakdown">
            <div className="sc-row"><span className="sc-row-label">FOB Value (+20%)</span><span className="sc-row-val">{fmt(costs.modeB.fobValue, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">Freight (🚢)</span><span className="sc-row-val">{fmt(costs.modeB.freightCost, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">Insurance</span><span className="sc-row-val">{fmt(costs.modeB.insurance, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">EU Customs Duty</span><span className="sc-row-val">{fmt(costs.modeB.customsDuty, currency)}</span></div>
            {costs.modeB.cbamCost > 0 && (
              <div className="sc-row"><span className="sc-row-label">CBAM Carbon Levy</span><span className="sc-row-val sc-row-val--cbam">{fmt(costs.modeB.cbamCost, currency)}</span></div>
            )}
            <div className="sc-row"><span className="sc-row-label">Port Handling</span><span className="sc-row-val">{fmt(costs.modeB.portHandling, currency)}</span></div>
          </div>
          <div className="sc-total">
            <div>
              <div className="sc-total-label">Total Landed Cost</div>
              <div className="sc-per-unit">{fmt(costs.modeB.costPerUnit, currency)}/unit</div>
            </div>
            <div className="sc-total-val sc-total-val--b">{fmt(costs.modeB.totalLandedCost, currency)}</div>
          </div>
          <div className="sc-badges">
            <span className="sc-badge sc-badge--transit">🕐 {costs.modeB.transitDays}d transit</span>
            <span className="sc-badge sc-badge--nearshore">✓ Nearshore</span>
          </div>
        </div>

        {/* MODE C — Disaster Scenario */}
        <div className={`scenario-card scenario-card--c ${disasterActive ? 'disaster-active' : ''}`}>
          <div className="sc-label sc-label--c">{disasterActive ? '⚠ DISRUPTED' : 'Mode C'}</div>
          <div className="sc-title">{disasterActive ? selectedDisaster.name : 'Disaster Scenario'}</div>
          <div className="sc-subtitle">
            {disasterActive
              ? selectedDisaster.description
              : `Mode A when ${selectedDisaster.name.toLowerCase()} hits — activate below`}
          </div>
          <div className="sc-breakdown">
            <div className="sc-row"><span className="sc-row-label">FOB Value</span><span className="sc-row-val">{fmt(costs.modeC.fobValue, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">Freight (risked)</span><span className={`sc-row-val ${disasterActive ? 'sc-row-val--highlight' : ''}`}>{fmt(costs.modeC.freightCost, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">Insurance</span><span className="sc-row-val">{fmt(costs.modeC.insurance, currency)}</span></div>
            <div className="sc-row"><span className="sc-row-label">EU Customs Duty</span><span className="sc-row-val">{fmt(costs.modeC.customsDuty, currency)}</span></div>
            {disasterActive && costs.modeC.disasterSurcharge > 0 && (
              <div className="sc-row"><span className="sc-row-label">⚠ Demurrage/Emergency</span><span className="sc-row-val sc-row-val--highlight">{fmt(costs.modeC.disasterSurcharge, currency)}</span></div>
            )}
            {costs.modeC.cbamCost > 0 && (
              <div className="sc-row"><span className="sc-row-label">CBAM Carbon Levy</span><span className="sc-row-val sc-row-val--cbam">{fmt(costs.modeC.cbamCost, currency)}</span></div>
            )}
            <div className="sc-row"><span className="sc-row-label">Port Handling</span><span className="sc-row-val">{fmt(costs.modeC.portHandling, currency)}</span></div>
          </div>
          <div className="sc-total">
            <div>
              <div className="sc-total-label">Total Landed Cost</div>
              <div className="sc-per-unit">{fmt(costs.modeC.costPerUnit, currency)}/unit</div>
            </div>
            <div className="sc-total-val sc-total-val--c">{fmt(costs.modeC.totalLandedCost, currency)}</div>
          </div>
          <div className="sc-badges">
            <span className="sc-badge sc-badge--transit">🕐 {costs.modeC.transitDays}d transit</span>
            {disasterActive && (
              <span className="sc-badge sc-badge--risk-high">
                +{fmt(costs.modeC.totalLandedCost - costs.modeA.totalLandedCost, currency)} vs normal
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Disaster Control Panel */}
      <div className="rt-disaster-panel">
        <div className="disaster-header">
          <span className="disaster-title">⚠ Disaster Scenario Simulator</span>
          <button
            className={`disaster-btn ${disasterActive ? 'disaster-btn--active' : ''}`}
            onClick={handleDisasterToggle}
          >
            {disasterActive ? '↩ Reset to Normal' : '⚡ Activate Disaster'}
          </button>
        </div>
        <div className="disaster-scenario-list">
          {disasterScenarios.map(scenario => (
            <button
              key={scenario.id}
              className={`disaster-scenario-btn ${selectedDisaster.id === scenario.id ? 'disaster-scenario-btn--active' : ''}`}
              onClick={() => { setSelectedDisaster(scenario); setDisasterActive(true); }}
            >
              <span className="ds-icon">{scenario.icon}</span>
              <span className="ds-name">{scenario.name}</span>
              <span className="ds-impact">+{scenario.extraDelayDays}d · ×{scenario.freightMultiplier} freight</span>
            </button>
          ))}
        </div>
      </div>

      {/* Comparison Bar Chart */}
      <div className="rt-comparison">
        <div className="comparison-title">Cost Comparison — Total Landed Cost</div>
        {[
          { label: 'Mode A', val: costs.modeA.totalLandedCost, cls: 'a', key: 'a' },
          { label: 'Mode B', val: costs.modeB.totalLandedCost, cls: 'b', key: 'b' },
          { label: disasterActive ? '⚠ Disastr' : 'Mode C', val: costs.modeC.totalLandedCost, cls: 'c', key: 'c' },
        ].map(row => (
          <div key={row.key} className="comparison-bar-row">
            <span className="cb-label">{row.label}</span>
            <div className="cb-bar-track">
              <div
                className={`cb-bar-fill cb-bar-fill--${row.cls}`}
                style={{ width: `${(row.val / maxCost) * 100}%` }}
              />
            </div>
            <span className="cb-value">{fmt(row.val, currency)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
