// Guards for the 2026-11 blog corrections: worked examples, published code, structured data and
// claims that were removed on purpose. See docs/content-audit/blog-corrections.md.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { parse } from 'node-html-parser';

const read = (f) => readFileSync(f, 'utf8');
const articles = readdirSync('.').filter(f => f.endsWith('.html') && /class="article-header"/.test(read(f)));
const EDITED = [
    'supply-chain-management-game', 'scm-fundamentals-5-pillars', 'bayesian-inference-beats-traditional',
    'stochastic-optimization-supply-chains', 'excel-supply-chain-management', 'scres-strategies-resilient-framework',
    'supply-chain-disruption-simulation', 'best-business-simulation-games', 'digital-automation-supply-chain',
    'real-time-monitoring-supply-chain', 'information-technology-supply-chain',
].map(n => `${n}.html`);
const text = (html) => parse(html).text.replace(/\s+/g, ' ');
// node-html-parser keeps <pre> contents as raw text, so code blocks are extracted with a regex and decoded here
const unescapeHtml = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const codeBlocks = (html) => [...html.matchAll(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/g)]
    .map(m => ({ attrs: m[1], source: (m[1].match(/data-source="([^"]+)"/) || [])[1], code: unescapeHtml(m[2]) }));
const near = (a, b, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${a} vs ${b}`);

test('Bayesian worked example arithmetic (hypothetical inputs)', () => {
    const post = (prior, l1, l0) => (l1 * prior) / (l1 * prior + l0 * (1 - prior));
    const p1 = post(0.10, 0.80, 0.20);
    near(p1, 0.08 / 0.26);
    assert.equal(p1.toFixed(3), '0.308');
    const odds = (p1 / (1 - p1)) * (0.70 / 0.30);
    near(odds, 28 / 27);
    near(odds / (1 + odds), 28 / 55);
    assert.equal((28 / 55).toFixed(3), '0.509');
    assert.equal(post(0.05, 0.80, 0.20).toFixed(3), '0.174');
    near(post(0.20, 0.80, 0.20), 0.5);
});

test('Excel worked examples: exponential smoothing, MAPE, safety stock, fill rate, landed cost', () => {
    // exponential smoothing, alpha 0.3, actuals 100,120,80
    const a = 0.3, A = [100, 120, 80], F = [A[0]];
    for (let i = 1; i < 4; i++) F.push(a * A[i - 1] + (1 - a) * F[i - 1]);
    near(F[1], 100); near(F[2], 106); near(F[3], 98.2, 1e-9);
    // MAPE vs weighted error
    const act = [100, 120, 80], fc = [90, 130, 100];
    const ape = act.map((x, i) => Math.abs(x - fc[i]) / x);
    near(ape.reduce((s, x) => s + x, 0) / 3, (0.1 + 10 / 120 + 0.25) / 3);
    assert.equal((100 * ape.reduce((s, x) => s + x, 0) / 3).toFixed(1), '14.4');
    assert.equal((100 * 40 / 300).toFixed(1), '13.3');
    // safety stock: z for 95%, sigma_LTD, SS, ROP
    const z = 1.6448536269514722, mean = 200, sd = 40, L = 2;
    const sigma = Math.sqrt(L * sd ** 2);
    near(sigma, 56.5685, 1e-3);
    near(z * sigma, 93.05, 0.01);
    near(mean * L + z * sigma, 493.05, 0.01);
    const sigma2 = Math.sqrt(L * sd ** 2 + mean ** 2 * 0.5 ** 2);
    near(sigma2 ** 2, 13200); near(z * sigma2, 188.97, 0.01);
    // fill rate: L(z) = phi(z) - z(1 - Phi(z)); Phi via erf
    const erf = (x) => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
    const phi = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI), Phi = 0.5 * (1 + erf(z / Math.SQRT2));
    const loss = phi - z * (1 - Phi);
    near(loss, 0.0209, 5e-4);
    near(1 - sigma * loss / 400, 0.997, 1e-3);
    // landed cost
    const landed = 10 + 2000 / 1000 + 10 * 0.05 + 10 * 0.005 + 0.30 + 0.20 + 10 * (6 / 52) * 0.08;
    near(landed, 13.142308, 1e-6);
    assert.equal(landed.toFixed(2), '13.14');
});

test('Excel article: complete FORECAST.ETS signature, formula blocks free of comments, no invented anecdotes', () => {
    const html = read('excel-supply-chain-management.html');
    assert.ok(html.includes('FORECAST.ETS(target_date, values, timeline, [seasonality], [data_completion], [aggregation])'));
    const blocks = codeBlocks(html);
    assert.ok(blocks.length >= 10, 'expected the formula blocks to be found');
    for (const b of blocks) assert.ok(!/\/\//.test(b.code), `comment inside a formula block: ${b.code.slice(0, 60)}`);
    assert.ok(!/two-thirds|pharmaceutical distributor|£50,000|"we(?:'|’)ve seen/i.test(html));
    assert.ok(/NORM\.S\.INV/.test(html) && /STDEV\.S/.test(html));
});

test('stochastic article: published code is exactly the tested example files', () => {
    const blocks = codeBlocks(read('stochastic-optimization-supply-chains.html')).filter(b => b.source);
    assert.deepEqual(blocks.map(b => b.source).sort(), ['bayes_inventory.py', 'test_bayes_inventory.py']);
    for (const b of blocks) {
        const file = read(`examples/stochastic-inventory/${b.source}`).replace(/\r\n/g, '\n').replace(/\n$/, '');
        assert.equal(b.code.replace(/\r\n/g, '\n'), file);
    }
    assert.ok(!/gurobipy|_compute_ci|get_order_decision/.test(blocks.map(b => b.code).join('')));
});

test('stochastic example: Python unit tests pass (skipped when Python is unavailable)', (t) => {
    const r = spawnSync('python', ['-m', 'unittest'], { cwd: 'examples/stochastic-inventory', encoding: 'utf8' });
    if (r.error) return t.skip('python not available');
    assert.equal(r.status, 0, r.stderr);
});

test('corrected claims stay corrected', () => {
    const game = text(read('supply-chain-management-game.html'));
    assert.ok(!/Ch\. 1.{0,3}3|Chapters 1.{0,3}3 free|~10%|~70%|half-semester|AI-assisted demand sensing/.test(game));
    assert.ok(/FMCG Chapter 1 free/.test(game) && /\$19\.99/.test(game));
    const pillars = text(read('scm-fundamentals-5-pillars.html'));
    for (const w of ['Orchestrate', 'Transform', 'Fulfill', 'SCOR Digital Standard', 'explanatory']) assert.ok(pillars.includes(w), w);
    const bayes = text(read('bayesian-inference-beats-traditional.html'));
    assert.ok(/Independence is a modelling assumption/.test(bayes));
    assert.ok(read('bayesian-inference-beats-traditional.html').includes('Bayesian Inference for Supply Chain Risk: Uses, Examples and Limitations'));
    for (const f of ['bayesian-inference-supply-chain-risk.html', 'bayesian-inference-vs-traditional.html', 'bayesian-inference-beats-traditional.html']) {
        const s = read(f);
        assert.ok(!/Frequentist methods treat each event as independent/.test(s), f);
        assert.ok(!s.includes('PMC9225871'), `${f} cites a retracted paper`);
    }
    const best = text(read('best-business-simulation-games.html'));
    assert.ok(!/reviewed over 40|0\.41 effect|23% higher/.test(best) && /We publish Supply Chain Disaster/.test(best));
    const scres = text(read('scres-strategies-resilient-framework.html'));
    assert.ok(!/at least 40%|cuts potential recovery time|86\.2%/.test(scres));
});

test('no article claims Supply Chain Disaster is a hazard-intelligence platform', () => {
    for (const f of articles) {
        assert.ok(!/<a href="https:\/\/supplychaindisaster\.com"[^>]*>[^<]*(hazard intelligence|platform)/i.test(read(f)), f);
    }
});

test('no stale free-offer wording or raw Markdown in any article', () => {
    for (const f of articles) {
        const s = read(f);
        assert.ok(!/Chapters 1&ndash;3 free|All 10 chapters always free/.test(s), `${f}: stale offer note`);
        for (const m of s.matchAll(/<meta (?:name|property)="(?:description|og:description|twitter:description)" content="([^"]*)"/g)) {
            assert.ok(!/\*\*|\]\(http/.test(m[1]), `${f}: Markdown in meta description`);
        }
    }
});

test('edited articles: JSON-LD parses, dateModified is the edit date, FAQ questions are visible', () => {
    for (const f of EDITED) {
        const html = read(f);
        const visible = text(html);
        let checked = 0;
        for (const m of html.matchAll(/<script type="application\/ld\+json">\s*([\s\S]*?)<\/script>/g)) {
            const ld = JSON.parse(m[1]);
            if (ld['@type'] !== 'BlogPosting') continue;
            checked++;
            assert.equal(ld.dateModified, '2026-11-08', `${f}: dateModified`);
            for (const q of ld.mainEntity || []) assert.ok(visible.includes(q.name.replace(/&amp;/g, '&')), `${f}: FAQ question not visible: ${q.name}`);
        }
        assert.equal(checked, 1, `${f}: expected one BlogPosting`);
    }
});
