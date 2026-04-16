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

window.addEventListener('DOMContentLoaded', () => {
  initAmbientParticles();
});
