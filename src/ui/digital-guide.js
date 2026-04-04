/**
 * Digital Strategy Guide — personalized PDF generated with jsPDF.
 *
 * Sections:
 *   1. Cover page
 *   2. Executive Summary (stats + mastery overview)
 *   3. Chapter Reports (one per completed chapter)
 *   4. Recommendations & Next Steps
 *
 * Expansion buyers receive chapters 9-10 reports and a closing
 * "Advanced Supply Chain Professional" recognition section.
 */

import { jsPDF } from 'jspdf';
import { CHAPTERS } from '../data/chapters.js';
import { EXPANSION_CHAPTERS } from '../data/expansion-chapters.js';

const INDUSTRY_NAMES = {
    electronics: 'Electronics',
    fmcg:        'FMCG (Consumer Goods)',
    pharma:      'Pharmaceuticals',
};

const GRADES = [
    { min: 90, grade: 'S', title: 'Supply Chain Master',  color: [245, 158,  11] },
    { min: 75, grade: 'A', title: 'Expert Strategist',    color: [ 34, 197,  94] },
    { min: 55, grade: 'B', title: 'Skilled Operator',     color: [ 59, 130, 246] },
    { min: 35, grade: 'C', title: 'Developing Manager',   color: [148, 163, 184] },
    { min: 0,  grade: 'D', title: 'Supply Chain Novice',  color: [239,  68,  68] },
];

const GRADE_INTERPRETATIONS = {
    S: 'Exceptional performance. You consistently chose optimal strategies, minimised risk, and demonstrated mastery of all supply chain concepts. You are prepared for senior supply chain leadership roles.',
    A: 'Strong performance. You showed deep understanding of core supply chain principles with occasional conservative trade-offs. Your risk management approach was sound throughout.',
    B: 'Solid performance. You grasped the fundamentals and made mostly sound decisions. Focusing on the weaker chapters below will elevate your strategic thinking to the next level.',
    C: 'Developing performance. You encountered challenges in several areas. Reviewing each chapter\'s key concepts and replaying will significantly reinforce your decision-making instincts.',
    D: 'Early-stage learning. Supply chain management is complex — every replay sharpens your instincts. Start by mastering one chapter at a time before advancing.',
};

function getGrade(pct) {
    return GRADES.find(g => pct >= g.min) || GRADES[GRADES.length - 1];
}

function fmtMoney(n) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(n);
}

export class DigitalGuide {
    /**
     * Generate and download the personalized strategy guide PDF.
     * @param {object} params
     * @param {string}   params.playerName  - Recipient name
     * @param {object}   params.overall     - { percentage, masteredCount, totalConcepts }
     * @param {object[]} params.summaries   - mastery.getAllSummaries()
     * @param {number}   params.cash        - Final cash
     * @param {string}   params.industry    - 'electronics' | 'fmcg' | 'pharma'
     * @param {boolean}  params.isExpansion - Whether expansion bundle was completed
     */
    static generate({ playerName, overall, summaries, cash, industry, isExpansion }) {
        const doc  = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const grade        = getGrade(overall.percentage);
        const industryName = INDUSTRY_NAMES[industry] || industry;
        const allChapters  = [...CHAPTERS, ...(isExpansion ? EXPANSION_CHAPTERS : [])];

        // Page dimensions / margins
        const W = 210, H = 297, ML = 15, MR = 15, MB = 20;
        const CW = W - ML - MR; // 180 mm

        let pageNum = 0;

        // ── Colour helpers ────────────────────────────────────────────────────
        const rgb  = (arr) => doc.setFillColor(...arr);
        const srgb = (arr) => doc.setDrawColor(...arr);
        const txt  = (arr) => doc.setTextColor(...arr);

        const NAVY   = [15,  23,  42];
        const BLUE   = [59,  130, 246];
        const AMBER  = [245, 158, 11];
        const GREEN  = [34,  197, 94];
        const MUTED  = [148, 163, 184];
        const DARK   = [30,  41,  59];
        const LIGHT  = [248, 250, 252];
        const BODY   = [51,  65,  85];
        const WHITE  = [255, 255, 255];

        // ── Shared header / footer ────────────────────────────────────────────
        const addHeader = () => {
            rgb(NAVY); doc.rect(0, 0, W, 11, 'F');
            doc.setFontSize(7);
            doc.setFont('helvetica', 'normal');
            txt(MUTED);
            doc.text('SUPPLY CHAIN DISASTER', ML, 7.5);
            doc.text(`${playerName}  ·  Personal Strategy Guide`, W - MR, 7.5, { align: 'right' });
        };

        const addFooter = (num) => {
            srgb([226, 232, 240]); doc.setLineWidth(0.3);
            doc.line(ML, H - MB + 4, W - MR, H - MB + 4);
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); txt(MUTED);
            doc.text(`Supply Chain Disaster  ·  Personal Report  ·  ${date}`, ML, H - MB + 9);
            doc.text(`Page ${num}`, W - MR, H - MB + 9, { align: 'right' });
        };

        // ── Page tracker ─────────────────────────────────────────────────────
        const newPage = () => { doc.addPage(); pageNum++; addHeader(); addFooter(pageNum); };
        const guardY  = (y, reserve = 35) => {
            if (y > H - MB - reserve) { newPage(); return 22; }
            return y;
        };

        // ─────────────────────────────────────────────────────────────────────
        // PAGE 1 — COVER
        // ─────────────────────────────────────────────────────────────────────
        pageNum = 1;

        rgb(NAVY); doc.rect(0, 0, W, H, 'F');

        // Blue accent strip
        rgb(BLUE); doc.rect(0, 0, W, 7, 'F');

        // Amber accent line
        rgb(AMBER); doc.rect(ML, 62, 18, 2, 'F');

        // Main title
        doc.setFontSize(30); doc.setFont('helvetica', 'bold'); txt(LIGHT);
        doc.text('Supply Chain', ML, 88);
        doc.text('Strategy Guide', ML, 106);

        doc.setFontSize(14); doc.setFont('helvetica', 'normal'); txt(MUTED);
        doc.text('Personalized Performance Report', ML, 120);

        // Divider
        rgb(BLUE); doc.rect(ML, 128, 78, 0.5, 'F');

        // Player block
        doc.setFontSize(9); txt(MUTED); doc.setFont('helvetica', 'normal');
        doc.text('PREPARED FOR', ML, 143);
        doc.setFontSize(20); doc.setFont('helvetica', 'bold'); txt(AMBER);
        doc.text(playerName, ML, 156);

        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); txt(MUTED);
        doc.text('INDUSTRY', ML, 169);
        doc.setFontSize(12); txt(LIGHT);
        doc.text(industryName, ML, 178);

        doc.setFontSize(9); txt(MUTED);
        doc.text('COMPLETION DATE', ML, 190);
        doc.setFontSize(12); txt(LIGHT);
        doc.text(date, ML, 199);

        // Grade badge (right side)
        const gc = grade.color;
        rgb(gc); doc.circle(W - MR - 24, 168, 22, 'F');
        doc.setFontSize(38); doc.setFont('helvetica', 'bold'); txt(NAVY);
        doc.text(grade.grade, W - MR - 24, 175, { align: 'center' });
        doc.setFontSize(9); doc.setFont('helvetica', 'bold'); txt(LIGHT);
        doc.text(grade.title, W - MR - 24, 198, { align: 'center' });
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); txt(MUTED);
        doc.text(`${overall.percentage}% Mastery`, W - MR - 24, 206, { align: 'center' });

        // Expansion badge
        if (isExpansion) {
            rgb(BLUE);
            doc.roundedRect(ML, 216, 108, 11, 2, 2, 'F');
            doc.setFontSize(8); doc.setFont('helvetica', 'bold'); txt(WHITE);
            doc.text('★  EXPANSION BUNDLE COMPLETE  —  10 CHAPTERS', ML + 54, 223.5, { align: 'center' });
        }

        // Cover footer
        rgb(DARK); doc.rect(0, H - 22, W, 22, 'F');
        doc.setFontSize(8); doc.setFont('helvetica', 'normal'); txt(MUTED);
        doc.text('supplychaindisaster.com', ML, H - 7);
        doc.text(`Page ${pageNum}`, W - MR, H - 7, { align: 'right' });

        // ─────────────────────────────────────────────────────────────────────
        // PAGE 2 — EXECUTIVE SUMMARY
        // ─────────────────────────────────────────────────────────────────────
        newPage();
        let y = 22;

        // Section title
        rgb(BLUE); doc.rect(ML, y, 3, 10, 'F');
        doc.setFontSize(16); doc.setFont('helvetica', 'bold'); txt(DARK);
        doc.text('Executive Summary', ML + 6, y + 8);
        y += 18;

        // Stats grid (2 × 2)
        const statBoxes = [
            { label: 'FINAL CASH',         value: fmtMoney(cash) },
            { label: 'OVERALL MASTERY',     value: `${overall.percentage}%` },
            { label: 'CHAPTERS MASTERED',   value: `${overall.masteredCount} / ${overall.totalConcepts}` },
            { label: 'PERFORMANCE GRADE',   value: `${grade.grade}  —  ${grade.title}` },
        ];
        statBoxes.forEach((s, i) => {
            const col = i % 2, row = Math.floor(i / 2);
            const sx = ML + col * (CW / 2 + 1);
            const sy = y + row * 20;
            rgb(LIGHT); doc.roundedRect(sx, sy, CW / 2 - 1, 17, 2, 2, 'F');
            doc.setFontSize(7); doc.setFont('helvetica', 'normal'); txt(BODY);
            doc.text(s.label, sx + 4, sy + 6);
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); txt(DARK);
            doc.text(s.value, sx + 4, sy + 13.5);
        });
        y += 44;

        // Performance analysis
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); txt(DARK);
        doc.text('Performance Analysis', ML, y);
        y += 7;
        doc.setFontSize(9); doc.setFont('helvetica', 'normal'); txt(BODY);
        const interpLines = doc.splitTextToSize(GRADE_INTERPRETATIONS[grade.grade] || GRADE_INTERPRETATIONS.D, CW);
        doc.text(interpLines, ML, y);
        y += interpLines.length * 4.8 + 10;

        // Mastery overview bars
        doc.setFontSize(11); doc.setFont('helvetica', 'bold'); txt(DARK);
        doc.text('Chapter Mastery Overview', ML, y);
        y += 8;

        summaries.forEach((s) => {
            y = guardY(y, 12);
            const pct   = Math.max(0, Math.min(100, (s.score / s.maxScore) * 100));
            const barW  = (pct / 100) * (CW - 58);
            const label = s.chapterTitle.length > 32
                ? s.chapterTitle.substring(0, 30) + '…'
                : s.chapterTitle;

            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); txt(DARK);
            doc.text(label, ML, y);

            // Track
            rgb([226, 232, 240]); doc.rect(ML + 60, y - 3.5, CW - 60, 5, 'F');
            // Fill
            if (barW > 0) {
                rgb(s.mastered ? GREEN : BLUE);
                doc.rect(ML + 60, y - 3.5, barW, 5, 'F');
            }
            // Score
            doc.setFontSize(7); txt(MUTED);
            doc.text(`${s.score}/${s.maxScore}`, W - MR, y, { align: 'right' });
            y += 9;
        });

        // ─────────────────────────────────────────────────────────────────────
        // PAGES 3+ — CHAPTER REPORTS
        // ─────────────────────────────────────────────────────────────────────
        summaries.forEach((s) => {
            const chData = allChapters.find(c => c.id === s.chapterId);
            if (!chData) return;

            newPage();
            y = 11;

            // Chapter header band
            rgb(NAVY); doc.rect(0, y, W, 22, 'F');

            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); txt(MUTED);
            doc.text(`CHAPTER ${chData.number}`, ML, y + 7);

            const chapTitle = chData.title.length > 52
                ? chData.title.substring(0, 50) + '…'
                : chData.title;
            doc.setFontSize(13); doc.setFont('helvetica', 'bold'); txt(LIGHT);
            doc.text(chapTitle, ML, y + 18);

            // Mastery badge
            const badgeColor = s.mastered ? GREEN : AMBER;
            const badgeLabel = s.mastered ? 'MASTERED' : 'LEARNING';
            rgb(badgeColor);
            doc.roundedRect(W - MR - 28, y + 6, 28, 10, 2, 2, 'F');
            doc.setFontSize(8); doc.setFont('helvetica', 'bold');
            txt(s.mastered ? DARK : DARK);
            doc.text(badgeLabel, W - MR - 14, y + 13, { align: 'center' });

            y = 42;

            // Score bar
            const pct2 = Math.max(0, Math.min(100, (s.score / s.maxScore) * 100));
            doc.setFontSize(9); doc.setFont('helvetica', 'normal'); txt(BODY);
            doc.text(`Mastery Score: ${s.score} / ${s.maxScore}  (${Math.round(pct2)}%)`, ML, y);
            y += 5;
            rgb([226, 232, 240]); doc.rect(ML, y, CW, 4, 'F');
            const bw = (pct2 / 100) * CW;
            if (bw > 0) { rgb(s.mastered ? GREEN : BLUE); doc.rect(ML, y, bw, 4, 'F'); }
            y += 13;

            // Decision breakdown
            doc.setFontSize(9); doc.setFont('helvetica', 'bold'); txt(DARK);
            doc.text('Decision Breakdown', ML, y);
            y += 7;

            [
                { label: 'Optimal',  count: s.decisions.optimal,  color: GREEN },
                { label: 'Cautious', count: s.decisions.cautious, color: AMBER },
                { label: 'Risky',    count: s.decisions.risky,    color: [239, 68, 68] },
            ].forEach((d, di) => {
                const dx = ML + di * 62;
                rgb(LIGHT); doc.roundedRect(dx, y, 58, 14, 2, 2, 'F');
                rgb(d.color); doc.roundedRect(dx, y, 3, 14, 1, 1, 'F');
                doc.setFontSize(11); doc.setFont('helvetica', 'bold'); txt(DARK);
                doc.text(String(d.count), dx + 8, y + 9);
                doc.setFontSize(7); doc.setFont('helvetica', 'normal'); txt(BODY);
                doc.text(d.label, dx + 8, y + 13.5);
            });
            y += 22;

            // Key concepts
            doc.setFontSize(9); doc.setFont('helvetica', 'bold'); txt(DARK);
            doc.text('Key Concepts', ML, y);
            y += 7;

            (chData.keyPoints || []).forEach((kp) => {
                y = guardY(y, 14);
                doc.setFontSize(8); doc.setFont('helvetica', 'normal'); txt(BODY);
                const kpLines = doc.splitTextToSize(`• ${kp}`, CW - 4);
                doc.text(kpLines, ML + 2, y);
                y += kpLines.length * 4.5 + 2;
            });
            y += 6;

            // Industry case study
            const example = chData.realWorldExample && chData.realWorldExample[industry];
            if (example) {
                y = guardY(y, 50);
                doc.setFontSize(9); doc.setFont('helvetica', 'bold'); txt(DARK);
                doc.text(`${industryName} Case Study`, ML, y);
                y += 6;

                const exLines = doc.splitTextToSize(example, CW - 8);
                const boxH    = exLines.length * 4.5 + 10;
                y = guardY(y, boxH + 10);

                rgb([239, 246, 255]); doc.rect(ML, y - 2, CW, boxH, 'F');
                rgb(BLUE);           doc.rect(ML, y - 2, 2.5, boxH, 'F');
                doc.setFontSize(8); doc.setFont('helvetica', 'normal'); txt([30, 64, 175]);
                doc.text(exLines, ML + 6, y + 4);
                y += boxH + 6;
            }
        });

        // ─────────────────────────────────────────────────────────────────────
        // FINAL PAGE — RECOMMENDATIONS
        // ─────────────────────────────────────────────────────────────────────
        newPage();
        y = 22;

        rgb(BLUE); doc.rect(ML, y, 3, 10, 'F');
        doc.setFontSize(16); doc.setFont('helvetica', 'bold'); txt(DARK);
        doc.text('Recommendations & Next Steps', ML + 6, y + 8);
        y += 18;

        const weakChapters   = summaries.filter(s => !s.mastered);
        const strongChapters = summaries.filter(s => s.mastered);

        // Weak chapters
        if (weakChapters.length > 0) {
            doc.setFontSize(10); doc.setFont('helvetica', 'bold'); txt([185, 28, 28]);
            doc.text('Areas to Strengthen', ML, y);
            y += 7;
            weakChapters.forEach((s) => {
                y = guardY(y, 18);
                rgb([254, 242, 242]); doc.roundedRect(ML, y - 2, CW, 14, 2, 2, 'F');
                rgb([239, 68, 68]);   doc.roundedRect(ML, y - 2, 3, 14, 1, 1, 'F');
                doc.setFontSize(8);  doc.setFont('helvetica', 'bold');  txt(DARK);
                doc.text(s.chapterTitle, ML + 6, y + 4.5);
                doc.setFont('helvetica', 'normal'); txt(BODY);
                doc.text(`Score: ${s.score}/100  —  replay this chapter to improve mastery`, ML + 6, y + 10);
                y += 18;
            });
            y += 4;
        }

        // Strong chapters
        if (strongChapters.length > 0) {
            y = guardY(y, 20);
            doc.setFontSize(10); doc.setFont('helvetica', 'bold'); txt([21, 128, 61]);
            doc.text('Your Strongest Areas', ML, y);
            y += 7;
            strongChapters.forEach((s) => {
                y = guardY(y, 14);
                rgb([240, 253, 244]); doc.roundedRect(ML, y - 2, CW, 12, 2, 2, 'F');
                rgb(GREEN);           doc.roundedRect(ML, y - 2, 3, 12, 1, 1, 'F');
                doc.setFontSize(8);  doc.setFont('helvetica', 'bold');  txt(DARK);
                doc.text(`✓  ${s.chapterTitle}`, ML + 6, y + 6.5);
                y += 15;
            });
            y += 6;
        }

        // Continue learning
        y = guardY(y, 30);
        doc.setFontSize(10); doc.setFont('helvetica', 'bold'); txt(DARK);
        doc.text('Continue Learning', ML, y);
        y += 7;
        const tips = [
            'Replay chapters where your score was below 60 to unlock the "Mastered" badge.',
            'Switch industries (Electronics / FMCG / Pharma) to see how the same decisions produce different outcomes.',
            'Pay attention to how story choices affect lead time and customer satisfaction — these cascade across turns.',
        ];
        tips.forEach((tip) => {
            y = guardY(y, 12);
            doc.setFontSize(8); doc.setFont('helvetica', 'normal'); txt(BODY);
            const tLines = doc.splitTextToSize(`• ${tip}`, CW - 4);
            doc.text(tLines, ML + 2, y);
            y += tLines.length * 4.5 + 3;
        });
        y += 6;

        // Expansion closer
        if (isExpansion) {
            y = guardY(y, 42);
            rgb(NAVY); doc.roundedRect(ML, y, CW, 38, 3, 3, 'F');
            rgb(AMBER); doc.rect(ML, y, CW, 2, 'F');
            doc.setFontSize(11); doc.setFont('helvetica', 'bold'); txt(AMBER);
            doc.text('★  Advanced Supply Chain Professional', ML + 8, y + 11);
            doc.setFontSize(8.5); doc.setFont('helvetica', 'normal'); txt(MUTED);
            const closerText =
                'You have completed Global Crisis Management and Multi-Regional Logistics Networks — the ' +
                'frontier of modern supply chain strategy. These capabilities are directly applicable to ' +
                'VP-level and above roles in global enterprises. Well done.';
            const closerLines = doc.splitTextToSize(closerText, CW - 16);
            doc.text(closerLines, ML + 8, y + 20);
        }

        // ── Save ─────────────────────────────────────────────────────────────
        const filename = `scd-strategy-guide-${playerName.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.pdf`;
        doc.save(filename);
    }
}
