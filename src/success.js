import './shared/nav.css';
import './shared/pages.css';
import './shared/base.css';
import { createNav } from './shared/nav.js';
import { Entitlements } from './logic/entitlements.js';
import { CORE_PRICE } from './ui/paywall.js';
import { track } from './shared/track.js';

/*
 * Checkout return page. Visiting this URL proves nothing: access is shown
 * only after the server confirms that a signed Lemon Squeezy webhook fulfilled
 * THIS browser's checkout claim. Until then the state is honestly "pending".
 */

const POLL_MS = 3000;
const POLL_FOR_MS = 2 * 60 * 1000;
const SENT_KEY = 'scd_purchase_events_sent';

function returnPath() {
  const p = new URLSearchParams(window.location.search).get('return') || '/play';
  return /^\/[a-zA-Z0-9/_-]*$/.test(p) ? p : '/play';
}

/** Fire purchase_confirmed once per provider order ID (survives reloads). The ID is only used locally for de-duplication — it is never sent to analytics. */
function trackPurchaseOnce(orderId) {
  if (!orderId) return;
  let sent = [];
  try { sent = JSON.parse(localStorage.getItem(SENT_KEY) || '[]'); } catch { /* ignore */ }
  if (sent.includes(orderId)) return;
  track('purchase_confirmed', { offer: 'core' });
  try { localStorage.setItem(SENT_KEY, JSON.stringify([...sent, orderId].slice(-20))); } catch { /* ignore */ }
}

function render(el, html) { el.innerHTML = html; el.querySelector('h2')?.focus?.(); }

window.addEventListener('DOMContentLoaded', async () => {
  createNav('game');
  const el = document.getElementById('success-content');
  const back = returnPath();
  const claim = Entitlements.pendingClaim();

  if (!claim) {
    render(el, `
      <h2 tabindex="-1">Nothing to confirm in this browser</h2>
      <p class="muted-text">We couldn't find a checkout started from this browser. If you completed a purchase,
        open the game and choose <strong>Core Game Pass → Restore a purchase</strong>: we'll email you a code to confirm it's you.</p>
      <a href="${back}" class="btn-primary success-cta">Return to the game</a>`);
    return;
  }

  render(el, `
    <div class="success-icon">…</div>
    <h2 tabindex="-1">Confirming your purchase</h2>
    <p class="muted-text" role="status" aria-live="polite" id="success-status">Waiting for Lemon Squeezy to confirm your payment. This usually takes a few seconds.</p>`);

  const started = Date.now();
  while (Date.now() - started < POLL_FOR_MS) {
    const r = await Entitlements.checkClaim();
    if (r.state === 'active') {
      Entitlements.clearClaim();
      trackPurchaseOnce(r.orderId);
      document.title = 'Core Game Pass active — Supply Chain Disaster';
      render(el, `
        <div class="success-icon success-icon--ok">✓</div>
        <h2 class="success-title" tabindex="-1">Your Core Game Pass is active</h2>
        <p class="muted-text">One-time ${CORE_PRICE} purchase — no subscription. All three industry campaigns, replay,
          Endless Survival, the weekly challenge, the Advanced Report PDF and the certificate are unlocked in this browser.
          A confirmation email is on its way.</p>
        ${r.orderId ? `<div class="success-order-box"><p class="success-order-label">Your order ID</p>
          <div class="success-order-row"><span class="success-order-id">${String(r.orderId).replace(/[^\w-]/g, '')}</span></div>
          <p class="success-order-hint">On another device, choose <strong>Core Game Pass → Restore a purchase</strong> and enter your purchase email.</p></div>` : ''}
        <a href="${back}" class="btn-primary success-cta">Continue playing →</a>`);
      return;
    }
    if (r.state === 'not_active') {
      render(el, `
        <h2 tabindex="-1">This purchase isn't active</h2>
        <p class="muted-text">Lemon Squeezy reports this order as not paid or refunded, so no access was granted.
          If you think that's wrong, <a href="/contact">contact support</a>.</p>
        <a href="${back}" class="btn-primary success-cta">Return to the game</a>`);
      return;
    }
    if (r.state === 'unknown') break;
    await new Promise(res => setTimeout(res, POLL_MS));
  }

  // Delayed or missing webhook: never fake success — keep the claim so the game can retry later
  render(el, `
    <h2 tabindex="-1">Still confirming your payment</h2>
    <p class="muted-text">We haven't received confirmation yet. Nothing is lost: if you paid, your access will appear
      automatically the next time you open the game in this browser. You can also restore it any time with
      <strong>Core Game Pass → Restore a purchase</strong> using your purchase email. Your saved game is unaffected.</p>
    <a href="${back}" class="btn-primary success-cta">Return to the game</a>`);
});
