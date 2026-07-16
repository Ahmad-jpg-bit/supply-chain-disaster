/**
 * NegotiationOverlay — a supply-contract negotiation with a named supplier.
 * Accept / Counter (relationship-gated) / Decline. One counter attempt.
 */

import { resolveCounter } from '../logic/negotiation.js';
import { getIcon } from '../graphics/svg-icons.js';

const fmtN = (n) => n.toLocaleString();
const fmtMoney = (n) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);

const TIER_LABEL = {
    preferred:   { text: 'PREFERRED PARTNER', cls: 'nego-tier--preferred' },
    established: { text: 'ESTABLISHED ACCOUNT', cls: 'nego-tier--established' },
    new:         { text: 'NEW RELATIONSHIP', cls: 'nego-tier--new' },
};

export class NegotiationOverlay {
    constructor() {
        this.overlay = null;
        this._countered = false;
    }

    /**
     * @param {Object}   opts
     * @param {Object}   opts.offer  — from buildOpeningOffer
     * @param {number}   opts.chapterNumber
     * @param {Function} opts.onAccept  — receives the (possibly improved) offer
     * @param {Function} opts.onDecline
     */
    show({ offer, chapterNumber, onAccept, onDecline }) {
        this._offer = offer;
        this._countered = false;
        this._done = false;

        this.overlay = document.createElement('div');
        this.overlay.className = 'nego-overlay';
        this.overlay.innerHTML = this._markup(offer, chapterNumber, null);
        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('nego-overlay--visible'));

        this._bind(chapterNumber, onAccept, onDecline);
    }

    _markup(offer, chapterNumber, negoMsg) {
        const tier = TIER_LABEL[offer.tier];
        return `
            <div class="nego-card glass-panel">
                <div class="nego-head">
                    <span class="nego-eyebrow">${getIcon('handshake', 13)} CONTRACT PROPOSAL</span>
                    <span class="nego-tier ${tier.cls}">${tier.text}</span>
                </div>
                <div class="nego-from">${offer.supplierName} &mdash; supply agreement for Chapter ${chapterNumber}</div>

                <p class="nego-pitch">${negoMsg || `"We value your business. Commit to a per-quarter volume and I'll take ${offer.discountPct}% off every unit for this chapter. Fewer surprises for both of us."`}</p>

                <div class="nego-terms">
                    <div class="nego-term">
                        <span class="nego-term-label">Unit discount</span>
                        <span class="nego-term-value nego-term-value--good">−${offer.discountPct}%</span>
                    </div>
                    <div class="nego-term">
                        <span class="nego-term-label">Volume commitment</span>
                        <span class="nego-term-value">${fmtN(offer.minVolume)} units / quarter</span>
                    </div>
                    <div class="nego-term">
                        <span class="nego-term-label">Shortfall fee</span>
                        <span class="nego-term-value nego-term-value--warn">${fmtMoney(offer.shortfallFee)} / miss</span>
                    </div>
                </div>

                <p class="nego-fineprint">Hit the committed volume and the discount applies. Fall short in a quarter and the discount voids for that quarter, plus the fee. Runs through the end of Chapter ${chapterNumber}.</p>

                <div class="nego-actions">
                    <button class="nego-btn nego-btn--accept" data-act="accept">Accept terms</button>
                    <button class="nego-btn nego-btn--counter" data-act="counter" ${this._countered ? 'disabled' : ''}>
                        ${this._countered ? 'Countered' : 'Push for a better deal'}
                    </button>
                    <button class="nego-btn nego-btn--decline" data-act="decline">Walk away</button>
                </div>
            </div>`;
    }

    _bind(chapterNumber, onAccept, onDecline) {
        this.overlay.querySelectorAll('.nego-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this._done || btn.disabled) return;
                const act = btn.dataset.act;

                if (act === 'accept') {
                    this._done = true;
                    this._hide();
                    onAccept(this._offer);
                } else if (act === 'decline') {
                    this._done = true;
                    this._hide();
                    onDecline();
                } else if (act === 'counter' && !this._countered) {
                    this._countered = true;
                    const outcome = resolveCounter(this._offer);
                    if (outcome.result === 'improved' || outcome.result === 'held') {
                        this._offer = outcome.offer;
                    }
                    // 'walked' keeps the original offer but locks the counter
                    this.overlay.querySelector('.nego-card')
                        .outerHTML = this._markup(this._offer, chapterNumber, outcome.message);
                    this._bind(chapterNumber, onAccept, onDecline);
                }
            });
        });
    }

    _hide() {
        if (!this.overlay) return;
        const el = this.overlay;
        this.overlay = null;
        el.classList.remove('nego-overlay--visible');
        setTimeout(() => el.remove(), 250);
    }
}
