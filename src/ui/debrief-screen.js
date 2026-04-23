/**
 * debrief-screen.js
 *
 * Post-game debrief overlay.  Shows a lightweight in-browser summary and,
 * for premium players, generates a 5-page PDF debrief report via jsPDF +
 * jsPDF-AutoTable.
 *
 * PDF structure
 * ─────────────
 *  Page 1  Cover             — score, industry, grade, date
 *  Page 2  Performance       — 4-stat grid + diagnostic insights
 *  Page 3  Decision Audit    — full quarter-by-quarter autoTable
 *  Page 4  Chapter Breakdown — per-chapter metrics + top crisis
 *  Page 5  Learning Summary  — data-driven narrative + disclaimer
 */

import './debrief-screen.css';
import { jsPDF }    from 'jspdf';
import autoTable    from 'jspdf-autotable';
import { DebriefCollector } from '../game/debrief-collector.js';

// ── Design tokens (mirror digital-guide.js) ──────────────────────────────────
const NAVY   = [15,  23,  42];
const BLUE   = [59,  130, 246];
const AMBER  = [245, 158, 11];
const GREEN  = [34,  197, 94];
const RED    = [239, 68,  68];
const MUTED  = [148, 163, 184];
const DARK   = [30,  41,  59];
const LIGHT  = [248, 250, 252];
const BODY   = [51,  65,  85];
const WHITE  = [255, 255, 255];

const GRADES = [
    { min: 90, grade: 'S', title: 'Supply Chain Master',  color: AMBER },
    { min: 75, grade: 'A', title: 'Expert Strategist',    color: GREEN },
    { min: 55, grade: 'B', title: 'Skilled Operator',     color: BLUE  },
    { min: 35, grade: 'C', title: 'Developing Manager',   color: MUTED },
    { min: 0,  grade: 'D', title: 'Supply Chain Novice',  color: RED   },
];

const INDUSTRY_NAMES = {
    electronics: 'Electronics',
    fmcg:        'FMCG (Consumer Goods)',
    pharma:      'Pharmaceuticals',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getGrade(pct) {
    return GRADES.find(g => pct >= g.min) || GRADES[GRADES.length - 1];
}

function fmtMoney(n) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(n);
}

function fmtPct(n) {
    return (n * 100).toFixed(1) + '%';
}

function avg(arr) {
    if (!arr.length) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

// ── Debrief analytics helpers ─────────────────────────────────────────────────

/**
 * Build 2-3 short diagnostic insights from the debrief report.
 * Returns an array of { icon, headline, detail, accent } objects.
 * accent is an RGB array for the left-border stripe.
 */
function buildInsights(report, overall) {
    const insights = [];
    const quarters = report?.quarters || [];
    const chapters = report?.chapters || [];

    if (!quarters.length) return insights;

    // 1. Bullwhip pattern
    const validBW = chapters.filter(c => c.bullwhipRatio !== null && c.bullwhipRatio > 0);
    if (validBW.length) {
        const meanBW = avg(validBW.map(c => c.bullwhipRatio));
        if (meanBW > 1.5) {
            insights.push({
                icon: '↑↑',
                headline: `Bullwhip amplification detected (avg ratio ${meanBW.toFixed(2)})`,
                detail:   'Your order variance was consistently larger than demand variance. ' +
                          'This is the bullwhip effect in action — small demand signals caused ' +
                          'disproportionately large ordering swings, inflating holding costs and ' +
                          'stockout risk.',
                accent: RED,
            });
        } else if (meanBW <= 1.15) {
            insights.push({
                icon: '✓',
                headline: `Strong demand smoothing (avg bullwhip ${meanBW.toFixed(2)})`,
                detail:   'Your ordering stayed close to actual demand, keeping the bullwhip ' +
                          'effect in check. This reflects disciplined use of demand data rather ' +
                          'than reactive panic-ordering.',
                accent: GREEN,
            });
        }
    }

    // 2. Stockout pattern
    const totalStockouts  = chapters.reduce((s, c) => s + (c.totalStockouts  || 0), 0);
    const totalChapterTurns = chapters.reduce((s, c) => s + (c.decisionsTotal || 0), 0);
    if (totalChapterTurns > 0) {
        const stockoutRate = totalStockouts / totalChapterTurns;
        if (stockoutRate > 0.35) {
            insights.push({
                icon: '⚠',
                headline: `Recurring stockouts in ${totalStockouts} of ${totalChapterTurns} turns`,
                detail:   'Demand repeatedly outstripped available inventory. This typically signals ' +
                          'under-ordering relative to your safety stock target or slow reaction to ' +
                          'demand spikes. Raising your order quantity or safety stock buffer in ' +
                          'volatile chapters would recover significant missed revenue.',
                accent: RED,
            });
        } else if (stockoutRate === 0) {
            insights.push({
                icon: '✓',
                headline: 'Zero stockouts across the full run',
                detail:   'You maintained enough inventory to fulfil every unit of demand in every ' +
                          'turn — a strong signal of proactive safety stock discipline.',
                accent: GREEN,
            });
        }
    }

    // 3. Overordering pattern
    const overOrderTurns = quarters.filter(q => {
        const dev = parseFloat(q.orderDeviation);
        return !isNaN(dev) && dev > 25;
    }).length;
    if (quarters.length > 0 && overOrderTurns / quarters.length > 0.3) {
        insights.push({
            icon: '📦',
            headline: `Overordering in ${overOrderTurns} of ${quarters.length} quarters (>25% above optimal)`,
            detail:   'In more than a third of turns you ordered substantially more than the ' +
                      'order-up-to target, accumulating excess inventory and elevated holding costs. ' +
                      'Tightening order quantities to match demand forecasts plus your safety stock ' +
                      'buffer would materially improve margin.',
            accent: AMBER,
        });
    }

    // 4. Service level
    const allSvc = quarters.map(q => q.serviceLevel).filter(v => typeof v === 'number');
    if (allSvc.length) {
        const meanSvc = avg(allSvc);
        if (meanSvc >= 0.97) {
            insights.push({
                icon: '★',
                headline: `Near-perfect service level (${fmtPct(meanSvc)} average)`,
                detail:   'You fulfilled almost all customer demand across every quarter. ' +
                          'Maintaining this level at lower inventory cost is the next ' +
                          'optimisation frontier.',
                accent: GREEN,
            });
        } else if (meanSvc < 0.80) {
            insights.push({
                icon: '⚠',
                headline: `Low average service level — ${fmtPct(meanSvc)}`,
                detail:   'Across all quarters you fulfilled fewer than 80% of units demanded. ' +
                          'Each unfulfilled unit represents direct revenue loss and compounds ' +
                          'customer satisfaction penalties into the next turn.',
                accent: RED,
            });
        }
    }

    // Cap at 3
    return insights.slice(0, 3);
}

/**
 * Build the Page 5 narrative paragraphs.
 * Returns an array of { heading, body } objects.
 */
function buildNarrative(report, overall, grade, industryName) {
    const paras  = [];
    const qs     = report?.quarters || [];
    const chs    = report?.chapters || [];

    // Opening
    paras.push({
        heading: 'Overall Performance',
        body:    `You completed the ${industryName} simulation with a ${grade.grade} grade ` +
                 `(${overall.percentage}% mastery, ${overall.masteredCount} of ` +
                 `${overall.totalConcepts} chapters mastered). ` +
                 (overall.percentage >= 75
                     ? 'Your strategic decision-making was strong throughout, demonstrating ' +
                       'real command of core supply chain concepts.'
                     : 'Several chapters highlighted areas where sharper procurement and ' +
                       'risk management instincts would improve outcomes significantly.'),
    });

    // Bullwhip
    const validBW = chs.filter(c => c.bullwhipRatio !== null);
    if (validBW.length >= 2) {
        const meanBW = avg(validBW.map(c => c.bullwhipRatio));
        paras.push({
            heading: 'Order Amplification (Bullwhip Effect)',
            body:    meanBW > 1.5
                ? `Your average bullwhip ratio of ${meanBW.toFixed(2)} indicates that your orders ` +
                  `amplified demand signals by ${((meanBW - 1) * 100).toFixed(0)}% on average. ` +
                  `The bullwhip effect occurs when each player in the supply chain overreacts to ` +
                  `demand information, placing orders that swing far wider than actual demand. ` +
                  `Sharing real-time demand data, using consistent order policies, and avoiding ` +
                  `panic-ordering in crisis turns are the primary mitigations.`
                : `Your average bullwhip ratio of ${meanBW.toFixed(2)} shows your ordering ` +
                  `closely tracked demand. Ratios close to 1.0 indicate disciplined, ` +
                  `demand-anchored procurement — one of the core skills tested in this simulation.`,
        });
    }

    // Stockout vs. overstock tension
    const totalSO = chs.reduce((s, c) => s + (c.totalStockouts  || 0), 0);
    const totalOS = chs.reduce((s, c) => s + (c.totalOverstock  || 0), 0);
    const totalTurns = chs.reduce((s, c) => s + (c.decisionsTotal || 0), 0);
    if (totalTurns > 0) {
        paras.push({
            heading: 'Inventory Balance',
            body:    `Across ${totalTurns} procurement turns you experienced ${totalSO} stockout ` +
                     `quarter${totalSO !== 1 ? 's' : ''} and ${totalOS} overstock ` +
                     `quarter${totalOS !== 1 ? 's' : ''}. ` +
                     (totalSO > totalOS
                         ? `The data suggests your safety stock targets were set too low relative to ` +
                           `demand volatility. Each stockout eroded customer satisfaction and generated ` +
                           `a backlog that cascaded into the following turn.`
                         : totalOS > totalSO
                             ? `You erred on the side of excess inventory, which kept stockouts low ` +
                               `but inflated holding costs. Tighter order quantities calibrated against ` +
                               `the demand forecast would recover margin without materially raising ` +
                               `stockout risk.`
                             : `You balanced stockout and overstock risk well — a mark of mature ` +
                               `inventory policy.`),
        });
    }

    // Order accuracy
    if (qs.length) {
        const deviations = qs.map(q => parseFloat(q.orderDeviation)).filter(v => !isNaN(v));
        if (deviations.length) {
            const meanAbsDev = avg(deviations.map(Math.abs));
            paras.push({
                heading: 'Order Accuracy vs. Optimal',
                body:    `The decision audit table shows your orders deviated from the order-up-to ` +
                         `optimum by an average of ${meanAbsDev.toFixed(1)}% in absolute terms. ` +
                         `The optimal order each turn is calculated as: ` +
                         `max(0, demand forecast + safety stock target − current inventory − in-transit pipeline). ` +
                         `Turns where deviation exceeds ±20% are highlighted in the audit table — these ` +
                         `are the highest-leverage moments for improving your results on a replay.`,
            });
        }
    }

    // Crisis resilience
    const crisisCount = (report?.crisisEvents || []).length;
    if (crisisCount > 0) {
        const avgSvcAfterCrisis = qs
            .filter(q => (report.crisisEvents || []).some(c => c.turn === q.quarter))
            .map(q => q.serviceLevel);
        const crisisSvc = avgSvcAfterCrisis.length ? avg(avgSvcAfterCrisis) : null;
        paras.push({
            heading: 'Crisis Resilience',
            body:    `You encountered ${crisisCount} micro-crisis event${crisisCount !== 1 ? 's' : ''} ` +
                     `across the simulation. ` +
                     (crisisSvc !== null
                         ? `Your average service level in crisis-affected turns was ` +
                           `${fmtPct(crisisSvc)}, compared to an overall average across all turns. ` +
                           (crisisSvc >= 0.85
                               ? `This shows solid crisis buffering — your safety stock absorbed the ` +
                                 `disruptions without severe customer impact.`
                               : `Crisis turns measurably degraded your fulfilment rate, suggesting ` +
                                 `your safety stock buffers were too thin to absorb disruption.`)
                         : `Building a safety stock buffer of 1–2 turns of demand is the standard ` +
                           `mitigation for disruption events of this type.`),
        });
    }

    // Disclaimer
    paras.push({
        heading: null,  // no heading — rendered as italic disclaimer
        body:    'This report was generated from your Supply Chain Disaster simulation session. ' +
                 'The optimal decisions shown represent one ideal solution path; multiple valid ' +
                 'strategies exist depending on your industry, risk tolerance, and the specific ' +
                 'crisis conditions encountered.',
    });

    return paras;
}

// ─────────────────────────────────────────────────────────────────────────────
// DebriefScreen class
// ─────────────────────────────────────────────────────────────────────────────

export class DebriefScreen {
    constructor() {
        /** @type {HTMLElement|null} */
        this._overlay = null;
        this._params  = null;
    }

    // ── Public: show ──────────────────────────────────────────────────────────

    /**
     * Render the in-browser debrief overlay.
     *
     * @param {object}   params
     * @param {object}   params.overall      - { percentage, masteredCount, totalConcepts }
     * @param {object[]} params.summaries    - mastery.getAllSummaries()
     * @param {number}   params.cash         - final cash
     * @param {object}   params.industry     - full industry object (needs .metrics.initialCapital)
     * @param {boolean}  params.isExpansion
     * @param {boolean}  params.isPremium
     */
    show(params) {
        this._params = params;

        // Remove any previous overlay
        this._overlay?.remove();

        const { overall, summaries, cash, industry, isExpansion, isPremium } = params;
        const report = DebriefCollector.getFullReport();

        const initialCapital = industry?.metrics?.initialCapital || 500000;
        const financialPct   = Math.min(100, Math.max(0, (cash / (initialCapital * 2)) * 100));
        const blended        = Math.round(0.6 * financialPct + 0.4 * overall.percentage);
        const grade          = getGrade(blended);
        const industryName   = INDUSTRY_NAMES[report?.industry || industry?.id] || 'Unknown';
        const date           = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
        const insights       = buildInsights(report, overall);
        const chapters       = report?.chapters || [];

        const overlay = document.createElement('div');
        overlay.className = 'debrief-overlay';
        overlay.innerHTML = `
            <div class="debrief-modal">
                <!-- ── Header ── -->
                <div class="debrief-header">
                    <div class="debrief-header-left">
                        <span class="debrief-header-eyebrow">POST-GAME</span>
                        <h2 class="debrief-header-title">Performance Debrief</h2>
                        <span class="debrief-header-meta">${industryName} · ${date}</span>
                    </div>
                    <div class="debrief-header-right">
                        ${isPremium ? `
                            <button class="btn-primary debrief-pdf-btn">
                                ↓ Download PDF
                            </button>
                        ` : `
                            <span class="debrief-premium-hint">
                                PDF report — Premium only
                            </span>
                        `}
                        <button class="debrief-close-btn" aria-label="Close">✕</button>
                    </div>
                </div>

                <!-- ── Score band ── -->
                <div class="debrief-score-band">
                    <div class="debrief-score-grade" style="color: rgb(${grade.color.join(',')})">
                        ${grade.grade}
                    </div>
                    <div class="debrief-score-info">
                        <div class="debrief-score-pct">${blended}%</div>
                        <div class="debrief-score-title">${grade.title}</div>
                        <div class="debrief-score-breakdown">
                            Financial ${Math.round(financialPct)}% &nbsp;·&nbsp; Mastery ${overall.percentage}%
                        </div>
                    </div>
                    <div class="debrief-score-stats">
                        <div class="debrief-stat-pill">
                            <span class="dsp-val">${fmtMoney(cash)}</span>
                            <span class="dsp-label">Final Cash</span>
                        </div>
                        <div class="debrief-stat-pill">
                            <span class="dsp-val">${overall.masteredCount}/${overall.totalConcepts}</span>
                            <span class="dsp-label">Mastered</span>
                        </div>
                        <div class="debrief-stat-pill">
                            <span class="dsp-val">${(report?.crisisEvents || []).length}</span>
                            <span class="dsp-label">Crises hit</span>
                        </div>
                        <div class="debrief-stat-pill">
                            <span class="dsp-val">${(report?.quarters || []).length}</span>
                            <span class="dsp-label">Quarters played</span>
                        </div>
                    </div>
                </div>

                <!-- ── Insights ── -->
                ${insights.length ? `
                    <div class="debrief-section">
                        <h3 class="debrief-section-title">Key Insights</h3>
                        <div class="debrief-insights">
                            ${insights.map(ins => `
                                <div class="debrief-insight" style="border-left-color: rgb(${ins.accent.join(',')})">
                                    <div class="debrief-insight-head">
                                        <span class="debrief-insight-icon">${ins.icon}</span>
                                        <strong>${ins.headline}</strong>
                                    </div>
                                    <p class="debrief-insight-body">${ins.detail}</p>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                ` : ''}

                <!-- ── Chapter breakdown ── -->
                ${chapters.length ? `
                    <div class="debrief-section">
                        <h3 class="debrief-section-title">Chapter Breakdown</h3>
                        <div class="debrief-chapter-grid">
                            ${chapters.map(ch => {
                                const pct  = Math.round((ch.finalScore / 100) * 100);
                                const bw   = ch.bullwhipRatio !== null ? ch.bullwhipRatio.toFixed(2) : '—';
                                const top  = ch.crisisEvents?.[0];
                                return `
                                    <div class="debrief-ch-card ${ch.mastered ? 'mastered' : ''}">
                                        <div class="debrief-ch-header">
                                            <span class="debrief-ch-num">Ch ${ch.chapter}</span>
                                            <span class="debrief-ch-title">${ch.chapterTitle}</span>
                                            <span class="debrief-ch-badge ${ch.mastered ? 'badge-mastered' : 'badge-learning'}">
                                                ${ch.mastered ? 'Mastered' : 'Learning'}
                                            </span>
                                        </div>
                                        <div class="debrief-ch-bar-wrap">
                                            <div class="debrief-ch-bar-fill" style="width:${pct}%;background:${ch.mastered ? '#22c55e' : '#3b82f6'}"></div>
                                        </div>
                                        <div class="debrief-ch-metrics">
                                            <span>Svc ${fmtPct(ch.avgServiceLevel)}</span>
                                            <span>Stockouts ${ch.totalStockouts}</span>
                                            <span>Bullwhip ${bw}</span>
                                            <span>ΔCash ${ch.cashDelta >= 0 ? '+' : ''}${fmtMoney(ch.cashDelta)}</span>
                                        </div>
                                        ${top ? `<div class="debrief-ch-crisis">⚡ ${top.name}</div>` : ''}
                                    </div>
                                `;
                            }).join('')}
                        </div>
                    </div>
                ` : ''}

                ${!isPremium ? `
                    <div class="debrief-upsell">
                        <strong>Unlock the full PDF debrief report</strong> — decision audit table,
                        chapter-by-chapter breakdown, and personalised learning narrative.
                        Available with Standard Edition or Expansion Bundle.
                    </div>
                ` : ''}
            </div>
        `;

        document.body.appendChild(overlay);
        this._overlay = overlay;

        // Close button
        overlay.querySelector('.debrief-close-btn').addEventListener('click', () => this.hide());
        overlay.addEventListener('click', e => { if (e.target === overlay) this.hide(); });

        // PDF button (premium only)
        if (isPremium) {
            overlay.querySelector('.debrief-pdf-btn').addEventListener('click', () => {
                this.downloadPDF();
            });
        }
    }

    hide() {
        this._overlay?.remove();
        this._overlay = null;
    }

    // ── Public: downloadPDF ───────────────────────────────────────────────────

    /**
     * Build and download the 5-page PDF debrief report.
     * Only called when isPremium === true (button is not rendered otherwise).
     */
    downloadPDF() {
        const report = DebriefCollector.getFullReport();
        const { overall, summaries, cash, industry, isExpansion } = this._params;

        const industryId     = report?.industry || industry?.id || 'electronics';
        const industryName   = INDUSTRY_NAMES[industryId] || industryId;
        const initialCapital = industry?.metrics?.initialCapital || 500000;
        const financialPct   = Math.min(100, Math.max(0, (cash / (initialCapital * 2)) * 100));
        const blended        = Math.round(0.6 * financialPct + 0.4 * overall.percentage);
        const grade          = getGrade(blended);
        const date           = new Date().toLocaleDateString('en-US', {
            year: 'numeric', month: 'long', day: 'numeric',
        });
        const dateSlug       = new Date().toISOString().slice(0, 10);

        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

        // Page geometry
        const W = 210, H = 297, ML = 15, MR = 15, MB = 20;
        const CW = W - ML - MR;           // 180 mm content width
        let pageNum = 0;

        // ── PDF drawing helpers ───────────────────────────────────────────────
        const rgb  = (c) => doc.setFillColor(...c);
        const srgb = (c) => doc.setDrawColor(...c);
        const txt  = (c) => doc.setTextColor(...c);

        const addHeader = () => {
            rgb(NAVY); doc.rect(0, 0, W, 11, 'F');
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); txt(MUTED);
            doc.text('SUPPLY CHAIN DISASTER', ML, 7.5);
            doc.text(`Debrief Report  ·  ${industryName}  ·  ${date}`, W - MR, 7.5, { align: 'right' });
        };

        const addFooter = (num) => {
            srgb([226, 232, 240]); doc.setLineWidth(0.3);
            doc.line(ML, H - MB + 4, W - MR, H - MB + 4);
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); txt(MUTED);
            doc.text('supplychaindisaster.com  ·  Supply Chain Debrief Report', ML, H - MB + 9);
            doc.text(`Page ${num}`, W - MR, H - MB + 9, { align: 'right' });
        };

        const newPage = () => {
            doc.addPage(); pageNum++;
            addHeader(); addFooter(pageNum);
        };

        // Guard: start a new page if y is too close to the bottom
        const guardY = (y, reserve = 35) => {
            if (y > H - MB - reserve) { newPage(); return 22; }
            return y;
        };

        // Section title with left-accent bar
        const sectionTitle = (y, title) => {
            rgb(BLUE); doc.rect(ML, y, 3, 9, 'F');
            doc.setFontSize(13); doc.setFont('helvetica', 'bold'); txt(DARK);
            doc.text(title, ML + 6, y + 7);
            return y + 16;
        };

        // ─────────────────────────────────────────────────────────────────────
        // PAGE 1 — COVER
        // ─────────────────────────────────────────────────────────────────────
        pageNum = 1;

        // Full navy background
        rgb(NAVY); doc.rect(0, 0, W, H, 'F');

        // Blue top stripe
        rgb(BLUE); doc.rect(0, 0, W, 8, 'F');

        // Amber accent line
        rgb(AMBER); doc.rect(ML, 56, 22, 2, 'F');

        // Title
        doc.setFontSize(28); doc.setFont('helvetica', 'bold'); txt(LIGHT);
        doc.text('Supply Chain', ML, 80);
        doc.text('Debrief Report', ML, 96);

        doc.setFontSize(12); doc.setFont('helvetica', 'normal'); txt(MUTED);
        doc.text('Post-Simulation Performance Analysis', ML, 110);

        // Divider
        rgb(BLUE); doc.rect(ML, 118, 74, 0.5, 'F');

        // Meta block (left column)
        doc.setFontSize(8); txt(MUTED); doc.setFont('helvetica', 'bold');
        doc.text('INDUSTRY',   ML, 133);
        doc.setFontSize(14); txt(LIGHT); doc.setFont('helvetica', 'bold');
        doc.text(industryName, ML, 143);

        doc.setFontSize(8); txt(MUTED); doc.setFont('helvetica', 'bold');
        doc.text('DATE',       ML, 156);
        doc.setFontSize(11); txt(LIGHT); doc.setFont('helvetica', 'normal');
        doc.text(date,         ML, 165);

        doc.setFontSize(8); txt(MUTED); doc.setFont('helvetica', 'bold');
        doc.text('QUARTERS PLAYED', ML, 177);
        doc.setFontSize(11); txt(LIGHT); doc.setFont('helvetica', 'normal');
        doc.text(String((report?.quarters || []).length), ML, 186);

        // Score badge (right column, vertically centred in lower half)
        const [gr, gg, gb] = grade.color;
        rgb(grade.color); doc.circle(W - MR - 26, 158, 24, 'F');
        doc.setFontSize(42); doc.setFont('helvetica', 'bold'); txt(NAVY);
        doc.text(grade.grade, W - MR - 26, 166, { align: 'center' });
        doc.setFontSize(9);  doc.setFont('helvetica', 'bold'); txt(LIGHT);
        doc.text(grade.title, W - MR - 26, 190, { align: 'center' });
        doc.setFontSize(8);  doc.setFont('helvetica', 'normal'); txt(MUTED);
        doc.text(`${blended}% overall`, W - MR - 26, 198, { align: 'center' });

        // Sub-score pills
        const pillY = 207;
        [[`Financial: ${Math.round(financialPct)}%`, ML],
         [`Mastery: ${overall.percentage}%`, ML + 52],
         [`${overall.masteredCount}/${overall.totalConcepts} chapters`, ML + 104]].forEach(([label, px]) => {
            rgb(DARK); doc.roundedRect(px, pillY, 48, 9, 2, 2, 'F');
            doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); txt(MUTED);
            doc.text(label, px + 24, pillY + 6, { align: 'center' });
        });

        // Cover footer
        rgb(DARK); doc.rect(0, H - 18, W, 18, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); txt(MUTED);
        doc.text('Generated by Supply Chain Disaster — supplychaindisaster.com', ML, H - 6);
        doc.text(`Page ${pageNum}`, W - MR, H - 6, { align: 'right' });

        // ─────────────────────────────────────────────────────────────────────
        // PAGE 2 — PERFORMANCE SUMMARY
        // ─────────────────────────────────────────────────────────────────────
        newPage();
        let y = 22;

        y = sectionTitle(y, 'Performance Summary');

        // 2×2 stat grid
        const quarters = report?.quarters || [];
        const chapters = report?.chapters || [];
        const allSvc   = quarters.map(q => q.serviceLevel).filter(v => typeof v === 'number');
        const avgSvc   = allSvc.length ? avg(allSvc) : null;
        const validBW  = chapters.filter(c => c.bullwhipRatio !== null && c.bullwhipRatio > 0);
        const avgBW    = validBW.length ? avg(validBW.map(c => c.bullwhipRatio)) : null;

        const statBoxes = [
            { label: 'FINAL CASH',         value: fmtMoney(cash) },
            { label: 'AVG SERVICE LEVEL',   value: avgSvc !== null ? fmtPct(avgSvc) : '—' },
            { label: 'CONCEPTS MASTERED',   value: `${overall.masteredCount} / ${overall.totalConcepts}` },
            { label: 'AVG BULLWHIP RATIO',  value: avgBW !== null ? avgBW.toFixed(2) : '—' },
        ];

        statBoxes.forEach((s, i) => {
            const col = i % 2;
            const row = Math.floor(i / 2);
            const sx  = ML + col * (CW / 2 + 1);
            const sy  = y + row * 20;
            rgb(LIGHT); doc.roundedRect(sx, sy, CW / 2 - 1, 17, 2, 2, 'F');
            doc.setFontSize(7);  doc.setFont('helvetica', 'normal'); txt(BODY);
            doc.text(s.label, sx + 4, sy + 6);
            doc.setFontSize(12); doc.setFont('helvetica', 'bold'); txt(DARK);
            doc.text(s.value, sx + 4, sy + 13.5);
        });
        y += 44;

        // Diagnostic insights
        const insights = buildInsights(report, overall);
        if (insights.length) {
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); txt(DARK);
            doc.text('Key Insights', ML, y);
            y += 8;

            insights.forEach((ins) => {
                const bodyLines = doc.splitTextToSize(ins.detail, CW - 14);
                const boxH      = bodyLines.length * 4.5 + 14;
                y = guardY(y, boxH + 6);

                rgb(LIGHT); doc.roundedRect(ML, y - 2, CW, boxH, 2, 2, 'F');
                rgb(ins.accent); doc.rect(ML, y - 2, 3, boxH, 'F');

                doc.setFontSize(8); doc.setFont('helvetica', 'bold'); txt(DARK);
                doc.text(`${ins.icon}  ${ins.headline}`, ML + 6, y + 5);

                doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); txt(BODY);
                doc.text(bodyLines, ML + 6, y + 11);
                y += boxH + 5;
            });
        }

        // Chapter mastery bars
        y = guardY(y, 20);
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); txt(DARK);
        doc.text('Chapter Mastery', ML, y);
        y += 8;

        summaries.forEach((s) => {
            y = guardY(y, 11);
            const pct   = Math.max(0, Math.min(100, (s.score / s.maxScore) * 100));
            const barW  = (pct / 100) * (CW - 56);
            const label = s.chapterTitle.length > 34
                ? s.chapterTitle.substring(0, 32) + '…'
                : s.chapterTitle;

            doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); txt(DARK);
            doc.text(label, ML, y);
            rgb([226, 232, 240]); doc.rect(ML + 58, y - 3.5, CW - 60, 5, 'F');
            if (barW > 0) {
                rgb(s.mastered ? GREEN : BLUE);
                doc.rect(ML + 58, y - 3.5, barW, 5, 'F');
            }
            doc.setFontSize(7); txt(MUTED);
            doc.text(`${s.score}/100`, W - MR, y, { align: 'right' });
            y += 9;
        });

        // ─────────────────────────────────────────────────────────────────────
        // PAGE 3 — DECISION AUDIT TABLE
        // ─────────────────────────────────────────────────────────────────────
        newPage();
        y = 22;

        y = sectionTitle(y, 'Decision Audit — All Quarters');

        doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); txt(BODY);
        doc.text(
            'Deviation = (Your Order − Optimal) ÷ Optimal × 100.  ' +
            'Optimal = demand forecast + safety stock − inventory − in-transit.',
            ML, y
        );
        y += 7;

        // Build autoTable rows — colour deviation column
        const tableRows = quarters.map(q => {
            const dev = parseFloat(q.orderDeviation);
            return [
                `Q${q.quarter}`,
                String(q.chapter),
                q.playerOrder.toLocaleString(),
                q.optimalOrder.toLocaleString(),
                q.orderDeviation,
                fmtPct(q.serviceLevel),
                fmtMoney(q.cashPosition),
            ];
        });

        autoTable(doc, {
            startY: y,
            head: [[
                'Quarter', 'Chapter',
                'Your Order', 'Optimal Order', 'Deviation',
                'Svc Level', 'Cash Position',
            ]],
            body: tableRows,
            styles: {
                fontSize:   7,
                cellPadding: 2,
                overflow:   'linebreak',
                font:       'helvetica',
            },
            headStyles: {
                fillColor:  NAVY,
                textColor:  WHITE,
                fontStyle:  'bold',
                fontSize:   7,
            },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            columnStyles: {
                0: { cellWidth: 14, halign: 'center' },   // Quarter
                1: { cellWidth: 16, halign: 'center' },   // Chapter
                2: { cellWidth: 24, halign: 'right'  },   // Your Order
                3: { cellWidth: 27, halign: 'right'  },   // Optimal Order
                4: { cellWidth: 22, halign: 'right'  },   // Deviation
                5: { cellWidth: 22, halign: 'right'  },   // Svc Level
                6: { cellWidth: 'auto', halign: 'right' },// Cash
            },
            didParseCell: (data) => {
                // Colour the deviation column by magnitude
                if (data.column.index === 4 && data.section === 'body') {
                    const val = parseFloat(data.cell.raw);
                    if (!isNaN(val)) {
                        if (Math.abs(val) > 25) {
                            data.cell.styles.textColor = val > 0 ? AMBER : RED;
                            data.cell.styles.fontStyle = 'bold';
                        } else if (Math.abs(val) <= 10) {
                            data.cell.styles.textColor = GREEN;
                        }
                    }
                }
                // Colour service level column
                if (data.column.index === 5 && data.section === 'body') {
                    const raw = data.cell.raw;
                    const val = parseFloat(raw);
                    if (!isNaN(val)) {
                        if (val >= 97)       data.cell.styles.textColor = GREEN;
                        else if (val < 80)   data.cell.styles.textColor = RED;
                    }
                }
            },
            didDrawPage: () => { addHeader(); addFooter(++pageNum); },
            margin: { left: ML, right: MR, top: 14, bottom: MB + 4 },
        });

        // ─────────────────────────────────────────────────────────────────────
        // PAGE 4 — CHAPTER BREAKDOWN
        // ─────────────────────────────────────────────────────────────────────
        newPage();
        y = 22;

        y = sectionTitle(y, 'Chapter Breakdown');

        if (!chapters.length) {
            doc.setFontSize(9); txt(MUTED);
            doc.text('No chapter data recorded.', ML, y);
        }

        chapters.forEach((ch, ci) => {
            // Estimate block height: header + bar + metrics + possible crisis
            const topCrisis = ch.crisisEvents?.[0] || null;
            const blockH = topCrisis ? 52 : 44;
            y = guardY(y, blockH + 8);

            // Chapter header strip
            rgb(DARK); doc.roundedRect(ML, y, CW, 12, 2, 2, 'F');
            doc.setFontSize(8);  doc.setFont('helvetica', 'normal'); txt(MUTED);
            doc.text(`CHAPTER ${ch.chapter}`, ML + 4, y + 5);
            doc.setFontSize(10); doc.setFont('helvetica', 'bold'); txt(LIGHT);
            doc.text(ch.chapterTitle, ML + 28, y + 8.5);

            // Mastery badge
            const bColor = ch.mastered ? GREEN : AMBER;
            rgb(bColor);
            doc.roundedRect(W - MR - 24, y + 1, 24, 10, 2, 2, 'F');
            doc.setFontSize(7); doc.setFont('helvetica', 'bold'); txt(DARK);
            doc.text(ch.mastered ? 'MASTERED' : 'LEARNING', W - MR - 12, y + 7.5, { align: 'center' });

            y += 16;

            // Score progress bar
            const pct = Math.round((ch.finalScore / 100) * 100);
            doc.setFontSize(7.5); doc.setFont('helvetica', 'normal'); txt(BODY);
            doc.text(`Mastery: ${ch.finalScore}/100 (${pct}%)`, ML, y);
            rgb([226, 232, 240]); doc.rect(ML + 52, y - 3.5, CW - 54, 4.5, 'F');
            if (pct > 0) {
                rgb(ch.mastered ? GREEN : BLUE);
                doc.rect(ML + 52, y - 3.5, ((pct / 100) * (CW - 54)), 4.5, 'F');
            }
            y += 9;

            // Metrics row — 4 pills
            const metrics = [
                { label: 'Avg Svc Level', value: fmtPct(ch.avgServiceLevel) },
                { label: 'Stockouts',     value: String(ch.totalStockouts)   },
                { label: 'Bullwhip',      value: ch.bullwhipRatio !== null ? ch.bullwhipRatio.toFixed(2) : '—' },
                { label: 'Cash Δ',        value: (ch.cashDelta >= 0 ? '+' : '') + fmtMoney(ch.cashDelta) },
            ];
            const pillW = (CW - 6) / 4;
            metrics.forEach((m, mi) => {
                const px = ML + mi * (pillW + 2);
                rgb(LIGHT); doc.roundedRect(px, y - 1, pillW, 12, 1.5, 1.5, 'F');
                doc.setFontSize(6.5); doc.setFont('helvetica', 'normal'); txt(MUTED);
                doc.text(m.label, px + pillW / 2, y + 3.5, { align: 'center' });
                doc.setFontSize(8.5); doc.setFont('helvetica', 'bold'); txt(DARK);
                doc.text(m.value, px + pillW / 2, y + 9.5, { align: 'center' });
            });
            y += 16;

            // Decision breakdown chips
            const decs = [
                { label: 'Optimal',  n: ch.decisionsOptimal,  c: GREEN },
                { label: 'Cautious', n: ch.decisionsCautious, c: AMBER },
                { label: 'Risky',    n: ch.decisionsRisky,    c: RED   },
            ];
            decs.forEach((d, di) => {
                const chipX = ML + di * 34;
                rgb(d.c);
                doc.setFontSize(7); doc.setFont('helvetica', 'normal'); txt(WHITE);
                const chipLabel = `${d.label}: ${d.n}`;
                doc.roundedRect(chipX, y - 1, 30, 7, 1, 1, 'F');
                doc.text(chipLabel, chipX + 15, y + 4, { align: 'center' });
            });
            y += 11;

            // Top crisis (if any)
            if (topCrisis) {
                rgb([30, 41, 59]); doc.roundedRect(ML, y - 1, CW, 9, 1.5, 1.5, 'F');
                doc.setFontSize(7); doc.setFont('helvetica', 'bold'); txt(AMBER);
                doc.text('⚡', ML + 3, y + 5.5);
                doc.setFont('helvetica', 'normal'); txt(MUTED);
                const crisisLine = `${topCrisis.name}  (Turn ${topCrisis.turn}  ·  ${topCrisis.severity})`;
                doc.text(crisisLine, ML + 9, y + 5.5);
                y += 13;
            }

            y += 6; // inter-chapter gap
        });

        // ─────────────────────────────────────────────────────────────────────
        // PAGE 5 — LEARNING SUMMARY
        // ─────────────────────────────────────────────────────────────────────
        newPage();
        y = 22;

        y = sectionTitle(y, 'What This Means — Learning Summary');

        const narrative = buildNarrative(report, overall, grade, industryName);

        narrative.forEach((para, pi) => {
            const isDisclaimer = para.heading === null;

            y = guardY(y, isDisclaimer ? 24 : 32);

            if (!isDisclaimer && para.heading) {
                doc.setFontSize(9.5); doc.setFont('helvetica', 'bold'); txt(DARK);
                doc.text(para.heading, ML, y);
                y += 6;
            }

            const bodyLines = doc.splitTextToSize(para.body, isDisclaimer ? CW - 8 : CW);

            if (isDisclaimer) {
                // Render as a muted italic disclaimer block
                const boxH = bodyLines.length * 4.5 + 8;
                y = guardY(y, boxH + 6);
                rgb([241, 245, 249]); doc.roundedRect(ML, y - 2, CW, boxH, 2, 2, 'F');
                srgb([226, 232, 240]); doc.setLineWidth(0.3);
                doc.roundedRect(ML, y - 2, CW, boxH, 2, 2, 'S');
                doc.setFontSize(7); doc.setFont('helvetica', 'italic'); txt(MUTED);
                doc.text(bodyLines, ML + 4, y + 4);
                y += boxH + 6;
            } else {
                doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); txt(BODY);
                doc.text(bodyLines, ML, y);
                y += bodyLines.length * 4.8 + 8;
            }
        });

        // ── Save ──────────────────────────────────────────────────────────────
        const filename = `supply-chain-debrief-${industryId}-${dateSlug}.pdf`;
        doc.save(filename);
    }
}
