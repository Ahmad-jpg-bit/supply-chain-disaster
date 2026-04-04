/**
 * Animated number counter with easeOutExpo easing and trend indicators.
 */

function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export class AnimatedCounter {
    /**
     * @param {HTMLElement} element - The element whose textContent will be updated
     * @param {object} opts
     * @param {function} opts.formatter - Format number for display (e.g. currency)
     * @param {number}   opts.duration  - Animation duration in ms (default 700)
     */
    constructor(element, opts = {}) {
        this.el = element;
        this.formatter = opts.formatter || (n => String(n));
        this.duration = opts.duration || 700;
        this.currentValue = 0;
        this.animId = null;
    }

    /**
     * Animate from current value to newValue.
     * Returns the trend delta.
     */
    set(newValue) {
        const from = this.currentValue;
        const to = newValue;
        const delta = to - from;
        this.currentValue = to;

        if (delta === 0) return 0;
        if (this.animId) cancelAnimationFrame(this.animId);

        const start = performance.now();
        const dur = this.duration;

        const tick = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / dur, 1);
            const eased = easeOutExpo(progress);
            const current = from + delta * eased;
            this.el.textContent = this.formatter(current);

            if (progress < 1) {
                this.animId = requestAnimationFrame(tick);
            } else {
                this.el.textContent = this.formatter(to);
                // Pulse effect
                this.el.classList.add('count-pulse');
                setTimeout(() => this.el.classList.remove('count-pulse'), 400);
            }
        };

        this.animId = requestAnimationFrame(tick);
        return delta;
    }

    /** Set value without animation (for initialization) */
    setImmediate(value) {
        this.currentValue = value;
        this.el.textContent = this.formatter(value);
    }
}

/**
 * Render a trend badge next to a metric.
 * @param {HTMLElement} container - Parent metric-card element
 * @param {number} delta - The change value
 * @param {function} formatter - Format the delta for display
 */
export function showTrendBadge(container, delta, formatter) {
    // Remove existing
    const existing = container.querySelector('.trend-badge');
    if (existing) existing.remove();

    if (delta === 0) return;

    const badge = document.createElement('span');
    const isPositive = delta > 0;
    badge.className = `trend-badge ${isPositive ? 'trend-up' : 'trend-down'}`;
    badge.textContent = `${isPositive ? '+' : ''}${formatter(delta)}`;
    container.appendChild(badge);

    // Auto-fade after 2s
    setTimeout(() => {
        badge.classList.add('trend-fade');
        setTimeout(() => badge.remove(), 500);
    }, 2000);
}
