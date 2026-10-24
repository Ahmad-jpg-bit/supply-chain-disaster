// Vite plugin: applies scripts/blog/transform.mjs to the blog index and every
// article (dev and build), serves /blog-page-N in dev, and emits
// blog-page-N.html at build time (Vercel cleanUrls → /blog-page-N).

import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { catalogCache, buildCatalog, isArticleSource, transformArticle, transformIndex, pageCount, pageFile } from './transform.mjs';

export function blogPlugin({ root }) {
    let getCatalog = catalogCache(root);
    return {
        name: 'scd-blog',
        buildStart() {
            // One catalog per build (fails the build early if any article is malformed)
            const cat = buildCatalog(root);
            getCatalog = () => cat;
        },
        transformIndexHtml: {
            order: 'pre',
            handler(html, ctx) {
                const file = basename(ctx.filename || '');
                if (file === 'blog.html') {
                    const m = /\/blog-page-(\d+)(?:\.html)?(?:\?|$)/.exec(ctx.originalUrl || '');
                    return transformIndex(html, getCatalog(), m ? Number(m[1]) : 1);
                }
                if (isArticleSource(html)) return transformArticle(html, file, getCatalog()).html;
                return html;
            },
        },
        configureServer(server) {
            server.middlewares.use(async (req, res, next) => {
                const m = /^\/blog-page-(\d+)(?:\.html)?(?:\?.*)?$/.exec(req.url || '');
                if (!m) return next();
                try {
                    const html = await server.transformIndexHtml('/blog.html', readFileSync(join(root, 'blog.html'), 'utf8'), req.url);
                    res.setHeader('Content-Type', 'text/html; charset=utf-8');
                    res.end(html);
                } catch (e) { next(e); }
            });
        },
        // 'post': Vite's own HTML plugin adds blog.html to the bundle in its generateBundle
        generateBundle: {
            order: 'post',
            handler(_opts, bundle) {
                const first = bundle['blog.html'];
                if (!first) throw new Error('[blog] blog.html missing from the bundle — cannot emit the paginated pages');
                const cat = getCatalog();
                for (let n = 2; n <= pageCount(cat); n++) {
                    this.emitFile({ type: 'asset', fileName: pageFile(n), source: transformIndex(String(first.source), cat, n, { rebuild: true }) });
                }
            },
        },
    };
}
