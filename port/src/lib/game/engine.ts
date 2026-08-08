/* ─────────────────────────────────────────────────────────────
   Supply Chain Disaster — Game Engine State Machine (ported)
   Phases: ASSESS → STRATEGIZE → IMPLEMENT → MONITOR → DEBRIEF
   ──────────────────────────────────────────────────────────── */

import type { GamePhase, GameSession, Chapter, DifficultyMode, MetricSnapshot } from "@/types";
import { runSimulation, calculateRecoveryScore, scoreToStars } from "./simulation";

const PHASE_ORDER: GamePhase[] = ["ASSESS", "STRATEGIZE", "IMPLEMENT", "MONITOR", "DEBRIEF"];

export function createSession(chapter: Chapter, difficulty: DifficultyMode): GameSession {
  return {
    chapterId: chapter.id,
    phase: "ASSESS",
    difficulty,
    selectedDiagnoses: [],
    selectedStrategy: null,
    implementProgress: {},
    simulationTurn: 0,
    currentMetrics: { ...chapter.initialMetrics },
    recoveryScore: 0,
    elapsedSeconds: 0,
    isComplete: false,
  };
}

export function advancePhase(session: GameSession): GameSession {
  const next = PHASE_ORDER[PHASE_ORDER.indexOf(session.phase) + 1];
  if (!next) return { ...session, isComplete: true };
  return { ...session, phase: next };
}

export function submitDiagnosis(session: GameSession, diagnosisId: string): GameSession {
  const already = session.selectedDiagnoses.includes(diagnosisId);
  return {
    ...session,
    selectedDiagnoses: already
      ? session.selectedDiagnoses.filter((id) => id !== diagnosisId)
      : [...session.selectedDiagnoses, diagnosisId],
  };
}

export function selectStrategy(session: GameSession, strategyId: string): GameSession {
  return { ...session, selectedStrategy: strategyId };
}

export function submitImplementStep(session: GameSession, stepId: string, value: string): GameSession {
  return { ...session, implementProgress: { ...session.implementProgress, [stepId]: value } };
}

export function runMonitorPhase(
  session: GameSession,
  chapter: Chapter
): { snapshots: MetricSnapshot[]; session: GameSession } {
  if (!session.selectedStrategy) throw new Error("No strategy selected before monitor phase.");

  const curve = chapter.simulationCurves[session.selectedStrategy] ?? [];
  const noiseByDifficulty: Record<DifficultyMode, number> = { guided: 0, normal: 0.3, expert: 0.7 };
  const noise = noiseByDifficulty[session.difficulty];

  const snapshots = runSimulation({ initialMetrics: chapter.initialMetrics, curve, noise });

  const optimalId = chapter.strategyOptions.find((s) => s.isOptimal)?.id;
  const optimalCurve = optimalId ? chapter.simulationCurves[optimalId] ?? curve : curve;
  const optimalSnapshots = runSimulation({ initialMetrics: chapter.initialMetrics, curve: optimalCurve, noise: 0 });

  const finalActual = snapshots[snapshots.length - 1];
  const finalOptimal = optimalSnapshots[optimalSnapshots.length - 1];
  const recoveryScore = calculateRecoveryScore(finalActual, finalOptimal, chapter.initialMetrics);

  return {
    snapshots,
    session: { ...session, currentMetrics: finalActual, recoveryScore, isComplete: false },
  };
}

export function calculateXP(
  recoveryScore: number,
  elapsedSeconds: number,
  baseXP: number,
  difficulty: DifficultyMode
): number {
  const starMultiplier = [0.5, 1, 1.5, 2][scoreToStars(recoveryScore)];
  const speedBonus = elapsedSeconds < 120 ? 20 : elapsedSeconds < 300 ? 10 : 0;
  const difficultyMultiplier: Record<DifficultyMode, number> = { guided: 0.8, normal: 1, expert: 1.3 };
  return Math.round(baseXP * starMultiplier * difficultyMultiplier[difficulty] + speedBonus);
}
