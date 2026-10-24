// Blog template: every article's substantive content survives the build
// transform; only the approved template components are added/replaced.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { parse } from 'node-html-parser';
import * as B from '../scripts/blog/transform.mjs';
import { OFFER } from '../src/data/offer-copy.js';

const catalog = B.buildCatalog('.');
const PARSE = { comment: true };
const norm = (s) => s.replace(/\s+/g, ' ').trim();
const GENERATED_IN_CONTENT = '.ab-module, .ab-endmatter';

/** Source article content minus what the template legitimately replaces (CTA blocks, hand-written TOC). */
function sourceContent(html) {
    const content = parse(html, PARSE).querySelector('.article-content');
    content.querySelectorAll('.mission-briefing, .article-cta').forEach(e => e.remove());
    for (const el of content.querySelectorAll('h2, h3, p')) {
        if (!/^table of contents$/i.test(norm(el.text))) continue;
        const list = el.nextElementSibling;
        if (list && ['UL', 'OL'].includes(list.tagName) && list.querySelectorAll('a').every(a => (a.getAttribute('href') || '').startsWith('#'))) { el.remove(); list.remove(); }
    }
    return content;
}
function builtContent(root) {
    const content = parse(root.querySelector('.article-content').outerHTML, PARSE);
    content.querySelectorAll(GENERATED_IN_CONTENT).forEach(e => e.remove());
    return content;
}
const ldBlocks = (root) => root.querySelectorAll('script[type="application/ld+json"]').map(s => JSON.parse(s.text));
const hrefs = (el) => el.querySelectorAll('a').map(a => a.getAttribute('href')).sort();

const results = catalog.posts.map(post => {
    const src = readFileSync(post.file, 'utf8');
    const { html, report } = B.transformArticle(src, post.file, catalog);
    return { post, src, html, report, root: parse(html, PARSE), srcRoot: parse(src, PARSE) };
});

test('catalog: all 58 articles, newest first, unique slugs and canonical URLs', () => {
    assert.equal(catalog.posts.length, 58);
    assert.equal(new Set(catalog.posts.map(p => p.slug)).size, 58);
    for (let i = 1; i < catalog.posts.length; i++) assert.ok(catalog.posts[i - 1].published >= catalog.posts[i].published);
});

test('every article: substantive content, links, lists, tables and heading IDs preserved', () => {
    const failures = [];
    for (const { post, src, root } of results) {
        const before = sourceContent(src), after = builtContent(root);
        if (norm(before.text) !== norm(after.text)) failures.push(`${post.file}: text differs`);
        if (hrefs(before).join('|') !== hrefs(after).join('|')) failures.push(`${post.file}: links differ`);
        for (const tag of ['table', 'ul', 'ol', 'li', 'h2', 'h3', 'h4', 'blockquote', 'img', 'code', 'strong', 'em'])
            if (before.querySelectorAll(tag).length !== after.querySelectorAll(tag).length) failures.push(`${post.file}: <${tag}> count differs`);
        for (const el of before.querySelectorAll('[id]')) {
            const id = el.getAttribute('id');
            const now = after.querySelector(`#${CSS_escape(id)}`);
            if (!now || now.tagName !== el.tagName) failures.push(`${post.file}: id #${id} lost`);
        }
    }
    assert.deepEqual(failures, []);
});

test('every article: one H1 (unchanged), metadata and existing structured data preserved', () => {
    for (const { post, srcRoot, root } of results) {
        assert.equal(root.querySelectorAll('h1').length, 1, post.file);
        assert.equal(norm(root.querySelector('h1').text), norm(srcRoot.querySelector('h1').text), post.file);
        for (const sel of ['title', 'meta[name="description"]', 'link[rel="canonical"]', 'meta[property="og:url"]', 'meta[name="robots"]']) {
            assert.equal(root.querySelector(sel)?.toString(), srcRoot.querySelector(sel)?.toString(), `${post.file} ${sel}`);
        }
        assert.equal(root.querySelector('link[rel="canonical"]').getAttribute('href'), `${B.SITE}/${post.slug}`);
        const before = ldBlocks(srcRoot), after = ldBlocks(root);
        assert.deepEqual(after.filter(d => d['@type'] !== 'BreadcrumbList'), before, `${post.file}: JSON-LD changed`);
        const crumbs = after.filter(d => d['@type'] === 'BreadcrumbList');
        assert.equal(crumbs.length, 1);
        assert.deepEqual(crumbs[0].itemListElement.map(i => i.item), [`${B.SITE}/`, `${B.SITE}/blog`, post.canonical]);
        const visible = root.querySelectorAll('.ab-crumbs a').map(a => a.getAttribute('href'));
        assert.deepEqual(visible, ['/', '/blog', post.url], `${post.file}: visible breadcrumbs match the structured data`);
    }
});

test('every article: template components exactly once, no legacy CTA left', () => {
    for (const { post, root } of results) {
        for (const c of ['ab-crumbs', 'ab-layout', 'ab-related', 'ab-endmatter', 'ab-skip']) assert.equal(root.querySelectorAll(`.${c}`).length, 1, `${post.file} .${c}`);
        assert.ok(root.querySelectorAll('.ab-toc').length <= 1);
        assert.ok(root.querySelectorAll('.ab-module').length <= 1);
        assert.equal(root.querySelectorAll('.mission-briefing, .article-cta, .article-back-link').length, 0, post.file);
        assert.equal(root.querySelectorAll('.article-meta').length, 1);
    }
});

test('every article: contents links and in-page anchors resolve; IDs unique', () => {
    for (const { post, root } of results) {
        const ids = root.querySelectorAll('[id]').map(e => e.getAttribute('id'));
        assert.equal(new Set(ids).size, ids.length, `${post.file}: duplicate id`);
        for (const a of root.querySelectorAll('.article-content a[href^="#"], .ab-toc a, .ab-skip')) {
            const id = decodeURIComponent(a.getAttribute('href').slice(1));
            assert.ok(id && ids.includes(id), `${post.file}: ${a.getAttribute('href')} has no target`);
        }
        const toc = root.querySelector('.ab-toc');
        if (toc) {
            const h2 = root.querySelectorAll('.article-content h2').filter(h => !h.closest('.ab-module')).map(h => h.getAttribute('id'));
            assert.deepEqual(toc.querySelectorAll('a').map(a => a.getAttribute('href').slice(1)), h2, `${post.file}: TOC lists every section in order`);
            assert.ok(post.minutes >= B.TOC_MIN_MINUTES && h2.length >= B.TOC_MIN_SECTIONS);
        }
    }
});

test('every article: reading time matches an independent word count; dates are the article’s own', () => {
    for (const { post, src, root } of results) {
        const words = norm(sourceContent(src).querySelectorAll('script, style').reduce((t, s) => t.replace(s.text, ''), sourceContent(src).text))
            .split(' ').filter(w => /[\p{L}\p{N}]/u.test(w)).length;
        assert.equal(post.minutes, Math.max(1, Math.round(words / 230)), post.file);
        const meta = root.querySelector('.article-meta');
        assert.match(meta.text, new RegExp(`${post.minutes} min read`));
        const times = meta.querySelectorAll('time').map(t => t.getAttribute('datetime'));
        const ld = ldBlocks(parse(src, PARSE)).find(d => d['@type'] === 'BlogPosting');
        assert.equal(times[0], ld.datePublished, post.file);
        if (ld.dateModified && ld.dateModified > ld.datePublished) assert.equal(times[1], ld.dateModified);
        else assert.equal(times.length, 1, `${post.file}: no "Updated" without a later dateModified`);
        assert.match(meta.text, new RegExp(`By ${post.author}`));
    }
});

test('every article: related reading points at real articles; share + correction are wired', () => {
    for (const { post, root } of results) {
        const rel = root.querySelectorAll('.ab-related .ab-card-title a').map(a => a.getAttribute('href'));
        assert.equal(rel.length, 3, post.file);
        assert.equal(new Set(rel).size, 3);
        for (const href of rel) {
            assert.notEqual(href, post.url);
            assert.ok(existsSync(`${href.slice(1)}.html`) && catalog.bySlug[href.slice(1)], `${post.file}: ${href}`);
        }
        const same = B.relatedFor(post, catalog).items.filter(p => p.topic === post.topic).length;
        assert.equal(same, Math.min(3, catalog.posts.filter(p => p.topic === post.topic).length - 1), `${post.file}: same-topic first`);
        assert.equal(root.querySelector('[data-ab-copy]').getAttribute('data-url'), post.canonical);
        const fix = root.querySelector('.ab-correction a').getAttribute('href');
        assert.equal(fix, `/contact?subject=${encodeURIComponent(`Correction: ${post.title}`)}`);
    }
});

test('game module: catalog-derived offer, contextual industry link, no stale offer claims', () => {
    // Stale claims about OUR offer (third-party games may legitimately be "completely free")
    const banned = /Chapters 1(&ndash;|–|-)3 free|\(Ch 1(&ndash;|–|-)3\)|All 10 chapters (always|are permanently) free|Supply Chain Disaster is a free|32 turns/i;
    for (const { post, html, root, report } of results) {
        assert.doesNotMatch(root.querySelector('.article-content').text, banned, post.file);
        const mod = root.querySelector('.ab-module');
        if (!mod) { assert.equal(report.ctasReplaced, 0); continue; }
        assert.ok(mod.text.includes(OFFER.free) && mod.text.includes('$19.99, one-time'), post.file);
        const play = mod.querySelector('.ab-module-btn').getAttribute('href');
        assert.match(play, /^\/play\?start=1&industry=(fmcg|pharma|electronics)$/);
        assert.doesNotMatch(report.cta.paragraph, /\bfree\b|hours?\b|minutes?\b/i, `${post.file}: claim sentence kept`);
        assert.ok(!/autostart|&new=|&chapter=/.test(play), 'links only preselect');
        assert.ok(html.length > 0);
    }
});

test('transform is deterministic, refuses its own output, and fails clearly on broken structure', () => {
    const { post, src, html } = results[0];
    assert.equal(B.transformArticle(src, post.file, catalog).html, html);
    assert.throws(() => B.transformArticle(html, post.file, catalog), B.BlogStructureError);
    assert.throws(() => B.readArticle(src.replace('class="article-header"', 'class="x"'), post.file), /article-header/);
    assert.throws(() => B.readArticle(src.replace('</h1>', '</h1><h1>Two</h1>'), post.file), /exactly one <h1>/);
    assert.throws(() => B.readArticle(src.replace(/"datePublished":\s*"[^"]+"/, '"datePublished": ""'), post.file), /datePublished/);
});

test('alternate template (div header/content, two .article-cta blocks, hand-written TOC) is handled', () => {
    const r = results.find(x => x.post.slug === 'what-is-a-supply-chain');
    assert.deepEqual([r.report.ctasReplaced, r.report.ctasRemoved, r.report.handwrittenTocRemoved], [1, 1, 1]);
    assert.equal(r.root.querySelector('.article-content').tagName, 'DIV');
});

test('blog index: 5 pages cover all 58 articles once; canonical/prev/next; structured data lists all posts', () => {
    const src = readFileSync('blog.html', 'utf8');
    const seen = [];
    let page1;
    for (let n = 1; n <= B.pageCount(catalog); n++) {
        const html = n === 1 ? (page1 = B.transformIndex(src, catalog, 1)) : B.transformIndex(page1, catalog, n, { rebuild: true });
        const root = parse(html, PARSE);
        assert.equal(root.querySelectorAll('h1').length, 1);
        assert.equal(root.querySelector('link[rel="canonical"]').getAttribute('href'), `${B.SITE}${B.pageUrl(n)}`);
        assert.equal(Boolean(root.querySelector('link[rel="prev"]')), n > 1);
        assert.equal(Boolean(root.querySelector('link[rel="next"]')), n < B.pageCount(catalog));
        seen.push(...root.querySelectorAll('.ab-listing .ab-card-title a').map(a => a.getAttribute('href')));
        const blog = ldBlocks(root).filter(d => d['@type'] === 'Blog');
        if (n === 1) assert.equal(blog[0].blogPost.length, 58); else assert.equal(blog.length, 0);
        const cat = JSON.parse(root.querySelector('#ab-catalog').text);
        assert.equal(cat.length, 58);
        assert.doesNotMatch(root.querySelector('#ab-catalog').text, /</, 'catalog JSON cannot close its <script>');
    }
    assert.equal(seen.length, 58);
    assert.equal(new Set(seen).size, 58);
    assert.throws(() => B.transformIndex(page1, catalog, 1), B.BlogStructureError, 'refuses an already filled index');
});

function CSS_escape(id) { return id.replace(/([^a-zA-Z0-9_-])/g, '\\$1'); }
