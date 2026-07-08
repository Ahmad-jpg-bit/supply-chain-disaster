/**
 * AllocationOverlay — shortage rationing exercise.
 *
 * Three customer segments, one pool of scarce units, three sliders.
 * No right answer; the player feels the rationing trade-off directly.
 */

const fmtN = (n) => n.toLocaleString();

export class AllocationOverlay {
    constructor() {
        this.overlay = null;
    }

    /**
     * @param {Object}   opts
     * @param {Object}   opts.scenario — from buildAllocationScenario
     * @param {number}   opts.missed   — units of demand that cannot be served
     * @param {Function} opts.onDone   — receives ({premium, loyal, churn})
     */
    show({ scenario, missed, onDone }) {
        this._done = false;
        const segs = scenario.segments;
        const pool = scenario.available;

        // Initial allocation: pro-rata by demand, clamped to the pool
        const totalDemand = segs.reduce((s, x) => s + x.demand, 0);
        const initial = {};
        let assigned = 0;
        segs.forEach((s, i) => {
            let v = i === segs.length - 1
                ? Math.max(0, pool - assigned)
                : Math.min(s.demand, Math.round(pool * (s.demand / totalDemand)));
            v = Math.min(v, s.demand);
            initial[s.id] = v;
            assigned += v;
        });

        this.overlay = document.createElement('div');
        this.overlay.className = 'alloc-overlay';
        this.overlay.innerHTML = `
            <div class="alloc-card glass-panel">
                <div class="alloc-eyebrow">⚠ SHORTAGE — RATION YOUR STOCK</div>
                <h3 class="alloc-title">You have ${fmtN(pool)} units. They ordered ${fmtN(totalDemand)}.</h3>
                <p class="alloc-sub">Someone goes short this quarter. Decide who — and live with it.</p>

                <div class="alloc-rows">
                    ${segs.map(s => `
                        <div class="alloc-row" data-seg="${s.id}">
                            <div class="alloc-row-head">
                                <span class="alloc-name">${s.name}</span>
                                <span class="alloc-tag alloc-tag--${s.id}">${s.tag}</span>
                                <span class="alloc-fill" data-fill="${s.id}"></span>
                            </div>
                            <p class="alloc-note">${s.note}</p>
                            <div class="alloc-slider-row">
                                <input type="range" class="alloc-slider" data-slider="${s.id}"
                                       min="0" max="${s.demand}" step="10" value="${initial[s.id]}"
                                       aria-label="Units for ${s.name}"/>
                                <span class="alloc-units" data-units="${s.id}">${fmtN(initial[s.id])} / ${fmtN(s.demand)}</span>
                            </div>
                        </div>`).join('')}
                </div>

                <div class="alloc-pool">
                    Unallocated: <strong data-pool>0</strong> of ${fmtN(pool)} units
                </div>

                <div class="alloc-consequences hidden" data-consequences></div>

                <button class="btn-primary alloc-confirm-btn">Commit Allocation</button>
            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('alloc-overlay--visible'));

        const sliders = [...this.overlay.querySelectorAll('.alloc-slider')];
        const poolEl  = this.overlay.querySelector('[data-pool]');
        const btn     = this.overlay.querySelector('.alloc-confirm-btn');

        const readAlloc = () => Object.fromEntries(
            sliders.map(sl => [sl.dataset.slider, parseInt(sl.value, 10) || 0]));

        const refresh = (changed) => {
            let alloc = readAlloc();
            let used  = Object.values(alloc).reduce((a, b) => a + b, 0);

            // Over-committed: pull the excess back from the slider just moved
            if (used > pool && changed) {
                const over = used - pool;
                changed.value = Math.max(0, (parseInt(changed.value, 10) || 0) - over);
                alloc = readAlloc();
                used  = Object.values(alloc).reduce((a, b) => a + b, 0);
            }

            sliders.forEach(sl => {
                const id = sl.dataset.slider;
                const seg = segs.find(s => s.id === id);
                this.overlay.querySelector(`[data-units="${id}"]`).textContent =
                    `${fmtN(alloc[id])} / ${fmtN(seg.demand)}`;
                const pct = seg.demand > 0 ? Math.round((alloc[id] / seg.demand) * 100) : 100;
                const fillEl = this.overlay.querySelector(`[data-fill="${id}"]`);
                fillEl.textContent = pct + '% filled';
                fillEl.className = 'alloc-fill ' +
                    (pct >= 80 ? 'alloc-fill--good' : pct >= 50 ? 'alloc-fill--mid' : 'alloc-fill--low');
            });

            const remaining = pool - used;
            poolEl.textContent = fmtN(remaining);
            poolEl.parentElement.classList.toggle('alloc-pool--waste', remaining > 0);
            btn.disabled = remaining > 0;
            btn.textContent = remaining > 0
                ? `Allocate ${fmtN(remaining)} more units`
                : 'Commit Allocation';
        };

        sliders.forEach(sl => sl.addEventListener('input', () => refresh(sl)));
        refresh(null);

        btn.addEventListener('click', () => {
            if (this._done || btn.disabled) return;
            this._done = true;
            const alloc = readAlloc();
            // Freeze inputs; caller injects consequences via showConsequences()
            sliders.forEach(sl => { sl.disabled = true; });
            onDone(alloc);
        });
    }

    /**
     * Phase 2: display consequence lines and swap the button to continue.
     * @param {Array} consequences — from applyAllocation
     * @param {Function} onContinue
     */
    showConsequences(consequences, onContinue) {
        const box = this.overlay.querySelector('[data-consequences]');
        box.innerHTML = consequences.map(c => `
            <div class="alloc-cq alloc-cq--${c.tone}">
                <span class="alloc-cq-icon">${c.icon}</span>
                <p class="alloc-cq-text">${c.text}</p>
            </div>`).join('');
        box.classList.remove('hidden');

        const btn = this.overlay.querySelector('.alloc-confirm-btn');
        btn.textContent = 'See Quarterly Results →';
        btn.disabled = false;
        const fresh = btn.cloneNode(true);
        btn.replaceWith(fresh);
        fresh.addEventListener('click', () => {
            this._hide();
            onContinue();
        });
    }

    _hide() {
        if (!this.overlay) return;
        const el = this.overlay;
        this.overlay = null;
        el.classList.remove('alloc-overlay--visible');
        setTimeout(() => el.remove(), 250);
    }
}
