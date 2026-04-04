/**
 * Enhanced game over screen with performance grade, radial progress ring,
 * staggered mastery bars, and final stats.
 */
import { getIcon } from '../graphics/svg-icons.js';
import { CertificateGenerator } from './certificate.js';
import { DigitalGuide } from './digital-guide.js';

const GRADES = [
    { min: 90, grade: 'S', title: 'Supply Chain Master',  color: '#f59e0b' },
    { min: 75, grade: 'A', title: 'Expert Strategist',    color: '#22c55e' },
    { min: 55, grade: 'B', title: 'Skilled Operator',     color: '#3b82f6' },
    { min: 35, grade: 'C', title: 'Developing Manager',   color: '#94a3b8' },
    { min: 0,  grade: 'D', title: 'Supply Chain Novice',  color: '#ef4444' },
];

function getGrade(percentage) {
    return GRADES.find(g => percentage >= g.min) || GRADES[GRADES.length - 1];
}

function fmtMoney(n) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n);
}

export class GameOverScreen {
    /**
     * @param {HTMLElement} modalEl - The #game-over-modal element
     */
    constructor(modalEl) {
        this.modal = modalEl;
    }

    /**
     * Show the enhanced game over screen.
     * @param {object} params
     * @param {number}   params.cash         - Final cash
     * @param {object}   params.overall      - { totalScore, maxTotal, percentage, masteredCount, totalConcepts }
     * @param {object[]} params.summaries    - Array from mastery.getAllSummaries()
     * @param {string}   params.industry     - 'electronics' | 'fmcg' | 'pharma'
     * @param {boolean}  params.isExpansion  - Whether expansion tier is active
     */
    show({ cash, overall, summaries, industry = 'electronics', isExpansion = false }) {
        // Option 8: Blended score = 60% financial + 40% mastery
        const initialCapital = (typeof industry === 'object' ? industry?.metrics?.initialCapital : null) || 500000;
        const financialPct = Math.min(100, Math.max(0, (cash / (initialCapital * 2)) * 100));
        const blendedScore = Math.round(0.6 * financialPct + 0.4 * overall.percentage);
        const grade = getGrade(blendedScore);
        const content = this.modal.querySelector('.modal-content');

        // Find best chapter
        const bestChapter = summaries.reduce((best, s) =>
            (s.score / s.maxScore) > (best.score / best.maxScore) ? s : best
        , summaries[0]);

        content.innerHTML = `
            <div class="gameover-screen">
                <div class="gameover-header">
                    <div class="gameover-trophy">${getIcon('trophy', 40)}</div>
                    <h2>Simulation Complete</h2>
                </div>

                <div class="gameover-grade-section">
                    <canvas id="grade-ring" width="130" height="130"></canvas>
                    <div class="gameover-grade-info">
                        <div class="gameover-grade-letter" style="color: ${grade.color}">${grade.grade}</div>
                        <div class="gameover-grade-title">${grade.title}</div>
                        <div class="gameover-grade-pct">${blendedScore}% Overall</div>
                        <div class="gameover-grade-breakdown">
                            <span>Financial: ${Math.round(financialPct)}%</span>
                            <span class="gameover-grade-sep">·</span>
                            <span>Mastery: ${overall.percentage}%</span>
                        </div>
                    </div>
                </div>

                <div class="gameover-stats-row">
                    <div class="gameover-stat">
                        <span class="gameover-stat-value">${fmtMoney(cash)}</span>
                        <span class="gameover-stat-label">Final Cash</span>
                    </div>
                    <div class="gameover-stat">
                        <span class="gameover-stat-value">${overall.masteredCount}/${overall.totalConcepts}</span>
                        <span class="gameover-stat-label">Concepts Mastered</span>
                    </div>
                    <div class="gameover-stat">
                        <span class="gameover-stat-value">${bestChapter.chapterTitle.split('&')[0].trim()}</span>
                        <span class="gameover-stat-label">Best Chapter</span>
                    </div>
                </div>

                <div class="gameover-mastery-section">
                    <h3>Chapter Mastery</h3>
                    <div class="gameover-mastery-list">
                        ${summaries.map((s, i) => {
                            const pct = Math.max(0, Math.min(100, (s.score / s.maxScore) * 100));
                            return `
                                <div class="gameover-mastery-row" style="animation-delay: ${i * 0.1}s">
                                    <span class="gameover-ch-name">${s.chapterTitle}</span>
                                    <div class="gameover-bar-track">
                                        <div class="gameover-bar-fill" style="--target-width: ${pct}%"></div>
                                    </div>
                                    <span class="mastery-badge ${s.mastered ? 'mastered' : 'learning'}">
                                        ${s.mastered ? 'Mastered' : 'Learning'}
                                    </span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>

                <div class="gameover-actions">
                    <button class="btn-primary btn-glow gameover-play-again" onclick="location.reload()">Play Again</button>
                    <button class="btn-secondary gameover-cert-btn">Certificate</button>
                    <button class="btn-secondary gameover-guide-btn">Strategy Guide</button>
                </div>
            </div>
        `;

        this.modal.classList.remove('hidden');

        // Draw radial ring after DOM updates (animate to blended score)
        requestAnimationFrame(() => {
            this._drawRing(blendedScore, grade.color);
        });

        // Certificate button
        this.modal.querySelector('.gameover-cert-btn').addEventListener('click', () => {
            CertificateGenerator.show({ overall, cash, industry, isExpansion });
        });

        // Strategy Guide button — prompts for name first, then generates PDF
        this.modal.querySelector('.gameover-guide-btn').addEventListener('click', () => {
            const playerName = prompt('Enter your name for the strategy guide:')?.trim();
            if (!playerName) return;
            DigitalGuide.generate({ playerName, overall, summaries, cash, industry, isExpansion });
        });
    }

    _drawRing(percentage, color) {
        const canvas = document.getElementById('grade-ring');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const cx = 65, cy = 65, radius = 55, lineWidth = 8;

        const targetAngle = (percentage / 100) * Math.PI * 2;
        const duration = 1200;
        const start = performance.now();

        const draw = (now) => {
            const elapsed = now - start;
            const progress = Math.min(elapsed / duration, 1);
            // easeOutCubic
            const eased = 1 - Math.pow(1 - progress, 3);
            const currentAngle = targetAngle * eased;

            ctx.clearRect(0, 0, 130, 130);

            // Background ring
            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
            ctx.lineWidth = lineWidth;
            ctx.stroke();

            // Progress ring
            ctx.beginPath();
            ctx.arc(cx, cy, radius, -Math.PI / 2, -Math.PI / 2 + currentAngle);
            ctx.strokeStyle = color;
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();

            if (progress < 1) {
                requestAnimationFrame(draw);
            }
        };

        requestAnimationFrame(draw);
    }
}
