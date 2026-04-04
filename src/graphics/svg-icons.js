// 12 inline SVG icon functions for supply chain visualization
// Each returns an SVG string. Optional size param (default 24).

export function factory(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 20h20V8l-6 4V8l-6 4V4H2z"/>
        <path d="M17 20v-4h3v4"/>
        <path d="M7 20v-4h3v4"/>
    </svg>`;
}

export function warehouse(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 21V8l9-5 9 5v13"/>
        <path d="M9 21V13h6v8"/>
        <path d="M3 21h18"/>
    </svg>`;
}

export function truck(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1 14h12V4H1z"/>
        <path d="M13 8h4l3 3v3h-7V8z"/>
        <circle cx="5.5" cy="18.5" r="2.5"/>
        <circle cx="17.5" cy="18.5" r="2.5"/>
    </svg>`;
}

export function ship(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2 20l1.5-3h17L22 20"/>
        <path d="M4 17l-1-5h18l-1 5"/>
        <path d="M12 12V4"/>
        <path d="M8 8h8"/>
    </svg>`;
}

export function store(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M3 9l1-4h16l1 4"/>
        <path d="M3 9v11h18V9"/>
        <path d="M9 20V14h6v6"/>
        <path d="M3 9c0 1.1.9 2 2 2s2-.9 2-2"/>
        <path d="M7 9c0 1.1.9 2 2 2s2-.9 2-2"/>
        <path d="M11 9c0 1.1.9 2 2 2s2-.9 2-2"/>
        <path d="M15 9c0 1.1.9 2 2 2s2-.9 2-2"/>
    </svg>`;
}

export function supplier(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="7" width="8" height="14" rx="1"/>
        <path d="M6 7V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v3"/>
        <path d="M14 7h6a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-6"/>
        <circle cx="6" cy="14" r="2"/>
    </svg>`;
}

export function chartUp(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
        <polyline points="16 7 22 7 22 13"/>
    </svg>`;
}

export function chartDown(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/>
        <polyline points="16 17 22 17 22 11"/>
    </svg>`;
}

export function warning(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
        <line x1="12" y1="9" x2="12" y2="13"/>
        <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>`;
}

export function lightbulb(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9 18h6"/>
        <path d="M10 22h4"/>
        <path d="M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z"/>
    </svg>`;
}

export function checkmark(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
        <polyline points="22 4 12 14.01 9 11.01"/>
    </svg>`;
}

export function clock(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <polyline points="12 6 12 12 16 14"/>
    </svg>`;
}

export function globe(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="10"/>
        <path d="M2 12h20"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>`;
}

export function rocket(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z"/>
        <path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z"/>
        <path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/>
        <path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/>
    </svg>`;
}

export function trophy(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/>
        <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/>
        <path d="M4 22h16"/>
        <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/>
        <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/>
        <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>
    </svg>`;
}

export function supplyChainLogo(size = 80) {
    const r = 34; // radius for node placement
    const cx = 50, cy = 50;
    // 5 nodes evenly spaced around a circle (top-center start, clockwise)
    const nodes = [
        { angle: -90,  label: 'S',  color: '#a855f7' }, // Supplier
        { angle: -18,  label: 'F',  color: '#f59e0b' }, // Factory
        { angle: 54,   label: 'W',  color: '#3b82f6' }, // Warehouse
        { angle: 126,  label: 'T',  color: '#22c55e' }, // Truck/Transport
        { angle: 198,  label: 'R',  color: '#ec4899' }, // Retail
    ];
    const pts = nodes.map(n => ({
        x: cx + r * Math.cos(n.angle * Math.PI / 180),
        y: cy + r * Math.sin(n.angle * Math.PI / 180),
        ...n
    }));

    // Build connection lines (each node to next, forming a ring)
    let lines = '';
    for (let i = 0; i < pts.length; i++) {
        const a = pts[i], b = pts[(i + 1) % pts.length];
        lines += `<line x1="${a.x.toFixed(1)}" y1="${a.y.toFixed(1)}" x2="${b.x.toFixed(1)}" y2="${b.y.toFixed(1)}" stroke="url(#logoGrad)" stroke-width="1.5" stroke-dasharray="4 2" opacity="0.5"/>`;
    }
    // Cross connections for network feel
    lines += `<line x1="${pts[0].x.toFixed(1)}" y1="${pts[0].y.toFixed(1)}" x2="${pts[2].x.toFixed(1)}" y2="${pts[2].y.toFixed(1)}" stroke="url(#logoGrad)" stroke-width="1" opacity="0.25"/>`;
    lines += `<line x1="${pts[1].x.toFixed(1)}" y1="${pts[1].y.toFixed(1)}" x2="${pts[3].x.toFixed(1)}" y2="${pts[3].y.toFixed(1)}" stroke="url(#logoGrad)" stroke-width="1" opacity="0.25"/>`;
    lines += `<line x1="${pts[0].x.toFixed(1)}" y1="${pts[0].y.toFixed(1)}" x2="${pts[3].x.toFixed(1)}" y2="${pts[3].y.toFixed(1)}" stroke="url(#logoGrad)" stroke-width="1" opacity="0.25"/>`;

    // Build node circles with icons
    let circles = '';
    pts.forEach(p => {
        circles += `
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="9" fill="${p.color}" opacity="0.15"/>
            <circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="7" fill="none" stroke="${p.color}" stroke-width="1.5"/>
            <text x="${p.x.toFixed(1)}" y="${(p.y + 3.5).toFixed(1)}" text-anchor="middle" fill="${p.color}" font-size="7" font-weight="700" font-family="Inter, sans-serif">${p.label}</text>`;
    });

    // Center hub
    const hub = `
        <circle cx="${cx}" cy="${cy}" r="12" fill="url(#logoGrad)" opacity="0.1"/>
        <circle cx="${cx}" cy="${cy}" r="10" fill="none" stroke="url(#logoGrad)" stroke-width="1.5" stroke-dasharray="3 2">
            <animateTransform attributeName="transform" type="rotate" from="0 ${cx} ${cy}" to="360 ${cx} ${cy}" dur="20s" repeatCount="indefinite"/>
        </circle>
        <circle cx="${cx}" cy="${cy}" r="4" fill="url(#logoGrad)" opacity="0.6"/>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
        <defs>
            <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#3b82f6"/>
                <stop offset="100%" stop-color="#22c55e"/>
            </linearGradient>
        </defs>
        ${lines}
        ${hub}
        ${circles}
    </svg>`;
}

export function shield(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
    </svg>`;
}

export function coins(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="12" cy="12" r="8"/>
        <path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/>
        <path d="M12 18V6"/>
    </svg>`;
}

export function leaf(size = 24) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
        <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
    </svg>`;
}

// Icon lookup by name
const ICON_MAP = {
    factory, warehouse, truck, ship, store, supplier,
    chartUp, chartDown, warning, lightbulb, checkmark, clock,
    globe, rocket, trophy, supplyChainLogo,
    shield, coins, leaf
};

export function getIcon(name, size = 24) {
    const fn = ICON_MAP[name];
    return fn ? fn(size) : '';
}
