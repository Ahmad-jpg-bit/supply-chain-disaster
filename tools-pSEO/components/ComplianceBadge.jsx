export default function ComplianceBadge({ items, lane }) {
  return (
    <section className="compliance-section">
      <div className="compliance-header">
        <span className="compliance-shield">🛡</span>
        <div>
          <div className="compliance-title">EU Regulatory Compliance Reference</div>
          <div className="compliance-subtitle">
            Active regulations affecting {lane.origin.name} → {lane.destination.country} imports in 2026
          </div>
        </div>
      </div>
      <div className="compliance-grid">
        {items.map(item => (
          <div key={item.id} className="compliance-item">
            <span
              className="compliance-badge-pill"
              style={{ color: item.color, borderColor: `${item.color}40`, backgroundColor: `${item.color}12` }}
            >
              {item.badge}
            </span>
            <div className="compliance-item-title">{item.title}</div>
            <div className="compliance-item-desc">{item.description}</div>
            <div className="compliance-item-reg">{item.regulation} · {item.effectiveDate}</div>
          </div>
        ))}
      </div>
      <div className="compliance-accuracy-note">
        All CBAM carbon costs calculated at €55/tonne CO₂ (2026 EU ETS estimate). Import duties per EU Combined Nomenclature 2026. Verify exact rates with your customs broker before trading.
      </div>
    </section>
  );
}
