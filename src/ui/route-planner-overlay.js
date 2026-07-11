/**
 * RoutePlannerOverlay — assemble an intermodal shipping lane for the chapter.
 * Pick a long-haul leg and a last-mile leg; the SVG lane and the cost/transit/
 * risk totals update live. Commit sets your shipping economics for the chapter.
 */

import { LONG_HAUL_LEGS, LAST_MILE_LEGS, computeRoute, DEFAULT_ROUTE } from '../logic/route-planner.js';

export class RoutePlannerOverlay {
    constructor() {
        this.overlay = null;
        this.longId = DEFAULT_ROUTE.longId;
        this.lastId = DEFAULT_ROUTE.lastId;
    }

    /**
     * @param {Object}   opts
     * @param {number}   opts.chapterNumber
     * @param {Function} opts.onCommit — receives (longId, lastId)
     */
    show({ chapterNumber, onCommit }) {
        this._done = false;
        this.overlay = document.createElement('div');
        this.overlay.className = 'route-overlay';
        this.overlay.innerHTML = `
            <div class="route-card glass-panel">
                <div class="route-eyebrow">🗺️ DESIGN YOUR LANE — CHAPTER ${chapterNumber}</div>
                <h3 class="route-title">Build the primary route for this chapter.</h3>
                <p class="route-sub">Cheaper lanes run slower — and late arrivals cause stockouts. Balance cost against transit time.</p>

                <div class="route-map" id="route-map"></div>

                <div class="route-legs">
                    <div class="route-leg-group">
                        <div class="route-leg-label">LONG-HAUL · Overseas Plant → Transit Hub</div>
                        <div class="route-leg-options" data-group="long">
                            ${LONG_HAUL_LEGS.map(l => this._legBtn(l, this.longId)).join('')}
                        </div>
                    </div>
                    <div class="route-leg-group">
                        <div class="route-leg-label">LAST-MILE · Transit Hub → Regional DC</div>
                        <div class="route-leg-options" data-group="last">
                            ${LAST_MILE_LEGS.map(l => this._legBtn(l, this.lastId)).join('')}
                        </div>
                    </div>
                </div>

                <div class="route-totals" id="route-totals"></div>

                <button class="btn-primary route-commit-btn">Lock In This Lane &rarr;</button>
            </div>
        `;
        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('route-overlay--visible'));

        this.overlay.querySelectorAll('.route-leg-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const group = btn.closest('.route-leg-options').dataset.group;
                if (group === 'long') this.longId = btn.dataset.id;
                else this.lastId = btn.dataset.id;
                this._refresh();
            });
        });

        this.overlay.querySelector('.route-commit-btn').addEventListener('click', () => {
            if (this._done) return;
            this._done = true;
            this._hide();
            onCommit(this.longId, this.lastId);
        });

        this._refresh();
    }

    _legBtn(leg, selectedId) {
        const sel = leg.id === selectedId ? ' route-leg-btn--selected' : '';
        return `
            <button class="route-leg-btn${sel}" data-id="${leg.id}">
                <span class="route-leg-icon">${leg.icon}</span>
                <span class="route-leg-mode">${leg.mode}</span>
                <span class="route-leg-meta">${leg.days}d · ${leg.risk}</span>
            </button>`;
    }

    _refresh() {
        // Repaint selection state
        this.overlay.querySelectorAll('.route-leg-options').forEach(group => {
            const sel = group.dataset.group === 'long' ? this.longId : this.lastId;
            group.querySelectorAll('.route-leg-btn').forEach(b =>
                b.classList.toggle('route-leg-btn--selected', b.dataset.id === sel));
        });

        const r = computeRoute(this.longId, this.lastId);
        this.overlay.querySelector('#route-map').innerHTML = this._mapSVG(r);

        const costPct = Math.round((r.shippingCostFactor - 1) * 100);
        const costLabel = costPct === 0 ? 'baseline' : (costPct > 0 ? `+${costPct}%` : `${costPct}%`);
        const leadLabel = r.leadTimeMod === 0 ? 'on schedule'
            : r.leadTimeMod > 0 ? `+${r.leadTimeMod} turn${r.leadTimeMod > 1 ? 's' : ''} slower`
            : `${Math.abs(r.leadTimeMod)} turn${Math.abs(r.leadTimeMod) > 1 ? 's' : ''} faster`;
        const expCls = r.exposure === 'High' ? 'route-exp--high' : r.exposure === 'Moderate' ? 'route-exp--mid' : 'route-exp--low';

        this.overlay.querySelector('#route-totals').innerHTML = `
            <div class="route-total"><span class="route-total-label">Shipping cost</span><span class="route-total-value ${costPct < 0 ? 'route-total-value--good' : costPct > 0 ? 'route-total-value--warn' : ''}">${costLabel}</span></div>
            <div class="route-total"><span class="route-total-label">Transit</span><span class="route-total-value">${r.totalDays} days · ${leadLabel}</span></div>
            <div class="route-total"><span class="route-total-label">Stockout exposure</span><span class="route-total-value ${expCls}">${r.exposure}</span></div>`;
    }

    _mapSVG(r) {
        const W = 440, H = 90;
        const nodes = [
            { x: 40,  label: 'Plant' },
            { x: 220, label: 'Hub' },
            { x: 400, label: 'DC' },
        ];
        const legColour = (id) => id === 'air' || id === 'truck' ? '#f59e0b' : '#3b82f6';
        const seg = (x1, x2, leg) => `
            <line x1="${x1}" y1="40" x2="${x2}" y2="40" stroke="${legColour(leg.id)}" stroke-width="3" stroke-dasharray="${leg.id === 'ocean' || leg.id === 'rail' ? '1 0' : '6 4'}"/>
            <text x="${(x1 + x2) / 2}" y="28" text-anchor="middle" font-size="11">${leg.icon}</text>
            <text x="${(x1 + x2) / 2}" y="60" text-anchor="middle" font-size="8.5" fill="#94a3b8">${leg.mode}</text>`;
        return `
            <svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Route: ${r.legs.long.mode} then ${r.legs.last.mode}">
                ${seg(nodes[0].x, nodes[1].x, r.legs.long)}
                ${seg(nodes[1].x, nodes[2].x, r.legs.last)}
                ${nodes.map(n => `
                    <circle cx="${n.x}" cy="40" r="6" fill="#0d1120" stroke="#6c63ff" stroke-width="2"/>
                    <text x="${n.x}" y="80" text-anchor="middle" font-size="9" fill="#c8ccf0" font-weight="700">${n.label}</text>`).join('')}
            </svg>`;
    }

    _hide() {
        if (!this.overlay) return;
        const el = this.overlay;
        this.overlay = null;
        el.classList.remove('route-overlay--visible');
        setTimeout(() => el.remove(), 250);
    }
}
