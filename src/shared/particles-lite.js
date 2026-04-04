/**
 * Thin wrapper — starts particle network in ambient mode for non-game pages.
 */
import { ParticleNetwork } from '../graphics/particle-network.js';

export function initAmbientParticles() {
  const particles = new ParticleNetwork();
  particles.setMode('ambient');
  particles.start();
  return particles;
}
