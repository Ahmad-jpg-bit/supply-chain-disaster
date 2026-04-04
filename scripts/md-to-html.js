#!/usr/bin/env node
/**
 * md-to-html.js
 * Converts a supply chain blog draft (Markdown) to a full HTML page
 * matching supplychaindisaster.com's article style.
 *
 * Usage:  node scripts/md-to-html.js <slug>
 * Looks up the post in blog-schedule.json, reads from blog-drafts/, writes HTML to project root.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const SCHEDULE = JSON.parse(fs.readFileSync(path.join(ROOT, 'blog-schedule.json'), 'utf8'));

// ─── Markdown → HTML ────────────────────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function inlineMarkdown(str) {
  return str
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" rel="noopener noreferrer" target="_blank">$1</a>')
    .replace(/\[([^\]]+)\]\(\/([^)]*)\)/g, '<a href="/$2">$1</a>');
}

function markdownToHtml(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    const h3 = line.match(/^### (.+)/);
    if (h3) { out.push(`<h3>${inlineMarkdown(h3[1])}</h3>`); i++; continue; }

    const h2 = line.match(/^## (.+)/);
    if (h2) { out.push(`<h2>${inlineMarkdown(h2[1])}</h2>`); i++; continue; }

    const h1 = line.match(/^# (.+)/);
    if (h1) { out.push(`<h1>${inlineMarkdown(h1[1])}</h1>`); i++; continue; }

    if (/^-{3,}$/.test(line.trim())) { out.push('<hr>'); i++; continue; }

    if (line.startsWith('> ')) {
      const bq = [];
      while (i < lines.length && lines[i].startsWith('> ')) {
        bq.push(inlineMarkdown(lines[i].slice(2)));
        i++;
      }
      out.push(`<blockquote><p>${bq.join(' ')}</p></blockquote>`);
      continue;
    }

    if (/^[*-] /.test(line)) {
      const items = [];
      while (i < lines.length && /^[*-] /.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^[*-] /, ''))}</li>`);
        i++;
      }
      out.push(`<ul>${items.join('')}</ul>`);
      continue;
    }

    if (/^\d+\. /.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+\. /.test(lines[i])) {
        items.push(`<li>${inlineMarkdown(lines[i].replace(/^\d+\. /, ''))}</li>`);
        i++;
      }
      out.push(`<ol>${items.join('')}</ol>`);
      continue;
    }

    if (line.trim() === '') { i++; continue; }

    // Paragraph — gather consecutive non-special lines
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !/^[#>]/.test(lines[i]) &&
      !/^[*-] /.test(lines[i]) &&
      !/^\d+\. /.test(lines[i]) &&
      !/^-{3,}$/.test(lines[i].trim())
    ) {
      para.push(lines[i]);
      i++;
    }
    if (para.length > 0) {
      out.push(`<p>${inlineMarkdown(para.join(' '))}</p>`);
    }
  }

  return out.join('\n      ');
}

// ─── Format detection & content extraction ──────────────────────────────────

function isJsonWrapped(raw) {
  return raw.includes('"content":') && raw.includes('"faqs":');
}

function extractJsonField(raw, key) {
  const re = new RegExp(`"${key}"\\s*:\\s*"([\\s\\S]*?)"\\s*(?:,\\s*"|\\s*[}\\]])`, 'i');
  const m = raw.match(re);
  if (!m) return '';
  return m[1]
    .replace(/\\n/g, '\n')
    .replace(/\\<p>/g, '\n\n')
    .replace(/\\p>/g, '\n\n')
    .replace(/\\t/g, ' ')
    .replace(/\\([^\\"])/g, '$1')
    .trim();
}

function parseFile(raw) {
  // Unescape escaped markdown syntax used in JSON-wrapped files
  const cleaned = raw
    .replace(/\\`/g, '`')
    .replace(/\\{/g, '{')
    .replace(/\\}/g, '}');

  const lines = cleaned.replace(/\r\n/g, '\n').split('\n');
  let title = '';
  let subtitle = '';
  const introParagraphs = [];
  let bodyStart = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!title && line.startsWith('# ')) {
      title = line.slice(2).trim();
      bodyStart = i + 1;
    } else if (title && !subtitle && line.startsWith('## ')) {
      subtitle = line.slice(3).trim();
      bodyStart = i + 1;
    } else if (title && subtitle && line.trim() && !line.startsWith('#') && !line.startsWith('`')) {
      introParagraphs.push(line.trim());
      bodyStart = i + 1;
    } else if (title && subtitle && line.startsWith('`')) {
      bodyStart = i;
      break;
    } else if (title && subtitle && introParagraphs.length > 0 && line.trim() === '') {
      bodyStart = i + 1;
      break;
    }
  }

  const intro = introParagraphs.join(' ');

  if (isJsonWrapped(cleaned)) {
    const jsonBlock = cleaned.slice(cleaned.indexOf('```json'));
    const contentMd = extractJsonField(jsonBlock, 'content');
    const faqsMd    = extractJsonField(jsonBlock, 'faqs');
    const tldrMd    = extractJsonField(jsonBlock, 'tldr');
    return {
      title: title || 'Supply Chain Insights',
      subtitle,
      intro,
      contentHtml: markdownToHtml(contentMd),
      faqsHtml: faqsMd ? markdownToHtml(faqsMd) : '',
      tldrItems: parseTldr(tldrMd),
      wordCount: wordCount(contentMd + faqsMd),
    };
  }

  const body = lines.slice(bodyStart).join('\n');

  const tldrMatch = body.match(/(?:^|\n)##\s+TL[;:]?DR\b[^\n]*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
  const tldrRaw   = tldrMatch ? tldrMatch[1] : '';

  const faqMatch = body.match(/(?:^|\n)##\s+(?:Frequently Asked Questions|FAQs?)\b[^\n]*\n([\s\S]*?)(?=\n##\s|\n#\s|$)/i);
  const faqRaw   = faqMatch ? faqMatch[1] : '';

  const mainBody = body
    .replace(/(?:^|\n)##\s+TL[;:]?DR\b[^\n]*\n[\s\S]*?(?=\n##\s|\n#\s|$)/i, '')
    .replace(/(?:^|\n)##\s+(?:Frequently Asked Questions|FAQs?)\b[^\n]*\n[\s\S]*?(?=\n##\s|\n#\s|$)/i, '')
    .trim();

  return {
    title: title || 'Supply Chain Insights',
    subtitle,
    intro,
    contentHtml: markdownToHtml(mainBody),
    faqsHtml: faqRaw ? markdownToHtml(faqRaw) : '',
    tldrItems: parseTldr(tldrRaw),
    wordCount: wordCount(body),
  };
}

function parseTldr(raw) {
  if (!raw) return [];
  return raw.split('\n')
    .map(l => l.replace(/^[*-]\s*/, '').trim())
    .filter(l => l.length > 0)
    .map(l => inlineMarkdown(l));
}

function wordCount(text) {
  return (text || '').split(/\s+/).filter(Boolean).length;
}

function readTime(wc) {
  return Math.max(3, Math.round(wc / 200));
}

// ─── HTML Template ───────────────────────────────────────────────────────────

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}

function generateHtml(post, parsed) {
  const { slug, title, tag, publish_date } = post;
  const canonical    = `https://www.supplychaindisaster.com/${slug}`;
  const formattedDate = formatDate(publish_date);
  const rt = readTime(parsed.wordCount);

  const rawDesc = parsed.intro || parsed.subtitle ||
    `${title} — expert analysis on supply chain strategy, risk management, and operational resilience.`;
  const metaDesc = rawDesc.length > 158 ? rawDesc.slice(0, 155) + '...' : rawDesc;

  const tldrHtml = parsed.tldrItems.length > 0 ? `
      <div class="tldr-box">
        <h3>TL;DR — Key Takeaways</h3>
        <ul>
          ${parsed.tldrItems.map(item => `<li>${item}</li>`).join('\n          ')}
        </ul>
      </div>` : '';

  const faqsHtml = parsed.faqsHtml ? `
      <div class="faq-section">
        <h2>Frequently Asked Questions</h2>
        ${parsed.faqsHtml}
      </div>` : '';

  const keywords = title.toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 3)
    .slice(0, 8)
    .map(w => `"${w} supply chain"`)
    .join(', ');

  return `<!doctype html>
<html lang="en">
<head>
  <!-- Google tag (gtag.js) -->
  <script async src="https://www.googletagmanager.com/gtag/js?id=G-2Z03B7JFE1"></script>
  <script>window.dataLayer = window.dataLayer || [];
    function gtag(){dataLayer.push(arguments);}
    gtag('js', new Date());
    gtag('config', 'G-2Z03B7JFE1');
  </script>
  <meta charset="UTF-8" />
  <link rel="icon" type="image/png" href="/logo.png" />
  <link rel="apple-touch-icon" href="/logo.png" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="theme-color" content="#0f172a" />
  <title>${escapeHtml(title)} | Supply Chain Disaster</title>
  <meta name="description" content="${escapeHtml(metaDesc)}" />
  <link rel="canonical" href="${canonical}" />
  <meta name="robots" content="index, follow" />
  <meta name="author" content="Ahmad Faruqi" />

  <!-- Open Graph -->
  <meta property="og:type" content="article" />
  <meta property="og:url" content="${canonical}" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(metaDesc)}" />
  <meta property="og:image" content="https://www.supplychaindisaster.com/og-image.png" />
  <meta property="og:site_name" content="Supply Chain Disaster" />
  <meta property="article:published_time" content="${publish_date}" />
  <meta property="article:author" content="Ahmad Faruqi" />

  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(metaDesc)}" />
  <meta name="twitter:image" content="https://www.supplychaindisaster.com/og-image.png" />

  <!-- JSON-LD: BlogPosting -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": "${title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",
    "description": "${metaDesc.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}",
    "datePublished": "${publish_date}",
    "dateModified": "${publish_date}",
    "author": {
      "@type": "Person",
      "name": "Ahmad Faruqi",
      "url": "https://www.linkedin.com/in/ahmad-f-549063193"
    },
    "publisher": {
      "@type": "Organization",
      "name": "Supply Chain Disaster",
      "url": "https://www.supplychaindisaster.com/"
    },
    "url": "${canonical}",
    "mainEntityOfPage": "${canonical}",
    "keywords": [${keywords}]
  }
  </script>

  <link rel="alternate" type="application/rss+xml" title="Supply Chain Disaster RSS Feed" href="/rss.xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
.tldr-box { margin: 1.5rem 0 2.5rem; padding: 1.5rem 1.75rem; background: rgba(30,41,59,0.6); border: 1px solid rgba(148,163,184,0.15); border-radius: 10px; }
.tldr-box h3 { margin: 0 0 0.875rem; font-size: 0.72rem; font-family: 'Courier New', monospace; letter-spacing: 0.2em; text-transform: uppercase; color: #64748b; }
.tldr-box ul { margin: 0; padding-left: 1.25rem; display: flex; flex-direction: column; gap: 0.5rem; }
.tldr-box li { font-size: 0.9rem; color: #cbd5e1; line-height: 1.6; }
.faq-section { margin: 3rem 0 1rem; }
.faq-section h2 { margin-bottom: 1.5rem; }
.faq-section h3 { font-size: 1rem; color: #f1f5f9; margin: 1.5rem 0 0.6rem; padding-top: 1.25rem; border-top: 1px solid rgba(148,163,184,0.1); }
.faq-section p { margin: 0 0 1rem; font-size: 0.9rem; color: #94a3b8; line-height: 1.75; }
.mission-briefing { margin: 2.5rem 0 1rem; padding: 2rem 2.25rem; background: linear-gradient(135deg, rgba(15,23,42,0.95), rgba(30,41,59,0.9)); border: 1px solid rgba(245,158,11,0.3); border-radius: 12px; box-shadow: 0 0 40px rgba(245,158,11,0.08), 0 8px 32px rgba(0,0,0,0.4); text-align: center; }
.mission-briefing-label { font-family: 'Courier New', monospace; font-size: 10px; font-weight: 700; letter-spacing: 0.2em; text-transform: uppercase; color: #f59e0b; margin-bottom: 0.75rem; }
.mission-briefing h2 { font-size: 1.5rem; font-weight: 800; color: #f1f5f9; margin: 0 0 0.875rem; border: none; padding: 0; }
.mission-briefing h2::after { display: none; }
.mission-briefing p { color: #94a3b8; font-size: 0.95rem; line-height: 1.7; margin: 0 0 1.5rem; max-width: 540px; margin-left: auto; margin-right: auto; }
.mission-btn { display: inline-block; padding: 0.875rem 2.25rem; background: linear-gradient(135deg, #f59e0b, #d97706); color: #0f172a; font-weight: 700; font-size: 1rem; text-decoration: none; border-radius: 8px; letter-spacing: 0.02em; animation: mission-glow 2.2s ease-in-out infinite; transition: transform 0.2s ease; }
.mission-btn:hover { transform: translateY(-2px); text-decoration: none; }
@keyframes mission-glow { 0%, 100% { box-shadow: 0 0 6px rgba(245,158,11,0.25), 0 3px 10px rgba(0,0,0,0.4); } 50% { box-shadow: 0 0 14px rgba(245,158,11,0.45), 0 3px 10px rgba(0,0,0,0.4); } }
.mission-briefing-note { display: block; margin-top: 0.875rem; font-size: 0.78rem; color: #475569; font-family: 'Courier New', monospace; }
  </style>
</head>
<body>
<div class="page-wrapper">
  <div class="page-content">
    <header class="article-header">
      <a href="/blog" class="article-back-link">&#8592; Back to Blog</a>
      <span class="article-tag">${escapeHtml(tag)}</span>
      <h1>${escapeHtml(title)}</h1>
      ${parsed.subtitle ? `<p class="article-subtitle">${escapeHtml(parsed.subtitle)}</p>` : ''}
      <div class="article-meta">
        <span>${formattedDate}</span>
        <span class="article-meta-sep">·</span>
        <span>Ahmad Faruqi</span>
        <span class="article-meta-sep">·</span>
        <span>${rt} min read</span>
      </div>
    </header>

    <article class="article-content">
      ${tldrHtml}

      ${parsed.contentHtml}
      ${faqsHtml}

      <div class="mission-briefing">
        <p class="mission-briefing-label">&#9889; Mission Briefing &#8212; Command Center</p>
        <h2>Test Your Supply Chain Instincts Under Real Pressure</h2>
        <p>Reading about supply chain strategy is not the same as making those decisions when your inventory hits zero and your primary supplier just went dark. Supply Chain Disaster puts you inside the crisis &#8212; where every decision has a visible cost.</p>
        <a href="https://www.supplychaindisaster.com" class="mission-btn">Begin Mission: Chapter 1 &rarr;</a>
        <span class="mission-briefing-note">Free &#8212; no account required &middot; Chapters 1 &amp; 2 always free</span>
      </div>

    </article>

    <footer class="page-footer">
      <p>&copy; 2026 Supply Chain Disaster. Built to teach supply chain strategy through play. &nbsp;&middot;&nbsp; <a href="/rss.xml" title="RSS Feed">RSS Feed</a></p>
    </footer>

  </div>
</div>
<script type="module" src="/src/blog.js"></script>
</body>
</html>`;
}

// ─── Main ────────────────────────────────────────────────────────────────────

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node scripts/md-to-html.js <slug>');
  process.exit(1);
}

const post = SCHEDULE.posts.find(p => p.slug === slug);
if (!post) {
  console.error(`Post with slug "${slug}" not found in blog-schedule.json`);
  process.exit(1);
}

const draftPath = path.join(ROOT, 'blog-drafts', post.file);
if (!fs.existsSync(draftPath)) {
  console.error(`Draft file not found: ${draftPath}`);
  process.exit(1);
}

const raw = fs.readFileSync(draftPath, 'utf8');
const parsed = parseFile(raw);
parsed.title = post.title; // use clean schedule title

const html = generateHtml(post, parsed);
const outPath = path.join(ROOT, `${post.slug}.html`);
fs.writeFileSync(outPath, html, 'utf8');

console.log(`Generated: ${post.slug}.html`);
console.log(`  Title: ${post.title}`);
console.log(`  Words: ${parsed.wordCount} (~${readTime(parsed.wordCount)} min read)`);
console.log(`  TL;DR items: ${parsed.tldrItems.length}`);
console.log(`  Has FAQs: ${parsed.faqsHtml ? 'yes' : 'no'}`);
