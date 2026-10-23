/**
 * home.js — lightweight entry point for the static marketing homepage (index.html).
 *
 * Responsibilities:
 *   1. Boot shared nav + footer (dynamic JS-enhanced versions)
 *   2. Start ambient particle network
 *
 * Intentionally thin — all page content is static HTML in index.html so crawlers
 * see it on first paint without needing JS.
 *
 * Note: the /play navigation transition overlay is handled by a small inline
 * <script> in index.html that runs before this module loads, ensuring it fires
 * even on slow connections.
 */

import './style.css';
import './shared/nav.css';
import './ui/landing-page.css';
import { initAmbientParticles } from './shared/particles-lite.js';
import { showDemo } from './ui/demo-modal.js';
import { mountAiCta } from './shared/ai-cta.js';

window.addEventListener('DOMContentLoaded', () => {
  initAmbientParticles();

  // AI-courses promo band (renders into the #ai-cta-home slot in index.html).
  mountAiCta({ slot: '#ai-cta-home' });

  // Hero "Watch 30-sec Demo" button → interactive game-preview modal.
  document.getElementById('lp-demo-btn')?.addEventListener('click', () => {
    showDemo({ onStart: () => { window.location.href = '/play?start=1'; } });
  });

  initNavScroll();
});

/** Give the sticky nav depth (shadow + more opaque bg) once the page scrolls. */
function initNavScroll() {
  const nav = document.querySelector('.hp-nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('hp-nav--scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
