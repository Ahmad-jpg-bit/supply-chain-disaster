#!/usr/bin/env node
/**
 * publish-today.js
 * Finds the post scheduled for today (or a given date), generates its HTML,
 * then updates blog.html, public/sitemap.xml, and public/rss.xml.
 *
 * Usage:
 *   node scripts/publish-today.js              # uses today's UTC date
 *   node scripts/publish-today.js 2026-04-04   # publish a specific date
 *   node scripts/publish-today.js --all-pending # publish every pending post
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEDULE_PATH = path.join(ROOT, 'blog-schedule.json');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayUtc() {
  return new Date().toISOString().slice(0, 10);
}

function formatRssDate(dateStr) {
  const d = new Date(dateStr + 'T09:00:00Z');
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${days[d.getUTCDay()]}, ${dd} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()} 09:00:00 +0000`;
}

function formatLongDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function extractExcerpt(htmlPath) {
  if (!fs.existsSync(htmlPath)) return '';
  const html = fs.readFileSync(htmlPath, 'utf8');
  // Find first <p> inside <article>
  const m = html.match(/<article[^>]*>[\s\S]*?<p>([\s\S]*?)<\/p>/i);
  if (!m) return '';
  const text = m[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return text.length > 220 ? text.slice(0, 217) + '...' : text;
}

// ─── Blog card HTML ───────────────────────────────────────────────────────────

function buildBlogCard(post, excerpt) {
  const longDate = formatLongDate(post.publish_date);
  const desc = excerpt || `In-depth analysis of ${post.title.toLowerCase()}.`;
  const safe = desc.replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `
        <article class="blog-card">
          <span class="blog-tag">${post.tag}</span>
          <h2><a href="/${post.slug}" style="color:inherit;text-decoration:none;">${post.title}</a></h2>
          <p class="blog-date">${longDate}</p>
          <p>${safe}</p>
          <a href="/${post.slug}" class="read-more">Read more &rarr;</a>
        </article>`;
}

// ─── blog.html update ────────────────────────────────────────────────────────

function updateBlogHtml(post, excerpt) {
  const blogPath = path.join(ROOT, 'blog.html');
  let html = fs.readFileSync(blogPath, 'utf8');

  if (html.includes(`href="/${post.slug}"`)) {
    console.log(`  blog.html: already contains /${post.slug}`);
    return;
  }

  const card = buildBlogCard(post, excerpt);

  // Insert card just before the closing </div> of .blog-grid
  // The blog-grid ends right before the tools cross-link banner comment
  html = html.replace(
    /(\s*<\/div>\s*\n\s*<!-- Tools cross-link)/,
    `${card}\n$1`
  );

  // Insert JSON-LD BlogPosting entry before the closing ] of blogPost array
  const safeTitle = post.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const safeDesc  = (excerpt || post.title).replace(/\\/g, '\\\\').replace(/"/g, '\\"').slice(0, 150);
  const jsonEntry = `      ,
      {
        "@type": "BlogPosting",
        "headline": "${safeTitle}",
        "description": "${safeDesc}",
        "datePublished": "${post.publish_date}",
        "author": { "@type": "Person", "name": "Ahmad Faruqi", "url": "https://www.linkedin.com/in/ahmad-f-549063193" },
        "url": "https://www.supplychaindisaster.com/${post.slug}"
      }`;

  html = html.replace(/([ \t]*\]\s*\n\s*\}\s*\n\s*<\/script>)/, `${jsonEntry}\n$1`);

  fs.writeFileSync(blogPath, html, 'utf8');
  console.log(`  blog.html: added card for /${post.slug}`);
}

// ─── vite.config.js update ───────────────────────────────────────────────────

function updateViteConfig(post) {
  const vitePath = path.join(ROOT, 'vite.config.js');
  let src = fs.readFileSync(vitePath, 'utf8');

  if (src.includes(`'${post.slug}':`)) {
    console.log(`  vite.config.js: already contains '${post.slug}'`);
    return;
  }

  // Insert as last entry in rollupOptions.input (before the closing },)
  const entry = `                '${post.slug}': resolve(__dirname, '${post.slug}.html'),`;
  src = src.replace(
    /([ \t]*\},\s*\n\s*output:)/,
    `${entry}\n$1`
  );

  fs.writeFileSync(vitePath, src, 'utf8');
  console.log(`  vite.config.js: added '${post.slug}'`);
}

// ─── sitemap.xml update ──────────────────────────────────────────────────────

function updateSitemap(post) {
  const sitemapPath = path.join(ROOT, 'public', 'sitemap.xml');
  let xml = fs.readFileSync(sitemapPath, 'utf8');

  if (xml.includes(`/${post.slug}`)) {
    console.log(`  sitemap.xml: already contains /${post.slug}`);
    return;
  }

  const entry = `
  <url>
    <loc>https://www.supplychaindisaster.com/${post.slug}</loc>
    <lastmod>${post.publish_date}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>`;

  xml = xml.replace(/(<\/urlset>)/, `${entry}\n$1`);
  fs.writeFileSync(sitemapPath, xml, 'utf8');
  console.log(`  sitemap.xml: added /${post.slug}`);
}

// ─── rss.xml update ──────────────────────────────────────────────────────────

function updateRss(post, excerpt) {
  const rssPath = path.join(ROOT, 'public', 'rss.xml');
  let xml = fs.readFileSync(rssPath, 'utf8');

  if (xml.includes(`/${post.slug}`)) {
    console.log(`  rss.xml: already contains /${post.slug}`);
    return;
  }

  xml = xml.replace(
    /<lastBuildDate>[^<]+<\/lastBuildDate>/,
    `<lastBuildDate>${formatRssDate(post.publish_date)}</lastBuildDate>`
  );

  const safeTitle = post.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const safeDesc  = (excerpt || post.title).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  const item = `
    <item>
      <title>${safeTitle}</title>
      <link>https://www.supplychaindisaster.com/${post.slug}</link>
      <guid isPermaLink="true">https://www.supplychaindisaster.com/${post.slug}</guid>
      <pubDate>${formatRssDate(post.publish_date)}</pubDate>
      <description>${safeDesc}</description>
    </item>`;

  // Insert as newest item (right after opening <channel> info, before first <item>)
  xml = xml.replace(/(\s*<item>)/, `${item}\n$1`);
  fs.writeFileSync(rssPath, xml, 'utf8');
  console.log(`  rss.xml: added /${post.slug}`);
}

// ─── Main publish flow ────────────────────────────────────────────────────────

function publishPost(post) {
  console.log(`\nPublishing: "${post.title}" [${post.publish_date}]`);

  execSync(`node "${path.join(ROOT, 'scripts', 'md-to-html.js')}" "${post.slug}"`, {
    cwd: ROOT,
    stdio: 'inherit',
  });

  const htmlPath = path.join(ROOT, `${post.slug}.html`);
  const excerpt  = extractExcerpt(htmlPath);

  updateBlogHtml(post, excerpt);
  updateSitemap(post);
  updateRss(post, excerpt);
  updateViteConfig(post);

  // Mark as published
  const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
  const idx = schedule.posts.findIndex(p => p.slug === post.slug);
  if (idx !== -1) {
    schedule.posts[idx].status = 'published';
    fs.writeFileSync(SCHEDULE_PATH, JSON.stringify(schedule, null, 2), 'utf8');
  }

  console.log(`  ✓ Live: https://www.supplychaindisaster.com/${post.slug}`);
}

// ─── Entry point ─────────────────────────────────────────────────────────────

const schedule = JSON.parse(fs.readFileSync(SCHEDULE_PATH, 'utf8'));
const arg = process.argv[2];

if (arg === '--all-pending') {
  const pending = schedule.posts.filter(p => p.status === 'pending');
  if (pending.length === 0) {
    console.log('No pending posts.');
  } else {
    console.log(`Publishing ${pending.length} pending posts...`);
    for (const post of pending) publishPost(post);
  }
} else {
  const targetDate = arg || todayUtc();
  const post = schedule.posts.find(p => p.publish_date === targetDate && p.status === 'pending');

  if (!post) {
    console.log(`No post scheduled for ${targetDate} (or already published).`);
    process.exit(0);
  }

  publishPost(post);
}
