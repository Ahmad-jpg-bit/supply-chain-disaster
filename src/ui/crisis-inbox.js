/**
 * CrisisInboxOverlay — a priority message from a named colleague, delivered
 * after the order is locked but before the quarter resolves.
 */

import { getIcon } from '../graphics/svg-icons.js';

const fmtMoney = (n) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(n);

const SEVERITY_LABELS = {
    positive: { label: 'GOOD NEWS', cls: 'ci-sev--positive' },
    low:      { label: 'ADVISORY',  cls: 'ci-sev--low' },
    medium:   { label: 'URGENT',    cls: 'ci-sev--medium' },
    high:     { label: 'CRITICAL',  cls: 'ci-sev--high' },
    critical: { label: 'CRITICAL',  cls: 'ci-sev--high' },
};

export class CrisisInboxOverlay {
    constructor() {
        this.overlay = null;
    }

    /**
     * @param {Object}   opts
     * @param {Object}   opts.message — from buildCrisisMessage
     * @param {number}   opts.turn    — current quarter number
     * @param {number}   opts.cash    — player cash (disables unaffordable mitigations)
     * @param {Function} opts.onDone  — receives the chosen option
     */
    show({ message, turn, cash, onDone }) {
        this._done = false;
        const sev = SEVERITY_LABELS[message.severity] || SEVERITY_LABELS.medium;
        const initials = message.sender.name.split(' ').map(w => w[0]).join('').slice(0, 2);

        this.overlay = document.createElement('div');
        this.overlay.className = 'ci-overlay';
        this.overlay.innerHTML = `
            <div class="ci-card glass-panel">
                <div class="ci-topbar">
                    <span class="ci-topbar-label">${getIcon('mail', 13)} INCOMING — PRIORITY MESSAGE</span>
                    <span class="ci-sev ${sev.cls}">${sev.label}</span>
                </div>

                <div class="ci-sender">
                    <span class="ci-avatar">${initials}</span>
                    <div class="ci-sender-meta">
                        <span class="ci-sender-name">${message.sender.name}</span>
                        <span class="ci-sender-role">${message.sender.role} · Q${turn}</span>
                    </div>
                </div>

                <div class="ci-subject">RE: ${message.subject}</div>
                <p class="ci-body">&ldquo;${message.body}&rdquo;</p>

                <div class="ci-options">
                    ${message.options.map(o => `
                        <button class="ci-option ${o.id === 'mitigate' ? 'ci-option--mitigate' : ''}"
                                data-id="${o.id}" ${o.cost > cash ? 'disabled' : ''}>
                            <span class="ci-option-label">
                                ${o.label}${o.cost > 0 ? ` <span class="ci-option-cost">−${fmtMoney(o.cost)}</span>` : ''}
                            </span>
                            ${o.note ? `<span class="ci-option-note">${o.cost > cash ? 'Not enough cash. ' : ''}${o.note}</span>` : ''}
                        </button>`).join('')}
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('ci-overlay--visible'));

        this.overlay.querySelectorAll('.ci-option').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this._done || btn.disabled) return;
                this._done = true;
                const option = message.options.find(o => o.id === btn.dataset.id);
                this._hide();
                onDone(option);
            });
        });
    }

    _hide() {
        if (!this.overlay) return;
        const el = this.overlay;
        this.overlay = null;
        el.classList.remove('ci-overlay--visible');
        setTimeout(() => el.remove(), 250);
    }
}
