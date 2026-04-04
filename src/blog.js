import './shared/base.css';
import './shared/nav.css';
import './shared/pages.css';
import { createNav } from './shared/nav.js';
import { createFooter } from './shared/footer.js';
import { initAmbientParticles } from './shared/particles-lite.js';

window.addEventListener('DOMContentLoaded', () => {
  createNav('blog');
  createFooter();
  initAmbientParticles();
  handleBlogSearch();
});

function handleBlogSearch() {
  const params = new URLSearchParams(window.location.search);
  const query = params.get('q')?.trim().toLowerCase();
  if (!query) return;

  const cards = document.querySelectorAll('.blog-card');
  let matchCount = 0;

  cards.forEach(card => {
    const text = card.textContent.toLowerCase();
    const matches = text.includes(query);
    card.style.display = matches ? '' : 'none';
    if (matches) matchCount++;
  });

  // Show result count banner below hero
  const hero = document.querySelector('.hero-section');
  if (hero) {
    const banner = document.createElement('p');
    banner.style.cssText = 'text-align:center;color:var(--text-muted);font-size:0.9rem;margin:-0.5rem 0 1.5rem;';
    banner.innerHTML = matchCount
      ? `Showing <strong style="color:var(--text-main)">${matchCount}</strong> result${matchCount !== 1 ? 's' : ''} for "<strong style="color:var(--text-main)">${query}</strong>" — <a href="/blog" style="color:#3b82f6">Clear</a>`
      : `No results for "<strong style="color:var(--text-main)">${query}</strong>" — <a href="/blog" style="color:#3b82f6">Show all</a>`;
    hero.insertAdjacentElement('afterend', banner);
  }
}
