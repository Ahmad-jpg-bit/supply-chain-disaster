/* ─────────────────────────────────────────────────────────────
   Supply Chain Disaster — Simulation Engine (ported)

   Turns a strategy's per-turn gap-closure curve into a run of
   MetricSnapshots. Curve values are CUMULATIVE fractions (0..1) of
   the gap between the starting service level and a perfect 100%
   closed by that turn; a risky strategy can dip negative (regress).

   Only serviceLevel drives scoring — the other fields are cosmetic
   KPIs the reveal/graph animate.
   ──────────────────────────────────────────────────────────── */

import type { MetricSnapshot, StarRating } from "@/types";

const TARGET_SERVICE = 100;
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export interface SimulationConfig {
  initialMetrics: MetricSnapshot;
  curve: number[];   // cumulative gap-closure fraction per turn
  noise: number;     // 0–1 (higher in Expert mode)
}

/** Generate one snapshot per curve entry (plus the initial state at turn 0). */
export function runSimulation({ initialMetrics, curve, noise }: SimulationConfig): MetricSnapshot[] {
  const snapshots: MetricSnapshot[] = [initialMetrics];
  const baseService = initialMetrics.serviceLevel;
  const baseSat = initialMetrics.satisfaction;

  for (let t = 1; t <= curve.length; t++) {
    const frac = curve[t - 1] ?? curve[curve.length - 1] ?? 0;
    const jitter = noise > 0 ? (Math.random() - 0.5) * 2 * noise * 4 : 0;

    const service = clamp(baseService + frac * (TARGET_SERVICE - baseService) + jitter, 0, 100);
    const prev = snapshots[snapshots.length - 1];

    snapshots.push({
      turn: t,
      serviceLevel: Math.round(service),
      satisfaction: Math.round(clamp(baseSat + frac * (100 - baseSat) + jitter * 0.5, 0, 100)),
      backlog: Math.max(0, Math.round((100 - service) * 6)),
      inventory: Math.max(0, Math.round(prev.inventory + (service - prev.serviceLevel) * 2)),
      cash: Math.max(0, Math.round(prev.cash - 3000 + (service - 50) * 40)),
    });
  }

  return snapshots;
}

/** Recovery score (0–100): how far the actual outcome closed the gap to the optimal one. */
export function calculateRecoveryScore(
  actual: MetricSnapshot,
  optimal: MetricSnapshot,
  initial: MetricSnapshot
): number {
  const range = optimal.serviceLevel - initial.serviceLevel;
  const gain = actual.serviceLevel - initial.serviceLevel;
  if (range <= 0) return 50;
  return clamp(Math.round((gain / range) * 100), 0, 100);
}

/** Map a recovery score to a star rating. */
export function scoreToStars(score: number): StarRating {
  if (score >= 85) return 3;
  if (score >= 60) return 2;
  if (score >= 30) return 1;
  return 0;
}
