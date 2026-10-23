/**
 * Rate & review dialog, plus the small "How was it?" prompt shown at
 * milestones (free intro complete, campaign complete — win or lose).
 *
 * Posting needs a verified account (the same email code as cloud saves) with
 * at least one completed quarter in a campaign saved to that account. A guest
 * can write first: the draft stays on this device through verification.
 * Review text is only ever inserted as text, never as HTML.
 */

import './review-form.css';
import * as CS from '../logic/cloud-sync.js';
import * as CM from '../logic/community.js';
import { t } from '../i18n/pregame.js';
import { track } from '../shared/track.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const TEXT_MAX = 1000;
export const NAME_MAX = 40;
const INDUSTRY_NAME = { fmcg: 'FMCG', pharma: 'Pharmaceuticals', electronics: 'Consumer Electronics' };
export const industryName = (id) => INDUSTRY_NAME[id] || '';

export class ReviewDialog {
    /** @param {{ savePanel?: import('./save-panel.js').SavePanel, currentRunId?: () => (string|null), onChange?: () => void }} o */
    constructor(o = {}) {
        this.o = o;
        this._resumeAfterSignIn = false;
        CS.onChange(() => {
            if (this._resumeAfterSignIn && CS.getSession().signedIn) {
                this._resumeAfterSignIn = false;
                this.open({ source: 'after_verification' });
            }
        });
    }

    async open({ source = 'entry' } = {}) {
        this.source = source;
        if (!this.el) {
            this.el = document.createElement('dialog');
            this.el.className = 'svp-dialog rvf-dialog';
            this.el.setAttribute('aria-labelledby', 'rvf-title');
            document.body.appendChild(this.el);
            this.el.addEventListener('close', () => { this.el.remove(); this.el = null; });
        }
        this.mine = null;
        this.msg = '';
        const draft = CM.loadDraft();
        this.form = { rating: draft?.rating || null, text: draft?.text || '', displayName: draft?.displayName || '', industryId: draft?.industryId || null };
        this._render(true);
        if (!this.el.open) this.el.showModal();
        track('review_open', { source });
        await this._loadMine();
    }

    close() { this.el?.close(); }

    async _loadMine({ retry = true } = {}) {
        const mine = await CM.fetchMine();
        if (!this.el) return;
        // Just verified: this campaign may still be uploading — give it one chance
        if (retry && mine.signedIn && !mine.eligible && !mine.review) {
            CS.flushAll();
            await new Promise(r => setTimeout(r, 2500));
            return this._loadMine({ retry: false });
        }
        this.mine = mine;
        // Prefill from the posted review unless the player has an unposted draft
        if (mine.review && !CM.loadDraft()) {
            this.form = { rating: mine.review.rating, text: mine.review.text, displayName: mine.review.displayName === 'Anonymous' ? '' : mine.review.displayName, industryId: mine.review.industryId };
        }
        this._render(false);
    }

    _render(loading) {
        const m = this.mine || {};
        const r = m.review;
        const f = this.form;
        const industries = m.playedIndustries || [];
        const stars = [1, 2, 3, 4, 5].map(n => `
            <input type="radio" class="rvf-star-input" name="rvf-rating" id="rvf-r${n}" value="${n}" ${f.rating === n ? 'checked' : ''}>
            <label class="rvf-star" for="rvf-r${n}" data-n="${n}"><span aria-hidden="true">★</span><span class="rvf-sr">${t(`rv.star.${n}`)}</span></label>`).join('');
        const statusLine = r ? t(`rv.mine.${r.status}`, { reason: r.statusReason ? t(`rv.reason.${r.statusReason}`) : '' }) : '';

        let action;
        if (loading) action = `<p class="rvf-note">${t('rv.loading')}</p>`;
        else if (m.error) action = `<p class="rvf-note">${t('rv.unavailable')}</p>`;
        else if (!m.signedIn) action = `
            <p class="rvf-note">${t('rv.signin.note')}</p>
            <button type="submit" class="svp-btn svp-btn--primary" data-rvf="verify">${t('rv.signin.button')}</button>`;
        else if (!m.eligible) action = `<p class="rvf-note">${t('rv.notEligible')}</p>`;
        else action = `
            <div class="svp-row">
                <button type="submit" class="svp-btn svp-btn--primary" data-rvf="post">${r ? t('rv.update') : t('rv.post')}</button>
                ${r ? `<button type="button" class="svp-btn svp-btn--ghost" data-rvf="delete">${t('rv.delete')}</button>` : ''}
            </div>`;

        this.el.innerHTML = `
            <form class="svp rvf" novalidate>
                <div class="svp-head">
                    <h2 class="svp-title" id="rvf-title">${r ? t('rv.titleEdit') : t('rv.title')}</h2>
                    <button type="button" class="svp-x" data-rvf="close" aria-label="${t('rv.close')}">✕</button>
                </div>
                ${statusLine ? `<p class="rvf-status">${esc(statusLine)}</p>` : ''}
                <fieldset class="rvf-rating">
                    <legend class="svp-label">${t('rv.rating.legend')}</legend>
                    <div class="rvf-stars">${stars}</div>
                    <p class="rvf-rating-value" id="rvf-rating-value">${f.rating ? t('rv.rating.value', { n: f.rating, label: t(`rv.star.${f.rating}`) }) : t('rv.rating.none')}</p>
                </fieldset>
                <div class="svp-form">
                    <label class="svp-label" for="rvf-text">${t('rv.text.label')}</label>
                    <textarea id="rvf-text" class="svp-input rvf-text" rows="5" maxlength="${TEXT_MAX}" aria-describedby="rvf-count rvf-text-hint"></textarea>
                    <p class="rvf-hint"><span id="rvf-text-hint">${t('rv.text.hint')}</span> <span id="rvf-count" class="rvf-count"></span></p>
                </div>
                <div class="svp-form">
                    <label class="svp-label" for="rvf-name">${t('rv.name.label')}</label>
                    <input id="rvf-name" class="svp-input" maxlength="${NAME_MAX}" autocomplete="off" placeholder="Anonymous" aria-describedby="rvf-name-hint">
                    <p class="rvf-hint" id="rvf-name-hint">${t('rv.name.hint')}</p>
                </div>
                ${industries.length ? `
                <div class="svp-form">
                    <label class="svp-label" for="rvf-industry">${t('rv.industry.label')}</label>
                    <select id="rvf-industry" class="svp-input">
                        <option value="">${t('rv.industry.none')}</option>
                        ${industries.map(id => `<option value="${esc(id)}" ${f.industryId === id ? 'selected' : ''}>${esc(industryName(id))}</option>`).join('')}
                    </select>
                </div>` : ''}
                <div class="rvf-public">
                    <p><strong>${t('rv.public.h')}</strong> ${t('rv.public.body')}</p>
                    <p>${t('rv.public.moderation')}</p>
                </div>
                ${action}
                <p class="svp-msg" role="status" aria-live="polite">${esc(this.msg)}</p>
            </form>`;
        // User text goes in as values, never markup
        this.el.querySelector('#rvf-text').value = f.text;
        this.el.querySelector('#rvf-name').value = f.displayName;
        this._bind();
    }

    _bind() {
        const el = this.el;
        const count = () => { el.querySelector('#rvf-count').textContent = t('rv.text.count', { n: el.querySelector('#rvf-text').value.length, max: TEXT_MAX }); };
        const sync = () => {
            const checked = el.querySelector('input[name="rvf-rating"]:checked');
            this.form = {
                rating: checked ? Number(checked.value) : null,
                text: el.querySelector('#rvf-text').value,
                displayName: el.querySelector('#rvf-name').value,
                industryId: el.querySelector('#rvf-industry')?.value || this.form.industryId || null,
            };
            el.querySelectorAll('.rvf-star').forEach(s => s.classList.toggle('is-on', Number(s.dataset.n) <= (this.form.rating || 0)));
            el.querySelector('#rvf-rating-value').textContent = this.form.rating ? t('rv.rating.value', { n: this.form.rating, label: t(`rv.star.${this.form.rating}`) }) : t('rv.rating.none');
            count();
            CM.saveDraft(this.form);
        };
        el.querySelectorAll('input[name="rvf-rating"]').forEach(i => i.addEventListener('change', sync));
        el.querySelector('#rvf-text').addEventListener('input', sync);
        el.querySelector('#rvf-name').addEventListener('input', sync);
        el.querySelector('#rvf-industry')?.addEventListener('change', sync);
        el.querySelectorAll('.rvf-star').forEach(s => s.classList.toggle('is-on', Number(s.dataset.n) <= (this.form.rating || 0)));
        count();
        el.querySelector('[data-rvf="close"]').addEventListener('click', () => this.close());
        el.querySelector('[data-rvf="delete"]')?.addEventListener('click', () => this._delete());
        el.querySelector('form').addEventListener('submit', (e) => {
            e.preventDefault();
            if (!this.mine) return;   // still loading
            if (e.submitter?.dataset.rvf === 'verify' || !this.mine?.signedIn) return this._verifyFirst();
            this._post();
        });
    }

    _say(msg) {
        this.msg = msg;
        const m = this.el?.querySelector('.svp-msg');
        if (m) m.textContent = msg;
    }

    _verifyFirst() {
        CM.saveDraft(this.form);
        if (!this.o.savePanel) { this._say(t('rv.unavailable')); return; }
        this._resumeAfterSignIn = true;
        this.close();
        this.o.savePanel.open({ focus: 'email', adoptRunId: this.o.currentRunId?.() || null, source: 'review' });
    }

    async _post() {
        if (!this.form.rating) { this._say(t('rv.err.bad_rating')); this.el.querySelector('#rvf-r1')?.focus(); return; }
        if (this.form.text.length > TEXT_MAX) { this._say(t('rv.err.too_long')); return; }
        this._say(t('rv.posting'));
        const r = await CM.submitReview({ ...this.form, text: this.form.text.trim(), displayName: this.form.displayName.trim() });
        if (!this.el) return;
        if (!r.ok) {
            if (r.error === 'signed_out') { this.mine = { signedIn: false }; this._render(false); }
            this._say(t(`rv.err.${r.error}`) === `rv.err.${r.error}` ? t('rv.err.generic') : t(`rv.err.${r.error}`));
            return;
        }
        track('review_submitted', { source: this.source, rating: this.form.rating, has_text: Boolean(this.form.text.trim()) });
        this.mine = null;
        await this._loadMine({ retry: false });
        this._say(r.status === 'published' ? t('rv.done.published') : t('rv.done.pending'));
        this.o.onChange?.();
    }

    async _delete() {
        if (!confirm(t('rv.delete.confirm'))) return;
        const r = await CM.deleteReview();
        if (!this.el) return;
        if (!r.ok) { this._say(t('rv.err.generic')); return; }
        CM.clearDraft();
        this.form = { rating: null, text: '', displayName: '', industryId: null };
        await this._loadMine({ retry: false });
        this._say(t('rv.deleted'));
        this.o.onChange?.();
    }
}

/**
 * Milestone prompt (never during decisions). Appended to a results screen;
 * "Not now" hides it for this campaign for good.
 */
export function mountReviewPrompt(container, { runId, dialog, source }) {
    if (!container || !runId || !dialog || !CM.shouldPrompt(runId)) return null;
    const box = document.createElement('aside');
    box.className = 'rvp';
    box.setAttribute('aria-labelledby', 'rvp-h');
    box.innerHTML = `
        <h3 class="rvp-h" id="rvp-h">${t('rv.prompt.h')}</h3>
        <p class="rvp-p">${t('rv.prompt.body')}</p>
        <div class="rvp-actions">
            <button type="button" class="svp-btn svp-btn--primary" data-rvp="go">${t('rv.prompt.go')}</button>
            <button type="button" class="svp-btn svp-btn--ghost" data-rvp="later">${t('rv.prompt.later')}</button>
        </div>`;
    container.appendChild(box);
    box.querySelector('[data-rvp="go"]').addEventListener('click', () => { CM.dismissPrompt(runId); box.remove(); dialog.open({ source }); });
    box.querySelector('[data-rvp="later"]').addEventListener('click', () => { CM.dismissPrompt(runId); box.remove(); track('review_prompt_dismissed', { source }); });
    track('review_prompt_view', { source });
    return box;
}
