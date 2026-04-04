/**
 * SaveProgressModal
 *
 * An email-capture gate themed as an "Operational Data Backup" prompt.
 * Displayed after Chapter 2 (last free chapter) and on Game Over
 * if the player hasn't already provided their email.
 *
 * Usage:
 *   const modal = new SaveProgressModal();
 *   modal.show({ chapter, industry }, onComplete);
 *   // onComplete() is called whether the player submits OR skips.
 *
 * localStorage key: 'scd_progress_email' — set on successful capture.
 */

import './save-progress-modal.css';
import { shield, checkmark } from '../graphics/svg-icons.js';

const STORAGE_KEY = 'scd_progress_email';

const INDUSTRY_LABELS = {
    electronics: 'Electronics',
    fmcg:        'Consumer Goods',
    pharma:      'Pharmaceuticals',
};

export class SaveProgressModal {
    constructor() {
        this.overlay    = null;
        this.onComplete = null;
    }

    /** Returns true if an email has already been captured this device. */
    static isCaptured() {
        return !!localStorage.getItem(STORAGE_KEY);
    }

    /** Returns the captured email, or null. */
    static getCapturedEmail() {
        return localStorage.getItem(STORAGE_KEY);
    }

    /**
     * @param {{ chapter: number, industry: string }} context
     * @param {function} onComplete  — called after submit or skip
     */
    show(context = {}, onComplete) {
        console.log('[SaveProgressModal] show() called', context);
        this.onComplete = onComplete;
        this._render(context);
    }

    _render({ chapter = 1, industry = 'electronics' } = {}) {
        console.log('[SaveProgressModal] _render() called');
        this.overlay = document.createElement('div');
        this.overlay.className = 'sp-overlay';

        const industryLabel = INDUSTRY_LABELS[industry] || 'Unknown';

        // Pre-fill with existing premium email if available
        const existingEmail = (() => {
            try {
                const raw = localStorage.getItem('scd_premium');
                return raw ? JSON.parse(raw)?.email || '' : '';
            } catch { return ''; }
        })();

        this.overlay.innerHTML = `
            <div class="sp-modal glass-panel">

                <div class="sp-header">
                    <div class="sp-badge">
                        <span class="sp-badge-dot"></span>
                        System Alert
                    </div>
                    <div class="sp-icon-wrap">
                        ${shield(28)}
                    </div>
                    <h2 class="sp-title">Secure Your Operational Data</h2>
                    <p class="sp-subtitle">
                        Your performance metrics and strategic decisions are stored in volatile
                        session memory. Enter your command-center access to encrypt and back up
                        your progress before advancing.
                    </p>
                </div>

                <div class="sp-data-row">
                    <div class="sp-data-cell">
                        <div class="sp-data-label">Industry Sector</div>
                        <div class="sp-data-value">${industryLabel}</div>
                    </div>
                    <div class="sp-data-cell">
                        <div class="sp-data-label">Chapter Cleared</div>
                        <div class="sp-data-value">${chapter} / 10</div>
                    </div>
                </div>

                <div class="sp-form" id="sp-form">
                    <div class="sp-input-wrap">
                        <span class="sp-input-icon">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="2" y="4" width="20" height="16" rx="2"/>
                                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                            </svg>
                        </span>
                        <input
                            id="sp-email-input"
                            class="sp-email-input"
                            type="email"
                            placeholder="commander@yourdomain.com"
                            autocomplete="email"
                            value="${existingEmail}"
                        />
                    </div>
                    <button id="sp-submit-btn" class="sp-submit-btn">
                        Lock In My Progress &rarr;
                    </button>
                    <div id="sp-status" class="sp-status hidden"></div>
                </div>

                <div class="sp-footer">
                    <button id="sp-skip-btn" class="sp-skip">
                        Skip &mdash; I accept the risk of data loss
                    </button>
                </div>

            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('visible'));

        this._attachListeners(chapter, industry);

        // Auto-focus email input
        setTimeout(() => {
            const input = this.overlay.querySelector('#sp-email-input');
            if (input && !input.value) input.focus();
        }, 350);
    }

    _attachListeners(chapter, industry) {
        const submitBtn = this.overlay.querySelector('#sp-submit-btn');
        const skipBtn   = this.overlay.querySelector('#sp-skip-btn');
        const input     = this.overlay.querySelector('#sp-email-input');

        submitBtn.addEventListener('click', () => this._handleSubmit(chapter, industry));

        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') this._handleSubmit(chapter, industry);
        });

        input.addEventListener('input', () => {
            input.classList.remove('error');
            this._setStatus('', '');
        });

        skipBtn.addEventListener('click', () => this._dismiss());
    }

    async _handleSubmit(chapter, industry) {
        const input     = this.overlay.querySelector('#sp-email-input');
        const submitBtn = this.overlay.querySelector('#sp-submit-btn');
        const email     = input.value.trim();

        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            input.classList.add('error');
            this._setStatus('Enter a valid email address to secure your data.', 'error-msg');
            input.focus();
            return;
        }

        submitBtn.disabled = true;
        submitBtn.textContent = 'Encrypting...';
        this._setStatus('', '');

        try {
            const res = await fetch('/api/save-progress', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ email, chapter, industry }),
            });

            const data = await res.json();

            if (!res.ok) throw new Error(data.error || 'Unknown error');

            // Persist locally
            localStorage.setItem(STORAGE_KEY, email);

            this._showSuccess(email);

        } catch (err) {
            console.error('save-progress error:', err);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Lock In My Progress \u2192';
            this._setStatus('Backup failed. Try again or skip for now.', 'error-msg');
        }
    }

    _showSuccess(email) {
        const form   = this.overlay.querySelector('#sp-form');
        const footer = this.overlay.querySelector('.sp-footer');

        form.innerHTML = `
            <div class="sp-success-state">
                <div class="sp-success-icon">${checkmark(24)}</div>
                <h3 class="sp-success-title">Progress Secured</h3>
                <p class="sp-success-sub">
                    Your operational data has been encrypted and sent to
                    <strong>${email}</strong>. The board has been notified.
                </p>
                <button class="sp-continue-btn" id="sp-continue-btn">
                    Continue Mission &rarr;
                </button>
            </div>
        `;
        footer.style.display = 'none';

        form.querySelector('#sp-continue-btn').addEventListener('click', () => this._dismiss());
    }

    _setStatus(msg, type) {
        const el = this.overlay.querySelector('#sp-status');
        if (!el) return;
        el.textContent = msg;
        el.className   = `sp-status ${type} ${msg ? '' : 'hidden'}`.trim();
    }

    _dismiss() {
        this.overlay.classList.remove('visible');
        this.overlay.addEventListener('transitionend', () => {
            this.overlay.remove();
            this.overlay = null;
        }, { once: true });
        this.onComplete?.();
        this.onComplete = null;
    }
}
