import './style.css'
import './shared/nav.css'
import { ParticleNetwork } from './graphics/particle-network.js';
import { Dashboard } from './dashboard.js';
import { createNav } from './shared/nav.js';
import { BillingManager } from './logic/billing.js';

// Dev mode: auto-grant expansion tier so all 10 chapters are accessible without a paywall.
// Vite sets import.meta.env.DEV=true only during `npm run dev` — never in production builds.
if (import.meta.env.DEV) {
  localStorage.setItem('scd_premium', JSON.stringify({ active: true, tier: 'expansion' }));
}

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
