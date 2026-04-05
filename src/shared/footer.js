import './footer.css';

/**
 * Shared site footer component.
 * Replaces any existing .page-footer element; or appends to .page-content.
 */
export function createFooter() {
  const footer = document.createElement('footer');
  footer.className = 'page-footer';
  footer.innerHTML = `
    <div class="footer-inner">
      <div class="footer-brand">
        <a href="/" class="footer-logo-link" aria-label="Supply Chain Disaster home">
          <svg class="footer-chain-icon" width="40" height="24" viewBox="0 0 52 32" fill="none" aria-hidden="true">
            <path d="M22 5 L9 5 Q3 5 3 11 L3 21 Q3 27 9 27 L22 27"
                  stroke="#3b82f6" stroke-width="3.5" stroke-linecap="round"/>
            <path d="M30 5 L43 5 Q49 5 49 11 L49 21 Q49 27 43 27 L30 27"
                  stroke="#f97316" stroke-width="3.5" stroke-linecap="round"/>
          </svg>
          <span class="footer-brand-name">Supply Chain Disaster</span>
        </a>
        <p class="footer-tagline">Built to teach supply chain strategy through play.</p>
      </div>

      <nav class="footer-links" aria-label="Footer navigation">
        <div class="footer-link-group">
          <span class="footer-group-label">Explore</span>
          <a href="/" class="footer-link">Play Game</a>
          <a href="/pricing" class="footer-link">Pricing</a>
          <a href="/about" class="footer-link">About</a>
          <a href="/blog" class="footer-link">Blog</a>
          <a href="https://tools.supplychaindisaster.com" class="footer-link" target="_blank" rel="noopener">Trade Lane Tools ↗</a>
          <a href="/contact" class="footer-link">Contact</a>
        </div>
        <div class="footer-link-group">
          <span class="footer-group-label">Legal</span>
          <a href="/terms" class="footer-link">Terms of Service</a>
          <a href="/privacy" class="footer-link">Privacy Policy</a>
          <a href="/refund" class="footer-link">Refund Policy</a>
        </div>
      </nav>
    </div>

    <div class="footer-bottom">
      <span>&copy; 2026 Supply Chain Disaster. All rights reserved.</span>
      <span class="footer-bottom-sep" aria-hidden="true">·</span>
      <a href="/terms" class="footer-link">Terms</a>
      <span class="footer-bottom-sep" aria-hidden="true">·</span>
      <a href="/privacy" class="footer-link">Privacy</a>
      <span class="footer-bottom-sep" aria-hidden="true">·</span>
      <a href="/refund" class="footer-link">Refund Policy</a>
      <span class="footer-bottom-sep" aria-hidden="true">·</span>
      <a href="mailto:hello@supplychaindisaster.com" class="footer-link">hello@supplychaindisaster.com</a>
    </div>
  `;

  // Replace existing static .page-footer; otherwise append to .page-content
  const existing = document.querySelector('.page-footer');
  if (existing) {
    existing.replaceWith(footer);
  } else {
    const content = document.querySelector('.page-content') || document.body;
    content.appendChild(footer);
  }

  return footer;
}
