/**
 * Shown when a player finishes the last chapter their access includes —
 * normally the free intro (FMCG Chapter 1). The full results, chapter summary
 * and concept card have ALREADY been shown; this screen adds a short debrief
 * and the paid continuation without withholding anything.
 */

import { CORE_PRICE } from './paywall.js';

const fmtMoney = (n) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class IntroComplete {
    /**
     * @param {Object} o
     * @param {boolean} o.isFreeIntro
     * @param {Object}  o.chapter       — chapter just completed
     * @param {Object}  o.nextChapter   — the chapter that needs more access
     * @param {Object}  o.stats         — { cash, profit, missedSales, score, maxScore, mastered, quarters }
     * @param {Object|null} o.diagnosis — { headline, detail } from the chapter's play
     * @param {Function} o.onUnlock, o.onReplay, o.onMenu
     */
    show(o) {
        this.hide();
        const el = document.createElement('div');
        el.className = 'ic-overlay';
        el.setAttribute('role', 'dialog');
        el.setAttribute('aria-modal', 'true');
        el.setAttribute('aria-labelledby', 'ic-title');
        const s = o.stats;
        el.innerHTML = `
            <div class="ic-card glass-panel">
                <p class="ic-eyebrow">${o.isFreeIntro ? 'Free intro complete' : 'End of your current access'}</p>
                <h2 class="ic-title" id="ic-title">Chapter ${o.chapter.number}: ${esc(o.chapter.title)} — done</h2>
                <dl class="ic-stats">
                    <div><dt>Quarters played</dt><dd>${s.quarters}</dd></div>
                    <div><dt>Cash now</dt><dd>${fmtMoney(s.cash)}</dd></div>
                    <div><dt>Chapter profit</dt><dd>${fmtMoney(s.profit)}</dd></div>
                    <div><dt>Units short</dt><dd>${(s.missedSales || 0).toLocaleString()}</dd></div>
                    <div><dt>Concept mastery</dt><dd>${s.score} / ${s.maxScore}${s.mastered ? ' · mastered' : ''}</dd></div>
                </dl>
                ${o.diagnosis ? `<div class="ic-debrief"><h3>Debrief: ${esc(o.diagnosis.headline)}</h3><p>${esc(o.diagnosis.detail)}</p></div>` : `
                <div class="ic-debrief"><h3>Debrief</h3><p>Your results above came from your own forecasts, orders and responses. Replay the chapter to try a different strategy — demand and events change each run.</p></div>`}
                <div class="ic-next">
                    <h3>Next: Chapter ${o.nextChapter.number} — ${esc(o.nextChapter.title)}</h3>
                    <p>${o.isFreeIntro
                        ? `The Core Game Pass (${CORE_PRICE}, one-time) continues this campaign through all 10 chapters and unlocks the Pharmaceuticals and Consumer Electronics campaigns, Endless Survival, the weekly challenge, the Advanced Report PDF and the certificate. No subscription.`
                        : `The Core Game Pass (${CORE_PRICE}, one-time) includes every chapter of all three industry campaigns.`}</p>
                    <p class="ic-fine">Your progress is saved in this browser, so buying later continues from here.</p>
                </div>
                <div class="ic-actions">
                    <button type="button" class="btn-primary" data-ic="unlock">Continue with the Core Game Pass</button>
                    ${o.isFreeIntro ? '<button type="button" class="btn-secondary" data-ic="replay">Replay the free intro</button>' : ''}
                    <button type="button" class="btn-secondary" data-ic="menu">Back to the start page</button>
                </div>
            </div>`;
        document.body.appendChild(el);
        this.el = el;
        requestAnimationFrame(() => el.classList.add('ic-overlay--visible'));
        el.querySelector('[data-ic="unlock"]').addEventListener('click', () => o.onUnlock?.());
        el.querySelector('[data-ic="replay"]')?.addEventListener('click', () => { this.hide(); o.onReplay?.(); });
        el.querySelector('[data-ic="menu"]').addEventListener('click', () => { this.hide(); o.onMenu?.(); });
        el.querySelector('[data-ic="unlock"]').focus();
    }

    hide() {
        this.el?.remove();
        this.el = null;
    }
}
