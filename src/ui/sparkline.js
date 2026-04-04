/**
 * Inline SVG sparkline renderer — zero dependencies.
 *
 * Draws a smooth area sparkline directly into a metric card.
 * The SVG is positioned absolutely behind the card's text content.
 */

const NS = 'http://www.w3.org/2000/svg';

/**
 * Convert a points array to a smooth cubic-bezier path (Catmull-Rom → Bezier).
 * Passes through every point, producing a visually pleasing curve with no overshooting.
 */
function smoothPath(pts) {
    if (pts.length < 2) return '';
    if (pts.length === 2) {
        return `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)} L${pts[1].x.toFixed(1)},${pts[1].y.toFixed(1)}`;
    }

    const T = 0.4; // tension — lower = tighter to original, higher = looser
    let d = `M${pts[0].x.toFixed(1)},${pts[0].y.toFixed(1)}`;

    for (let i = 1; i < pts.length; i++) {
        const p0 = pts[i - 2] || pts[i - 1];
        const p1 = pts[i - 1];
        const p2 = pts[i];
        const p3 = pts[i + 1] || p2;

        const cp1x = p1.x + (p2.x - p0.x) * T;
        const cp1y = p1.y + (p2.y - p0.y) * T;
        const cp2x = p2.x - (p3.x - p1.x) * T;
        const cp2y = p2.y - (p3.y - p1.y) * T;

        d += ` C${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
    }
    return d;
}

/**
 * Build and return an SVG element representing the sparkline.
 *
 * @param {number[]} values     - 2–8 data points (oldest → newest)
 * @param {object}   opts
 * @param {string}   opts.baseColor   - Gradient fill tint (hex, e.g. '#3b82f6')
 * @param {string}   opts.lineColor   - Stroke color (dynamically set to green/red based on trend)
 * @param {number}   [opts.width]     - SVG logical width  (default 120)
 * @param {number}   [opts.height]    - SVG logical height (default 52)
 * @param {number}   [opts.opacity]   - Overall element opacity (default 0.26)
 * @returns {SVGElement|null}
 */
export function buildSparklineSVG(values, {
    baseColor = '#3b82f6',
    lineColor = null,
    width     = 120,
    height    = 52,
    opacity   = 0.26,
} = {}) {
    if (!values || values.length < 2) return null;

    // Resolve line color from trend if not explicitly provided
    const trend = values[values.length - 1] - values[0];
    const stroke = lineColor ?? (trend > 0 ? '#22c55e' : trend < 0 ? '#ef4444' : baseColor);

    const padX = 2;
    const padYTop = 4;
    const padYBot = 6;   // leave floor space for area fill
    const innerW = width  - padX * 2;
    const innerH = height - padYTop - padYBot;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = (max - min) || 1;

    const pts = values.map((v, i) => ({
        x: padX + (i / (values.length - 1)) * innerW,
        y: padYTop + innerH - ((v - min) / range) * innerH,
    }));

    const linePath = smoothPath(pts);
    const last  = pts[pts.length - 1];
    const first = pts[0];
    const areaPath = `${linePath} L${last.x.toFixed(1)},${height} L${first.x.toFixed(1)},${height} Z`;

    const gradId = `spk-${baseColor.replace('#', '')}-${Math.random().toString(36).slice(2, 6)}`;

    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.setAttribute('preserveAspectRatio', 'none');
    svg.setAttribute('aria-hidden', 'true');
    svg.style.cssText = [
        'position:absolute',
        'inset:0',
        'width:100%',
        'height:100%',
        'pointer-events:none',
        'z-index:0',
        `opacity:${opacity}`,
        'border-radius:inherit',
    ].join(';');

    svg.innerHTML = `
        <defs>
            <linearGradient id="${gradId}" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stop-color="${baseColor}" stop-opacity="0.7"/>
                <stop offset="100%" stop-color="${baseColor}" stop-opacity="0"/>
            </linearGradient>
        </defs>
        <path d="${areaPath}" fill="url(#${gradId})"/>
        <path d="${linePath}"
              fill="none"
              stroke="${stroke}"
              stroke-width="1.5"
              stroke-linecap="round"
              stroke-linejoin="round"/>
        <circle cx="${last.x.toFixed(1)}" cy="${last.y.toFixed(1)}" r="2.5"
                fill="${stroke}" opacity="0.9"/>
    `;

    return svg;
}

/**
 * Inject or update a sparkline inside a metric card.
 *
 * @param {HTMLElement} card       - The .metric-card element
 * @param {number[]}    values     - Data points (oldest → newest)
 * @param {string}      baseColor  - Fill tint
 */
export function updateCardSparkline(card, values, baseColor) {
    if (!card || values.length < 2) return;

    // Remove stale sparkline
    card.querySelector('.metric-sparkline')?.remove();

    const svg = buildSparklineSVG(values, { baseColor });
    if (!svg) return;

    const wrapper = document.createElement('div');
    wrapper.className = 'metric-sparkline';
    wrapper.appendChild(svg);

    // Insert as first child so CSS stacking (z-index) is sole arbiter
    card.insertBefore(wrapper, card.firstChild);
}
