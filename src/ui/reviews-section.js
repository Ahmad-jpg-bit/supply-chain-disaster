/**
 * /play community blocks:
 *  - renderStatsStrip: up to three honest metrics next to the industry picker
 *    (campaigns played, quarterly scenarios completed, player rating), each
 *    omitted when unavailable, with a "How we count" explanation
 *  - ReviewsSection: published reviews (newest first, all of them, paged),
 *    average + count + distribution, report button, Rate & review entry point
 *
 * Every number comes from /api/community aggregates; nothing is estimated or
 * seeded. All review text is inserted with textContent.
 */

import './review-form.css';
import * as CM from '../logic/community.js';
import { t, tp, fmt } from '../i18n/pregame.js';
import { industryName } from './review-form.js';

const REASONS = ['spam', 'harassment', 'personal_information', 'irrelevant', 'manipulation', 'other'];

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const starsText = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const sinceText = (iso) => (iso ? fmt.date(Date.parse(`${iso}T12:00:00Z`)) : '');

/** Stats strip under the industry picker. Renders nothing at all if the API is unavailable. */
export async function renderStatsStrip(host, { industries }) {
    if (!host) return;
    const s = await CM.fetchStats();
    if (!host.isConnected) return;
    host.textContent = '';
    const items = [];
    if (s?.since && s.campaigns > 0) {
        items.push({ value: fmt.num(s.campaigns), label: tp('cm.campaigns', s.campaigns) });
        items.push({ value: fmt.num(s.scenarios), label: tp('cm.scenarios', s.scenarios) });
    } else {
        items.push({ value: String(industries), label: t('cm.industries') });   // honest fallback
    }
    if (s?.rating?.count) items.push({ value: `${s.rating.average.toFixed(1)} / 5`, label: tp('cm.rating', s.rating.count), href: '#pg-reviews' });
    else if (s) items.push({ value: t('cm.noRating'), label: t('cm.ratingLabel'), href: '#pg-reviews', small: true });

    const wrap = el('div', 'cm-strip');
    const dl = el('dl', 'cm-metrics');
    for (const it of items.slice(0, 3)) {
        const d = el('div', 'cm-metric');
        const dd = el('dd', `cm-value${it.small ? ' cm-value--cta' : ''}`);
        if (it.href) { const a = el('a', null, it.value); a.href = it.href; dd.appendChild(a); } else dd.textContent = it.value;
        const dt = el('dt', 'cm-label', it.label);
        d.append(dt, dd);   // dt before dd (valid dl); CSS shows the value first
        dl.appendChild(d);
    }
    wrap.appendChild(dl);
    if (s?.since && s.campaigns > 0) {
        const how = el('details', 'cm-how');
        how.appendChild(el('summary', null, t('cm.how.summary', { date: sinceText(s.since) })));
        const ul = el('ul');
        for (const k of ['campaigns', 'scenarios', 'rating', 'exclusions']) ul.appendChild(el('li', null, t(`cm.how.${k}`)));
        how.appendChild(ul);
        wrap.appendChild(how);
    }
    host.appendChild(wrap);
}

export class ReviewsSection {
    /** @param {HTMLElement} host  @param {{ dialog: import('./review-form.js').ReviewDialog }} o */
    constructor(host, o) {
        this.host = host;
        this.o = o;
        this.reviews = [];
        this.render();
        this.load(0);
    }

    render() {
        const h = this.host;
        h.textContent = '';
        const head = el('div', 'cm-reviews-head');
        const title = el('h2', 'pg-h2', t('cm.reviews.title'));
        title.id = 'pg-reviews-title';
        const write = el('button', 'pg-btn pg-btn--secondary', t('cm.reviews.write'));
        write.type = 'button';
        write.addEventListener('click', () => this.o.dialog.open({ source: 'play_reviews' }));
        head.append(title, write);
        h.appendChild(head);
        this.summary = el('div', 'cm-summary');
        this.summary.setAttribute('aria-live', 'polite');
        this.summary.appendChild(el('p', 'pg-muted', t('cm.reviews.loading')));
        this.list = el('ol', 'cm-list');
        this.more = el('button', 'pg-btn pg-btn--secondary cm-more', t('cm.reviews.more'));
        this.more.type = 'button';
        this.more.hidden = true;
        this.more.addEventListener('click', () => this.load(this.reviews.length));
        const policy = el('p', 'cm-policy', t('cm.reviews.policy'));
        h.append(this.summary, this.list, this.more, policy);
    }

    async load(offset) {
        const data = await CM.fetchReviews(offset);
        if (!this.host.isConnected) return;
        if (!data) { this.summary.textContent = ''; this.summary.appendChild(el('p', 'pg-muted', t('cm.reviews.unavailable'))); return; }
        if (offset === 0) { this.reviews = []; this.list.textContent = ''; this._summary(data.aggregate); }
        for (const r of data.reviews) { this.reviews.push(r); this.list.appendChild(this._item(r)); }
        this.more.hidden = this.reviews.length >= data.total;
    }

    reload() { this.load(0); }

    _summary(a) {
        const s = this.summary;
        s.textContent = '';
        if (!a?.count) {
            s.appendChild(el('p', 'cm-empty', t('cm.reviews.empty')));
            return;
        }
        const avg = el('div', 'cm-avg');
        avg.appendChild(el('p', 'cm-avg-num', `${a.average.toFixed(1)}`));
        const stars = el('p', 'cm-stars', starsText(Math.round(a.average)));
        stars.setAttribute('aria-hidden', 'true');
        avg.appendChild(stars);
        avg.appendChild(el('p', 'cm-avg-label', t('cm.reviews.avgLabel', { avg: a.average.toFixed(1), count: tp('cm.ratingsCount', a.count), written: tp('cm.writtenCount', a.written) })));
        const dist = el('table', 'cm-dist');
        dist.appendChild(el('caption', 'rvf-sr', t('cm.reviews.distCaption')));
        const body = el('tbody');
        for (const n of [5, 4, 3, 2, 1]) {
            const c = a.distribution[n] || 0;
            const tr = el('tr');
            tr.appendChild(el('th', null, t('cm.reviews.nStars', { n })));
            const bar = el('td', 'cm-bar');
            const fill = el('span', 'cm-bar-fill');
            fill.style.width = `${a.count ? Math.round((c / a.count) * 100) : 0}%`;
            bar.appendChild(fill);
            tr.appendChild(bar);
            tr.appendChild(el('td', 'cm-bar-n', fmt.num(c)));
            body.appendChild(tr);
        }
        dist.appendChild(body);
        s.append(avg, dist);
    }

    _item(r) {
        const li = el('li', 'cm-review');
        const head = el('div', 'cm-review-head');
        const stars = el('span', 'cm-stars', starsText(r.rating));
        stars.setAttribute('role', 'img');
        stars.setAttribute('aria-label', t('rv.rating.value', { n: r.rating, label: t(`rv.star.${r.rating}`) }));
        head.appendChild(stars);
        head.appendChild(el('span', 'cm-review-name', r.displayName || 'Anonymous'));
        head.appendChild(el('span', 'cm-review-date', fmt.date(r.date)));
        li.appendChild(head);
        const tags = [];
        if (r.industryId) tags.push(t('cm.reviews.played', { industry: industryName(r.industryId) }));
        else if (r.playedScenario) tags.push(t('cm.reviews.playedAny'));
        if (tags.length) li.appendChild(el('p', 'cm-review-tag', tags.join(' · ')));
        if (r.text) {
            const p = el('p', 'cm-review-text');
            p.textContent = r.text;          // plain text (CSS keeps line breaks)
            li.appendChild(p);
        }
        li.appendChild(this._reportControl(r));
        return li;
    }

    _reportControl(r) {
        const d = el('details', 'cm-report');
        d.appendChild(el('summary', null, t('cm.report.summary')));
        const form = el('form', 'cm-report-form');
        const label = el('label', 'svp-label', t('cm.report.label'));
        const sel = el('select', 'svp-input');
        sel.id = `cm-report-${r.id}`;
        label.htmlFor = sel.id;
        for (const k of REASONS) { const o = el('option', null, t(`rv.reason.${k}`)); o.value = k; sel.appendChild(o); }
        const btn = el('button', 'pg-btn pg-btn--secondary', t('cm.report.send'));
        btn.type = 'submit';
        const msg = el('p', 'cm-report-msg');
        msg.setAttribute('role', 'status');
        form.append(label, sel, btn, msg);
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            btn.disabled = true;
            const res = await CM.reportReview(r.id, sel.value);
            msg.textContent = res.ok ? t('cm.report.done') : t('cm.report.failed');
            if (!res.ok) btn.disabled = false;
        });
        d.appendChild(form);
        return d;
    }
}
