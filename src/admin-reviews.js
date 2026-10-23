/**
 * /admin-reviews — moderation queue for ratings and reviews (owner only; the
 * server checks REVIEW_ADMIN_EMAILS against the verified cloud-save session).
 * Review text is rendered with textContent only.
 */

import * as CS from './logic/cloud-sync.js';
import * as CM from './logic/community.js';
import { SavePanel } from './ui/save-panel.js';

const REASONS = ['spam', 'harassment', 'personal_information', 'irrelevant', 'manipulation', 'other'];
const FILTERS = ['pending', 'reported', 'published', 'hidden', 'rejected', 'all'];
const app = document.getElementById('app');
const panel = new SavePanel({});
let filter = 'pending';

const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
const btn = (label, cls, fn) => { const b = el('button', `btn ${cls || ''}`, label); b.type = 'button'; b.addEventListener('click', fn); return b; };
const when = (ms) => new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms));

async function load() {
    app.textContent = '';
    const s = CS.getSession();
    if (!s.known) { app.append(el('p', 'muted', 'Checking sign-in…')); return; }
    if (!s.signedIn) {
        app.append(el('p', null, 'Sign in with your admin email (one-time code).'), btn('Sign in', 'btn--primary', () => panel.open({ focus: 'email', source: 'admin' })));
        return;
    }
    const r = await CM.admin.queue(filter);
    app.textContent = '';
    if (r.status === 403) { app.append(el('p', 'warn', 'This account is not a review admin.')); return; }
    if (r.status !== 200) { app.append(el('p', 'warn', `Couldn't load the queue (${r.body.error || r.status}).`)); return; }

    const bar = el('div', 'row');
    const sel = el('select');
    sel.setAttribute('aria-label', 'Show');
    for (const f of FILTERS) { const o = el('option', null, f); o.value = f; o.selected = f === filter; sel.append(o); }
    sel.addEventListener('change', () => { filter = sel.value; load(); });
    const a = r.body.aggregate;
    bar.append(sel, el('span', 'muted', `Published: ${a.count} ratings, average ${a.average ?? '—'}, ${a.written} written`),
        btn('Recount play statistics', '', async () => {
            const x = await CM.admin.reconcile();
            alert(x.status === 200 ? `Campaigns ${x.body.before.campaigns} → ${x.body.after.campaigns}, scenarios ${x.body.before.scenarios} → ${x.body.after.scenarios}` : `Failed: ${x.body.error}`);
        }));
    app.append(bar);

    const list = el('ol');
    if (!r.body.reviews.length) list.append(el('li', 'muted', 'Nothing here.'));
    for (const rv of r.body.reviews) list.append(item(rv));
    app.append(list);
}

function item(rv) {
    const li = el('li', 'card');
    const head = el('div', 'row');
    head.append(el('span', 'stars', '★'.repeat(rv.rating) + '☆'.repeat(5 - rv.rating)), el('strong', null, rv.displayName),
        el('span', 'tag', `${rv.status}${rv.reasonCode ? ` (${rv.reasonCode})` : ''} · updated ${when(rv.updatedAt)}${rv.industryId ? ` · ${rv.industryId}` : ''}`));
    if (rv.reports) head.append(el('span', 'warn', `${rv.reports} report${rv.reports === 1 ? '' : 's'}`));
    li.append(head);
    li.append(rv.text ? el('p', 'text', rv.text) : el('p', 'muted', '(rating only)'));

    const actions = el('div', 'row');
    const reason = el('select');
    reason.setAttribute('aria-label', 'Reason');
    for (const k of REASONS) { const o = el('option', null, k); o.value = k; reason.append(o); }
    const note = el('input');
    note.placeholder = 'Internal note (optional)';
    note.maxLength = 300;
    note.setAttribute('aria-label', 'Internal note');
    const act = (decision) => async () => {
        const res = await CM.admin.moderate(rv.id, decision, decision === 'publish' ? null : reason.value, note.value);
        if (res.status !== 200) { alert(`Failed: ${res.body.error}`); return; }
        load();
    };
    if (rv.status !== 'published') actions.append(btn('Publish', 'btn--primary', act('publish')));
    actions.append(reason, note, btn('Reject', '', act('reject')), btn('Hide', '', act('hide')));
    li.append(actions);

    const log = el('details');
    log.append(el('summary', 'tag', 'History'));
    const ul = el('ul', 'log');
    for (const l of rv.log || []) ul.append(el('li', null, `${when(l.at)} · ${l.by} · ${l.action}${l.reason ? ` (${l.reason})` : ''}${l.note ? ` — ${l.note}` : ''}`));
    log.append(ul);
    li.append(log);
    return li;
}

CS.onChange(() => load());
CS.start();
load();
