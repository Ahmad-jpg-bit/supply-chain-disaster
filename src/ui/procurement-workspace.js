/**
 * Procurement workspace — markup builders for the quarterly decision screen.
 *
 * Pure string builders; the Dashboard owns state, listeners and updates.
 * All numbers shown here come from GameEngine.estimateTurn() and
 * computeProjection() — this module does no game math of its own beyond
 * formatting and comparing those results.
 */

import { SHIPPING_METHODS, PRICING_STRATEGIES, QUALITY_INSPECTIONS } from '../data/procurement-options.js';

export const fmtMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
export const fmtMoney2 = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
export const fmtNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const pct = (x) => `${(x * 100).toFixed(x < 0.01 ? 1 : x < 0.1 ? 1 : 0)}%`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const weeks = (w) => (w > 0 ? `+${w} wk` : w < 0 ? `−${Math.abs(w)} wk` : 'no change');

// ── Story response effects ────────────────────────────────────────────────

/** Describe the engine modifiers actually in effect as plain-language chips. */
export function describeModifiers(mods = {}) {
    const out = [];
    if (mods.unitCost != null && mods.unitCost !== 1) {
        const p = Math.round((mods.unitCost - 1) * 100);
        out.push({ text: `Unit cost ${p > 0 ? '+' : '−'}${Math.abs(p)}%`, tone: p > 0 ? 'bad' : 'good' });
    }
    if (mods.leadTime) {
        out.push({ text: `Lead time ${weeks(mods.leadTime)}`, tone: mods.leadTime > 0 ? 'bad' : 'good' });
    }
    if (mods.demandMultiplier != null && mods.demandMultiplier !== 1) {
        out.push({ text: `Demand ×${mods.demandMultiplier.toFixed(2).replace(/0$/, '')}`, tone: 'neutral' });
    }
    if (mods.customerSatisfaction) {
        const v = mods.customerSatisfaction;
        out.push({ text: `Customer satisfaction ${v > 0 ? '+' : '−'}${Math.abs(v)}`, tone: v > 0 ? 'good' : 'bad' });
    }
    return out;
}

const chips = (list, label) => list.length
    ? `<ul class="pw-chips" aria-label="${label}">${list.map(c => `<li class="pw-chip pw-chip--${c.tone}">${c.text}</li>`).join('')}</ul>`
    : `<p class="pw-muted">No mechanical effect on costs, lead time or demand.</p>`;

function eventCardHTML(s, archetypeChips) {
    if (s.isEndless) {
        const sat = Math.max(0, s.endlessSatisfaction);
        return `
        <article class="pw-card pw-event" aria-labelledby="pw-event-title">
            <p class="pw-eyebrow">Endless survival</p>
            <h3 class="pw-event-title" id="pw-event-title">Wave ${s.endlessWave} · turn ${s.endlessTurn + 1}</h3>
            <p class="pw-body">Customer satisfaction <strong>${Math.round(sat)}%</strong> · score <strong>${fmtNum(s.endlessScore)}</strong>.
               The run ends if cash finishes a quarter below $0 or satisfaction reaches 0.</p>
            ${archetypeChips}
        </article>`;
    }
    const scenario = s.currentScenario;
    const choice   = s.lastStoryChoice;
    if (!scenario || !choice) {
        return `
        <article class="pw-card pw-event">
            <p class="pw-eyebrow">This quarter</p>
            <p class="pw-body">No event response recorded for this quarter.</p>
            ${archetypeChips}
        </article>`;
    }
    return `
        <article class="pw-card pw-event" aria-labelledby="pw-event-title">
            <div class="pw-event-head">
                <p class="pw-eyebrow">This quarter's event</p>
                <button type="button" class="pw-link-btn" id="pw-view-briefing" aria-haspopup="dialog">View briefing</button>
            </div>
            <h3 class="pw-event-title" id="pw-event-title">${scenario.title}</h3>
            <p class="pw-event-choice"><span class="pw-k">Your response</span> <strong>${choice.optionLabel}</strong></p>
            <p class="pw-k pw-effects-label">Game effects in force this quarter</p>
            ${chips(describeModifiers(s.modifiers), 'Game effects of your response')}
            <p class="pw-note">Applies to this quarter's order and demand only — your next event response replaces it.</p>
            ${archetypeChips}
        </article>`;
}

// ── Situation alerts (from the last resolved quarter) ─────────────────────

function alertsHTML(last) {
    if (!last) return '';
    const items = [];
    if (last.crisis) {
        const good = last.crisis.severity === 'positive';
        items.push({ tone: good ? 'good' : 'warn', title: `Last quarter's event: ${last.crisis.name}`, text: last.crisis.consequenceText || last.crisis.ticker || '' });
    }
    if (last.backlog > 0) {
        items.push({ tone: 'critical', title: `Backlog: ${fmtNum(last.backlog)} units owed to customers`, text: 'Carried into this quarter — it is served from stock before new demand.' });
    } else if (last.missedSales > 0) {
        items.push({ tone: 'warn', title: `Stockout last quarter: ${fmtNum(last.missedSales)} units short`, text: 'Demand exceeded the stock you had on hand.' });
    }
    if (last.safetyBreach) {
        items.push({ tone: 'warn', title: 'Safety stock breached last quarter', text: `Stock after demand fell below your ${fmtNum(last.safetyStockTarget)}-unit target (customer satisfaction penalty).` });
    }
    if (last.demandEvent === 'regulatory_spike') {
        items.push({ tone: 'warn', title: 'Regulatory demand spike last quarter', text: `Demand ran ${Math.round((last.demand / 1000 - 1) * 100)}% above base.` });
    }
    if (!items.length) return '';
    const icon = { critical: '⛔', warn: '⚠', good: '✓' };
    return `
        <ul class="pw-alerts" aria-label="Alerts from last quarter">
            ${items.map(i => `
            <li class="pw-alert pw-alert--${i.tone}">
                <span class="pw-alert-icon" aria-hidden="true">${icon[i.tone]}</span>
                <span><strong>${i.title}</strong>${i.text ? ` <span class="pw-alert-text">${i.text}</span>` : ''}</span>
            </li>`).join('')}
        </ul>`;
}

// ── Decision group scaffolding ────────────────────────────────────────────

/** A collapsible decision group; `pinned` content stays visible when collapsed. */
function groupHTML(key, letter, title, sub, open, body, pinned = '') {
    return `
        <section class="pw-group${open ? ' pw-group--open' : ''}" data-group="${key}">
            <h3 class="pw-group-h">
                <button type="button" class="pw-group-toggle" id="pw-tog-${key}" aria-expanded="${open}" aria-controls="pw-body-${key}">
                    <span class="pw-group-letter" aria-hidden="true">${letter}</span>
                    <span class="pw-group-title">${title}</span>
                    <span class="pw-group-sub">${sub}</span>
                    <span class="pw-chevron" aria-hidden="true"></span>
                </button>
            </h3>
            <div class="pw-group-summary" id="pw-sum-${key}"></div>
            ${pinned}
            <div class="pw-group-body" id="pw-body-${key}" role="region" aria-labelledby="pw-tog-${key}"${open ? '' : ' hidden'}>
                ${body}
            </div>
        </section>`;
}

const radio = (name, value, checked, inner, extraCls = '') => `
    <label class="pw-opt ${extraCls}">
        <input type="radio" name="${name}" value="${value}"${checked ? ' checked' : ''}>
        ${inner}
    </label>`;

const stat = (k, v, attrs = '') => `<span class="pw-opt-stat"><span class="pw-k">${k}</span><span class="pw-v"${attrs}>${v}</span></span>`;

/**
 * Full workspace markup.
 * @param {Object} ctx — { state, suppliers, draft, openGroups }
 */
export function buildWorkspaceHTML(ctx) {
    const { state: s, suppliers, draft, openGroups } = ctx;
    const archMods = describeModifiers(s.archetypeModifiers || {});
    const archetypeChips = (archMods.length && s.startingArchetype)
        ? `<div class="pw-archetype"><p class="pw-k">Ongoing market condition · ${s.startingArchetype.label}</p>${chips(archMods, 'Ongoing market condition effects')}</div>`
        : '';

    const supplierRows = suppliers.map(sup => radio('pw-supplier', sup.id, sup.id === draft.supplierId, `
        <span class="pw-opt-main">
            <span class="pw-opt-name">${sup.name}</span>
            <span class="pw-tag pw-tag--${sup.tier.toLowerCase()}">${sup.tier}</span>
        </span>
        ${stat('Unit cost', '—', ` data-sup-cost="${sup.id}"`)}
        ${stat('Lead time', '—', ` data-sup-lead="${sup.id}"`)}
        ${stat('Defect rate', pct(sup.defectRate))}`, 'pw-opt--row')).join('');

    const shippingRows = SHIPPING_METHODS.map(m => radio('pw-shipping', m.id, m.id === draft.shippingId, `
        <span class="pw-opt-main"><span class="pw-opt-name">${m.name}</span></span>
        ${stat('Freight', '—', ` data-ship-cost="${m.id}"`)}
        ${stat('Transit', weeks(m.leadTimeModifier))}
        ${stat('Arrives', '—', ` data-ship-arr="${m.id}"`)}`, 'pw-opt--row')).join('');

    const pricingRows = PRICING_STRATEGIES.map(p => radio('pw-pricing', p.id, p.id === draft.pricingId, `
        <span class="pw-opt-main"><span class="pw-opt-name">${p.name}</span></span>
        ${stat('Sell price', '—', ` data-price="${p.id}"`)}
        ${stat('Demand', `×${p.demandMultiplier.toFixed(1)}`)}`, 'pw-opt--row')).join('');

    const inspectionRows = QUALITY_INSPECTIONS.map(q => radio('pw-inspection', q.id, q.id === draft.inspectionId, `
        <span class="pw-opt-main"><span class="pw-opt-name">${q.name}</span></span>
        ${stat('Cost', `$${q.costPerUnit}/unit`)}
        ${stat('Catches', `${Math.round(q.defectCatchRate * 100)}% of defects`)}`, 'pw-opt--row')).join('');

    const procurementBody = `
        <fieldset class="pw-field">
            <legend class="pw-legend">Supplier</legend>
            <div class="pw-options">${supplierRows}</div>
        </fieldset>
        <fieldset class="pw-field">
            <legend class="pw-legend">Shipping</legend>
            <div class="pw-options">${shippingRows}</div>
            <p class="pw-help" id="pw-route-note" hidden></p>
        </fieldset>
        <p class="pw-contract" id="pw-contract" hidden></p>`;

    const commercialBody = `
        <fieldset class="pw-field">
            <legend class="pw-legend">Pricing</legend>
            <div class="pw-options">${pricingRows}</div>
        </fieldset>`;

    const protectionBody = `
        <fieldset class="pw-field">
            <legend class="pw-legend">Quality inspection</legend>
            <div class="pw-options">${inspectionRows}</div>
            <p class="pw-help" id="pw-defect-est"></p>
        </fieldset>
        <div class="pw-field">
            <label class="pw-legend" for="safety-stock-slider">Safety-stock target</label>
            <div class="pw-slider">
                <input type="range" id="safety-stock-slider" min="0" max="2000" step="100" value="${draft.safetyStockTarget}" aria-describedby="pw-safety-help">
                <output id="safety-stock-value" for="safety-stock-slider">${fmtNum(draft.safetyStockTarget)} units</output>
            </div>
            <p class="pw-help" id="pw-safety-help">No direct cost. If stock left after demand ends a quarter below this target, customer satisfaction takes a penalty.</p>
        </div>`;

    // Quantity sits outside the collapsible body so it is always reachable
    const quantityHTML = `
        <div class="pw-field pw-qty-field">
            <label class="pw-legend" for="order-input">Order quantity <span class="pw-muted">(units)</span></label>
            <div class="pw-qty">
                <button type="button" class="pw-qty-btn" data-qty-add="-500" aria-label="Remove 500 units">−500</button>
                <button type="button" class="pw-qty-btn" data-qty-add="-100" aria-label="Remove 100 units">−100</button>
                <input type="number" id="order-input" inputmode="numeric" min="0" step="100" value="${draft.orderQuantity}" aria-describedby="order-help order-error">
                <button type="button" class="pw-qty-btn" data-qty-add="100" aria-label="Add 100 units">+100</button>
                <button type="button" class="pw-qty-btn" data-qty-add="500" aria-label="Add 500 units">+500</button>
            </div>
            <p class="pw-help" id="order-help">The buttons add or remove units from the amount in the box; type a number to set it exactly.</p>
            <p class="pw-error" id="order-error" role="alert" hidden></p>
        </div>`;

    const endlessNote = s.isEndless ? ' · run ends if cash finishes a quarter below $0' : '';

    return `
    <div class="pw">
        <div class="pw-grid">
            <section class="pw-situation" aria-label="Situation">
                ${eventCardHTML(s, archetypeChips)}
                ${alertsHTML(s.lastTurnResult)}
            </section>


            <section class="pw-decide" aria-label="Decisions and consequences">
                <div class="pw-groups">
                    <h2 class="pw-section-title">Quarter ${s.turn} decisions</h2>
                    ${groupHTML('procurement', 'A', 'Procurement', 'Supplier &amp; shipping', openGroups.procurement, procurementBody)}
                    ${groupHTML('commercial', 'B', 'Commercial', 'Quantity &amp; pricing', openGroups.commercial, commercialBody, quantityHTML)}
                    ${groupHTML('protection', 'C', 'Protection', 'Inspection &amp; safety stock', openGroups.protection, protectionBody)}
                </div>

                <aside class="pw-aside" aria-labelledby="pw-cons-title">
                    <div class="pw-cons">
                        <h2 class="pw-section-title" id="pw-cons-title">If you confirm</h2>
                        <dl class="pw-stats">
                            <div class="pw-stat"><dt>Order commitment</dt><dd id="pw-c-total">—</dd><span class="pw-stat-note">Charged when the quarter resolves</span></div>
                            <div class="pw-stat" id="pw-c-cash-wrap"><dt>Cash after order costs</dt><dd id="pw-c-cash">—</dd><span class="pw-stat-note">Before this quarter's sales revenue and holding cost${endlessNote}</span></div>
                            <div class="pw-stat"><dt>Order arrives</dt><dd id="pw-c-arrival">—</dd><span class="pw-stat-note" id="pw-c-arrival-note"></span></div>
                            <div class="pw-stat" id="pw-c-inv-wrap"><dt>Stock at end of Q${s.turn}</dt><dd id="pw-c-inv">—</dd><span class="pw-stat-note" id="pw-c-inv-note"></span></div>
                        </dl>
                        <div class="pw-warning" id="pw-c-warning" role="status" aria-live="polite"></div>
                        <details class="pw-breakdown">
                            <summary>Cost breakdown</summary>
                            <table class="pw-breakdown-table"><tbody id="pw-breakdown-rows"></tbody></table>
                            <p class="pw-note">All costs settle when the quarter resolves, together with sales revenue. Estimates exclude any crisis that hits this quarter and supplier requalification premiums.</p>
                        </details>
                    </div>
                    <div class="pw-actionbar">
                        <p class="pw-actionbar-sum" id="pw-actionbar-sum" aria-hidden="true"></p>
                        <button id="place-order-btn" class="pw-confirm" type="button" aria-describedby="pw-confirm-note">Confirm &amp; advance turn</button>
                        <p class="pw-confirm-note" id="pw-confirm-note">Commits all decisions above and resolves Q${s.turn}.${s.isEndless ? '' : ' You will be asked for a demand forecast first.'}</p>
                    </div>
                </aside>
            </section>
            <section class="pw-evidence" aria-label="Evidence: demand history and inventory outlook">
                <article class="pw-card pw-chart" aria-labelledby="pw-chart-title">
                    <div class="pw-card-head">
                        <h3 class="pw-card-title" id="pw-chart-title">Demand vs orders</h3>
                        <span id="bullwhip-live-ratio" class="bullwhip-live-ratio blr--neutral">—</span>
                    </div>
                    <div class="pw-legend-row" aria-hidden="true">
                        <span class="pw-key pw-key--demand">Demand</span>
                        <span class="pw-key pw-key--orders">Your past orders</span>
                        <span class="pw-key pw-key--proposed">This order (proposed)</span>
                    </div>
                    <div class="pw-chart-wrap"><canvas id="bullwhipLive" aria-hidden="true"></canvas></div>
                    <p class="pw-chart-text" id="pw-chart-text"></p>
                </article>

                <article class="pw-card pw-outlook" aria-labelledby="pw-outlook-title">
                    <div class="pw-card-head">
                        <h3 class="pw-card-title" id="pw-outlook-title">Shipments &amp; inventory outlook</h3>
                        <span class="pw-badge">Estimate</span>
                    </div>
                    <ul class="pw-shipments" id="pw-shipments" aria-label="Shipments"></ul>
                    <table class="pw-proj" id="pw-proj">
                        <caption class="pw-visually-hidden">Projected stock by quarter (estimate)</caption>
                        <thead><tr>
                            <th scope="col">Quarter</th>
                            <th scope="col">Arrivals</th>
                            <th scope="col">Expected demand</th>
                            <th scope="col">Stock after demand</th>
                        </tr></thead>
                        <tbody></tbody>
                    </table>
                    <p class="pw-note" id="pw-proj-assumptions"></p>
                </article>

                <div class="pw-flow-slot" aria-label="Network status"></div>
            </section>
        </div>
    </div>`;
}

// ── Outlook (shipments + projection) ──────────────────────────────────────

/**
 * @param {Object} p — { state, est, rows, safetyStock }
 */
export function renderShipmentsHTML(state, est) {
    const items = state.inTransit
        .slice()
        .sort((a, b) => a.arrivesOnTurn - b.arrivesOnTurn)
        .map(o => {
            const inN = o.arrivesOnTurn - state.turn;
            const when = inN <= 0 ? 'arrives this quarter, before demand' : `arrives Q${o.arrivesOnTurn} (in ${plural(inN, 'quarter')})`;
            return `<li class="pw-ship"><span class="pw-ship-units">${fmtNum(o.usableUnits + o.passedDefects)} units</span>
                <span class="pw-ship-meta">${o.supplierName ?? 'Earlier order'}${o.shippingName ? ` · ${o.shippingName}` : ''} — ${when}</span></li>`;
        });
    const proposed = est.orderQuantity > 0
        ? `<li class="pw-ship pw-ship--proposed"><span class="pw-ship-units">${fmtNum(est.arrivingUnits)} units</span>
            <span class="pw-ship-meta"><strong>This order (proposed)</strong> — arrives Q${est.arrivesOnTurn} (in ${plural(est.leadTimeTurns, 'quarter')})${est.caughtDefects ? `; ${fmtNum(est.caughtDefects)} defective units removed by inspection` : ''}</span></li>`
        : `<li class="pw-ship pw-ship--proposed"><span class="pw-ship-meta">No new order this quarter.</span></li>`;
    if (!items.length) items.push(`<li class="pw-ship"><span class="pw-ship-meta">No earlier orders en route.</span></li>`);
    return items.join('') + proposed;
}

export function renderProjectionRowsHTML(rows, est, currentTurn) {
    return rows.map(r => {
        const isNew = r.turn === est.arrivesOnTurn && est.arrivingUnits > 0;
        const earlier = r.arrivals - (isNew ? est.arrivingUnits : 0);
        const arrivals = [
            earlier > 0 ? `+${fmtNum(earlier)}` : '',
            isNew ? `<span class="pw-proj-new">+${fmtNum(est.arrivingUnits)} this order</span>` : '',
        ].filter(Boolean).join(' ') || '<span class="pw-muted">—</span>';
        const status = r.stockout
            ? `<span class="pw-status pw-status--critical">Short ${fmtNum(r.short)}</span>`
            : r.belowSafety
                ? `<span class="pw-status pw-status--warn">Below target</span>`
                : `<span class="pw-status pw-status--ok">OK</span>`;
        return `<tr${r.turn === currentTurn ? ' class="pw-proj-now"' : ''}>
            <th scope="row">Q${r.turn}${r.turn === currentTurn ? ' <span class="pw-muted">(now)</span>' : ''}</th>
            <td>${arrivals}</td>
            <td>${fmtNum(r.demand)}</td>
            <td><span class="pw-proj-stock">${fmtNum(r.endInv)}</span> ${status}</td>
        </tr>`;
    }).join('');
}

/**
 * Pick the single most consequential warning for the consequence summary.
 * Every rule compares engine estimates; none invents new thresholds except
 * the cash bands the game already uses for its ambient alert state.
 */
export function pickWarning({ state, est, rows, cashAfter, safetyStock }) {
    const firstShort = rows.find(r => r.stockout);
    if (state.isEndless && cashAfter < 0) {
        return { tone: 'critical', text: `Order costs exceed your cash by ${fmtMoney(-cashAfter)}. If cash ends the quarter below $0 the run is over — this quarter's sales would have to cover it.` };
    }
    if (cashAfter < 0) {
        return { tone: 'critical', text: `Order costs exceed your cash by ${fmtMoney(-cashAfter)}. Allowed, but you will rely on this quarter's sales to cover it.` };
    }
    if (firstShort && firstShort.turn < est.arrivesOnTurn && est.orderQuantity > 0) {
        return { tone: 'critical', text: `This order arrives in Q${est.arrivesOnTurn}. It will not cover the projected shortfall in Q${firstShort.turn} (about ${fmtNum(firstShort.short)} units short at expected demand).` };
    }
    if (firstShort) {
        return { tone: 'critical', text: `Projected shortfall in Q${firstShort.turn}: about ${fmtNum(firstShort.short)} units short at expected demand.` };
    }
    if (est.contractApplies && est.contractHonoured === false) {
        return { tone: 'warn', text: `Below your contract volume — a ${fmtMoney(est.contractFee)} shortfall fee applies and the discount is lost.` };
    }
    const firstBelow = rows.find(r => r.belowSafety);
    if (firstBelow) {
        return { tone: 'warn', text: `Stock projected below your ${fmtNum(safetyStock)}-unit safety target in Q${firstBelow.turn} — customer satisfaction penalty if demand runs as expected.` };
    }
    if (cashAfter < 80000) {
        return { tone: 'warn', text: `Cash after order costs would be under $80,000 — the game's low-cash alert level.` };
    }
    return { tone: 'ok', text: `No shortfall projected through Q${rows[rows.length - 1].turn} at expected demand. Demand and crises can still differ.` };
}
