/**
 * Certificate of Completion — canvas-rendered PNG.
 *
 * Shows a name-prompt overlay, then renders an 800×560 certificate
 * on a high-DPI canvas. Player can download as PNG.
 */

const GRADES = [
    { min: 90, grade: 'S', title: 'Supply Chain Master',  color: '#f59e0b' },
    { min: 75, grade: 'A', title: 'Expert Strategist',    color: '#22c55e' },
    { min: 55, grade: 'B', title: 'Skilled Operator',     color: '#3b82f6' },
    { min: 35, grade: 'C', title: 'Developing Manager',   color: '#94a3b8' },
    { min: 0,  grade: 'D', title: 'Supply Chain Novice',  color: '#ef4444' },
];

const INDUSTRY_NAMES = {
    electronics: 'Electronics',
    fmcg:        'Consumer Goods',
    pharma:      'Pharmaceuticals',
};

function getGrade(pct) {
    return GRADES.find(g => pct >= g.min) || GRADES[GRADES.length - 1];
}

function hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
}

function fmtMoney(n) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(n);
}

export class CertificateGenerator {
    /**
     * @param {object} params
     * @param {object}   params.overall     - { percentage, masteredCount, totalConcepts }
     * @param {number}   params.cash        - Final cash
     * @param {string}   params.industry    - 'electronics' | 'fmcg' | 'pharma'
     * @param {boolean}  params.isExpansion - Whether expansion bundle was completed
     */
    static show({ overall, cash, industry, isExpansion }) {
        const overlay = document.createElement('div');
        overlay.className = 'cert-overlay';
        overlay.innerHTML = `
            <div class="cert-modal glass-panel">
                <button class="cert-close-btn" aria-label="Close">✕</button>

                <div class="cert-name-prompt" id="cert-name-prompt">
                    <div class="cert-prompt-icon">🏆</div>
                    <h3>Your Certificate of Completion</h3>
                    <p>Enter your name as you'd like it to appear on the certificate.</p>
                    <input
                        type="text"
                        id="cert-name-input"
                        class="cert-name-input"
                        placeholder="Your Name"
                        maxlength="40"
                        autocomplete="name"
                    />
                    <div class="cert-prompt-actions">
                        <button class="btn-primary cert-generate-btn">Generate Certificate</button>
                    </div>
                </div>

                <div class="cert-preview hidden" id="cert-preview">
                    <canvas id="cert-canvas"></canvas>
                    <div class="cert-preview-actions">
                        <button class="btn-secondary cert-back-btn">← Enter Different Name</button>
                        <button class="btn-primary cert-download-btn">⬇ Download PNG</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        requestAnimationFrame(() => overlay.classList.add('visible'));

        const nameInput    = overlay.querySelector('#cert-name-input');
        const promptEl     = overlay.querySelector('#cert-name-prompt');
        const previewEl    = overlay.querySelector('#cert-preview');
        const generateBtn  = overlay.querySelector('.cert-generate-btn');
        const backBtn      = overlay.querySelector('.cert-back-btn');
        const downloadBtn  = overlay.querySelector('.cert-download-btn');
        const closeBtn     = overlay.querySelector('.cert-close-btn');

        nameInput.focus();

        const close = () => {
            overlay.classList.remove('visible');
            overlay.addEventListener('transitionend', () => overlay.remove(), { once: true });
        };

        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });

        const generate = () => {
            const name = nameInput.value.trim() || 'Anonymous';
            promptEl.classList.add('hidden');
            previewEl.classList.remove('hidden');
            CertificateGenerator._render({
                name, overall, cash, industry, isExpansion,
                canvas: overlay.querySelector('#cert-canvas'),
            });
        };

        generateBtn.addEventListener('click', generate);
        nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') generate(); });

        backBtn.addEventListener('click', () => {
            previewEl.classList.add('hidden');
            promptEl.classList.remove('hidden');
            nameInput.focus();
        });

        downloadBtn.addEventListener('click', () => {
            const canvas = overlay.querySelector('#cert-canvas');
            const name   = nameInput.value.trim() || 'anonymous';
            const link   = document.createElement('a');
            link.download = `scd-certificate-${name.toLowerCase().replace(/\s+/g, '-')}.png`;
            link.href     = canvas.toDataURL('image/png');
            link.click();
        });
    }

    static _render({ name, overall, cash, industry, isExpansion, canvas }) {
        const W = 800, H = 560;
        const DPR = Math.min(window.devicePixelRatio || 1, 2);

        canvas.width  = W * DPR;
        canvas.height = H * DPR;
        canvas.style.width  = `${W}px`;
        canvas.style.height = `${H}px`;

        const ctx = canvas.getContext('2d');
        ctx.scale(DPR, DPR);

        const grade = getGrade(overall.percentage);
        const [gr, gg, gb] = hexToRgb(grade.color);
        const industryName  = INDUSTRY_NAMES[industry] || industry;

        // ── Background ───────────────────────────────────────────────────────
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, W, H);

        // Subtle radial gradient overlay
        const radial = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W * 0.6);
        radial.addColorStop(0, `rgba(${gr},${gg},${gb},0.06)`);
        radial.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = radial;
        ctx.fillRect(0, 0, W, H);

        // ── Borders ──────────────────────────────────────────────────────────
        ctx.strokeStyle = grade.color;
        ctx.lineWidth = 2.5;
        ctx.strokeRect(6, 6, W - 12, H - 12);

        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        ctx.strokeRect(13, 13, W - 26, H - 26);

        // Grade-color top accent bar
        ctx.fillStyle = grade.color;
        ctx.fillRect(6, 6, W - 12, 4);

        // ── Corner diamonds ──────────────────────────────────────────────────
        const drawDiamond = (cx, cy, size) => {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(Math.PI / 4);
            ctx.fillStyle = grade.color;
            ctx.globalAlpha = 0.6;
            ctx.fillRect(-size / 2, -size / 2, size, size);
            ctx.globalAlpha = 1;
            ctx.restore();
        };
        drawDiamond(25, 25, 8);
        drawDiamond(W - 25, 25, 8);
        drawDiamond(25, H - 25, 8);
        drawDiamond(W - 25, H - 25, 8);

        // ── Header section ───────────────────────────────────────────────────
        ctx.textAlign = 'center';

        ctx.font = 'bold 11px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.letterSpacing = '0.15em';
        ctx.fillText('CERTIFICATE OF COMPLETION', W / 2, 52);
        ctx.letterSpacing = '0';

        // Decorative bar under header text
        ctx.fillStyle = grade.color;
        ctx.fillRect(W / 2 - 50, 60, 100, 2);

        ctx.font = '10px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#475569';
        ctx.fillText('Supply Chain Disaster  ·  Strategy Simulation', W / 2, 78);

        // ── Divider ──────────────────────────────────────────────────────────
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, 90);
        ctx.lineTo(W - 40, 90);
        ctx.stroke();

        // ── Recipient section ────────────────────────────────────────────────
        ctx.font = '11px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('This certifies that', W / 2, 118);

        ctx.font = 'bold 30px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#f59e0b';
        ctx.fillText(name, W / 2, 158);

        ctx.font = '11px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('has successfully completed', W / 2, 182);

        ctx.font = 'bold 18px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#f8fafc';
        ctx.fillText(isExpansion ? 'Supply Chain Disaster — All 10 Chapters' : 'Supply Chain Disaster', W / 2, 208);

        // ── Grade badge (left) + info (right) ───────────────────────────────
        const badgeCx = 220, badgeCy = 285, badgeR = 42;

        // Badge outer ring
        ctx.beginPath();
        ctx.arc(badgeCx, badgeCy, badgeR + 4, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${gr},${gg},${gb},0.3)`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Badge fill
        ctx.beginPath();
        ctx.arc(badgeCx, badgeCy, badgeR, 0, Math.PI * 2);
        ctx.fillStyle = grade.color;
        ctx.fill();

        // Grade letter
        ctx.font = 'bold 44px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(grade.grade, badgeCx, badgeCy + 1);
        ctx.textBaseline = 'alphabetic';

        // Grade info (right of badge)
        const infoX = 310;
        ctx.textAlign = 'left';

        ctx.font = '10px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#64748b';
        ctx.fillText('PERFORMANCE GRADE', infoX, 258);

        ctx.font = 'bold 20px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = grade.color;
        ctx.fillText(grade.title, infoX, 282);

        ctx.font = '12px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(`${overall.percentage}% Overall Mastery`, infoX, 302);

        ctx.fillStyle = '#475569';
        ctx.font = '11px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillText(`${overall.masteredCount} of ${overall.totalConcepts} chapters mastered`, infoX, 322);

        // ── Divider ──────────────────────────────────────────────────────────
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, 345);
        ctx.lineTo(W - 40, 345);
        ctx.stroke();

        // ── Stats row ────────────────────────────────────────────────────────
        const stats = [
            { label: 'FINAL CASH',        value: fmtMoney(cash) },
            { label: 'INDUSTRY',           value: industryName },
            { label: 'DATE COMPLETED',     value: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) },
        ];

        stats.forEach((s, i) => {
            const sx = 80 + i * 220;
            ctx.textAlign = 'center';

            ctx.font = 'bold 14px "Inter", "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#f8fafc';
            ctx.fillText(s.value, sx + 60, 382);

            ctx.font = '9px "Inter", "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#475569';
            ctx.fillText(s.label, sx + 60, 398);
        });

        // ── Expansion badge ──────────────────────────────────────────────────
        if (isExpansion) {
            ctx.textAlign = 'center';
            const badgeW = 320, badgeH = 24, bx = (W - badgeW) / 2, by = 418;

            ctx.fillStyle = `rgba(${gr},${gg},${gb},0.15)`;
            roundRect(ctx, bx, by, badgeW, badgeH, 4);
            ctx.fill();
            ctx.strokeStyle = `rgba(${gr},${gg},${gb},0.4)`;
            ctx.lineWidth = 1;
            roundRect(ctx, bx, by, badgeW, badgeH, 4);
            ctx.stroke();

            ctx.font = 'bold 9px "Inter", "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = grade.color;
            ctx.fillText('★  EXPANSION BUNDLE COMPLETE  —  ALL 10 CHAPTERS  ★', W / 2, by + 15.5);
        }

        // ── Bottom divider & footer ───────────────────────────────────────────
        const footerY = isExpansion ? 455 : 428;

        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(40, footerY);
        ctx.lineTo(W - 40, footerY);
        ctx.stroke();

        ctx.font = '9px "Inter", "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#334155';
        ctx.textAlign = 'left';
        ctx.fillText('Issued by Supply Chain Disaster', 40, footerY + 22);
        ctx.textAlign = 'right';
        ctx.fillText('supplychaindisaster.com', W - 40, footerY + 22);
    }
}

/** Canvas helper: rounded rectangle path. */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
}
