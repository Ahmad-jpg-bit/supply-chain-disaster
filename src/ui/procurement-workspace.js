/**
 * Procurement workspace — markup builders for the quarterly decision screen.
 *
 * Pure string builders; the Dashboard owns state, listeners and updates.
 * All numbers shown here come from GameEngine.estimateTurn() and
 * computeProjection() — this module does no game math of its own beyond
 * formatting and comparing those results.
 */

import { SHIPPING_METHODS, PRICING_STRATEGIES, QUALITY_INSPECTIONS } from '../data/procurement-options.js';
import { crisisText } from '../logic/turn-story.js';

export const fmtMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
export const fmtMoney2 = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
export const fmtNum = (n) => new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(n);
const pct = (x) => `${(x * 100).toFixed(x < 0.01 ? 1 : x < 0.1 ? 1 : 0)}%`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const weeks = (w) => (w > 0 ? `+${w} wk` : w < 0 ? `−${Math.abs(w)} wk` : 'no change');
const demandChange = (m) => (m === 1 ? 'No change' : `${m > 1 ? '+' : '−'}${Math.round(Math.abs(m - 1) * 100)}%`);

// ── "Explain" disclosures (keyboard, touch and screen-reader friendly) ────

/** A small button that reveals a short plain-language explanation below it. */
export function explainHTML(id, label, text) {
    return `<button type="button" class="gx-btn" data-explain="${id}" aria-expanded="false" aria-controls="gx-${id}" aria-label="Explain: ${label}">Explain</button>`
        + `<p class="gx-text" id="gx-${id}" hidden>${text}</p>`;
}

// ── Story response effects ────────────────────────────────────────────────

/** Describe the engine modifiers actually in effect as plain-language chips. */
export function describeModifiers(mods = {}) {
    const out = [];
    if (mods.unitCost != null && mods.unitCost !== 1) {
        const p = Math.round((mods.unitCost - 1) * 100);
        out.push({ text: `Price per unit ${p > 0 ? '+' : '−'}${Math.abs(p)}%`, tone: p > 0 ? 'bad' : 'good' });
    }
    if (mods.leadTime) {
        out.push({ text: `Delivery time ${weeks(mods.leadTime)}`, tone: mods.leadTime > 0 ? 'bad' : 'good' });
    }
    if (mods.demandMultiplier != null && mods.demandMultiplier !== 1) {
        out.push({ text: `Customer demand ${demandChange(mods.demandMultiplier)}`, tone: 'neutral' });
    }
    if (mods.customerSatisfaction) {
        const v = mods.customerSatisfaction;
        out.push({ text: `Customer satisfaction ${v > 0 ? '+' : '−'}${Math.abs(v)}`, tone: v > 0 ? 'good' : 'bad' });
    }
    return out;
}

const chips = (list, label) => list.length
    ? `<ul class="pw-chips" aria-label="${label}">${list.map(c => `<li class="pw-chip pw-chip--${c.tone}">${c.text}</li>`).join('')}</ul>`
    : `<p class="pw-muted">No effect on costs, delivery time or demand.</p>`;

// ── Turn brief: what happened · what to decide · keep in mind ─────────────

function turnBriefHTML(s, archetypeChips) {
    let happened;
    let viewBriefing = '';
    if (s.isEndless) {
        const sat = Math.max(0, s.endlessSatisfaction);
        happened = `<strong>Wave ${s.endlessWave}, turn ${s.endlessTurn + 1}.</strong> Customer satisfaction ${Math.round(sat)}% · score ${fmtNum(s.endlessScore)}.
            The run ends if cash finishes a quarter below $0 or satisfaction reaches 0.`;
    } else if (s.currentScenario && s.lastStoryChoice) {
        happened = `<strong>${s.currentScenario.title}.</strong> You responded: “${s.lastStoryChoice.optionLabel}”.`
            + `<span class="pw-brief-effects">${chips(describeModifiers(s.modifiers), 'Effects of your response this quarter')}</span>`;
        viewBriefing = `<button type="button" class="pw-link-btn" id="pw-view-briefing" aria-haspopup="dialog">View briefing</button>`;
    } else {
        happened = 'No event response recorded for this quarter.';
    }
    return `
        <article class="pw-card pw-brief" aria-labelledby="pw-brief-title">
            <div class="pw-event-head">
                <h2 class="pw-eyebrow" id="pw-brief-title">Quarter ${s.turn} at a glance</h2>
                ${viewBriefing}
            </div>
            <dl class="pw-brief-list">
                <div class="pw-brief-row"><dt>What happened</dt><dd>${happened}</dd></div>
                <div class="pw-brief-row pw-brief-row--goal"><dt>What to decide</dt><dd id="pw-brief-goal"></dd></div>
                <div class="pw-brief-row"><dt>Keep in mind</dt><dd id="pw-brief-note"></dd></div>
            </dl>
            <div class="pw-note pw-brief-time">One turn is one quarter (3 months). Each chapter has 4 quarters.
                ${explainHTML('quarter', 'how a quarter plays out', 'When you confirm, the quarter plays out in this order: shipments due this quarter arrive, customers buy from the stock you have (anyone still waiting from last quarter is served first), then your new order leaves the supplier.')}</div>
            ${archetypeChips}
        </article>`;
}

/**
 * The one decision this quarter asks for, grounded in confirmed stock and the
 * engine's expected demand. Never recommends a quantity.
 * @param {Object} p — { state, est, rows, earliest }
 */
export function turnGoal({ state: s, est, rows, earliest }) {
    const available = s.inventory + est.arrivingThisTurn;
    if (s.backlog > 0) {
        return `<strong>${fmtNum(s.backlog)} customer orders are still waiting</strong> from last quarter. They get served first from this quarter's ${fmtNum(available)} units. `
            + `Decide how much to order — a new order can arrive in Q${earliest} at the earliest.`;
    }
    if (rows[0]?.stockout) {
        return `You have <strong>${fmtNum(available)} units</strong> and customers are expected to want about <strong>${fmtNum(est.expectedDemand)}</strong> this quarter. `
            + `A new order can't arrive before Q${earliest}, so this quarter will likely run short. Decide how much to order for the quarters after.`;
    }
    return `You have <strong>${fmtNum(available)} units</strong> and customers are expected to want about <strong>${fmtNum(est.expectedDemand)}</strong> this quarter. `
        + `Decide how much to order for when this stock runs down — a new order can arrive in Q${earliest} at the earliest.`;
}

/** The most important constraint: orders take time, and money is limited. */
export function turnNote({ state: s, est, earliest }) {
    const arrival = est.orderQuantity > 0
        ? `Your current choice arrives in Q${est.arrivesOnTurn}${est.arrivesOnTurn > earliest ? ` (the fastest supplier and shipping combination arrives in Q${earliest})` : ''}.`
        : 'You are not ordering anything this quarter.';
    return `${arrival} You have <strong>${fmtMoney(s.cash)}</strong> to spend.`;
}

/** A readable sentence of the player's actual selections, shown before confirming. */
export function choicesSummary(est, safetyStockTarget) {
    const order = est.orderQuantity > 0
        ? `${fmtNum(est.orderQuantity)} units from ${est.supplier.name}, sent by ${est.shippingMethod.name}, arriving Q${est.arrivesOnTurn}`
        : 'No new order';
    return `${order}. ${est.pricingStrategy.name} (you sell at ${fmtMoney2(est.unitPrice)} per unit). ${est.inspection.name}. Extra-stock target: ${fmtNum(safetyStockTarget)} units.`;
}

// ── Situation alerts (from the last resolved quarter) ─────────────────────

function alertsHTML(last) {
    if (!last) return '';
    const items = [];
    if (last.crisis) {
        const good = last.crisis.severity === 'positive';
        items.push({ tone: good ? 'good' : 'warn', title: `Last quarter's event: ${last.crisis.name}`, text: crisisText(last.crisis) });
    }
    if (last.backlog > 0) {
        items.push({ tone: 'critical', title: `${fmtNum(last.backlog)} customer orders still waiting (backlog)`, text: 'They are served first from this quarter\'s stock, before new customers.' });
    } else if (last.missedSales > 0) {
        items.push({ tone: 'warn', title: `Ran short last quarter: ${fmtNum(last.missedSales)} units`, text: 'Customers wanted more than the stock you had.' });
    }
    if (last.safetyBreach) {
        items.push({ tone: 'warn', title: 'Stock fell below your extra-stock target last quarter', text: `Stock left after sales was under your ${fmtNum(last.safetyStockTarget)}-unit target, which lowered customer satisfaction.` });
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

/** A collapsible decision group; the summary stays visible when collapsed. */
function groupHTML(key, num, title, sub, open, body) {
    return `
        <section class="pw-group${open ? ' pw-group--open' : ''}" data-group="${key}">
            <h3 class="pw-group-h">
                <button type="button" class="pw-group-toggle" id="pw-tog-${key}" aria-expanded="${open}" aria-controls="pw-body-${key}">
                    <span class="pw-group-letter" aria-hidden="true">${num}</span>
                    <span class="pw-group-title">${title}</span>
                    <span class="pw-group-sub">${sub}</span>
                    <span class="pw-chevron" aria-hidden="true"></span>
                </button>
            </h3>
            <div class="pw-group-summary" id="pw-sum-${key}"></div>
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
        ${stat('Price per unit', '—', ` data-sup-cost="${sup.id}"`)}
        ${stat('Arrives in', '—', ` data-sup-lead="${sup.id}"`)}
        ${stat('Faulty units', pct(sup.defectRate))}`, 'pw-opt--row')).join('');

    const shippingRows = SHIPPING_METHODS.map(m => radio('pw-shipping', m.id, m.id === draft.shippingId, `
        <span class="pw-opt-main"><span class="pw-opt-name">${m.name}</span></span>
        ${stat('Shipping per unit', '—', ` data-ship-cost="${m.id}"`)}
        ${stat('Travel time', weeks(m.leadTimeModifier))}
        ${stat('Arrives', '—', ` data-ship-arr="${m.id}"`)}`, 'pw-opt--row')).join('');

    const pricingRows = PRICING_STRATEGIES.map(p => radio('pw-pricing', p.id, p.id === draft.pricingId, `
        <span class="pw-opt-main"><span class="pw-opt-name">${p.name}</span></span>
        ${stat('You sell at', '—', ` data-price="${p.id}"`)}
        ${stat('Customer demand', demandChange(p.demandMultiplier))}`, 'pw-opt--row')).join('');

    const inspectionRows = QUALITY_INSPECTIONS.map(q => radio('pw-inspection', q.id, q.id === draft.inspectionId, `
        <span class="pw-opt-main"><span class="pw-opt-name">${q.name}</span></span>
        ${stat('Cost per unit', `$${q.costPerUnit}`)}
        ${stat('Finds', `${Math.round(q.defectCatchRate * 100)}% of faulty units`)}`, 'pw-opt--row')).join('');

    const supplyBody = `
        <fieldset class="pw-field">
            <legend class="pw-legend">Supplier</legend>
            ${explainHTML('supplier', 'supplier columns', '<strong>Price per unit</strong> is what each unit costs from this supplier. <strong>Arrives in</strong> is how many quarters until the order reaches your warehouse — called <em>lead time</em>. <strong>Faulty units</strong> is the share that arrive broken (the <em>defect rate</em>). Cheaper suppliers are often slower or less reliable.')}
            <div class="pw-options">${supplierRows}</div>
        </fieldset>
        <fieldset class="pw-field">
            <legend class="pw-legend">Shipping</legend>
            ${explainHTML('shipping', 'shipping columns', 'Faster shipping costs more per unit but gets stock to you sooner. <strong>Travel time</strong> adds to or removes from the supplier\'s time; <strong>Arrives</strong> is the quarter the order can first be sold. Stock that has left the supplier but not arrived is <em>in transit</em> (“stock on the way”).')}
            <div class="pw-options">${shippingRows}</div>
            <p class="pw-help" id="pw-route-note" hidden></p>
        </fieldset>
        <p class="pw-contract" id="pw-contract" hidden></p>`;

    const pricingBody = `
        <fieldset class="pw-field">
            <legend class="pw-legend">Pricing</legend>
            ${explainHTML('pricing', 'pricing', 'A higher price earns more on each unit sold, but fewer customers buy. A lower price sells more units for less each. The change applies to this quarter\'s customer demand.')}
            <div class="pw-options">${pricingRows}</div>
        </fieldset>`;

    const protectionBody = `
        <fieldset class="pw-field">
            <legend class="pw-legend">Quality inspection</legend>
            ${explainHTML('inspection', 'quality inspection', 'Inspection checks your order for faulty units before they reach customers. Stricter inspection finds more of them but costs more per unit. Faulty units that reach customers lower customer satisfaction.')}
            <div class="pw-options">${inspectionRows}</div>
            <p class="pw-help" id="pw-defect-est"></p>
        </fieldset>
        <div class="pw-field">
            <label class="pw-legend" for="safety-stock-slider">Extra stock for surprises <span class="pw-muted">(safety stock target)</span></label>
            ${explainHTML('safety', 'extra stock for surprises', 'Extra stock you aim to keep in case demand is higher than expected is called <em>safety stock</em>. It costs nothing to set. If the stock left at the end of a quarter falls below this number, customer satisfaction drops — so a higher target asks you to keep more stock, which ties up money in storage.')}
            <div class="pw-slider">
                <input type="range" id="safety-stock-slider" min="0" max="2000" step="100" value="${draft.safetyStockTarget}" aria-describedby="pw-safety-help">
                <output id="safety-stock-value" for="safety-stock-slider">${fmtNum(draft.safetyStockTarget)} units</output>
            </div>
            <p class="pw-help" id="pw-safety-help">No direct cost. If stock left at the end of a quarter is below this target, customer satisfaction drops.</p>
        </div>`;

    // Quantity is the main decision and is never collapsed
    const quantityHTML = `
        <section class="pw-group pw-qblock" aria-labelledby="pw-q-title">
            <h3 class="pw-group-h pw-qblock-h">
                <span class="pw-group-letter" aria-hidden="true">1</span>
                <label class="pw-group-title" id="pw-q-title" for="order-input">How much should I buy?</label>
                <span class="pw-group-sub">Units to order</span>
            </h3>
            <div class="pw-field pw-qty-field">
                <div class="pw-qty">
                    <button type="button" class="pw-qty-btn" data-qty-add="-500" aria-label="Remove 500 units">−500</button>
                    <button type="button" class="pw-qty-btn" data-qty-add="-100" aria-label="Remove 100 units">−100</button>
                    <input type="number" id="order-input" inputmode="numeric" min="0" step="100" value="${draft.orderQuantity}" aria-describedby="pw-qty-hint order-help order-error">
                    <button type="button" class="pw-qty-btn" data-qty-add="100" aria-label="Add 100 units">+100</button>
                    <button type="button" class="pw-qty-btn" data-qty-add="500" aria-label="Add 500 units">+500</button>
                </div>
                <p class="pw-help pw-qty-hint" id="pw-qty-hint"></p>
                <p class="pw-help" id="order-help">Use the buttons to add or remove units, or type a number.</p>
                <p class="pw-error" id="order-error" role="alert" hidden></p>
            </div>
        </section>`;

    const endlessNote = s.isEndless ? ' · the run ends if cash finishes a quarter below $0' : '';

    return `
    <div class="pw">
        <div class="pw-grid">
            <section class="pw-situation" aria-label="Situation">
                ${turnBriefHTML(s, archetypeChips)}
                ${alertsHTML(s.lastTurnResult)}
            </section>


            <section class="pw-decide" aria-label="Decisions and consequences">
                <div class="pw-groups">
                    <h2 class="pw-section-title">Quarter ${s.turn} decisions</h2>
                    ${quantityHTML}
                    ${groupHTML('supply', '2', 'Who supplies it, and how fast?', 'Supplier &amp; shipping', openGroups.supply, supplyBody)}
                    ${groupHTML('pricing', '3', 'What price will I charge?', 'Pricing', openGroups.pricing, pricingBody)}
                    ${groupHTML('protection', '4', 'What extra protection do I want?', 'Inspection &amp; extra stock', openGroups.protection, protectionBody)}
                </div>

                <aside class="pw-aside" aria-labelledby="pw-cons-title">
                    <div class="pw-cons">
                        <h2 class="pw-section-title" id="pw-cons-title">If you confirm this order</h2>
                        <p class="pw-cons-key"><span class="pw-kind pw-kind--known">Known</span> costs and arrival
                            · <span class="pw-kind pw-kind--est">Estimate</span> stock
                            · <span class="pw-kind pw-kind--unknown">Unknown</span> exact demand and surprise events</p>
                        <dl class="pw-stats">
                            <div class="pw-stat"><dt>This order costs</dt><dd id="pw-c-total">—</dd><span class="pw-stat-note">Paid when the quarter plays out</span></div>
                            <div class="pw-stat" id="pw-c-cash-wrap"><dt>Money left after paying</dt><dd id="pw-c-cash">—</dd><span class="pw-stat-note">Before this quarter's sales and storage costs${endlessNote}</span></div>
                            <div class="pw-stat"><dt>Order arrives</dt><dd id="pw-c-arrival">—</dd><span class="pw-stat-note" id="pw-c-arrival-note"></span></div>
                            <div class="pw-stat" id="pw-c-inv-wrap"><dt>Stock left at end of Q${s.turn} <span class="pw-kind pw-kind--est">Estimate</span></dt><dd id="pw-c-inv">—</dd><span class="pw-stat-note" id="pw-c-inv-note"></span></div>
                        </dl>
                        <div class="pw-warning" id="pw-c-warning" role="status" aria-live="polite"></div>
                        <div class="pw-choices">
                            <h3 class="pw-choices-title">Your choices</h3>
                            <p class="pw-choices-text" id="pw-choices-text"></p>
                        </div>
                        <details class="pw-breakdown">
                            <summary>Cost breakdown</summary>
                            <table class="pw-breakdown-table"><tbody id="pw-breakdown-rows"></tbody></table>
                            <p class="pw-note">All costs are paid when the quarter plays out, together with sales income. Estimates leave out any surprise event this quarter and supplier re-approval fees.</p>
                        </details>
                    </div>
                    <div class="pw-actionbar">
                        <p class="pw-actionbar-sum" id="pw-actionbar-sum" aria-hidden="true"></p>
                        <button id="place-order-btn" class="pw-confirm" type="button" aria-describedby="pw-confirm-note">Confirm &amp; play the quarter</button>
                        <p class="pw-confirm-note" id="pw-confirm-note">Locks in all choices above and plays out Q${s.turn}.${s.isEndless ? '' : ' You\'ll be asked to guess demand first.'}</p>
                    </div>
                </aside>
            </section>
            <section class="pw-evidence" aria-label="Details: demand history and stock outlook">
                <article class="pw-card pw-outlook" aria-labelledby="pw-outlook-title">
                    <div class="pw-card-head">
                        <h3 class="pw-card-title" id="pw-outlook-title">Stock on the way &amp; outlook</h3>
                        <span class="pw-badge">Estimate</span>
                    </div>
                    <ul class="pw-shipments" id="pw-shipments" aria-label="Shipments"></ul>
                    <table class="pw-proj" id="pw-proj">
                        <caption class="pw-visually-hidden">Projected stock by quarter (estimate)</caption>
                        <thead><tr>
                            <th scope="col">Quarter</th>
                            <th scope="col">Arriving</th>
                            <th scope="col">Expected demand</th>
                            <th scope="col">Stock left</th>
                        </tr></thead>
                        <tbody></tbody>
                    </table>
                    <p class="pw-note" id="pw-proj-assumptions"></p>
                </article>

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
            const when = inN <= 0 ? 'arrives this quarter, before customers buy' : `arrives Q${o.arrivesOnTurn} (in ${plural(inN, 'quarter')})`;
            return `<li class="pw-ship"><span class="pw-ship-units">${fmtNum(o.usableUnits + o.passedDefects)} units</span>
                <span class="pw-ship-meta">${o.supplierName ?? 'Earlier order'}${o.shippingName ? ` · ${o.shippingName}` : ''} — ${when}</span></li>`;
        });
    const proposed = est.orderQuantity > 0
        ? `<li class="pw-ship pw-ship--proposed"><span class="pw-ship-units">${fmtNum(est.arrivingUnits)} units</span>
            <span class="pw-ship-meta"><strong>This order (proposed)</strong> — arrives Q${est.arrivesOnTurn} (in ${plural(est.leadTimeTurns, 'quarter')})${est.caughtDefects ? `; ${fmtNum(est.caughtDefects)} faulty units removed by inspection` : ''}</span></li>`
        : `<li class="pw-ship pw-ship--proposed"><span class="pw-ship-meta">No new order this quarter.</span></li>`;
    if (!items.length) items.push(`<li class="pw-ship"><span class="pw-ship-meta">No earlier orders on the way.</span></li>`);
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
        return { tone: 'critical', text: `This order costs ${fmtMoney(-cashAfter)} more than the money you have. If cash ends the quarter below $0 the run is over — this quarter's sales would have to cover it.` };
    }
    if (cashAfter < 0) {
        return { tone: 'critical', text: `This order costs ${fmtMoney(-cashAfter)} more than the money you have. That's allowed, but you'll rely on this quarter's sales to cover it.` };
    }
    if (firstShort && firstShort.turn < est.arrivesOnTurn && est.orderQuantity > 0) {
        return { tone: 'critical', text: `This order arrives in Q${est.arrivesOnTurn}, too late for Q${firstShort.turn}. Expect about ${fmtNum(firstShort.short)} units short in Q${firstShort.turn} — those customers wait for later stock.` };
    }
    if (firstShort) {
        return { tone: 'critical', text: `Expected shortfall in Q${firstShort.turn}: about ${fmtNum(firstShort.short)} units short if demand is as estimated.` };
    }
    if (est.contractApplies && est.contractHonoured === false) {
        return { tone: 'warn', text: `Below your contract volume — a ${fmtMoney(est.contractFee)} shortfall fee applies and the discount is lost.` };
    }
    const firstBelow = rows.find(r => r.belowSafety);
    if (firstBelow) {
        return { tone: 'warn', text: `Stock is expected to fall below your ${fmtNum(safetyStock)}-unit extra-stock target in Q${firstBelow.turn} — customer satisfaction drops if demand is as estimated.` };
    }
    if (cashAfter < 80000) {
        return { tone: 'warn', text: `Money left after paying would be under $80,000 — the game's low-cash alert level.` };
    }
    return { tone: 'ok', text: `No shortfall expected through Q${rows[rows.length - 1].turn} if demand is as estimated. Real demand and surprise events can still differ.` };
}
