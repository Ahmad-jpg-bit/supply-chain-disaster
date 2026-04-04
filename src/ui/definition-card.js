import { CSCP_DEFINITIONS } from '../data/cscp-definitions.js';

const DOMAIN_COLORS = {
    SCD:   { bg: 'rgba(251,146,60,0.10)', border: 'rgba(251,146,60,0.35)', text: '#fb923c' },
    SCPE:  { bg: 'rgba(79,172,254,0.10)', border: 'rgba(79,172,254,0.35)', text: '#4facfe' },
    SCIBP: { bg: 'rgba(52,211,153,0.10)', border: 'rgba(52,211,153,0.35)', text: '#34d399' },
};

export class DefinitionCard {
    constructor() {
        this.overlay = null;
    }

    /**
     * Show the CSCP definition card for a given chapter.
     * @param {string} chapterId  — matches key in CSCP_DEFINITIONS
     * @param {Function} onDismiss — called when the player clicks Continue
     */
    show(chapterId, onDismiss) {
        const def = CSCP_DEFINITIONS[chapterId];
        if (!def) {
            // No definition for this chapter — skip silently
            if (onDismiss) onDismiss();
            return;
        }

        const color = DOMAIN_COLORS[def.domain] ?? DOMAIN_COLORS.SCPE;

        this.overlay = document.createElement('div');
        this.overlay.className = 'defcard-overlay';
        this.overlay.innerHTML = `
            <div class="defcard glass-panel">

                <!-- Header -->
                <div class="defcard-header">
                    <div class="defcard-eyebrow">
                        <span class="defcard-cert-badge">APICS CSCP</span>
                        <span class="defcard-domain-badge" style="background:${color.bg};border-color:${color.border};color:${color.text};">
                            ${def.domain} &mdash; ${def.domainFull}
                        </span>
                    </div>
                    <div class="defcard-label">Chapter Concept</div>
                    <h2 class="defcard-term">${def.term}</h2>
                </div>

                <!-- Body -->
                <div class="defcard-body">

                    <div class="defcard-section defcard-section--definition">
                        <div class="defcard-section-label">
                            <span class="defcard-section-icon">&#9642;</span> Definition
                        </div>
                        <p class="defcard-text">${def.definition}</p>
                    </div>

                    <div class="defcard-section defcard-section--relevance">
                        <div class="defcard-section-label">
                            <span class="defcard-section-icon">&#9642;</span> Why It Matters for CSCP
                        </div>
                        <p class="defcard-text">${def.whyItMatters}</p>
                    </div>

                    <div class="defcard-exam-tip">
                        <div class="defcard-exam-tip-header">
                            <span class="defcard-tip-icon">&#9998;</span>
                            <span class="defcard-tip-label">Exam Tip</span>
                        </div>
                        <p class="defcard-tip-text">${def.examTip}</p>
                    </div>

                    <div class="defcard-memory-hook">
                        <span class="defcard-hook-icon">&#128161;</span>
                        <p class="defcard-hook-text"><em>${def.memoryHook}</em></p>
                    </div>

                </div>

                <!-- Footer -->
                <div class="defcard-footer">
                    <p class="defcard-footer-note">
                        Preparing for CSCP? This concept appears in the
                        <strong>${def.domainFull}</strong> exam domain.
                    </p>
                    <button class="btn-primary defcard-continue-btn">Got it &mdash; Continue</button>
                </div>

            </div>
        `;

        document.body.appendChild(this.overlay);
        requestAnimationFrame(() => this.overlay.classList.add('visible'));

        this.overlay.querySelector('.defcard-continue-btn')
            .addEventListener('click', () => {
                this._hide();
                if (onDismiss) onDismiss();
            });
    }

    _hide() {
        if (!this.overlay) return;
        this.overlay.classList.remove('visible');
        this.overlay.addEventListener('transitionend', () => {
            this.overlay?.remove();
            this.overlay = null;
        }, { once: true });
    }
}
