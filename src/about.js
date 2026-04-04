import './shared/base.css';
import './shared/nav.css';
import './shared/pages.css';
import { createNav } from './shared/nav.js';
import { createFooter } from './shared/footer.js';
import { initAmbientParticles } from './shared/particles-lite.js';

window.addEventListener('DOMContentLoaded', () => {
  createNav('about');
  createFooter();
  initAmbientParticles();
});
