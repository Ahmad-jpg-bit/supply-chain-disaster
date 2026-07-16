/**
 * Weekly leaderboard UI — the board overlay and the score-submit prompt.
 */

import { getIcon } from '../graphics/svg-icons.js';

const INDUSTRY_LABEL = { electronics: 'Electronics', fmcg: 'Consumer Goods', pharma: 'Pharmaceuticals' };
const NAME_KEY = 'scd_leaderboard_name';

async function fetchBoard(weekId) {
    try {
        const r = await fetch(`/api/leaderboard?weekId=${encodeURIComponent(weekId)}`);
        if (!r.ok) return { entries: [] };
        return await r.json();
    } catch { return { entries: [] }; }
}

function boardRowsHtml(entries, highlight) {
    if (!entries.length) {
        return `<div class="lb-empty">No scores yet this week. Be the first to post one.</div>`;
    }
    const medal = (r) => r === 1 ? '🥇' : r === 2 ? '🥈' : r === 3 ? '🥉' : `<span class="lb-rank-num">${r}</span>`;
    return entries.map(e => {
        const isMe = highlight && e.name === highlight.name && e.score === highlight.score;
        return `
        <div class="lb-row${isMe ? ' lb-row--me' : ''}">
            <span class="lb-rank">${medal(e.rank)}</span>
            <span class="lb-name">${e.name}</span>
            <span class="lb-score">${e.score.toLocaleString()}</span>
        </div>`;
    }).join('');
}

/**
 * Show the leaderboard overlay for a week.
 * @param {Object} opts { weekId, industryId, highlight?: {name, score}, canPlay?: boolean }
 */
export async function showLeaderboard({ weekId, industryId, highlight = null, canPlay = true }) {
    const overlay = document.createElement('div');
    overlay.className = 'lb-overlay';
    overlay.innerHTML = `
        <div class="lb-card glass-panel">
            <div class="lb-eyebrow">${getIcon('trophy', 13)} WEEKLY CHALLENGE — ${weekId}</div>
            <h3 class="lb-title">Global Leaderboard</h3>
            <p class="lb-sub">This week's arena: <strong>${INDUSTRY_LABEL[industryId] || 'Endless'}</strong> · everyone faces the same crises.</p>
            <div class="lb-board" id="lb-board"><div class="lb-loading">Loading scores…</div></div>
            <div class="lb-actions">
                ${canPlay ? `<button class="btn-primary lb-play-btn">Play This Week's Challenge &rarr;</button>` : ''}
                <button class="lb-close-btn">Close</button>
            </div>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('lb-overlay--visible'));

    const close = () => {
        overlay.classList.remove('lb-overlay--visible');
        setTimeout(() => overlay.remove(), 250);
    };
    overlay.querySelector('.lb-close-btn').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    overlay.querySelector('.lb-play-btn')?.addEventListener('click', () => {
        close();
        document.dispatchEvent(new CustomEvent('scd:start-weekly'));
    });

    const { entries } = await fetchBoard(weekId);
    const boardEl = overlay.querySelector('#lb-board');
    if (boardEl) boardEl.innerHTML = boardRowsHtml(entries, highlight);
}

/**
 * Prompt the player to submit their weekly score, then show the board.
 * @param {Object} opts { weekId, score, industryId }
 */
export function promptScoreSubmit({ weekId, score, industryId }) {
    const savedName = (() => { try { return localStorage.getItem(NAME_KEY) || ''; } catch { return ''; } })();

    const overlay = document.createElement('div');
    overlay.className = 'lb-overlay';
    overlay.innerHTML = `
        <div class="lb-card glass-panel">
            <div class="lb-eyebrow">${getIcon('trophy', 13)} POST YOUR SCORE — ${weekId}</div>
            <h3 class="lb-title">${score.toLocaleString()} points</h3>
            <p class="lb-sub">Put your name on this week's board.</p>
            <div class="lb-submit-row">
                <input type="text" class="lb-name-input" id="lb-name" maxlength="20"
                       placeholder="Your name" value="${savedName.replace(/"/g, '&quot;')}" autocomplete="off"/>
                <button class="btn-primary lb-submit-btn">Submit</button>
            </div>
            <div class="lb-submit-msg" id="lb-submit-msg"></div>
            <button class="lb-close-btn lb-skip-btn">Skip</button>
        </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('lb-overlay--visible'));

    const close = () => {
        overlay.classList.remove('lb-overlay--visible');
        setTimeout(() => overlay.remove(), 250);
    };
    overlay.querySelector('.lb-skip-btn').addEventListener('click', close);

    const submit = async () => {
        const btn = overlay.querySelector('.lb-submit-btn');
        const msg = overlay.querySelector('#lb-submit-msg');
        const name = overlay.querySelector('#lb-name').value.trim() || 'Anonymous';
        try { localStorage.setItem(NAME_KEY, name); } catch { /* noop */ }

        btn.disabled = true; btn.textContent = 'Submitting…';
        try {
            const r = await fetch('/api/leaderboard', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ weekId, name, score, industryId }),
            });
            const json = await r.json();
            if (json.ok) {
                msg.innerHTML = `<span class="lb-msg-good">Posted — you're ranked #${json.rank} this week.</span>`;
                setTimeout(() => { close(); showLeaderboard({ weekId, industryId, highlight: { name, score } }); }, 900);
            } else {
                msg.innerHTML = `<span class="lb-msg-bad">${json.skipped === 'kv-not-configured' ? 'Leaderboard is offline right now.' : 'Could not submit — try again.'}</span>`;
                btn.disabled = false; btn.textContent = 'Submit';
            }
        } catch {
            msg.innerHTML = `<span class="lb-msg-bad">Network error — try again.</span>`;
            btn.disabled = false; btn.textContent = 'Submit';
        }
    };

    overlay.querySelector('.lb-submit-btn').addEventListener('click', submit);
    overlay.querySelector('#lb-name').addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
}
