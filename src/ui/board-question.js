/**
 * BoardQuestion — diegetic spaced-retrieval quiz shown at chapter start.
 *
 * A board member asks one question about a concept from an EARLIER chapter.
 * Correct answer earns a board-confidence cash bonus; a wrong answer costs
 * nothing but shows the explanation. Either way the concept gets retrieved,
 * which is what makes it stick.
 */

const fmtMoney = (n) =>
    new Intl.NumberFormat('en-US', {
        style: 'currency', currency: 'USD', maximumFractionDigits: 0,
    }).format(n);

export class BoardQuestion {
    constructor() {
        this.overlay = null;
    }

    /**
     * @param {Object}   opts
     * @param {Object}   opts.question      — entry from RECALL_QUESTIONS
     * @param {number}   opts.chapterNumber — chapter about to start
     * @param {number}   opts.bonus         — cash bonus for a correct answer
     * @param {Function} opts.onDone        — receives (correct: boolean)
     */
    show({ question, chapterNumber, bonus, onDone }) {
        this._answered = false;
        const q = question;

        this.overlay = document.createElement('div');
        this.overlay.className = 'bq-overlay';
        this.overlay.innerHTML = `
            <div class="bq-card glass-panel">
                <div class="bq-header">
                    <div class="bq-eyebrow">■ BOARD MEETING — BEFORE CHAPTER ${chapterNumber}</div>
                    <div class="bq-asker">The <strong>${q.asker}</strong> turns to you:</div>
                    <h3 class="bq-question">&ldquo;${q.question}&rdquo;</h3>
                </div>
                <div class="bq-options">
                    ${q.options.map((opt, i) => `
                        <button class="bq-option" data-index="${i}">
                            <span class="bq-option-key">${String.fromCharCode(65 + i)}</span>
                            <span class="bq-option-text">${opt}</span>
                        </button>
                    `).join('')}
                </div>
                <div class="bq-feedback hidden">
                    <div class="bq-feedback-verdict"></div>
                    <p class="bq-feedback-explanation">${q.explanation}</p>
                    <div class="bq-feedback-concept">📘 ${q.concept}</div>
                    <button class="btn-primary bq-continue-btn">Enter Chapter ${chapterNumber} &rarr;</button>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('bq-overlay--visible'));

        const feedbackEl = this.overlay.querySelector('.bq-feedback');
        const verdictEl  = this.overlay.querySelector('.bq-feedback-verdict');

        this.overlay.querySelectorAll('.bq-option').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this._answered) return;
                this._answered = true;

                const picked  = parseInt(btn.dataset.index, 10);
                const correct = picked === q.correctIndex;

                // Lock options and paint verdict colours
                this.overlay.querySelectorAll('.bq-option').forEach(b => {
                    const idx = parseInt(b.dataset.index, 10);
                    b.disabled = true;
                    if (idx === q.correctIndex) b.classList.add('bq-option--correct');
                    else if (idx === picked)    b.classList.add('bq-option--wrong');
                    else                        b.classList.add('bq-option--muted');
                });

                verdictEl.innerHTML = correct
                    ? `<span class="bq-verdict bq-verdict--good">✓ The board nods. Confidence bonus: <strong>+${fmtMoney(bonus)}</strong></span>`
                    : `<span class="bq-verdict bq-verdict--bad">✗ A few raised eyebrows around the table. No penalty — but remember this one.</span>`;
                feedbackEl.classList.remove('hidden');

                this._correct = correct;
            });
        });

        this.overlay.querySelector('.bq-continue-btn')
            .addEventListener('click', () => {
                this._hide();
                onDone(Boolean(this._correct));
            });
    }

    _hide() {
        if (!this.overlay) return;
        const el = this.overlay;
        this.overlay = null;
        el.classList.remove('bq-overlay--visible');
        setTimeout(() => el.remove(), 250);
    }
}
