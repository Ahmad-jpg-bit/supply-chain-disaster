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

  initScrollReveal();
  initNavScroll();
});

/**
 * Fade + rise below-the-fold sections as they scroll into view. The hidden
 * initial state is applied pre-paint via the .reveal-ready flag (see the inline
 * head script in index.html); this just reveals each section once. Degrades to
 * fully-visible content when reduced-motion is on or IntersectionObserver is
 * missing.
 */
function initScrollReveal() {
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    document.documentElement.classList.remove('reveal-ready'); // never leave content hidden
    return;
  }

  const SELECTOR = '.hp-social-proof, body > .hp-section, .hp-educators, #ai-cta-home, .hp-final-cta, .hp-connect';
  const targets = document.querySelectorAll(SELECTOR);
  if (!targets.length) return;

  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('hp-reveal-in');
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -7% 0px' });

  targets.forEach((el) => io.observe(el));

  // Safety net: reveal anything in view shortly after load so no section can
  // ever be left stuck hidden by an observer edge case.
  window.addEventListener('load', () => setTimeout(() => {
    targets.forEach((el) => {
      if (el.getBoundingClientRect().top < window.innerHeight) el.classList.add('hp-reveal-in');
    });
  }, 1200));
}

/** Give the sticky nav depth (shadow + more opaque bg) once the page scrolls. */
function initNavScroll() {
  const nav = document.querySelector('.hp-nav');
  if (!nav) return;
  const onScroll = () => nav.classList.toggle('hp-nav--scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });
}
