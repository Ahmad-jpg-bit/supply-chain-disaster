import { getIcon } from '../graphics/svg-icons.js';

export class ConceptCard {
    constructor() {
        this.overlay = null;
    }

    show(chapter, onDismiss) {
        // Create overlay
        this.overlay = document.createElement('div');
        this.overlay.className = 'concept-card-overlay';

        const icon = getIcon(chapter.icon, 48);

        const expansionBadge = chapter.isExpansion
            ? `<div class="concept-expansion-badge">✦ Expansion Bundle</div>`
            : '';

        this.overlay.innerHTML = `
            <div class="concept-card glass-panel ${chapter.isExpansion ? 'concept-card--expansion' : ''}">
                <div class="concept-card-header">
                    ${expansionBadge}
                    <span class="concept-chapter-label">Chapter ${chapter.number}</span>
                    <div class="concept-icon">${icon}</div>
                    <h2 class="concept-title">${chapter.title}</h2>
                </div>
                <div class="concept-body">
                    <p class="concept-description">${chapter.description}</p>
                    <div class="concept-key-points">
                        <h4>Key Learning Points</h4>
                        <ul>
                            ${chapter.keyPoints.map(p => `<li>${p}</li>`).join('')}
                        </ul>
                    </div>
                    <div class="concept-example">
                        <h4>Real-World Example</h4>
                        <p>${chapter.realWorldExample}</p>
                    </div>
                </div>
                <div class="concept-dismiss-row">
                    <button class="btn-primary concept-dismiss-btn">Got it — Let's Begin</button>
                    <label class="concept-skip-label">
                        <input type="checkbox" class="concept-skip-checkbox">
                        Don't show this intro again
                    </label>
                </div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        // Trigger entrance animation
        requestAnimationFrame(() => {
            this.overlay.classList.add('visible');
        });

        // Bind dismiss
        this.overlay.querySelector('.concept-dismiss-btn').addEventListener('click', () => {
            const skipNext = this.overlay.querySelector('.concept-skip-checkbox').checked;
            this.hide();
            if (onDismiss) onDismiss(skipNext);
        });
    }

    hide() {
        if (this.overlay) {
            this.overlay.classList.remove('visible');
            this.overlay.addEventListener('transitionend', () => {
                this.overlay.remove();
                this.overlay = null;
            }, { once: true });
        }
    }
}
