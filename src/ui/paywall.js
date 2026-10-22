/**
 * Core Game Pass offer (the only purchasable offer). Opens from the HUD,
 * locked campaign/mode actions, the free-intro completion screen and the
 * pre-game page via the 'scd:open-paywall' event.
 *
 * Checkout is created server-side (/api/create-checkout) for the allowlisted
 * Core offer only; access is granted only after a verified provider event
 * (see success page) or an email-verified restore. Membership is never
 * offered here — it is disabled server-side until explicitly launched.
 */

import { PremiumManager } from '../logic/premium.js';
import { Entitlements } from '../logic/entitlements.js';
import { CORE_CATALOG, OFFERS } from '../data/packages.js';
import { INDUSTRIES } from '../logic/industries.js';
import { track } from '../shared/track.js';

const IS_TEST_MODE = import.meta.env.VITE_LS_TEST_MODE === 'true';
const fmtPrice = (cents, currency) => new Intl.NumberFormat('en-US', { style: 'currency', currency, minimumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

/** Display price for the Core Game Pass (single source for every surface). */
export const CORE_PRICE = fmtPrice(OFFERS.core.priceCents, OFFERS.core.currency);
/** @deprecated kept for older imports — the Core price. */
export const FULL_ACCESS_PRICE = CORE_PRICE;

const industryName = (id) => Object.values(INDUSTRIES).find(i => i.id === id)?.name || id;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Paywall {
    constructor() {
        this.overlay = null;
        this.onSuccess = null;
    }

    /**
     * @param {Function} [onSuccess] — called after access is confirmed (restore/promo)
     * @param {Function} [onBeforeCheckout] — called just before leaving for checkout
     * @param {Object} [opts] — { source } analytics source
     */
    show(onSuccess, onBeforeCheckout, opts = {}) {
        this.onSuccess = onSuccess;
        this._onBeforeCheckout = onBeforeCheckout ?? null;
        this._source = opts.source || 'game';
        this._render();
        track('core_offer_view', { source: this._source, owned: Entitlements.ownsCore() });
    }

    hide() {
        if (!this.overlay) return;
        const el = this.overlay;
        this.overlay = null;
        el.classList.remove('visible');
        setTimeout(() => el.remove(), 300);
        this._returnFocus?.focus?.();
    }

    _render() {
        if (this.overlay) this.overlay.remove();
        this._returnFocus = document.activeElement;
        const owned = Entitlements.ownsCore();

        this.overlay = document.createElement('div');
        this.overlay.className = 'paywall-overlay';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.setAttribute('aria-labelledby', 'paywall-title');

        const campaigns = CORE_CATALOG.campaigns.map(id => `<li>${esc(industryName(id))} — all ${CORE_CATALOG.chapters.length} chapters</li>`).join('');
        const sandbox = IS_TEST_MODE ? `<div class="paywall-sandbox-banner">TEST MODE — Lemon Squeezy test card 4242 4242 4242 4242, any future date, any CVC</div>` : '';

        this.overlay.innerHTML = `
            <div class="paywall-modal glass-panel">
                ${sandbox}
                <button class="paywall-close-btn" aria-label="Close">✕</button>
                <div class="paywall-header">
                    <div class="paywall-badge">${owned ? 'INCLUDED IN YOUR ACCESS' : `CORE GAME PASS — ${CORE_PRICE} ONE-TIME`}</div>
                    <h2 class="paywall-title" id="paywall-title">${owned ? 'You have the Core Game Pass content.' : 'Play every campaign.'}</h2>
                    <p class="paywall-subtitle">
                        ${owned
                            ? 'Everything below is already unlocked in this browser. There is nothing to buy again.'
                            : `The free intro is Chapter 1 of Fast-Moving Consumer Goods. The Core Game Pass is a one-time ${CORE_PRICE} purchase — no subscription and no recurring charge.`}
                    </p>
                </div>

                <div class="pricing-cards-grid pricing-cards-grid--solo">
                    <div class="pricing-card pricing-card--featured pricing-card--solo">
                        <div class="pricing-card-header">
                            <h3 class="pricing-card-name">Core Game Pass</h3>
                            <div class="pricing-card-price">
                                <span class="pricing-price-amount">${CORE_PRICE}</span>
                                <span class="pricing-price-period">one-time</span>
                            </div>
                        </div>
                        <p class="paywall-included-label">Includes</p>
                        <ul class="pricing-features paywall-list">
                            ${campaigns}
                            <li>Replay any campaign and start at any chapter</li>
                            <li>Endless Survival and the weekly challenge</li>
                            <li>Downloadable Advanced Report (PDF) and Certificate of Completion</li>
                        </ul>
                        <p class="paywall-fine">Access is for the campaigns and modes listed here. It does not automatically include content released later.</p>
                        ${owned ? `<p class="paywall-owned">✓ Included</p>` : `
                        <button class="pricing-buy-btn pricing-buy-btn--featured" id="paywall-buy-btn">Continue to secure checkout</button>
                        <p class="paywall-fine">
                            Checkout is handled by Lemon Squeezy, our merchant of record. Any sales tax or VAT for your
                            location is calculated at checkout and shown before you pay. Your saved game stays on this
                            device while you check out. Use the email you want to restore your purchase with.
                            <a href="/refund">Refund policy</a> · <a href="/contact">Support</a>
                        </p>`}
                    </div>
                </div>

                <div id="paywall-msg" class="paywall-msg hidden" role="status" aria-live="polite"></div>

                <div class="paywall-restore-box">
                    <p class="paywall-restore-box-title">Already bought it, or playing on a new device?</p>
                    <p class="paywall-restore-box-desc">Enter the email you purchased with. We'll email you a 6-digit code to confirm it's you.</p>
                    <form class="paywall-restore-form" id="paywall-restore-form" novalidate>
                        <label class="pg-visually-hidden" for="paywall-restore-email">Purchase email</label>
                        <input id="paywall-restore-email" type="email" autocomplete="email" placeholder="you@example.com" class="paywall-promo-input">
                        <button type="submit" class="paywall-restore-box-btn" id="paywall-restore-send">Send code</button>
                    </form>
                    <form class="paywall-restore-form" id="paywall-code-form" novalidate hidden>
                        <label class="pg-visually-hidden" for="paywall-restore-code">6-digit code</label>
                        <input id="paywall-restore-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="6-digit code" class="paywall-promo-input">
                        <button type="submit" class="paywall-restore-box-btn">Restore</button>
                    </form>
                </div>

                <details class="paywall-promo-details">
                    <summary class="paywall-promo-summary">Have a promo code?</summary>
                    <div class="paywall-promo-form">
                        <input id="paywall-promo-input" type="text" class="paywall-promo-input" placeholder="Enter promo code" autocomplete="off" spellcheck="false" />
                        <button id="paywall-promo-btn" class="paywall-promo-btn" type="button">Apply</button>
                    </div>
                    <div id="paywall-promo-msg" class="paywall-msg hidden"></div>
                </details>
            </div>`;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay?.classList.add('visible'));

        const $ = (s) => this.overlay.querySelector(s);
        $('#paywall-buy-btn')?.addEventListener('click', () => this._handleBuy());
        $('#paywall-restore-form').addEventListener('submit', (e) => { e.preventDefault(); this._sendCode(); });
        $('#paywall-code-form').addEventListener('submit', (e) => { e.preventDefault(); this._verifyCode(); });
        $('#paywall-promo-btn').addEventListener('click', () => this._handlePromo());
        $('#paywall-promo-input').addEventListener('keydown', (e) => { if (e.key === 'Enter') this._handlePromo(); });
        $('.paywall-close-btn').addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', (e) => { if (e.target === this.overlay) this.hide(); });
        this.overlay.addEventListener('keydown', (e) => { if (e.key === 'Escape') this.hide(); });
        ($('#paywall-buy-btn') || $('.paywall-close-btn')).focus();
    }

    async _handleBuy() {
        const btn = this.overlay.querySelector('#paywall-buy-btn');
        const msg = this.overlay.querySelector('#paywall-msg');
        btn.disabled = true;
        btn.textContent = 'Opening checkout…';
        this._setMsg(msg, '');
        const result = await Entitlements.startCheckout('core', '/play');
        if (result.url) {
            track('checkout_start', { offer: 'core', source: this._source });
            this._onBeforeCheckout?.();
            document.dispatchEvent(new Event('scd:before-checkout'));   // the game saves its run first
            window.location.href = result.url;
            return;
        }
        btn.disabled = false;
        btn.textContent = 'Continue to secure checkout';
        this._setMsg(msg, result.error === 'not_configured' || result.error === 'unavailable'
            ? 'Purchases aren’t available yet. Your free intro and saved progress are unaffected — please check back soon.'
            : 'Couldn’t open checkout. Check your connection and try again.', 'error');
    }

    async _sendCode() {
        const email = this.overlay.querySelector('#paywall-restore-email').value.trim();
        const msg = this.overlay.querySelector('#paywall-msg');
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this._setMsg(msg, 'Enter a valid email address.', 'error'); return; }
        const r = await Entitlements.requestCode(email).catch(() => ({ ok: false, error: 'network' }));
        if (!r.ok) {
            this._setMsg(msg, r.error === 'rate_limited' ? 'Too many codes requested. Try again in an hour.' : 'Couldn’t send a code right now. Try again later.', 'error');
            return;
        }
        this._restoreEmail = email;
        this.overlay.querySelector('#paywall-code-form').hidden = false;
        this.overlay.querySelector('#paywall-restore-code').focus();
        this._setMsg(msg, `If ${email} has a purchase, a code is on its way. Check your inbox.`, 'success');
    }

    async _verifyCode() {
        const code = this.overlay.querySelector('#paywall-restore-code').value.trim();
        const msg = this.overlay.querySelector('#paywall-msg');
        const r = await Entitlements.verifyCode(this._restoreEmail, code).catch(() => ({ ok: false, error: 'network' }));
        if (!r.ok) {
            this._setMsg(msg, { wrong_code: 'That code isn’t right. Check it and try again.', code_expired: 'That code has expired. Request a new one.', too_many_attempts: 'Too many attempts. Request a new code.' }[r.error] || 'Couldn’t verify the code. Try again.', 'error');
            return;
        }
        if (!Entitlements.hasPaid()) { this._setMsg(msg, 'Email confirmed, but no purchase was found for it. Contact support if you think this is wrong.', 'error'); return; }
        this._setMsg(msg, '✓ Purchase restored in this browser.', 'success');
        setTimeout(() => { this.hide(); this.onSuccess?.(); }, 1000);
    }

    async _handlePromo() {
        const input = this.overlay.querySelector('#paywall-promo-input');
        const btn = this.overlay.querySelector('#paywall-promo-btn');
        const msg = this.overlay.querySelector('#paywall-promo-msg');
        const code = input.value.trim();
        if (!code) { this._setMsg(msg, 'Please enter a promo code.', 'error'); return; }
        btn.disabled = true;
        btn.textContent = 'Applying…';
        this._setMsg(msg, '');
        const result = await PremiumManager.redeemPromo(code);
        btn.disabled = false;
        btn.textContent = 'Apply';
        if (result.ok) {
            this._setMsg(msg, `✓ ${result.message}`, 'success');
            setTimeout(() => { this.hide(); this.onSuccess?.(); }, 1200);
        } else {
            this._setMsg(msg, result.message, 'error');
        }
    }

    _setMsg(el, text, type = '') {
        el.textContent = text;
        el.className = 'paywall-msg' + (text ? '' : ' hidden');
        if (type) el.classList.add(`paywall-msg--${type}`);
    }
}
