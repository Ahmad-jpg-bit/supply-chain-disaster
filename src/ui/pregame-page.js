/**
 * PregamePage — the /play landing: what the game is, industry selection with
 * a mission preview, resume, access (free vs paid) and FAQ.
 *
 * Boundary: this module only renders #start-screen. It never starts a game
 * itself — every start/resume goes through the onLaunch callback supplied by
 * Dashboard (same signature as the previous LandingPage), and paid options go
 * through the existing 'scd:open-paywall' event. Selecting or previewing an
 * industry has no side effects on saves, purchases or game state.
 *
 * Usage: new PregamePage(container, (industryId, chapterIndex, mode, statePatch) => …, { skipHero })
 */

import './pregame-page.css';
import { CHAPTERS } from '../data/chapters.js';
import { EXPANSION_CHAPTERS } from '../data/expansion-chapters.js';
import { CHAPTER_SCENARIOS } from '../data/scenarios-expanded.js';
import { CSCP_DEFINITIONS } from '../data/cscp-definitions.js';
import { STARTING_ARCHETYPES } from '../logic/crisis-engine.js';
import { RANKS } from '../logic/career.js';
import { Entitlements } from '../logic/entitlements.js';
import { FEATURE, FREE_INTRO, CORE_CATALOG } from '../data/packages.js';
import { getWeeklyChallenge } from '../logic/seeded-rng.js';
import { listIndustryProfiles, getIndustryProfile } from '../logic/industry-profiles.js';
import { describeSave, newerSave, resumeLaunchArgs, isValidEmail, SAVE_EMAIL_KEY, saveIsGrandfathered } from '../logic/pregame-state.js';
import { readLocalSave } from '../logic/save-game.js';
import { CORE_PRICE } from './paywall.js';
import { createFooter } from '../shared/footer.js';
import { setNavMinimal } from '../shared/nav.js';
import { track } from '../shared/track.js';
import { t, tp, fmt } from '../i18n/pregame.js';

const ALL_CHAPTERS = [...CHAPTERS, ...EXPANSION_CHAPTERS];
const TOTAL_TURNS = ALL_CHAPTERS.reduce((n, ch) => n + (ch.turnsRange[1] - ch.turnsRange[0] + 1), 0);

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const readEmail = () => { try { return localStorage.getItem(SAVE_EMAIL_KEY) || ''; } catch { return ''; } };

/** Decision-theme lines for an industry, with values from its engine profile. */
function themesFor(p) {
    const pct = fmt.pct;
    const b = p.budgetSupplier;
    const vars = {
        price: fmt.money(p.basePrice), cost: fmt.money(p.baseUnitCost), lead: p.baseLeadTurns,
        swing: pct(p.demand.swing),
        chance: pct(p.demand.spikeChance || 0), spikeLo: pct(p.demand.spikeMin || 0),
        spikeHi: pct((p.demand.spikeMin || 0) + (p.demand.spikeRange || 0)),
        saving: b ? pct(b.saving) : '', defects: b ? pct(b.defectRate) : '', weeks: b ? b.leadWeeks : '',
    };
    return ['t1', 't2', 't3'].map(k => t(`ind.${p.id}.${k}`, vars));
}

export class PregamePage {
    constructor(container, onLaunch, options = {}) {
        this.container  = container;
        this.onLaunch   = onLaunch;
        this.skipHero   = Boolean(options.skipHero);
        this.profiles   = listIndustryProfiles();
        this.selectedId = null;
        this.email      = readEmail();
        // Two possible saves: this browser (automatic) and the email backup.
        // The banner offers whichever was saved most recently.
        this.localSave  = describeSave(readLocalSave(), ALL_CHAPTERS, 'device');
        this.serverSave = null;
        this.save       = this.localSave;              // describeSave() result shown in the banner
        this.saveState  = this.localSave ? 'found' : 'none';   // none | checking | found | error
        this._render();
        this._offAccess = Entitlements.onChange(() => {
            if (!this.page?.isConnected) { this._offAccess?.(); return; }
            this._render();
            this._renderResume();
        });
        track('pregame_view', { entry: this.skipHero ? 'start_param' : 'direct', has_email: Boolean(this.email), has_local_save: Boolean(this.localSave?.resumable) }, 'page');
        if (this.localSave) this._afterSaveChange();
        if (this.email) this._checkSave(this.email);
    }

    /* ── Render ─────────────────────────────────────────────── */

    _render() {
        this.container.innerHTML = '';
        this.container.classList.remove('hidden');
        const page = document.createElement('div');
        page.className = 'pg-page';
        page.innerHTML = `
            ${this._heroHTML()}
            <div class="pg-resume" id="pg-resume" aria-live="polite"></div>
            <div class="pg-select">
                ${this._pickerHTML()}
                <section class="pg-preview" id="pg-preview" aria-labelledby="pg-preview-title" tabindex="-1"></section>
            </div>
            ${this._howHTML()}
            ${this._moreHTML()}
            ${this._accessHTML()}
            <div class="pg-two">
                ${this._faqHTML()}
                ${this._restoreHTML()}
            </div>
            ${this._confirmHTML()}
        `;
        this.container.appendChild(page);
        createFooter(this.container);
        setNavMinimal(true);
        this.page = page;
        this._bind();
        if (this.selectedId) {
            const input = page.querySelector(`input[name="pg-industry"][value="${this.selectedId}"]`);
            if (input) input.checked = true;
        }
        this._renderPreview();
        this._renderJump();

        if (this.skipHero && window.matchMedia('(max-width: 1023px)').matches) {
            page.querySelector('#pg-picker')?.scrollIntoView({ block: 'start' });
        }
    }

    _heroHTML() {
        return `
        <header class="pg-hero">
            <p class="pg-eyebrow">${t('hero.eyebrow')}</p>
            <h1 class="pg-title">${t('hero.title')}</h1>
            <p class="pg-sub">${t('hero.sub')}</p>
            <ul class="pg-facts">
                <li>${t('hero.facts.industries', { n: this.profiles.length })}</li>
                <li>${t('hero.facts.chapters', { n: ALL_CHAPTERS.length })}</li>
                <li>${t('hero.facts.turns', { n: TOTAL_TURNS })}</li>
                <li class="pg-facts-free">${t('hero.facts.free')}</li>
            </ul>
            <button type="button" class="pg-btn pg-btn--primary pg-choose" data-action="choose">${t('hero.choose')} ↓</button>
        </header>`;
    }

    _pickerHTML() {
        const easiest = this.profiles[0]?.id;
        const cards = this.profiles.map(p => `
            <label class="pg-card" data-industry="${p.id}">
                <input type="radio" name="pg-industry" value="${p.id}" class="pg-card-input"
                       aria-describedby="pg-card-${p.id}-desc">
                <span class="pg-card-head">
                    <span class="pg-card-name">${esc(p.name)}</span>
                    <span class="pg-card-check" aria-hidden="true">✓ ${t('picker.selected')}</span>
                </span>
                <span class="pg-card-tags">
                    ${this._accessTag(p)}
                    <span class="pg-tag">${t('picker.difficulty', { level: t(`difficulty.${p.difficulty}`) })}</span>
                    ${p.id === easiest ? `<span class="pg-tag pg-tag--rec" data-rec>${t('picker.recommended')}</span>` : ''}
                    <span class="pg-tag pg-tag--saved" data-saved hidden>${t('picker.saved')}</span>
                </span>
                <span class="pg-card-desc" id="pg-card-${p.id}-desc">${t(`ind.${p.id}.challenge`)}</span>
                <span class="pg-card-themes">${themesFor(p).map(x => `<span class="pg-theme">${x}</span>`).join('')}</span>
                <a class="pg-card-jump" href="#pg-preview" data-action="to-preview">${t('picker.toPreview')} ↓</a>
            </label>`).join('');
        return `
        <section class="pg-picker" id="pg-picker" aria-labelledby="pg-picker-title">
            <h2 class="pg-h2" id="pg-picker-title">${t('picker.title')}</h2>
            <p class="pg-muted">${t('picker.sub')}</p>
            <div class="pg-cards" role="radiogroup" aria-labelledby="pg-picker-title">${cards}</div>
            <p class="pg-visually-hidden" id="pg-select-status" aria-live="polite"></p>
        </section>`;
    }

    _previewHTML(p) {
        if (!p) {
            return `
                <h2 class="pg-h2" id="pg-preview-title">${t('preview.empty.title')}</h2>
                <p class="pg-muted">${t('preview.empty.body')}</p>`;
        }
        const rank = RANKS[0];
        const ch1 = CHAPTERS[0];
        const concepts = CHAPTERS.slice(0, 3).map(ch => CSCP_DEFINITIONS[ch.id]?.term || ch.title);
        const caseStudy = typeof ch1.realWorldExample === 'object' ? ch1.realWorldExample[p.id] : ch1.realWorldExample;
        const sample = CHAPTER_SCENARIOS[ch1.id]?.[0];
        const swing = p.demand.spikeChance
            ? `±${fmt.pct(p.demand.swing)} · ${fmt.pct(p.demand.spikeChance)} chance of +${fmt.pct(p.demand.spikeMin)}–${fmt.pct(p.demand.spikeMin + p.demand.spikeRange)}`
            : `±${fmt.pct(p.demand.swing)}`;
        const resumable = this.save?.resumable;
        const canStart = Entitlements.canPlay(p.id, 1);
        const startLabel = !canStart ? t('preview.unlock', { industry: p.name })
            : resumable ? t('preview.startNew', { industry: p.name }) : t('preview.start', { industry: p.name });
        const startNote = !canStart ? t('preview.startNoteLocked', { industry: p.name, price: CORE_PRICE })
            : Entitlements.ownsCore() ? t('preview.startNoteCore')
            : t('preview.startNoteFree', { price: CORE_PRICE });
        return `
            <p class="pg-eyebrow">${t('preview.eyebrow', { industry: esc(p.name) })}</p>
            <h2 class="pg-h2" id="pg-preview-title">${esc(p.name)}</h2>
            <div class="pg-preview-grid">
                <div class="pg-block">
                    <h3 class="pg-h3">${t('preview.role.h')}</h3>
                    <p>${t('preview.role.body', { rank: rank.title, remit: rank.remit })}</p>
                </div>
                <div class="pg-block">
                    <h3 class="pg-h3">${t('preview.opening.h')}</h3>
                    <p>${t('preview.opening.body', { title: ch1.title, desc: ch1.description })}</p>
                    <p class="pg-muted">${t('preview.opening.roll', { n: STARTING_ARCHETYPES.length })}</p>
                </div>
            </div>
            <div class="pg-block">
                <h3 class="pg-h3">${t('preview.stakes.h')}</h3>
                <dl class="pg-stats">
                    <div><dt>${t('preview.stakes.capital')}</dt><dd>${fmt.money(p.capital)}</dd><span>${t('preview.stakes.capitalNote')}</span></div>
                    <div><dt>${t('preview.stakes.lead')}</dt><dd>${tp('preview.stakes.leadVal', p.baseLeadTurns)}</dd></div>
                    <div><dt>${t('preview.stakes.swing')}</dt><dd>${swing}</dd></div>
                    <div><dt>${t('preview.stakes.holding')}</dt><dd>${t('preview.stakes.holdingVal', { rate: fmt.pct(p.holdingRate) })}</dd></div>
                    <div><dt>${t('preview.stakes.margin')}</dt><dd>${fmt.pct(p.margin)}</dd></div>
                </dl>
            </div>
            <div class="pg-block">
                <h3 class="pg-h3">${t('preview.decisions.h')}</h3>
                <p>${t('preview.decisions.body')}</p>
            </div>
            <div class="pg-block">
                <h3 class="pg-h3">${t('preview.practice.h')}</h3>
                <p>${t('preview.practice.body', { c1: concepts[0], c2: concepts[1], c3: concepts[2] })}</p>
            </div>
            ${caseStudy ? `
            <details class="pg-details" data-section="case_study">
                <summary>${t('preview.case.h')}</summary>
                <p>${esc(caseStudy)}</p>
            </details>` : ''}
            ${sample ? `
            <details class="pg-details" data-section="sample_briefing">
                <summary>${t('preview.sample.summary')}</summary>
                <p class="pg-muted">${t('preview.sample.note')}</p>
                <p class="pg-sample-title">${esc(sample.title)}</p>
                <p>${esc(sample.text)}</p>
                <ul class="pg-sample-options">${sample.options.map(o => `<li>${esc(o.label)}</li>`).join('')}</ul>
            </details>` : ''}
            <div class="pg-preview-action">
                <button type="button" class="pg-btn ${resumable || !canStart ? 'pg-btn--secondary' : 'pg-btn--primary'}" data-action="start">${startLabel}</button>
                <p class="pg-muted">${startNote}</p>
            </div>`;
    }

    _howHTML() {
        const step = (n, w, h) => `
            <li class="pg-step">
                <h3 class="pg-h3">${t(`how.s${n}.h`)}</h3>
                <p>${t(`how.s${n}.b`)}</p>
                <img src="/images/play/how-${n}.webp" width="${w}" height="${h}" loading="lazy" decoding="async" alt="${t(`how.img${n}`)}">
            </li>`;
        return `
        <section class="pg-section" aria-labelledby="pg-how-title">
            <h2 class="pg-h2" id="pg-how-title">${t('how.title')}</h2>
            <ol class="pg-steps">${step(1, 960, 600)}${step(2, 960, 600)}${step(3, 960, 600)}</ol>
            <div class="pg-learn">
                <h3 class="pg-h3">${t('learn.title')}</h3>
                <ul>${[1, 2, 3, 4, 5].map(i => `<li>${t(`learn.l${i}`)}</li>`).join('')}</ul>
                <p class="pg-muted">${t('learn.note')}</p>
            </div>
        </section>`;
    }

    _moreHTML() {
        const weekly = getWeeklyChallenge();
        const weeklyName = getIndustryProfile(weekly.industryId)?.name || weekly.industryId;
        return `
        <section class="pg-section" aria-labelledby="pg-more-title">
            <h2 class="pg-h2" id="pg-more-title">${t('more.title')}</h2>
            <div class="pg-more">
                <div class="pg-panel">
                    <h3 class="pg-h3">${t('more.endless.h')} ${this._coreTag(FEATURE.ENDLESS)}</h3>
                    <p>${t('more.endless.b')}</p>
                    <div class="pg-btn-row">
                        ${this.profiles.map(p => `<button type="button" class="pg-btn pg-btn--secondary" data-action="endless" data-industry="${p.id}">${t('more.endless.cta', { industry: esc(p.name) })}</button>`).join('')}
                    </div>
                </div>
                <div class="pg-panel">
                    <h3 class="pg-h3">${t('more.weekly.h')} ${this._coreTag(FEATURE.WEEKLY)}</h3>
                    <p>${t('more.weekly.b', { industry: esc(weeklyName) })}</p>
                    <div class="pg-btn-row">
                        <button type="button" class="pg-btn pg-btn--secondary" data-action="weekly">${t('more.weekly.cta')}</button>
                        <button type="button" class="pg-btn pg-btn--ghost" data-action="leaderboard">${t('more.weekly.board')}</button>
                    </div>
                </div>
                <div class="pg-panel" id="pg-jump">
                    <h3 class="pg-h3">${t('more.jump.h')} ${this._coreTag(FEATURE.CHAPTER_JUMP)}</h3>
                    <p>${t('more.jump.b')}</p>
                    <label class="pg-label" for="pg-jump-select">${t('more.jump.label')}</label>
                    <select id="pg-jump-select" class="pg-select-input">
                        ${CHAPTERS.map((ch, i) => `<option value="${i}">${this._jumpLocked(ch.number)
                            ? t('more.jump.optLocked', { n: ch.number, title: ch.title })
                            : t('more.jump.opt', { n: ch.number, title: ch.title })}</option>`).join('')}
                    </select>
                    <div class="pg-btn-row">
                        <button type="button" class="pg-btn pg-btn--secondary" data-action="jump" id="pg-jump-btn"></button>
                    </div>
                    <p class="pg-muted" id="pg-jump-note"></p>
                </div>
            </div>
        </section>`;
    }

    _accessHTML() {
        return `
        <section class="pg-section" aria-labelledby="pg-access-title">
            <h2 class="pg-h2" id="pg-access-title">${t('access.title')}</h2>
            <div class="pg-access">
                <div class="pg-panel">
                    <h3 class="pg-h3">${t('access.free.h')}</h3>
                    <ul class="pg-list">${[1, 2, 3, 4].map(i => `<li>${t(`access.free.l${i}`)}</li>`).join('')}</ul>
                </div>
                <div class="pg-panel">
                    <h3 class="pg-h3">${t('access.paid.h', { price: CORE_PRICE })}</h3>
                    <p class="pg-muted">${t('access.paid.period')}</p>
                    <ul class="pg-list">${[1, 2, 3, 4, 5].map(i => `<li>${t(`access.paid.l${i}`, { n: CORE_CATALOG.chapters.length })}</li>`).join('')}</ul>
                    ${Entitlements.ownsCore()
                        ? `<p class="pg-owned">✓ ${t('access.paid.owned')}</p>`
                        : `<button type="button" class="pg-btn pg-btn--secondary" data-action="paid">${t('access.paid.cta')}</button>`}
                    <p class="pg-muted">${t('access.paid.note')}</p>
                </div>
            </div>
        </section>`;
    }

    _faqHTML() {
        const items = ['free', 'prior', 'save', 'poor', 'paid', 'tax', 'restore', 'refund', 'lang'];
        return `
        <section class="pg-section" aria-labelledby="pg-faq-title">
            <h2 class="pg-h2" id="pg-faq-title">${t('faq.title')}</h2>
            ${items.map(k => `
            <details class="pg-details pg-faq">
                <summary>${t(`faq.${k}.q`)}</summary>
                <p>${t(`faq.${k}.a`, { price: CORE_PRICE })}</p>
            </details>`).join('')}
        </section>`;
    }

    _restoreHTML() {
        return `
        <section class="pg-section" aria-labelledby="pg-restore-title">
            <h2 class="pg-h2" id="pg-restore-title">${t('restore.title')}</h2>
            <p class="pg-muted">${t('restore.body')}</p>
            <form class="pg-restore" id="pg-restore-form" novalidate>
                <label class="pg-label" for="pg-restore-email">${t('restore.label')}</label>
                <div class="pg-restore-row">
                    <input type="email" id="pg-restore-email" class="pg-input" autocomplete="email" value="${esc(this.email)}" aria-describedby="pg-restore-status">
                    <button type="submit" class="pg-btn pg-btn--secondary">${t('restore.cta')}</button>
                </div>
                <p class="pg-restore-status" id="pg-restore-status" role="status"></p>
            </form>
        </section>`;
    }

    _confirmHTML() {
        return `
        <dialog class="pg-dialog" id="pg-confirm" aria-labelledby="pg-confirm-title">
            <h2 class="pg-h2" id="pg-confirm-title">${t('confirm.title')}</h2>
            <p id="pg-confirm-body"></p>
            <div class="pg-btn-row">
                <button type="button" class="pg-btn pg-btn--secondary" value="cancel" data-confirm="no">${t('confirm.no')}</button>
                <button type="button" class="pg-btn pg-btn--primary" data-confirm="yes">${t('confirm.yes')}</button>
            </div>
        </dialog>`;
    }

    /* ── Dynamic regions ────────────────────────────────────── */

    _renderPreview() {
        const el = this.page.querySelector('#pg-preview');
        const p = this.selectedId ? getIndustryProfile(this.selectedId) : null;
        el.innerHTML = this._previewHTML(p);
        el.classList.toggle('pg-preview--empty', !p);
        if (p) track('mission_preview_open', { industry_id: p.id, section: 'summary' }, `summary:${p.id}`);
        el.querySelectorAll('details[data-section]').forEach(d => d.addEventListener('toggle', () => {
            if (d.open) track('mission_preview_open', { industry_id: p.id, section: d.dataset.section }, `${d.dataset.section}:${p.id}`);
        }));
    }

    _renderResume() {
        const el = this.page.querySelector('#pg-resume');
        const s = this.save;
        this.page.querySelectorAll('[data-saved]').forEach(tag => { tag.hidden = !(s?.resumable && tag.closest('.pg-card').dataset.industry === s.industryId); });
        this.page.querySelectorAll('[data-rec]').forEach(tag => { tag.hidden = Boolean(s?.resumable); });
        // One dominant action: with a resumable save, Resume replaces the hero's "Choose your industry"
        const choose = this.page.querySelector('.pg-choose');
        if (choose) choose.hidden = Boolean(s?.resumable);
        if (this.saveState === 'checking') {
            el.innerHTML = `<p class="pg-muted pg-resume-checking">${t('resume.checking')}</p>`;
            return;
        }
        if (this.saveState === 'error') {
            el.innerHTML = `<p class="pg-muted">${t('resume.error')}</p>`;
            return;
        }
        if (!s) { el.innerHTML = ''; return; }
        const name = getIndustryProfile(s.industryId)?.name || s.industryId;
        const needsCore = s.resumable && !saveIsGrandfathered(s) && !Entitlements.canPlay(s.industryId, s.nextChapter?.number ?? s.nextChapterIndex + 1);
        if (!s.resumable) {
            el.innerHTML = `<p class="pg-resume-done">${t('resume.completed', { industry: esc(name) })}</p>`;
            return;
        }
        el.innerHTML = `
            <section class="pg-resume-card" aria-labelledby="pg-resume-title">
                <div>
                    <p class="pg-eyebrow">${t('resume.eyebrow')}</p>
                    <h2 class="pg-h2" id="pg-resume-title" tabindex="-1">${t(s.midChapter && s.quarter > 1 ? 'resume.titleMid' : 'resume.title', {
                        industry: esc(name), chapter: s.nextChapter?.number ?? s.nextChapterIndex + 1, chapterTitle: esc(s.nextChapter?.title ?? ''),
                        quarter: s.quarter, quarters: s.nextChapter ? s.nextChapter.turnsRange[1] - s.nextChapter.turnsRange[0] + 1 : 4,
                    })}</h2>
                    <p class="pg-muted">${t(s.source === 'device' ? 'resume.meta.device' : 'resume.meta.email', {
                        email: esc(this.email),
                        date: s.savedAt ? fmt.dateTime(s.savedAt) : '—',
                        cash: typeof s.cash === 'number' ? fmt.money(s.cash) : '—',
                        done: s.turnsPlayed, total: s.totalTurns,
                    })}</p>
                    ${needsCore ? `<p class="pg-muted">${t('resume.needsCore', { chapter: s.nextChapter?.number ?? s.nextChapterIndex + 1 })}</p>` : ''}
                </div>
                <div class="pg-resume-actions">
                    <button type="button" class="pg-btn pg-btn--primary" data-action="resume">${t(needsCore ? 'resume.ctaCore' : 'resume.cta', { industry: esc(name) })}</button>
                    <button type="button" class="pg-btn pg-btn--ghost" data-action="choose">${t('resume.new')}</button>
                </div>
            </section>`;
    }

    _renderJump() {
        const btn  = this.page.querySelector('#pg-jump-btn');
        const note = this.page.querySelector('#pg-jump-note');
        const sel  = this.page.querySelector('#pg-jump-select');
        const idx  = parseInt(sel.value, 10);
        const ch   = CHAPTERS[idx];
        const p    = this.selectedId ? getIndustryProfile(this.selectedId) : null;
        const locked = this._jumpLocked(ch.number);
        btn.disabled = !p && !locked;
        btn.textContent = locked
            ? t('more.jump.locked', { n: ch.number })
            : p ? t('more.jump.start', { industry: p.name, n: ch.number }) : t('more.jump.startNoIndustry', { n: ch.number });
        note.textContent = !p && !locked ? t('more.jump.needIndustry') : '';
    }

    /* ── Behaviour ──────────────────────────────────────────── */

    _bind() {
        const page = this.page;

        page.querySelectorAll('input[name="pg-industry"]').forEach(input => {
            input.addEventListener('change', () => { if (input.checked) this._select(input.value); });
        });

        page.addEventListener('click', (e) => {
            const el = e.target.closest('[data-action]');
            if (!el) return;
            const action = el.dataset.action;
            if (action === 'choose') { e.preventDefault(); this._focusPicker(); }
            else if (action === 'to-preview') {
                e.preventDefault();
                const pv = page.querySelector('#pg-preview');
                pv.scrollIntoView({ block: 'start', behavior: this._motion() });
                pv.focus({ preventScroll: true });
            }
            else if (action === 'start') this._start(this.selectedId, 0, 'story', 'preview');
            else if (action === 'resume') this._resume();
            else if (action === 'endless') this._start(el.dataset.industry, 0, 'endless', 'endless');
            else if (action === 'weekly') {
                if (!Entitlements.has(FEATURE.WEEKLY)) { this._openPaid('pregame_weekly'); return; }
                track('start_click', { industry_id: getWeeklyChallenge().industryId, mode: 'weekly', start_chapter: 0, has_save: Boolean(this.save?.resumable), source: 'weekly' });
                document.dispatchEvent(new CustomEvent('scd:start-weekly'));
            }
            else if (action === 'leaderboard') document.dispatchEvent(new CustomEvent('scd:show-leaderboard'));
            else if (action === 'paid') this._openPaid('pregame_access');
            else if (action === 'jump') {
                const idx = parseInt(page.querySelector('#pg-jump-select').value, 10);
                if (this._jumpLocked(CHAPTERS[idx].number)) this._openPaid('pregame_chapter_jump');
                else this._start(this.selectedId, idx, 'story', 'chapter_jump');
            }
        });

        page.querySelector('#pg-jump-select').addEventListener('change', () => this._renderJump());

        page.querySelector('#pg-restore-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this._lookup(page.querySelector('#pg-restore-email').value.trim());
        });

        const dlg = page.querySelector('#pg-confirm');
        dlg.addEventListener('click', (e) => {
            const b = e.target.closest('[data-confirm]');
            if (b) dlg.close(b.dataset.confirm);
            else if (e.target === dlg) dlg.close('no');
        });
    }

    _motion() {
        return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
    }

    _focusPicker() {
        const picker = this.page.querySelector('#pg-picker');
        picker.scrollIntoView({ block: 'start', behavior: this._motion() });
        const target = this.page.querySelector('input[name="pg-industry"]:checked') || this.page.querySelector('input[name="pg-industry"]');
        target?.focus({ preventScroll: true });
    }

    _select(id) {
        if (id === this.selectedId) return;
        this.selectedId = id;
        const p = getIndustryProfile(id);
        track('industry_select', { industry_id: id });
        this.page.querySelector('#pg-select-status').textContent = t('preview.status', { industry: p?.name || id });
        this._renderPreview();
        this._renderJump();
    }

    _start(industryId, chapterIndex, mode, source) {
        if (!industryId) { this._focusPicker(); return; }
        const allowed = mode === 'endless' ? Entitlements.has(FEATURE.ENDLESS) : Entitlements.canPlay(industryId, chapterIndex + 1);
        if (!allowed) { this._openPaid(`pregame_${source}`); return; }
        const hasSave = Boolean(this.localSave?.resumable || this.serverSave?.resumable);
        track('start_click', { industry_id: industryId, mode, start_chapter: chapterIndex + 1, has_save: hasSave, source });
        const go = () => { setNavMinimal(false); this.onLaunch(industryId, chapterIndex, mode); };
        // Only campaign games autosave over the email save; endless/weekly never do.
        if (hasSave && mode === 'story') this._confirmOverwrite(go);
        else go();
    }

    _confirmOverwrite(proceed) {
        const dlg = this.page.querySelector('#pg-confirm');
        const nameOf = (sv) => getIndustryProfile(sv.industryId)?.name || sv.industryId;
        const parts = [];
        if (this.localSave?.resumable) parts.push(t('confirm.bodyDevice', { industry: nameOf(this.localSave) }));
        if (this.serverSave?.resumable) parts.push(t('confirm.bodyEmail', { industry: nameOf(this.serverSave), email: this.email }));
        this.page.querySelector('#pg-confirm-body').textContent = parts.join(' ');
        dlg.addEventListener('close', () => { if (dlg.returnValue === 'yes') proceed(); }, { once: true });
        dlg.returnValue = '';
        dlg.showModal();
        dlg.querySelector('[data-confirm="no"]').focus();
    }

    _resume() {
        const s = this.save;
        if (!s?.resumable) return;
        track('resume_click', { industry_id: s.industryId, start_chapter: s.nextChapterIndex + 1 });
        setNavMinimal(false);
        this.onLaunch(...resumeLaunchArgs(s));
    }

    /** Picker tag: what this industry costs for THIS player. */
    _accessTag(p) {
        if (Entitlements.ownsCore()) return `<span class="pg-tag pg-tag--free">✓ ${t('picker.included')}</span>`;
        if (p.id === FREE_INTRO.industryId) return `<span class="pg-tag pg-tag--free">${t('picker.freeIntro')}</span>`;
        return `<span class="pg-tag pg-tag--core">${t('picker.core')}</span>`;
    }

    _coreTag(feature) {
        return Entitlements.has(feature) ? '' : `<span class="pg-tag pg-tag--core">${t('picker.core')}</span>`;
    }

    /** Starting directly at chapter n (n > 1) is a Core feature; so is any chapter of a locked campaign. */
    _jumpLocked(n) {
        if (n > 1 && !Entitlements.has(FEATURE.CHAPTER_JUMP)) return true;
        return Boolean(this.selectedId) && !Entitlements.canPlay(this.selectedId, n);
    }

    _openPaid(source) {
        document.dispatchEvent(new CustomEvent('scd:open-paywall', { detail: { source } }));
    }

    async _fetchSave(email) {
        const res = await fetch('/api/load-game', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email }),
        });
        if (!res.ok) throw new Error(`load-game ${res.status}`);
        return res.json();
    }

    /** Silent check for a returning player whose email is already stored on this device. */
    async _checkSave(email) {
        this.saveState = 'checking';
        this._renderResume();
        try {
            this.serverSave = describeSave(await this._fetchSave(email), ALL_CHAPTERS, 'email');
            this.save = newerSave(this.localSave, this.serverSave);
            this.saveState = this.save ? 'found' : 'none';
        } catch {
            // Email backup unreachable — a save on this device still works
            this.save = this.localSave;
            this.saveState = this.localSave ? 'found' : 'error';
        }
        this._afterSaveChange();
    }

    /** Explicit lookup from the "Resume on another device" form. */
    async _lookup(email) {
        const status = this.page.querySelector('#pg-restore-status');
        if (!isValidEmail(email)) { status.textContent = t('restore.invalid'); return; }
        status.textContent = t('restore.checking');
        try {
            const found = describeSave(await this._fetchSave(email), ALL_CHAPTERS, 'email');
            if (!found) { status.textContent = t('restore.notFound'); return; }
            // Only a found save links this device to the email (as before)
            try { localStorage.setItem(SAVE_EMAIL_KEY, email); } catch { /* storage blocked */ }
            this.email = email;
            this.serverSave = found;
            const save = newerSave(this.localSave, found);
            this.save = save;
            this.saveState = 'found';
            status.textContent = !found.resumable
                ? t('resume.completed', { industry: getIndustryProfile(found.industryId)?.name || found.industryId })
                : save === found ? t('restore.found') : t('restore.foundOlder');
            this._afterSaveChange();
            if (save.resumable) {
                const h = this.page.querySelector('#pg-resume-title');
                h?.scrollIntoView({ block: 'center', behavior: this._motion() });
                h?.focus({ preventScroll: true });
            }
        } catch {
            status.textContent = t('restore.error');
        }
    }

    _afterSaveChange() {
        this._renderResume();
        // Pre-select the saved industry so its briefing is ready — no side effects
        if (this.save?.resumable && !this.selectedId) {
            const input = this.page.querySelector(`input[name="pg-industry"][value="${this.save.industryId}"]`);
            if (input) { input.checked = true; this.selectedId = this.save.industryId; }
        }
        this._renderPreview();
        this._renderJump();
    }
}
