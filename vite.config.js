import { defineConfig } from 'vite'
import { resolve } from 'path'
import { normalize } from 'path'

/**
 * Static nav links injected into every content page at build time.
 * Googlebot reads these in Wave 1 (raw HTML) before any JS executes,
 * ensuring internal PageRank flows correctly even if JS rendering is delayed.
 * Regular users see the full JS-enhanced nav — this block is invisible to them.
 */
const STATIC_SEO_NAV = `<noscript id="seo-nav">
<nav aria-label="Site navigation (static fallback)">
<a href="/">Play Free</a>
<a href="/blog">Supply Chain Blog</a>
<a href="/pricing">Pricing</a>
<a href="/about">About</a>
<a href="/contact">Contact</a>
<a href="/terms">Terms of Service</a>
<a href="/privacy">Privacy Policy</a>
<a href="/refund">Refund Policy</a>
<a href="/what-is-a-supply-chain">What Is a Supply Chain?</a>
<a href="/best-business-simulation-games">Best Business Simulation Games</a>
<a href="/supply-chain-simulation-guide">Supply Chain Simulation Guide</a>
<a href="/scm-fundamentals-5-pillars">SCM Fundamentals</a>
<a href="/7cs-supply-chain-4pl-logistics">7Cs Supply Chain &amp; 4PL Logistics</a>
<a href="/six-sigma-kaizen-supply-chain">Six Sigma &amp; Kaizen</a>
<a href="/supply-chain-management-game">Supply Chain Management Game</a>
<a href="/supply-chain-disruption-simulation">Supply Chain Disruption Simulation</a>
<a href="/procurement-simulation-game">Procurement Simulation Game</a>
<a href="/lead-time-calculator">Lead Time Calculator</a>
<a href="/bullwhip-effect-calculator">Bullwhip Effect Calculator</a>
<a href="/automotive-supply-chain-resilience">Automotive Supply Chain Resilience</a>
<a href="/excel-supply-chain-management">Excel for Supply Chain Management</a>
</nav>
</noscript>`;

export default defineConfig({
    server: {
        port: 3000,
    },
    build: {
        // Suppress the bundle-size warning — the game SPA is intentionally large
        chunkSizeWarningLimit: 700,

        rollupOptions: {
            input: {
                main: resolve(__dirname, 'index.html'),
                play: resolve(__dirname, 'play.html'),
                about: resolve(__dirname, 'about.html'),
                blog: resolve(__dirname, 'blog.html'),
                contact: resolve(__dirname, 'contact.html'),
                success: resolve(__dirname, 'success.html'),
                pricing: resolve(__dirname, 'pricing.html'),
                terms: resolve(__dirname, 'terms.html'),
                privacy: resolve(__dirname, 'privacy.html'),
                refund: resolve(__dirname, 'refund.html'),
                'best-business-simulation-games': resolve(__dirname, 'best-business-simulation-games.html'),
                'what-is-a-supply-chain': resolve(__dirname, 'what-is-a-supply-chain.html'),
                'supply-chain-simulation-guide': resolve(__dirname, 'supply-chain-simulation-guide.html'),
                'scm-fundamentals-5-pillars': resolve(__dirname, 'scm-fundamentals-5-pillars.html'),
                '7cs-supply-chain-4pl-logistics': resolve(__dirname, '7cs-supply-chain-4pl-logistics.html'),
                'six-sigma-kaizen-supply-chain': resolve(__dirname, 'six-sigma-kaizen-supply-chain.html'),
                'supply-chain-management-game': resolve(__dirname, 'supply-chain-management-game.html'),
                'supply-chain-disruption-simulation': resolve(__dirname, 'supply-chain-disruption-simulation.html'),
                'procurement-simulation-game': resolve(__dirname, 'procurement-simulation-game.html'),
                'lead-time-calculator': resolve(__dirname, 'lead-time-calculator.html'),
                'bullwhip-effect-calculator': resolve(__dirname, 'bullwhip-effect-calculator.html'),
                'automotive-supply-chain-resilience': resolve(__dirname, 'automotive-supply-chain-resilience.html'),
                'excel-supply-chain-management': resolve(__dirname, 'excel-supply-chain-management.html'),
                'kitkat-cargo-theft-supply-chain': resolve(__dirname, 'kitkat-cargo-theft-supply-chain.html'),
                'reactive-risk-management': resolve(__dirname, 'reactive-risk-management.html'),
                'supply-chain-risk-model-obsolete': resolve(__dirname, 'supply-chain-risk-model-obsolete.html'),
                'predictive-risk-complex-adaptive-systems': resolve(__dirname, 'predictive-risk-complex-adaptive-systems.html'),
                'stochastic-optimization-supply-chains': resolve(__dirname, 'stochastic-optimization-supply-chains.html'),
                'jit-vulnerability-framework': resolve(__dirname, 'jit-vulnerability-framework.html'),
                'jit-vs-agile-supply-chains': resolve(__dirname, 'jit-vs-agile-supply-chains.html'),
                'adaptive-inventory-policies': resolve(__dirname, 'adaptive-inventory-policies.html'),
                'bayesian-inference-supply-chain-risk': resolve(__dirname, 'bayesian-inference-supply-chain-risk.html'),
                'bayesian-inference-vs-traditional': resolve(__dirname, 'bayesian-inference-vs-traditional.html'),
                'bayesian-inference-beats-traditional': resolve(__dirname, 'bayesian-inference-beats-traditional.html'),
                'supply-chain-resilience-predictive-analytics': resolve(__dirname, 'supply-chain-resilience-predictive-analytics.html'),
                'predictive-analytics-jit-risk': resolve(__dirname, 'predictive-analytics-jit-risk.html'),
                'supply-chain-resilience-strategies-2026': resolve(__dirname, 'supply-chain-resilience-strategies-2026.html'),
                'resilient-supply-chain-framework': resolve(__dirname, 'resilient-supply-chain-framework.html'),
                'scres-strategies-resilient-framework': resolve(__dirname, 'scres-strategies-resilient-framework.html'),
                'scres-strategies-redundancy': resolve(__dirname, 'scres-strategies-redundancy.html'),
                'supply-chain-resilience-skills': resolve(__dirname, 'supply-chain-resilience-skills.html'),
                'supply-chain-agility-factors': resolve(__dirname, 'supply-chain-agility-factors.html'),
                'redundancy-vs-agility-automotive': resolve(__dirname, 'redundancy-vs-agility-automotive.html'),
                'automotive-supply-chain-lessons': resolve(__dirname, 'automotive-supply-chain-lessons.html'),
                'digital-supply-chain-risk-management': resolve(__dirname, 'digital-supply-chain-risk-management.html'),
                'cybersecurity-vs-financial-risk': resolve(__dirname, 'cybersecurity-vs-financial-risk.html'),
                'digital-automation-supply-chain': resolve(__dirname, 'digital-automation-supply-chain.html'),
                'real-time-monitoring-supply-chain': resolve(__dirname, 'real-time-monitoring-supply-chain.html'),
                'supply-chain-visibility-signs': resolve(__dirname, 'supply-chain-visibility-signs.html'),
                'information-technology-supply-chain': resolve(__dirname, 'information-technology-supply-chain.html'),
                'collaboration-supply-chain-resilience': resolve(__dirname, 'collaboration-supply-chain-resilience.html'),
                'collaboration-costs-supply-chains': resolve(__dirname, 'collaboration-costs-supply-chains.html'),
                'nearshoring-cross-functional-teams': resolve(__dirname, 'nearshoring-cross-functional-teams.html'),
                'supply-chain-decision-making-framework': resolve(__dirname, 'supply-chain-decision-making-framework.html'),
                'supplier-performance-metrics': resolve(__dirname, 'supplier-performance-metrics.html'),
                'supply-chain-industry-dynamics': resolve(__dirname, 'supply-chain-industry-dynamics.html'),
                'supply-chain-data-literacy-signs': resolve(__dirname, 'supply-chain-data-literacy-signs.html'),
                'supply-chain-data-literacy': resolve(__dirname, 'supply-chain-data-literacy.html'),
                'supply-chain-company-types': resolve(__dirname, 'supply-chain-company-types.html'),
                'supply-chain-job-titles': resolve(__dirname, 'supply-chain-job-titles.html'),
                'supply-chain-job-titles-dead-end': resolve(__dirname, 'supply-chain-job-titles-dead-end.html'),
                'supply-chain-job-search-strategies': resolve(__dirname, 'supply-chain-job-search-strategies.html'),
                'supply-chain-talent-gap': resolve(__dirname, 'supply-chain-talent-gap.html'),
            },

            output: {
                /**
                 * manualChunks — reduces JS file count from ~21 to ~13.
                 *
                 * Content pages previously loaded 4-5 separate JS chunks:
                 *   nav-*.js + particles-lite-*.js + auto-split fragments + page entry
                 * After this change they load 2:
                 *   pages-shared-*.js + page-entry-*.js
                 *
                 * This directly cuts the JS share of Googlebot's crawl budget
                 * per content page from ~5 requests to ~2.
                 */
                manualChunks(id) {
                    const n = normalize(id).replace(/\\/g, '/');

                    // All shared content-page infrastructure → one chunk
                    // (nav, footer, ambient particles — loaded by every blog/article page)
                    if (
                        n.includes('/src/shared/nav') ||
                        n.includes('/src/shared/footer') ||
                        n.includes('/src/shared/particles-lite')
                    ) {
                        return 'pages-shared';
                    }

                    // Large vendor libs — stable named chunks so browsers cache them
                    // across deploys when only the app code changes
                    if (n.includes('node_modules/chart.js') || n.includes('node_modules/chartjs-')) {
                        return 'vendor-charts';
                    }
                    if (n.includes('node_modules/html2canvas')) {
                        return 'vendor-canvas';
                    }
                    if (n.includes('node_modules/dompurify')) {
                        return 'vendor-purify';
                    }
                },
            },
        },
    },

    plugins: [
        /**
         * non-blocking-fonts
         *
         * Converts every render-blocking Google Fonts <link rel="stylesheet"> to a
         * preload + onload pattern so the browser can parse HTML without waiting for
         * the external font CSS network round-trip.
         *
         * Before: <link href="https://fonts.googleapis.com/..." rel="stylesheet">
         * After:  <link rel="preload" as="style" href="..." onload="this.rel='stylesheet'">
         *         <noscript><link rel="stylesheet" href="..."></noscript>
         *
         * Impact: eliminates the Google Fonts render-blocking resource that blocks
         * First Contentful Paint (FCP) and Largest Contentful Paint (LCP) on mobile.
         * Also adds a preconnect hint to fonts.gstatic.com (where the font files live)
         * if not already present, so the TLS handshake is pipelined with the CSS fetch.
         */
        {
            name: 'non-blocking-fonts',
            transformIndexHtml: {
                order: 'pre',
                handler(html) {
                    // Add fonts.gstatic.com preconnect next to the googleapis one
                    html = html.replace(
                        /(<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">)/,
                        '$1\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
                    );
                    // Convert blocking stylesheet to non-blocking preload
                    html = html.replace(
                        /<link href="(https:\/\/fonts\.googleapis\.com[^"]*)" rel="stylesheet">/g,
                        (_, href) =>
                            `<link rel="preload" as="style" href="${href}" onload="this.onload=null;this.rel='stylesheet'">` +
                            `<noscript><link rel="stylesheet" href="${href}"></noscript>`
                    );
                    return html;
                },
            },
        },

        /**
         * inject-static-seo-nav
         *
         * At build time, inserts a <noscript> block containing plain anchor
         * tags for every page on the site into every content HTML file.
         *
         * Why: createNav() and createFooter() both run in JavaScript, meaning
         * Googlebot's Wave 1 (raw HTML) crawl sees ZERO internal links on
         * content pages. This causes PageRank to not flow through nav/footer
         * links until Wave 2 JS rendering — sometimes days later.
         *
         * The <noscript> block is completely invisible to JS-enabled users
         * (i.e. everyone) but is part of the raw HTML that Google reads first.
         *
         * Skips index.html (the game SPA) — its nav is wired differently.
         */
        {
            name: 'inject-static-seo-nav',
            transformIndexHtml: {
                order: 'pre',
                handler(html, ctx) {
                    // Skip the game SPA (play.html) — its nav is wired differently.
                    // index.html is now the static marketing page and DOES need the nav.
                    const isGamePage = ctx.filename && (
                        ctx.filename.endsWith('/play.html') ||
                        ctx.filename.endsWith('\\play.html')
                    );
                    if (isGamePage) return html;
                    return html.replace('<body>', `<body>\n${STATIC_SEO_NAV}`);
                },
            },
        },
    ],
})
