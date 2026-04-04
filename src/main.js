import './style.css'
import './shared/nav.css'
import { ParticleNetwork } from './graphics/particle-network.js';
import { Dashboard } from './dashboard.js';
import { createNav } from './shared/nav.js';
import { BillingManager } from './logic/billing.js';

window.addEventListener('DOMContentLoaded', async () => {
  // Initialize RevenueCat before anything else (no-op on web)
  await BillingManager.initialize();

  // Add shared nav
  createNav('game');

  // Create particle canvas before anything else
  const particles = new ParticleNetwork();
  particles.setMode('hero');
  particles.start();

  // Boot dashboard, passing particle instance for mode switching
  new Dashboard(particles);
});
