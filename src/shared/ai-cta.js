import './ai-cta.css';

/**
 * Shared "AI courses on Udemy" affiliate promo.
 *
 * One tracking link, rendered as a compact animated band that matches the
 * light SaaS UI. Used on the homepage and across blog posts.
 *
 * Placement:
 *   - Pages that want precise control put an empty slot where they want it:
 *       <div id="ai-cta-slot" data-ai-title="…" data-ai-desc="…" data-ai-eyebrow="…"></div>
 *     (data-* attributes override the copy so it can sit "under the context
 *     of the title" per page).
 *   - Otherwise it appends to the fallback container (e.g. .article-content).
 *   - Never renders twice on a page.
 */

const TRACKING_LINK = 'https://trk.udemy.com/c/7496155/3193860/39854';

const DEFAULTS = {
    eyebrow: 'The next-decade skill',
    title: 'AI is rewriting how this work gets done.',
    desc: 'From demand forecasting to logistics and operations, AI is the edge that compounds every other skill you build here. Get job-ready with the top-rated AI courses on Udemy.',
    cta: 'Explore AI Courses on Udemy',
};

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
));

export function aiCtaMarkup(opts = {}) {
    const o = { ...DEFAULTS, ...opts };
    return `
    <aside class="ai-cta" role="complementary" aria-label="AI courses on Udemy">
      <div class="ai-cta-inner">
        <div class="ai-cta-text">
          <p class="ai-cta-eyebrow"><span class="ai-cta-spark" aria-hidden="true"></span>${esc(o.eyebrow)}</p>
          <p class="ai-cta-title">${esc(o.title)}</p>
          <p class="ai-cta-desc">${esc(o.desc)}</p>
        </div>
        <div class="ai-cta-action">
          <a class="ai-cta-btn" href="${TRACKING_LINK}" target="_blank" rel="noopener sponsored">
            ${esc(o.cta)} <span class="ai-cta-arrow" aria-hidden="true">&rarr;</span>
          </a>
          <p class="ai-cta-note">Check today &mdash; Udemy courses are frequently discounted up to 80%.</p>
        </div>
      </div>
    </aside>`;
}

/**
 * @param {object}  cfg
 * @param {string} [cfg.slot]     selector for an explicit placement slot
 * @param {string} [cfg.fallback] selector to append into when no slot exists
 */
export function mountAiCta({ slot, fallback } = {}) {
    if (document.querySelector('.ai-cta')) return; // never duplicate

    const host = slot ? document.querySelector(slot) : null;
    if (host) {
        const opts = {};
        if (host.dataset.aiEyebrow) opts.eyebrow = host.dataset.aiEyebrow;
        if (host.dataset.aiTitle)   opts.title = host.dataset.aiTitle;
        if (host.dataset.aiDesc)    opts.desc = host.dataset.aiDesc;
        if (host.dataset.aiCta)     opts.cta = host.dataset.aiCta;
        host.innerHTML = aiCtaMarkup(opts);
        return;
    }

    const container = fallback ? document.querySelector(fallback) : null;
    if (container) container.insertAdjacentHTML('beforeend', aiCtaMarkup());
}
