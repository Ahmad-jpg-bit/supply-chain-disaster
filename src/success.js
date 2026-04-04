import './shared/nav.css';
import './shared/pages.css';
import './shared/base.css';
import { createNav } from './shared/nav.js';
import { PremiumManager } from './logic/premium.js';

window.addEventListener('DOMContentLoaded', async () => {
  createNav('game');

  // Lemon Squeezy appends ?order_id={id} to the redirect URL after payment.
  const params    = new URLSearchParams(window.location.search);
  const orderId   = params.get('order_id');
  const contentEl = document.getElementById('success-content');

  if (!orderId) {
    contentEl.innerHTML = `
      <div class="success-icon success-icon--error">✕</div>
      <h2>Missing Order ID</h2>
      <p class="muted-text">Something went wrong with the redirect. If you completed a payment, please <a href="/contact" style="color: var(--primary-color);">contact support</a> with your email.</p>
      <a href="/" class="btn-primary success-cta">Return to Game</a>
    `;
    return;
  }

  const ok = await PremiumManager.verifyOrder(orderId);

  if (ok) {
    const isExpansion = PremiumManager.isExpansion();
    document.title = 'Payment Confirmed — Supply Chain Disaster';
    contentEl.innerHTML = `
      <div class="success-icon success-icon--ok">✓</div>
      <h2 class="success-title">${isExpansion ? 'Expansion Bundle Unlocked!' : "You're Premium!"}</h2>
      <p class="muted-text">${
        isExpansion
          ? 'All 10 chapters are now unlocked — including the Global Logistics Expansion. Good luck out there.'
          : 'All 8 chapters are now unlocked. Time to put your skills to the real test.'
      }</p>
      <a href="/" class="btn-primary success-cta">Start Playing →</a>
    `;
  } else {
    document.title = 'Payment Verification Failed — Supply Chain Disaster';
    contentEl.innerHTML = `
      <div class="success-icon success-icon--error">✕</div>
      <h2>Payment Verification Failed</h2>
      <p class="muted-text">
        We couldn't confirm your payment. If you were charged, please
        <a href="/contact" style="color: var(--primary-color);">contact support</a>
        with your order email and we'll sort it out.
      </p>
      <a href="/" class="btn-primary success-cta">Return to Game</a>
    `;
  }
});
