/**
 * Build-time blog templating (Node only — never shipped to the browser).
 *
 * Article sources (*.html with .article-header + .article-content) stay as
 * authored. At build time each article gets the shared template components:
 * breadcrumbs (+ BreadcrumbList JSON-LD), a standard meta line (author,
 * published, updated only when the article's own dateModified is later,
 * reading time), an "On this page" list for long articles, scrollable table
 * regions, one standard game/tool module, share + "Suggest a correction",
 * and "Related reading". The blog index gets generated cards, a search/topic
 * filter and real paginated pages (/blog-page-N).
 *
 * Every fact comes from the article itself (its h1, meta description, tag,
 * JSON-LD dates/author, text) or from the package catalog (offer-copy.js).
 * Missing structure throws BlogStructureError — the build fails rather than
 * publishing a half-transformed page. The transform refuses input that
 * already contains generated components, so nothing can be duplicated.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'node-html-parser';
import { OFFER, industryName } from '../../src/data/offer-copy.js';

export const SITE = 'https://www.supplychaindisaster.com';
export const WORDS_PER_MINUTE = 230;
export const PAGE_SIZE = 12;
export const TOC_MIN_SECTIONS = 4;
export const TOC_MIN_MINUTES = 6;
/** Classes the transform generates — a source containing any of them is refused. */
export const GENERATED = ['ab-crumbs', 'ab-toc', 'ab-layout', 'ab-module', 'ab-related', 'ab-endmatter', 'ab-skip', 'ab-table'];
const CTA_SELECTOR = '.mission-briefing, .article-cta';
const PARSE = { comment: true };

export class BlogStructureError extends Error {
    constructor(file, what) { super(`[blog] ${file}: ${what}`); this.name = 'BlogStructureError'; }
}

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const squash = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
export const fmtDate = (iso) => new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(new Date(`${iso}T00:00:00Z`));

export function slugify(text) {
    return squash(text).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
        .replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 64).replace(/-+$/, '') || 'section';
}

/** Words a reader reads: the article body without CTA blocks, scripts or styles. */
export function countWords(contentEl) {
    const clone = parse(contentEl.outerHTML, PARSE);
    clone.querySelectorAll(`${CTA_SELECTOR}, script, style, .${GENERATED.join(', .')}`).forEach(e => e.remove());
    return clone.text.split(/\s+/).filter(w => /[\p{L}\p{N}]/u.test(w)).length;
}
export const readingMinutes = (words) => Math.max(1, Math.round(words / WORDS_PER_MINUTE));

function jsonLd(root) {
    return root.querySelectorAll('script[type="application/ld+json"]').map(s => {
        try { return { el: s, data: JSON.parse(s.text) }; } catch { return { el: s, data: null }; }
    });
}

/* ── Catalog ─────────────────────────────────────────────────────────── */

export const isArticleSource = (html) => html.includes('src/blog.js') && /class="article-header"/.test(html);

/** Facts about one article, read from its own markup. Throws when anything required is missing. */
export function readArticle(html, file) {
    const slug = file.replace(/\.html$/, '');
    const root = parse(html, PARSE);
    const need = (v, what) => { if (!v) throw new BlogStructureError(file, `missing ${what}`); return v; };
    const header = need(root.querySelector('.article-header'), '.article-header');
    const content = need(root.querySelector('.article-content'), '.article-content');
    const h1s = root.querySelectorAll('h1');
    if (h1s.length !== 1 || !header.querySelector('h1')) throw new BlogStructureError(file, `needs exactly one <h1>, inside .article-header (found ${h1s.length})`);
    need(header.querySelector('.article-meta'), '.article-meta');
    const canonical = need(root.querySelector('link[rel="canonical"]')?.getAttribute('href'), 'canonical link');
    if (canonical !== `${SITE}/${slug}`) throw new BlogStructureError(file, `canonical ${canonical} ≠ ${SITE}/${slug}`);
    const posting = need(jsonLd(root).find(j => j.data?.['@type'] === 'BlogPosting')?.data, 'BlogPosting JSON-LD');
    const published = need(/^\d{4}-\d{2}-\d{2}$/.test(posting.datePublished || '') && posting.datePublished, 'BlogPosting.datePublished (YYYY-MM-DD)');
    const modified = /^\d{4}-\d{2}-\d{2}$/.test(posting.dateModified || '') ? posting.dateModified : null;
    const author = need(squash(posting.author?.name || root.querySelector('meta[name="author"]')?.getAttribute('content')), 'author');
    const words = countWords(content);
    return {
        slug, file, url: `/${slug}`, canonical,
        title: squash(header.querySelector('h1').text),
        description: need(squash(root.querySelector('meta[name="description"]')?.getAttribute('content')), 'meta description'),
        topic: need(squash(header.querySelector('.article-tag')?.text), '.article-tag (topic)'),
        published, updated: modified && modified > published ? modified : null,
        author, words, minutes: readingMinutes(words),
    };
}

/** Every article in `dir`, newest first (ties: title). */
export function buildCatalog(dir) {
    const posts = [];
    for (const file of readdirSync(dir).filter(f => f.endsWith('.html')).sort()) {
        const html = readFileSync(join(dir, file), 'utf8');
        if (isArticleSource(html)) posts.push(readArticle(html, file));
    }
    posts.sort((a, b) => b.published.localeCompare(a.published) || a.title.localeCompare(b.title));
    const topics = [...new Set(posts.map(p => p.topic))].sort((a, b) => a.localeCompare(b));
    return { posts, topics, bySlug: Object.fromEntries(posts.map(p => [p.slug, p])) };
}

/** Cache keyed by the html files' mtimes (dev server); a build calls buildCatalog once. */
export function catalogCache(dir) {
    let key = '', value = null;
    return () => {
        const k = readdirSync(dir).filter(f => f.endsWith('.html')).map(f => `${f}:${statSync(join(dir, f)).mtimeMs}`).join('|');
        if (k !== key) { value = buildCatalog(dir); key = k; }
        return value;
    };
}

/* ── Shared fragments ────────────────────────────────────────────────── */

const TOOLS = [
    { test: /bullwhip/i, href: '/bullwhip-effect-calculator', label: 'Bullwhip effect calculator' },
    { test: /lead[- ]time|safety stock|reorder|\bJIT\b|just[- ]in[- ]time|inventory/i, href: '/lead-time-calculator', label: 'Lead time calculator' },
];
/** A contextual industry only when the article is explicitly about it; otherwise the free campaign. */
function industryFor(text) {
    if (/pharma/i.test(text)) return 'pharma';
    if (/consumer electronics|semiconductor/i.test(text)) return 'electronics';
    return OFFER.freeIndustryId;
}
/** Sentences in an old CTA paragraph that make offer/duration claims are dropped; the offer lines state the facts. */
const CLAIM = /\bfree\b|\bno account\b|\b\d+(?:\.\d+)?\s*(?:hours?|minutes?)\b|\b\d+\s+turns\b|\bchapters?\s*1\s*[–-]\s*3\b/i;
export function dropClaimSentences(text) {
    return squash(text).split(/(?<=[.!?])\s+(?=[A-Z"“‘(])/).filter(s => s && !CLAIM.test(s)).join(' ');
}

function offerItems(industryId, tool) {
    return [
        `<li><strong>Free:</strong> ${esc(OFFER.free)}</li>`,
        `<li><strong>${esc(OFFER.coreName)}:</strong> ${esc(OFFER.core.replace(/^The Core Game Pass /, ''))}</li>`,
        tool ? `<li><strong>Free tool:</strong> <a href="${tool.href}">${esc(tool.label)}</a> — runs in your browser, no account or purchase.</li>` : '',
    ].join('');
}

function moduleHTML({ heading, paragraph, industryId, tool }) {
    const free = industryId === OFFER.freeIndustryId;
    return `<aside class="ab-module" aria-labelledby="ab-module-h">`
        + `<p class="ab-module-kicker">Practise it in the simulation</p>`
        + `<h2 class="ab-module-h" id="ab-module-h">${esc(heading)}</h2>`
        + (paragraph ? `<p class="ab-module-p">${esc(paragraph)}</p>` : '')
        + `<ul class="ab-module-offer">${offerItems(industryId, tool)}</ul>`
        + `<p class="ab-module-actions"><a class="ab-module-btn" href="${OFFER.playUrl(industryId)}">${free ? 'Play the free scenario' : `See the ${esc(industryName(industryId))} mission`}</a>`
        + `<a class="ab-module-link" href="${OFFER.pricingUrl}">Compare free and paid</a></p>`
        + `</aside>`;
}

/* ── Article ─────────────────────────────────────────────────────────── */

function crumbsHTML(post) {
    return `<nav class="ab-crumbs" aria-label="Breadcrumb"><ol>`
        + `<li><a href="/">Home</a></li><li><a href="/blog">Blog</a></li>`
        + `<li><a href="${post.url}" aria-current="page">${esc(post.title)}</a></li></ol></nav>`;
}
function breadcrumbLd(post) {
    const items = [['Home', `${SITE}/`], ['Blog', `${SITE}/blog`], [post.title, post.canonical]]
        .map(([name, item], i) => ({ '@type': 'ListItem', position: i + 1, name, item }));
    return `<script type="application/ld+json">${JSON.stringify({ '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: items })}</script>`;
}
function metaHTML(post) {
    const parts = [`<span>By ${esc(post.author)}</span>`, `<span>Published <time datetime="${post.published}">${fmtDate(post.published)}</time></span>`];
    if (post.updated) parts.push(`<span>Updated <time datetime="${post.updated}">${fmtDate(post.updated)}</time></span>`);
    parts.push(`<span>${post.minutes} min read</span>`);
    return `<p class="article-meta">${parts.join('<span class="article-meta-sep" aria-hidden="true">·</span>')}</p>`;
}
function tocHTML(entries) {
    return `<nav class="ab-toc" aria-labelledby="ab-toc-h"><details open><summary id="ab-toc-h">On this page</summary><ol>`
        + entries.map(e => `<li><a href="#${esc(e.id)}">${esc(e.text)}</a></li>`).join('') + `</ol></details></nav>`;
}
function endmatterHTML(post) {
    const u = encodeURIComponent(post.canonical), t = encodeURIComponent(post.title);
    return `<div class="ab-endmatter">`
        + `<div class="ab-share" role="group" aria-labelledby="ab-share-h"><p class="ab-share-h" id="ab-share-h">Share this article</p>`
        + `<button type="button" class="ab-btn" data-ab-share hidden>Share…</button>`
        + `<button type="button" class="ab-btn" data-ab-copy data-url="${esc(post.canonical)}">Copy link</button>`
        + `<a class="ab-btn" href="https://www.linkedin.com/sharing/share-offsite/?url=${u}" target="_blank" rel="noopener noreferrer">LinkedIn</a>`
        + `<a class="ab-btn" href="https://x.com/intent/post?url=${u}&amp;text=${t}" target="_blank" rel="noopener noreferrer">X</a>`
        + `<a class="ab-btn" href="mailto:?subject=${t}&amp;body=${u}">Email</a>`
        + `<p class="ab-share-status" role="status" aria-live="polite"></p></div>`
        + `<p class="ab-correction">Spotted an error or an outdated fact? <a href="/contact?subject=${encodeURIComponent(`Correction: ${post.title}`)}">Suggest a correction</a> — corrections are reviewed by the author.</p>`
        + `</div>`;
}
export function relatedFor(post, catalog, n = 3) {
    const others = catalog.posts.filter(p => p.slug !== post.slug);
    const same = others.filter(p => p.topic === post.topic).slice(0, n);
    const fill = others.filter(p => !same.includes(p)).slice(0, n - same.length);
    const rule = !same.length ? 'The newest articles.' : fill.length ? `More in ${post.topic}, then the newest articles.` : `More in ${post.topic}, newest first.`;
    return { items: [...same, ...fill], rule };
}
function cardHTML(p, { headingLevel = 3, newest = false } = {}) {
    const h = `h${headingLevel}`;
    return `<article class="ab-card${newest ? ' ab-card--newest' : ''}">`
        + (newest ? `<p class="ab-card-flag">Newest article</p>` : '')
        + `<p class="ab-card-topic">${esc(p.topic)}</p>`
        + `<${h} class="ab-card-title"><a href="${p.url}">${esc(p.title)}</a></${h}>`
        + `<p class="ab-card-excerpt">${esc(p.description)}</p>`
        + `<p class="ab-card-meta"><time datetime="${p.published}">${fmtDate(p.published)}</time> · ${p.minutes} min read</p>`
        + `</article>`;
}
function relatedHTML(post, catalog) {
    const { items, rule } = relatedFor(post, catalog);
    return `<section class="ab-related" aria-labelledby="ab-related-h"><h2 id="ab-related-h">Related reading</h2>`
        + `<p class="ab-related-rule">${esc(rule)}</p><div class="ab-related-grid">${items.map(p => cardHTML(p)).join('')}</div></section>`;
}

/** Remove a hand-written "Table of Contents" heading + its list of in-page links (replaced by the generated one). */
function removeHandwrittenToc(content) {
    let removed = 0;
    for (const el of content.querySelectorAll('h2, h3, p')) {
        if (!/^table of contents$/i.test(squash(el.text))) continue;
        const list = el.nextElementSibling;
        const links = list?.querySelectorAll('a') || [];
        if (!list || !['UL', 'OL'].includes(list.tagName) || !links.length || links.some(a => !(a.getAttribute('href') || '').startsWith('#'))) continue;
        el.remove(); list.remove(); removed++;
    }
    return removed;
}

/**
 * @returns {{ html: string, report: object }} transformed page + what changed (for verification)
 */
export function transformArticle(html, file, catalog) {
    const post = catalog.bySlug[file.replace(/\.html$/, '')];
    if (!post) throw new BlogStructureError(file, 'not in the catalog');
    const root = parse(html, PARSE);
    const dup = GENERATED.find(c => root.querySelector(`.${c}`));
    if (dup) throw new BlogStructureError(file, `source already contains generated .${dup}`);
    if (jsonLd(root).some(j => j.data?.['@type'] === 'BreadcrumbList')) throw new BlogStructureError(file, 'source already has BreadcrumbList JSON-LD');
    const head = root.querySelector('head'), body = root.querySelector('body');
    const header = root.querySelector('.article-header');
    const content = root.querySelector('.article-content');
    if (!head || !body || !header || !content) throw new BlogStructureError(file, 'missing head/body/header/content');
    const report = { file, handwrittenTocRemoved: 0, ctasReplaced: 0, ctasRemoved: 0, idsAdded: [], tables: 0, toc: 0, minutes: post.minutes, cta: null };

    // Head: breadcrumb structured data mirroring the visible breadcrumbs
    head.insertAdjacentHTML('beforeend', `\n  ${breadcrumbLd(post)}\n`);

    // Header: breadcrumbs (replace "Back to Blog"), topic link, standard meta line
    const back = header.querySelector('.article-back-link');
    if (back) back.replaceWith(crumbsHTML(post)); else header.insertAdjacentHTML('afterbegin', crumbsHTML(post));
    header.querySelector('.article-tag').replaceWith(`<a class="article-tag" href="/blog?topic=${encodeURIComponent(post.topic)}">${esc(post.topic)}</a>`);
    header.querySelector('.article-meta').replaceWith(metaHTML(post));

    // Content
    if (!content.getAttribute('id')) content.setAttribute('id', 'article-body');
    content.setAttribute('tabindex', '-1');
    report.handwrittenTocRemoved = removeHandwrittenToc(content);

    // One standard game/tool module, built from the last existing CTA's own heading/context
    const ctas = content.querySelectorAll(CTA_SELECTOR).filter(e => !e.parentNode?.closest?.(CTA_SELECTOR));
    if (ctas.length) {
        const src = ctas.at(-1);
        const strongHeading = src.querySelectorAll('p').find(p => p.querySelector('strong') && squash(p.text) === squash(p.querySelector('strong').text));
        const heading = squash(src.querySelector('h2, h3')?.text || strongHeading?.text);
        if (!heading) throw new BlogStructureError(file, 'CTA block has no heading to keep');
        const para = src.querySelectorAll('p').find(p => p !== strongHeading && !/mission-(briefing-label|note|briefing-note)/.test(p.getAttribute('class') || '') && squash(p.text).length > 40);
        const paragraph = para ? dropClaimSentences(para.text) : '';
        const ctx = `${post.title} ${post.topic} ${post.description}`;
        const tool = TOOLS.find(t => t.test.test(ctx)) || null;
        const industryId = industryFor(post.title);
        report.cta = { heading, paragraph, original: squash(para?.text || ''), industryId, tool: tool?.href || null };
        for (const extra of ctas.slice(0, -1)) { extra.remove(); report.ctasRemoved++; }
        src.replaceWith(moduleHTML({ heading, paragraph, industryId, tool }));
        report.ctasReplaced = 1;
    }

    // Stable section IDs (existing IDs untouched), contents list for long articles
    const used = new Set(root.querySelectorAll('[id]').map(e => e.getAttribute('id')));
    const entries = [];
    for (const h of content.querySelectorAll('h2')) {
        if (h.closest('.ab-module')) continue;
        let id = h.getAttribute('id');
        if (!id) {
            const base = slugify(h.text); id = base;
            for (let i = 2; used.has(id); i++) id = `${base}-${i}`;
            used.add(id); h.setAttribute('id', id); report.idsAdded.push(id);
        }
        entries.push({ id, text: squash(h.text) });
    }
    const showToc = entries.length >= TOC_MIN_SECTIONS && post.minutes >= TOC_MIN_MINUTES;
    report.toc = showToc ? entries.length : 0;

    // Tables: labelled, keyboard-scrollable regions
    content.querySelectorAll('table').forEach((t, i) => {
        const cap = squash(t.querySelector('caption')?.text) || squash(t.querySelector('th')?.text);
        t.replaceWith(`<div class="ab-table" role="region" tabindex="0" aria-label="${esc(`Table ${i + 1}${cap ? `: ${cap}` : ''}`)} (scrolls sideways)">${t.outerHTML}</div>`);
        report.tables++;
    });
    // Images: explicit dimensions required; lazy loading added
    for (const img of content.querySelectorAll('img')) {
        if (!img.getAttribute('width') || !img.getAttribute('height')) throw new BlogStructureError(file, `image without width/height: ${img.getAttribute('src')}`);
        if (!img.getAttribute('loading')) img.setAttribute('loading', 'lazy');
        if (!img.getAttribute('decoding')) img.setAttribute('decoding', 'async');
    }

    content.insertAdjacentHTML('beforeend', endmatterHTML(post));
    content.replaceWith(`<div class="ab-layout${showToc ? ' ab-layout--toc' : ''}">${showToc ? tocHTML(entries) : ''}${content.outerHTML}</div>`);
    root.querySelector('.ab-layout').insertAdjacentHTML('afterend', relatedHTML(post, catalog));

    // Skip link and page scope
    body.insertAdjacentHTML('afterbegin', `<a class="ab-skip" href="#${esc(root.querySelector('.article-content').getAttribute('id'))}">Skip to article</a>`);
    body.classList.add('ab-article');
    return { html: root.toString(), report };
}

/* ── Blog index ──────────────────────────────────────────────────────── */

export const pageCount = (catalog) => Math.max(1, Math.ceil(catalog.posts.length / PAGE_SIZE));
// Flat file names (blog-page-N.html): a blog/ directory next to blog.html would make /blog ambiguous for static hosting
export const pageUrl = (n) => (n <= 1 ? '/blog' : `/blog-page-${n}`);
export const pageFile = (n) => `blog-page-${n}.html`;

function paginationHTML(page, pages) {
    if (pages <= 1) return '';
    const link = (n, label, rel) => `<a href="${pageUrl(n)}"${rel ? ` rel="${rel}"` : ''}>${label}</a>`;
    const nums = Array.from({ length: pages }, (_, i) => i + 1).map(n => n === page
        ? `<li><a href="${pageUrl(n)}" aria-current="page">${n}</a></li>` : `<li>${link(n, String(n))}</li>`).join('');
    return `<nav class="ab-pages" aria-label="Article pages"><ul>`
        + (page > 1 ? `<li>${link(page - 1, '← Newer', 'prev')}</li>` : '') + nums
        + (page < pages ? `<li>${link(page + 1, 'Older →', 'next')}</li>` : '') + `</ul></nav>`;
}

export function indexRegionHTML(catalog, page) {
    const pages = pageCount(catalog);
    const slice = catalog.posts.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
    const options = catalog.topics.map(t => `<option value="${esc(t)}">${esc(t)} (${catalog.posts.filter(p => p.topic === t).length})</option>`).join('');
    const items = catalog.posts.map(p => ({ title: p.title, url: p.url, topic: p.topic, description: p.description, published: p.published, date: fmtDate(p.published), minutes: p.minutes }));
    const tools = TOOLS.map(t => `<li><a href="${t.href}">${esc(t.label)}</a></li>`).join('');
    return `<form class="ab-filter" role="search" action="/blog" method="get" aria-label="Find articles">`
        + `<div class="ab-filter-field"><label for="ab-q">Search articles</label><input id="ab-q" name="q" type="search" autocomplete="off" maxlength="100"></div>`
        + `<div class="ab-filter-field"><label for="ab-topic">Topic</label><select id="ab-topic" name="topic"><option value="">All topics (${catalog.posts.length})</option>${options}</select></div>`
        + `<button type="submit" class="ab-btn ab-btn--solid">Show articles</button></form>`
        + `<p class="ab-status" id="ab-status" role="status" aria-live="polite"></p>`
        + `<div class="ab-results" id="ab-results" hidden></div>`
        + `<div class="ab-listing" id="ab-listing">`
        + `<p class="ab-listing-note">All articles, newest first — page ${page} of ${pages}</p>`
        + `<div class="ab-grid">${slice.map((p, i) => cardHTML(p, { headingLevel: 2, newest: page === 1 && i === 0 })).join('')}</div>`
        + paginationHTML(page, pages) + `</div>`
        + `<aside class="ab-module ab-module--index" aria-labelledby="ab-module-h"><p class="ab-module-kicker">Practise it in the simulation</p>`
        + `<h2 class="ab-module-h" id="ab-module-h">Try the decisions these articles describe</h2>`
        + `<ul class="ab-module-offer">${offerItems(OFFER.freeIndustryId, null)}<li><strong>Free tools:</strong> <ul class="ab-module-tools">${tools}</ul></li></ul>`
        + `<p class="ab-module-actions"><a class="ab-module-btn" href="${OFFER.playUrl()}">Play the free scenario</a><a class="ab-module-link" href="${OFFER.pricingUrl}">Compare free and paid</a></p></aside>`
        + `<script type="application/json" id="ab-catalog">${JSON.stringify(items).replace(/</g, '\\u003c')}</script>`;
}

function setMeta(root, selector, attr, value) {
    const el = root.querySelector(selector);
    if (el) el.setAttribute(attr, value);
}

/**
 * Fill #ab-index for `page`. On page 1 the source must have an empty #ab-index;
 * `rebuild: true` re-renders an already filled page (used to emit pages 2..N
 * from the built page 1, which carries Vite's asset tags).
 */
export function transformIndex(html, catalog, page = 1, { rebuild = false } = {}) {
    const pages = pageCount(catalog);
    if (!Number.isInteger(page) || page < 1 || page > pages) throw new BlogStructureError('blog.html', `page ${page} out of range 1..${pages}`);
    const root = parse(html, PARSE);
    const region = root.querySelector('#ab-index');
    if (!region) throw new BlogStructureError('blog.html', 'missing #ab-index');
    if (!rebuild && region.innerHTML.trim()) throw new BlogStructureError('blog.html', '#ab-index must be empty in the source');
    region.set_content(indexRegionHTML(catalog, page));

    const head = root.querySelector('head');
    const url = `${SITE}${pageUrl(page)}`;
    setMeta(root, 'link[rel="canonical"]', 'href', url);
    setMeta(root, 'meta[property="og:url"]', 'content', url);
    head.querySelectorAll('link[rel="prev"], link[rel="next"]').forEach(e => e.remove());
    if (page > 1) head.insertAdjacentHTML('beforeend', `<link rel="prev" href="${SITE}${pageUrl(page - 1)}">`);
    if (page < pages) head.insertAdjacentHTML('beforeend', `<link rel="next" href="${SITE}${pageUrl(page + 1)}">`);
    const title = head.querySelector('title');
    const baseTitle = title.text.replace(/ — Page \d+$/, '');
    title.set_content(esc(page > 1 ? `${baseTitle} — Page ${page}` : baseTitle));

    // Blog structured data: the full, current post list (page 1 only)
    for (const { el, data } of jsonLd(root)) {
        if (data?.['@type'] !== 'Blog') continue;
        if (page > 1) { el.remove(); continue; }
        data.blogPost = catalog.posts.map(p => ({
            '@type': 'BlogPosting', headline: p.title, description: p.description, datePublished: p.published,
            ...(p.updated ? { dateModified: p.updated } : {}), author: { '@type': 'Person', name: p.author }, url: p.canonical,
        }));
        data.dateModified = catalog.posts.map(p => p.updated || p.published).sort().at(-1);
        el.set_content(`\n  ${JSON.stringify(data, null, 2).replace(/</g, '\\u003c')}\n  `);
    }
    return root.toString();
}
