/**
 * Save & progress UI shared by /play and the game:
 *  - SavePanel: save status (this device / cloud), Save now, cloud saves sign-in
 *    with an emailed code, sign out — always available, never blocks play
 *  - showCloudPrompt: the one-time, dismissible offer after the first turn
 *  - showConflict: choose between this device's and the cloud's version
 *  - showTabLock: this campaign continued in another tab
 *
 * Turning on cloud saves is not consent to marketing or reminder emails.
 */

import './save-panel.css';
import * as CS from '../logic/cloud-sync.js';
import * as RS from '../logic/run-store.js';
import { CHAPTERS } from '../data/chapters.js';
import { EXPANSION_CHAPTERS } from '../data/expansion-chapters.js';
import { track } from '../shared/track.js';

const ALL_CHAPTERS = [...CHAPTERS, ...EXPANSION_CHAPTERS];
const PROMPT_KEY = 'scd_cloud_prompt';
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmtTime = (ms) => (ms ? new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)) : '—');

const PHASE_LABEL = {
    PHASE_CHAPTER_INTRO: 'chapter intro',
    PHASE_STORY: 'briefing',
    PHASE_PROCUREMENT: 'decisions',
    PHASE_CHAPTER_SUMMARY: 'chapter results',
    PHASE_GAME_OVER: 'final results',
};

/** "Chapter 3, quarter 2 of 4 · decisions" from a run's stored progress. */
export function describeProgress(m) {
    if (!m) return '';
    if (m.status === 'completed') return 'Campaign complete';
    const ch = ALL_CHAPTERS[(m.chapterNumber || 1) - 1];
    if (m.format === 'v1-chapter-end' || !m.phase) return `Starts at Chapter ${(m.chapterNumber || 1) + 1}`;
    if (m.phase === 'PHASE_CHAPTER_SUMMARY') return `Chapter ${m.chapterNumber} complete · next: Chapter ${m.chapterNumber + 1}`;
    if (!ch) return `Chapter ${m.chapterNumber}`;
    const quarters = ch.turnsRange[1] - ch.turnsRange[0] + 1;
    const q = Math.min(quarters, Math.max(1, (m.turn || 1) - ch.turnsRange[0] + 1));
    return `Chapter ${m.chapterNumber}, quarter ${q} of ${quarters} · ${PHASE_LABEL[m.phase] || ''}`.replace(/ · $/, '');
}

/* ── Save & progress panel ────────────────────────────────────────────── */

export class SavePanel {
    /**
     * @param {Object} o
     * @param {() => (string|null)} o.currentRunId — the run being played (in-game) or null
     * @param {() => boolean} [o.onSaveNow] — save immediately; returns local success
     */
    constructor(o = {}) {
        this.o = o;
        this.step = 'idle';     // idle | code
        this.email = '';
        this.msg = '';
        CS.onChange(() => { if (this.el) this._render(); });
    }

    open({ focus = null, adoptRunId = null, source = 'panel' } = {}) {
        this.adoptRunId = adoptRunId;
        this.source = source;
        if (!this.el) {
            this.el = document.createElement('dialog');
            this.el.className = 'svp-dialog';
            this.el.setAttribute('aria-labelledby', 'svp-title');
            document.body.appendChild(this.el);
            this.el.addEventListener('close', () => { this.el.remove(); this.el = null; this.step = 'idle'; this.msg = ''; });
            this.el.addEventListener('click', (e) => { if (e.target === this.el) this.el.close(); });
        }
        this._render();
        if (!this.el.open) this.el.showModal();
        if (focus === 'email') this.el.querySelector('#svp-email')?.focus();
        track('save_panel_open', { source });
    }

    close() { this.el?.close(); }

    _render() {
        const s = CS.getSession();
        const runId = this.o.currentRunId?.();
        const meta = runId ? RS.getMeta(runId) : null;
        const st = CS.statusFor(meta);
        const signedIn = s.signedIn;
        const cloudLine = !meta ? '' : ({
            device: 'Not synced — this campaign is saved on this device only.',
            syncing: 'Syncing…',
            synced: `Synced ${fmtTime(meta.lastSyncedAt)}.`,
            pending: 'Waiting to sync — it will retry automatically.',
            signin: 'Sign in again to sync this campaign.',
            conflict: 'Changed on another device — choose which version to keep.',
            deleted: 'Deleted from the cloud on another device.',
            unavailable: 'Cloud saves are paused right now. This campaign syncs automatically when they’re back.',
        }[st.cloud] || '');
        const localLine = !meta ? '' : (meta.localError
            ? `Could not save on this device (storage is full or blocked). Keep this tab open${signedIn && meta.cloud ? ' — your last synced copy is in the cloud' : ', or turn on cloud saves'}.`
            : (meta.localRev > 0 ? `Saved ${fmtTime(meta.updatedAt)}.` : 'Not saved yet.'));

        this.el.innerHTML = `
            <div class="svp">
                <div class="svp-head">
                    <h2 class="svp-title" id="svp-title">Save &amp; progress</h2>
                    <button type="button" class="svp-x" data-svp="close" aria-label="Close">✕</button>
                </div>
                ${meta ? `
                <section class="svp-sec" aria-label="This campaign">
                    <p class="svp-run">${esc(describeProgress(meta))}</p>
                    <dl class="svp-status">
                        <div><dt>This device</dt><dd class="${meta.localError ? 'svp-bad' : ''}">${esc(localLine)}</dd></div>
                        <div><dt>Cloud</dt><dd>${esc(cloudLine)}</dd></div>
                    </dl>
                    <button type="button" class="svp-btn svp-btn--primary" data-svp="save">Save now</button>
                </section>` : ''}
                <section class="svp-sec" aria-labelledby="svp-cloud-h">
                    <h3 class="svp-h3" id="svp-cloud-h">Cloud saves</h3>
                    ${!s.available && s.known ? `<p>Cloud saves aren't available right now. Your progress is still saved on this device.</p>` : signedIn ? `
                        <p>Cloud saves are on for <strong>${esc(s.email)}</strong>. Campaigns you play while signed in sync automatically.</p>
                        ${meta && meta.owner === 'guest' ? `<button type="button" class="svp-btn" data-svp="adopt">Sync this campaign to my account</button>` : ''}
                        <div class="svp-row">
                            ${meta ? `<button type="button" class="svp-btn" data-svp="sync">Sync now</button>` : ''}
                            <button type="button" class="svp-btn svp-btn--ghost" data-svp="signout">Sign out</button>
                        </div>` : this.step === 'code' ? `
                        <form class="svp-form" data-svp-form="code" novalidate>
                            <label class="svp-label" for="svp-code">Enter the 6-digit code we sent to <strong>${esc(this.email)}</strong></label>
                            <div class="svp-row">
                                <input id="svp-code" class="svp-input" inputmode="numeric" autocomplete="one-time-code" maxlength="6" pattern="[0-9]{6}">
                                <button type="submit" class="svp-btn svp-btn--primary">Verify</button>
                            </div>
                            <div class="svp-row"><button type="button" class="svp-link" data-svp="resend">Send a new code</button><button type="button" class="svp-link" data-svp="back">Use a different email</button></div>
                        </form>` : `
                        <p>${s.hint?.email ? `Your sign-in for <strong>${esc(s.hint.email)}</strong> ended. ` : ''}Verify your email to continue your campaigns on another device. We'll email you a one-time code — no password.</p>
                        <form class="svp-form" data-svp-form="email" novalidate>
                            <label class="svp-label" for="svp-email">Email</label>
                            <div class="svp-row">
                                <input id="svp-email" class="svp-input" type="email" autocomplete="email" value="${esc(this.email)}">
                                <button type="submit" class="svp-btn svp-btn--primary">Send code</button>
                            </div>
                        </form>`}
                    <p class="svp-msg" role="status" aria-live="polite">${esc(this.msg)}</p>
                </section>
                <section class="svp-sec svp-fine">
                    <ul>
                        <li>Without cloud saves, campaigns are saved in this browser only. Clearing site data or using private browsing can remove them.</li>
                        <li>Cloud saves need a verified email. If your sign-in expires, saving on this device keeps working — sign in again to sync.</li>
                        <li>Cloud copies are kept for ${s.retentionDays === 365 ? '12 months' : `${s.retentionDays} days`} after a campaign's last sync, and you can delete them any time from the /play page.</li>
                        <li>Turning on cloud saves doesn't sign you up for any emails.</li>
                    </ul>
                </section>
            </div>`;
        this._bind();
    }

    _bind() {
        const el = this.el;
        el.querySelectorAll('[data-svp]').forEach(b => b.addEventListener('click', () => this._act(b.dataset.svp)));
        el.querySelector('[data-svp-form="email"]')?.addEventListener('submit', (e) => { e.preventDefault(); this._sendCode(el.querySelector('#svp-email').value.trim()); });
        el.querySelector('[data-svp-form="code"]')?.addEventListener('submit', (e) => { e.preventDefault(); this._verify(el.querySelector('#svp-code').value.trim()); });
        if (this.step === 'code') el.querySelector('#svp-code')?.focus();
    }

    async _act(a) {
        const runId = this.o.currentRunId?.();
        if (a === 'close') return this.close();
        if (a === 'save') {
            const ok = this.o.onSaveNow?.();
            this.msg = ok ? 'Saved.' : 'Could not save on this device.';
            if (ok && runId) CS.flush(runId);
            return this._render();
        }
        if (a === 'sync' && runId) { CS.flush(runId); this.msg = ''; return this._render(); }
        if (a === 'adopt' && runId) { CS.adoptRun(runId); this.msg = 'This campaign will now sync to your account.'; return this._render(); }
        if (a === 'back') { this.step = 'idle'; this.msg = ''; return this._render(); }
        if (a === 'resend') return this._sendCode(this.email);
        if (a === 'signout') {
            const pending = CS.unsyncedForSignOut();
            const warn = pending.length
                ? `${pending.length} campaign${pending.length > 1 ? 's have' : ' has'} changes that haven't synced yet. Signing out removes this account's campaigns from this browser, including those changes. Sign out anyway?`
                : 'Signing out removes this account\'s campaigns from this browser. They stay in your cloud saves. Sign out?';
            if (!window.confirm(warn)) return;
            await CS.signOut();
            this.msg = 'Signed out.';
            this.o.onSignedOut?.();
            return this._render();
        }
    }

    async _sendCode(email) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { this.msg = 'Enter a valid email address.'; return this._render(); }
        this.email = email;
        this.msg = 'Sending…'; this._render();
        const r = await CS.requestCode(email);
        if (r.ok) { this.step = 'code'; this.msg = 'Code sent. It expires in 10 minutes.'; }
        else this.msg = r.error === 'resend_too_soon' ? 'Please wait a few seconds before asking for another code.'
            : r.error === 'rate_limited' ? 'Too many codes requested. Try again in an hour.'
            : r.error === 'network' ? 'You seem to be offline. Your progress is still saved on this device.'
            : 'Couldn\'t send a code right now. Try again later.';
        this._render();
    }

    async _verify(code) {
        if (!/^\d{6}$/.test(code)) { this.msg = 'Enter the 6-digit code.'; return this._render(); }
        this.msg = 'Checking…'; this._render();
        const r = await CS.verifyCode(this.email, code, { adoptRunId: this.adoptRunId || this.o.currentRunId?.() || null, source: this.source });
        if (r.ok) { this.step = 'idle'; this.msg = 'Cloud saves are on.'; this.o.onSignedIn?.(); }
        else this.msg = r.error === 'too_many_attempts' ? 'Too many tries. Request a new code.' : r.error === 'network' ? 'You seem to be offline. Try again when you\'re connected.' : 'That code didn\'t work. Check it or request a new one.';
        this._render();
    }
}

/* ── One-time cloud prompt ────────────────────────────────────────────── */

export function cloudPromptDismissed() { try { return Boolean(localStorage.getItem(PROMPT_KEY)); } catch { return true; } }

/** Small, dismissible, non-blocking. Shown at most once per browser. */
export function showCloudPrompt({ onEnable }) {
    if (cloudPromptDismissed() || CS.getSession().signedIn || document.querySelector('.svp-toast')) return;
    try { localStorage.setItem(PROMPT_KEY, 'shown'); } catch { /* ignore */ }
    const el = document.createElement('div');
    el.className = 'svp-toast';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Cloud saves');
    el.innerHTML = `
        <p>Progress saved on this device. Verify your email to continue on another device.</p>
        <div class="svp-row">
            <button type="button" class="svp-btn svp-btn--primary" data-t="on">Enable cloud saves</button>
            <button type="button" class="svp-btn svp-btn--ghost" data-t="off">Not now</button>
        </div>`;
    document.body.appendChild(el);
    // Reserve room for the toast so it never covers the last control or the sticky Confirm bar
    const root = document.documentElement;
    root.style.setProperty('--svp-toast-space', `${el.offsetHeight + 24}px`);
    root.classList.add('svp-toast-open');
    track('cloud_save_prompt_shown', {});
    const done = () => { el.remove(); root.classList.remove('svp-toast-open'); root.style.removeProperty('--svp-toast-space'); };
    el.querySelector('[data-t="on"]').addEventListener('click', () => { done(); onEnable(); });
    el.querySelector('[data-t="off"]').addEventListener('click', () => { done(); try { localStorage.setItem(PROMPT_KEY, 'dismissed'); } catch { /* ignore */ } track('cloud_save_prompt_dismissed', {}); });
}

/* ── Conflict chooser ─────────────────────────────────────────────────── */

/**
 * @param {string} runId
 * @param {(choice: 'device'|'cloud') => void} onChosen
 */
export function showConflict(runId, onChosen) {
    const m = RS.getMeta(runId);
    const remote = RS.readConflictCopy(runId);
    if (!m || !remote) return;
    const dlg = document.createElement('dialog');
    dlg.className = 'svp-dialog';
    dlg.setAttribute('aria-labelledby', 'svp-cf-title');
    const cloudMeta = { ...m, ...RS.summarize(remote.snapshot) };
    dlg.innerHTML = `
        <div class="svp">
            <h2 class="svp-title" id="svp-cf-title">This campaign changed on another device</h2>
            <p>Both versions are kept. Choose which one to continue — the other stays in Your campaigns as a separate copy.</p>
            <div class="svp-versions">
                <div class="svp-version"><h3 class="svp-h3">This device</h3><p>${esc(describeProgress(m))}</p><p class="svp-meta">Chapters completed: ${m.chaptersCompleted} of ${m.totalChapters}<br>Saved ${fmtTime(m.updatedAt)}</p>
                    <button type="button" class="svp-btn svp-btn--primary" data-cf="device">Continue this device's version</button></div>
                <div class="svp-version"><h3 class="svp-h3">Cloud</h3><p>${esc(describeProgress(cloudMeta))}</p><p class="svp-meta">Chapters completed: ${cloudMeta.chaptersCompleted} of ${cloudMeta.totalChapters}<br>Synced ${fmtTime(remote.updatedAt)}</p>
                    <button type="button" class="svp-btn svp-btn--primary" data-cf="cloud">Continue the cloud version</button></div>
            </div>
            <button type="button" class="svp-btn svp-btn--ghost" data-cf="later">Decide later</button>
        </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('close', () => dlg.remove());
    dlg.querySelectorAll('[data-cf]').forEach(b => b.addEventListener('click', () => {
        const c = b.dataset.cf;
        dlg.close();
        if (c === 'later') return;
        const r = CS.resolveConflict(runId, c);
        if (r.ok) onChosen?.(c);
    }));
    dlg.showModal();
}

/* ── Another tab took over ────────────────────────────────────────────── */

export function showTabLock({ onTakeOver, onKeepCopy = null }) {
    if (document.querySelector('.svp-tablock')) return;
    const dlg = document.createElement('dialog');
    dlg.className = 'svp-dialog svp-tablock';
    dlg.setAttribute('aria-labelledby', 'svp-tl-title');
    dlg.innerHTML = `
        <div class="svp">
            <h2 class="svp-title" id="svp-tl-title">This campaign is open in another tab</h2>
            <p>To keep your progress from being overwritten, this tab stopped saving. Everything up to the last save is kept, and “Continue in this tab” picks up from there.</p>
            ${onKeepCopy ? `<p>This tab also has progress that isn’t in that save. You can keep it as a separate campaign.</p>` : ''}
            <div class="svp-row">
                <button type="button" class="svp-btn svp-btn--primary" data-tl="here">Continue in this tab</button>
                ${onKeepCopy ? `<button type="button" class="svp-btn" data-tl="copy">Keep this tab’s progress as a copy</button>` : ''}
                <a class="svp-btn svp-btn--ghost" href="/play">Back to the start page</a>
            </div>
            <p class="svp-msg" role="status" aria-live="polite"></p>
        </div>`;
    document.body.appendChild(dlg);
    dlg.addEventListener('cancel', (e) => e.preventDefault());
    dlg.querySelector('[data-tl="here"]').addEventListener('click', () => { dlg.close(); dlg.remove(); onTakeOver?.(); });
    dlg.querySelector('[data-tl="copy"]')?.addEventListener('click', (e) => {
        const ok = onKeepCopy();
        e.currentTarget.disabled = true;
        dlg.querySelector('.svp-msg').textContent = ok ? 'Kept. It’s listed in Your campaigns on the start page.' : 'Couldn’t save a copy on this device (storage is full or blocked).';
    });
    dlg.showModal();
}
