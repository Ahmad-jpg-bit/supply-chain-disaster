/**
 * /play "Continue" card + "Your campaigns" — every saved run on this device
 * (and, when signed in, the account's runs on other devices). Starting a new
 * campaign never replaces another; deleting always says what it affects.
 * Locked runs (need the Core Game Pass) stay visible with their progress.
 */

import * as RS from '../logic/run-store.js';
import * as CS from '../logic/cloud-sync.js';
import { Entitlements } from '../logic/entitlements.js';
import { getIndustryProfile } from '../logic/industry-profiles.js';
import { describeProgress, showConflict } from './save-panel.js';
import { t, fmt } from '../i18n/pregame.js';
import { track } from '../shared/track.js';

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const nameOf = (id) => getIndustryProfile(id)?.name || id;
const INTENT_KEY = 'scd_resume_intent';

/** The chapter a run continues into (where access is checked). */
export function nextChapterOf(m) {
    if (m.format === 'v1-chapter-end' || !m.phase || m.phase === 'PHASE_CHAPTER_SUMMARY') return (m.chapterNumber || 1) + 1;
    return m.chapterNumber || 1;
}
const needsCore = (m) => m.status !== 'completed' && !m.legacyGrant && !Entitlements.canPlay(m.industryId, Math.min(nextChapterOf(m), m.totalChapters || 10));

function syncLabel(m) {
    const st = CS.statusFor(m);
    if (!m.cloud) return t('runs.sync.device');
    return t(`runs.sync.${st.cloud}`, { time: m.lastSyncedAt ? fmt.dateTime(m.lastSyncedAt) : '—' });
}

export class CampaignsPanel {
    /**
     * @param {HTMLElement} el
     * @param {Object} cb { onContinue(runId), onNewFor(industryId), onOpenCloud(), onChange() }
     */
    constructor(el, cb) {
        this.el = el;
        this.cb = cb;
        this.remoteOnly = [];
        this.expanded = new Set();
        this.notice = '';
        this._remoteFor = null;   // account the remote list was fetched for
        CS.onChange(() => {
            if (!this.el.isConnected) return;
            const s = CS.getSession();
            // Signed in (on load or just now) or switched account → fetch that account's other-device runs
            if (s.signedIn && s.owner !== this._remoteFor) this.refreshRemote();
            else if (!s.signedIn && this._remoteFor) { this._remoteFor = null; this.remoteOnly = []; }
            this.render();
        });
        this.render();
        this.refreshRemote();
    }

    runs() { return RS.visibleRuns(CS.ownerTag()); }

    /** The run the Continue card offers: the run left for checkout, else the most recent in-progress run. */
    primary() {
        const active = this.runs().filter(m => m.status !== 'completed' && !m.cloudDeleted);
        let intent = null;
        try { intent = localStorage.getItem(INTENT_KEY); } catch { /* ignore */ }
        return active.find(m => m.runId === intent) || active[0] || null;
    }

    async refreshRemote() {
        const s = CS.getSession();
        if (!s.signedIn) { this.remoteOnly = []; return; }
        this._remoteFor = s.owner;
        const r = await CS.reconcile();
        this.remoteOnly = r.remoteOnly || [];
        this.render();
    }

    render() {
        const runs = this.runs();
        const first = this.primary();
        const others = runs.filter(m => m !== first && m.runId !== first?.runId);
        const session = CS.getSession();
        const legacy = session.signedIn ? session.legacy : null;
        this.el.innerHTML = `
            ${this.notice ? `<p class="pg-runs-notice" role="status">${esc(this.notice)}</p>` : ''}
            ${first ? this._continueHTML(first) : ''}
            ${legacy ? this._legacyHTML(legacy) : ''}
            ${others.length || this.remoteOnly.length ? `
            <section class="pg-runs" aria-labelledby="pg-runs-title">
                <h2 class="pg-h3" id="pg-runs-title">${t('runs.title')}</h2>
                <ul class="pg-runs-list">
                    ${others.map(m => this._rowHTML(m)).join('')}
                    ${this.remoteOnly.map(c => this._remoteHTML(c)).join('')}
                </ul>
            </section>` : ''}`;
        this._bind();
        this.cb.onChange?.();
    }

    _stateNote(m) {
        if (m.conflict) return `<p class="pg-run-warn">${t('runs.conflict')}</p>`;
        if (m.cloudDeleted) return `<p class="pg-run-warn">${t('runs.deletedElsewhere')}</p>`;
        if (m.localError) return `<p class="pg-run-warn">${t('runs.localFailed')}</p>`;
        if (needsCore(m)) return `<p class="pg-muted">${t('runs.needsCore', { chapter: nextChapterOf(m) })}</p>`;
        if (m.copyOf) return `<p class="pg-muted">${t(m.copyLabel === 'cloud' ? 'runs.copyCloud' : m.copyLabel === 'tab' ? 'runs.copyTab' : 'runs.copyDevice')}</p>`;
        if (m.untrustedImport) return `<p class="pg-muted">${t('runs.imported')}</p>`;
        return '';
    }

    _actionsHTML(m, primary = false) {
        if (m.conflict) return `<button type="button" class="pg-btn pg-btn--primary" data-run="resolve" data-id="${m.runId}">${t('runs.choose')}</button>`;
        if (m.cloudDeleted) return `
            ${CS.getSession().signedIn ? `<button type="button" class="pg-btn pg-btn--secondary" data-run="recovercloud" data-id="${m.runId}">${t('runs.recoverCloud')}</button>` : ''}
            <button type="button" class="pg-btn pg-btn--secondary" data-run="keeplocal" data-id="${m.runId}">${t('runs.keepLocal')}</button>
            <button type="button" class="pg-btn pg-btn--ghost" data-run="delete" data-id="${m.runId}">${t('runs.delete')}</button>`;
        if (m.status === 'completed') return `
            <button type="button" class="pg-btn pg-btn--secondary" data-run="details" data-id="${m.runId}" aria-expanded="${this.expanded.has(m.runId)}">${t('runs.view')}</button>
            <button type="button" class="pg-btn pg-btn--secondary" data-run="again" data-industry="${m.industryId}">${t('runs.playAgain')}</button>
            <button type="button" class="pg-btn pg-btn--ghost" data-run="delete" data-id="${m.runId}">${t('runs.delete')}</button>`;
        const label = needsCore(m) ? t('runs.unlockContinue') : t('runs.continue', { industry: esc(nameOf(m.industryId)) });
        return `
            <button type="button" class="pg-btn ${primary ? 'pg-btn--primary' : 'pg-btn--secondary'}" data-run="continue" data-id="${m.runId}">${label}</button>
            <button type="button" class="pg-btn pg-btn--ghost" data-run="details" data-id="${m.runId}" aria-expanded="${this.expanded.has(m.runId)}">${t('runs.details')}</button>
            <button type="button" class="pg-btn pg-btn--ghost" data-run="delete" data-id="${m.runId}">${t('runs.delete')}</button>`;
    }

    _detailsHTML(m) {
        if (!this.expanded.has(m.runId)) return '';
        return `
            <dl class="pg-run-details">
                <div><dt>${t('runs.d.chapters')}</dt><dd>${m.chaptersCompleted} / ${m.totalChapters}</dd></div>
                <div><dt>${t('runs.d.mastered')}</dt><dd>${m.conceptsMastered ?? 0} / ${m.chaptersCompleted}</dd></div>
                <div><dt>${t('runs.d.cash')}</dt><dd>${typeof m.cash === 'number' ? fmt.money(m.cash) : '—'}</dd></div>
                <div><dt>${t('runs.d.started')}</dt><dd>${m.createdAt ? fmt.date(m.createdAt) : '—'}</dd></div>
                <div><dt>${t('runs.d.saved')}</dt><dd>${esc(syncLabel(m))}</dd></div>
            </dl>`;
    }

    _continueHTML(m) {
        return `
            <section class="pg-resume-card" aria-labelledby="pg-resume-title">
                <div>
                    <p class="pg-eyebrow">${t('runs.continueEyebrow')}</p>
                    <h2 class="pg-h2" id="pg-resume-title" tabindex="-1">${esc(nameOf(m.industryId))} — ${esc(describeProgress(m))}</h2>
                    <p class="pg-muted">${t('runs.meta', { done: m.chaptersCompleted, total: m.totalChapters, when: fmt.dateTime(m.updatedAt) })} · ${esc(syncLabel(m))}</p>
                    ${this._stateNote(m)}
                    ${this._detailsHTML(m)}
                </div>
                <div class="pg-resume-actions">${this._actionsHTML(m, true)}</div>
            </section>`;
    }

    _rowHTML(m) {
        return `
            <li class="pg-run">
                <div class="pg-run-main">
                    <p class="pg-run-title">${esc(nameOf(m.industryId))} <span class="pg-muted">· ${esc(describeProgress(m))}</span></p>
                    <p class="pg-muted pg-run-sub">${t('runs.meta', { done: m.chaptersCompleted, total: m.totalChapters, when: fmt.dateTime(m.updatedAt) })} · ${esc(syncLabel(m))}</p>
                    ${this._stateNote(m)}
                    ${this._detailsHTML(m)}
                </div>
                <div class="pg-run-actions">${this._actionsHTML(m)}</div>
            </li>`;
    }

    _remoteHTML(c) {
        const m = { ...c.meta, runId: c.runId };
        return `
            <li class="pg-run">
                <div class="pg-run-main">
                    <p class="pg-run-title">${esc(nameOf(m.industryId))} <span class="pg-muted">· ${esc(describeProgress(m))}</span></p>
                    <p class="pg-muted pg-run-sub">${t('runs.remote', { when: fmt.dateTime(c.updatedAt) })}</p>
                </div>
                <div class="pg-run-actions">
                    <button type="button" class="pg-btn pg-btn--secondary" data-run="download" data-id="${c.runId}">${t('runs.download')}</button>
                    <button type="button" class="pg-btn pg-btn--ghost" data-run="deleteremote" data-id="${c.runId}" data-rev="${c.rev}">${t('runs.delete')}</button>
                </div>
            </li>`;
    }

    _legacyHTML(l) {
        const ch = Number.isInteger(l.chapterIndex) ? l.chapterIndex + 1 : null;
        return `
            <section class="pg-resume-card" aria-labelledby="pg-legacy-title">
                <div>
                    <p class="pg-eyebrow">${t('runs.legacy.eyebrow')}</p>
                    <h2 class="pg-h3" id="pg-legacy-title">${esc(nameOf(l.industryId))}${ch ? ` — ${t('runs.legacy.chapter', { chapter: ch })}` : ''}</h2>
                    <p class="pg-muted">${t('runs.legacy.body', { when: l.savedAt ? fmt.date(l.savedAt) : '—' })}</p>
                </div>
                <div class="pg-resume-actions">
                    <button type="button" class="pg-btn pg-btn--secondary" data-run="importlegacy">${t('runs.legacy.import')}</button>
                    <button type="button" class="pg-btn pg-btn--ghost" data-run="dismisslegacy">${t('runs.legacy.dismiss')}</button>
                </div>
            </section>`;
    }

    _bind() {
        this.el.querySelectorAll('[data-run]').forEach(b => b.addEventListener('click', () => this._act(b.dataset.run, b.dataset)));
    }

    async _act(action, d) {
        const id = d.id;
        if (action === 'continue') {
            try { localStorage.removeItem(INTENT_KEY); } catch { /* ignore */ }
            return this.cb.onContinue(id);
        }
        if (action === 'details') { this.expanded.has(id) ? this.expanded.delete(id) : this.expanded.add(id); return this.render(); }
        if (action === 'again') return this.cb.onNewFor(d.industry);
        if (action === 'resolve') return showConflict(id, () => this.render());
        if (action === 'keeplocal' || action === 'recovercloud') {
            const r = CS.recoverDeleted(id, { toCloud: action === 'recovercloud' });
            this.notice = t(r.ok ? 'runs.recovered' : 'runs.recoverFailed');
            return this.render();
        }
        if (action === 'delete') return this._confirmDelete(id);
        if (action === 'download') {
            const c = this.remoteOnly.find(x => x.runId === id);
            const r = await CS.downloadRemote(c);
            this.remoteOnly = this.remoteOnly.filter(x => x.runId !== id);
            this.notice = r.ok ? '' : t('runs.downloadFailed');
            this.render();
            if (r.ok) this.cb.onContinue(id);
            return;
        }
        if (action === 'deleteremote') return this._confirmDelete(id, { remoteRev: Number(d.rev) });
        if (action === 'importlegacy') {
            const r = await CS.importLegacy();
            this.notice = r.ok ? t('runs.legacy.done') : t('runs.legacy.failed');
            track('legacy_backup_imported', { ok: Boolean(r.ok) });
            return this.render();
        }
        if (action === 'dismisslegacy') { await CS.dismissLegacy(); return this.render(); }
    }

    /** Deletion always says whether it affects this device, the cloud, or both. */
    _confirmDelete(runId, { remoteRev = null } = {}) {
        const m = RS.getMeta(runId);
        const inCloud = remoteRev !== null || Boolean(m?.cloud && m.cloudRev > 0 && !m.cloudDeleted && CS.getSession().signedIn);
        const local = Boolean(m);
        const dlg = document.createElement('dialog');
        dlg.className = 'pg-dialog';
        dlg.setAttribute('aria-labelledby', 'pg-del-title');
        dlg.innerHTML = `
            <h2 class="pg-h2" id="pg-del-title">${t('runs.del.title')}</h2>
            <p>${t(local && inCloud ? 'runs.del.both' : inCloud ? 'runs.del.cloud' : 'runs.del.device')}</p>
            ${local && inCloud ? `<p class="pg-muted">${t('runs.del.deviceOnlyNote')}</p>` : ''}
            <div class="pg-btn-row">
                <button type="button" class="pg-btn pg-btn--secondary" data-d="cancel">${t('runs.del.cancel')}</button>
                ${local && inCloud ? `<button type="button" class="pg-btn pg-btn--secondary" data-d="device">${t('runs.del.deviceOnly')}</button>` : ''}
                <button type="button" class="pg-btn pg-btn--danger" data-d="${inCloud ? 'everywhere' : 'device'}">${t(inCloud ? (local ? 'runs.del.everywhere' : 'runs.del.cloudBtn') : 'runs.del.deviceBtn')}</button>
            </div>
            <p class="pg-muted" role="status" data-d-msg></p>`;
        document.body.appendChild(dlg);
        dlg.addEventListener('close', () => dlg.remove());
        dlg.querySelectorAll('[data-d]').forEach(b => b.addEventListener('click', async () => {
            const what = b.dataset.d;
            if (what === 'cancel') return dlg.close();
            if (what === 'device') { RS.deleteLocalRun(runId); track('run_deleted', { scope: 'device' }); dlg.close(); return this.render(); }
            const r = remoteRev !== null && !local ? await CS.deleteRemote(runId, remoteRev) : await CS.deleteEverywhere(runId);
            if (!r.ok) { dlg.querySelector('[data-d-msg]').textContent = t(r.error === 'changed_elsewhere' ? 'runs.del.changed' : 'runs.del.failed'); return; }
            track('run_deleted', { scope: local ? 'everywhere' : 'cloud' });
            this.remoteOnly = this.remoteOnly.filter(x => x.runId !== runId);
            dlg.close();
            this.render();
        }));
        dlg.showModal();
        dlg.querySelector('[data-d="cancel"]').focus();
    }
}
