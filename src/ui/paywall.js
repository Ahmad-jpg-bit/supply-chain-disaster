import { PremiumManager } from '../logic/premium.js';
import { BillingManager } from '../logic/billing.js';

const IS_TEST_MODE = import.meta.env.VITE_LS_TEST_MODE === 'true';

// ── Checkout URLs (web only) ─────────────────────────────────────────────────
// Used exclusively on web. On native (Android/iOS), RevenueCat handles billing.
const CHECKOUT_URLS = {
    standard: 'https://nexttracksystems.lemonsqueezy.com/checkout/buy/65c58393-3110-4aec-9e52-c93abaf3de33',
};

// ── Product definition ───────────────────────────────────────────────────────
const REPORT_PRODUCT = {
    id:       'standard',
    name:     'Full Access',
    price:    '$6.99',
    period:   'one-time · lifetime',
    btnLabel: 'Unlock Everything — $6.99 ✦',
    features: [
        { text: '<strong>All 10 chapters</strong> — full 40-turn campaign' },
        { text: '<strong>Global Crisis &amp; Multi-Regional chapters</strong> (9–10)' },
        { text: '<strong>5-page PDF Debrief Report</strong>' },
        { text: '<strong>Turn-by-turn Decision Audit</strong>' },
        { text: '<strong>Learning Summary &amp; Chapter Breakdown</strong>' },
        { text: '<strong>Completion Certificate &amp; Lifetime Updates</strong>' },
    ],
};

export class Paywall {
    constructor() {
        this.overlay  = null;
        this.onSuccess = null;
    }

    show(onSuccess, onBeforeCheckout) {
        this.onSuccess = onSuccess;
        this._onBeforeCheckout = onBeforeCheckout ?? null;
        this._render();
    }

    hide() {
        if (!this.overlay) return;
        this.overlay.classList.remove('visible');
        this.overlay.addEventListener('transitionend', () => {
            this.overlay?.remove();
            this.overlay = null;
        }, { once: true });
    }

    _render() {
        if (this.overlay) this.overlay.remove();

        this.overlay = document.createElement('div');
        this.overlay.className = 'paywall-overlay';

        // Test-mode banner (web only — never shown on native Play Store builds)
        const sandboxBanner = (!BillingManager.isNative && IS_TEST_MODE) ? `
            <div class="paywall-sandbox-banner">
                🧪 TEST MODE — test card: <strong>4242 4242 4242 4242</strong> · any future date · any CVC
            </div>` : '';

        const featuresHtml = REPORT_PRODUCT.features.map(f => `
            <li class="pricing-feature">
                <span class="pricing-feature-check">✓</span>
                <span>${f.text}</span>
            </li>`).join('');

        const reportCard = `
            <div class="pricing-card pricing-card--featured pricing-card--solo">
                <div class="pricing-card-header">
                    <h3 class="pricing-card-name">${REPORT_PRODUCT.name}</h3>
                    <div class="pricing-card-price">
                        <span class="pricing-price-amount">${REPORT_PRODUCT.price}</span>
                        <span class="pricing-price-period">${REPORT_PRODUCT.period}</span>
                    </div>
                    <p class="pricing-card-tagline">One purchase. Every chapter, every feature, forever.</p>
                </div>
                <ul class="pricing-features">${featuresHtml}</ul>
                <button
                    class="pricing-buy-btn pricing-buy-btn--featured"
                    data-tier="${REPORT_PRODUCT.id}"
                >${REPORT_PRODUCT.btnLabel}</button>
                <p style="font-size:11px;color:var(--text-muted);text-align:center;margin-top:10px;">7-day refund policy &mdash; no questions asked</p>
            </div>`;

        const restoreLabel = BillingManager.isNative ? 'Restore Purchases' : 'Restore access';

        this.overlay.innerHTML = `
            <div class="paywall-modal glass-panel">
                ${sandboxBanner}

                <button class="paywall-close-btn" aria-label="Close">✕</button>

                <div class="paywall-header">
                    <div class="paywall-badge">FULL ACCESS — $6.99 LIFETIME</div>
                    <h2 class="paywall-title">Unlock the full game.</h2>
                    <p class="paywall-subtitle">
                        One $6.99 purchase unlocks all 10 chapters, the 5-page Advanced Report, and every feature — for life. No subscription.
                    </p>
                </div>

                <div class="pricing-cards-grid pricing-cards-grid--solo">
                    ${reportCard}
                </div>

                <div id="paywall-msg" class="paywall-msg hidden"></div>

                <div class="paywall-restore-box">
                    <div class="paywall-restore-box-inner">
                        <span class="paywall-restore-icon">↩</span>
                        <div>
                            <p class="paywall-restore-box-title">Already purchased?</p>
                            <p class="paywall-restore-box-desc">Restore access on this device using your purchase email.</p>
                        </div>
                        <button id="paywall-restore-btn" class="paywall-restore-box-btn">${restoreLabel}</button>
                    </div>
                </div>

                <div class="paywall-promo">
                    <details class="paywall-promo-details">
                        <summary class="paywall-promo-summary">Have a promo code?</summary>
                        <div class="paywall-promo-form">
                            <input
                                id="paywall-promo-input"
                                type="text"
                                class="paywall-promo-input"
                                placeholder="Enter promo code"
                                autocomplete="off"
                                spellcheck="false"
                            />
                            <button id="paywall-promo-btn" class="paywall-promo-btn">Apply</button>
                        </div>
                        <div id="paywall-promo-msg" class="paywall-msg hidden"></div>
                    </details>
                </div>

            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('visible'));

        // Buy button
        this.overlay.querySelectorAll('.pricing-buy-btn').forEach(btn => {
            btn.addEventListener('click', () => this._handleBuy(btn.dataset.tier));
        });

        // Restore
        this.overlay.querySelector('#paywall-restore-btn')
            .addEventListener('click', () => this._handleRestore());

        // Promo code
        this.overlay.querySelector('#paywall-promo-btn')
            .addEventListener('click', () => this._handlePromo());
        this.overlay.querySelector('#paywall-promo-input')
            .addEventListener('keydown', (e) => { if (e.key === 'Enter') this._handlePromo(); });

        // Close on backdrop click or ✕ button
        this.overlay.querySelector('.paywall-close-btn')
            .addEventListener('click', () => this.hide());
        this.overlay.addEventListener('click', (e) => {
            if (e.target === this.overlay) this.hide();
        });
    }

    async _handleBuy(tier) {
        const msgEl = this.overlay.querySelector('#paywall-msg');

        // ── Native (Google Play) ──────────────────────────────────────────────
        if (BillingManager.isNative) {
            const btn = this.overlay.querySelector(`[data-tier="${tier}"]`);
            this._setMsg(msgEl, '');
            btn.disabled = true;
            btn.textContent = 'Processing…';

            const result = await BillingManager.purchaseTier(tier);

            if (result.success) {
                this._setMsg(msgEl, '✓ Purchase successful! Loading content…', 'success');
                setTimeout(() => {
                    this.hide();
                    if (this.onSuccess) this.onSuccess();
                }, 1200);
                return;
            }

            btn.disabled = false;
            btn.textContent = REPORT_PRODUCT.btnLabel;

            if (result.reason === 'cancelled') return; // user cancelled — no error message
            this._setMsg(msgEl, 'Purchase failed. Please try again or contact support.', 'error');
            return;
        }

        // ── Web (Lemon Squeezy) ───────────────────────────────────────────────
        const url = CHECKOUT_URLS[tier] ?? CHECKOUT_URLS.standard;
        if (!url || url === '#') {
            this._setMsg(msgEl, 'Checkout not configured. Contact support.', 'error');
            return;
        }

        // Append success redirect so LS sends buyer back with ?order_id=
        const redirectUrl = `${window.location.origin}/success.html`;
        const separator   = url.includes('?') ? '&' : '?';
        const finalUrl    = `${url}${separator}checkout[redirect_url]=${encodeURIComponent(redirectUrl)}`;

        this._onBeforeCheckout?.();
        window.location.href = finalUrl;
    }

    async _handleRestore() {
        const restoreBtn = this.overlay.querySelector('#paywall-restore-btn');
        const msgEl      = this.overlay.querySelector('#paywall-msg');

        // ── Native (RevenueCat) ───────────────────────────────────────────────
        if (BillingManager.isNative) {
            this._setMsg(msgEl, '');
            restoreBtn.disabled    = true;
            restoreBtn.textContent = 'Restoring…';

            const result = await BillingManager.restorePurchases();

            if (result.success) {
                this._setMsg(msgEl, '✓ Purchases restored! Loading content…', 'success');
                setTimeout(() => {
                    this.hide();
                    if (this.onSuccess) this.onSuccess();
                }, 1200);
                return;
            }

            restoreBtn.disabled    = false;
            restoreBtn.textContent = 'Restore Purchases';

            const msg = result.reason === 'no-purchases-found'
                ? 'No previous purchases found for this account.'
                : 'Restore failed. Please try again or contact support.';
            this._setMsg(msgEl, msg, 'error');
            return;
        }

        // ── Web (email lookup) ────────────────────────────────────────────────
        const email = prompt('Enter the email address you used to purchase:');
        if (!email || !email.includes('@')) return;

        this._setMsg(msgEl, '');
        restoreBtn.disabled    = true;
        restoreBtn.textContent = 'Verifying…';

        const ok = await PremiumManager.restoreByEmail(email.trim());

        if (ok) {
            this._setMsg(msgEl, '✓ Access restored! Loading next chapter…', 'success');
            setTimeout(() => {
                this.hide();
                if (this.onSuccess) this.onSuccess();
            }, 1200);
        } else {
            this._setMsg(msgEl, 'No purchase found for that email. Contact support if you need help.', 'error');
            restoreBtn.disabled    = false;
            restoreBtn.textContent = 'Restore access';
        }
    }

    async _handlePromo() {
        const input  = this.overlay.querySelector('#paywall-promo-input');
        const btn    = this.overlay.querySelector('#paywall-promo-btn');
        const msgEl  = this.overlay.querySelector('#paywall-promo-msg');
        const code   = input.value.trim();

        if (!code) {
            this._setMsg(msgEl, 'Please enter a promo code.', 'error');
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Applying…';
        this._setMsg(msgEl, '');

        const result = await PremiumManager.redeemPromo(code);

        btn.disabled    = false;
        btn.textContent = 'Apply';

        if (result.ok) {
            this._setMsg(msgEl, `✓ ${result.message}`, 'success');
            setTimeout(() => {
                this.hide();
                if (this.onSuccess) this.onSuccess();
            }, 1400);
        } else {
            this._setMsg(msgEl, result.message, 'error');
        }
    }

    _setMsg(el, text, type = '') {
        el.textContent = text;
        el.className   = 'paywall-msg' + (text ? '' : ' hidden');
        if (type) el.classList.add(`paywall-msg--${type}`);
    }
}
