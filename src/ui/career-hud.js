/**
 * Career HUD — the rank chip in the header and the promotion/demotion notice.
 */

import { RANKS } from '../logic/career.js';

/** Render / update the rank chip inside a host element (idempotent). */
export function renderRankChip(host, rankIndex) {
    if (!host) return;
    const rank = RANKS[rankIndex] || RANKS[0];
    let el = host.querySelector('.rank-chip');
    if (!el) {
        el = document.createElement('div');
        el.className = 'rank-chip';
        el.title = 'Your title — climbs as the campaign advances';
        host.prepend(el);
    }
    el.innerHTML = `<span class="rank-chip-icon">${rank.icon}</span><span class="rank-chip-title">${rank.title}</span>`;
}

/** Full-screen promotion / demotion notice. */
export function showCareerNotice(review, onDone) {
    if (!review) { onDone?.(); return; }

    const overlay = document.createElement('div');
    overlay.className = `career-overlay career-overlay--${review.direction}`;
    overlay.innerHTML = `
        <div class="career-card glass-panel">
            <div class="career-eyebrow">${review.direction === 'promotion' ? '▲ PERFORMANCE REVIEW — PROMOTION' : '▼ PERFORMANCE REVIEW'}</div>
            <div class="career-icon">${review.icon}</div>
            <h2 class="career-title">${review.title}</h2>
            <p class="career-text">${review.text}</p>
            <button class="btn-primary career-btn">Continue &rarr;</button>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('career-overlay--visible'));

    const done = () => {
        overlay.classList.remove('career-overlay--visible');
        setTimeout(() => overlay.remove(), 300);
        onDone?.();
    };
    overlay.querySelector('.career-btn').addEventListener('click', done);
}
