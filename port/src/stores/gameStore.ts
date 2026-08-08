/* ─────────────────────────────────────────────────────────────
   Supply Chain Disaster — Zustand Game Store (ported)
   Client-side state for the active game session.
   ──────────────────────────────────────────────────────────── */

import { create } from "zustand";
import type { GameSession, Chapter, DifficultyMode, MetricSnapshot } from "@/types";
import {
  createSession,
  advancePhase,
  submitDiagnosis,
  selectStrategy,
  submitImplementStep,
  runMonitorPhase,
  calculateXP,
} from "@/lib/game/engine";
import { scoreToStars } from "@/lib/game/simulation";

interface GameStore {
  session: GameSession | null;
  chapter: Chapter | null;
  simulationSnapshots: MetricSnapshot[];
  earnedXP: number;

  startSession: (chapter: Chapter, difficulty: DifficultyMode) => void;
  toggleDiagnosis: (id: string) => void;
  chooseStrategy: (id: string) => void;
  updateImplementStep: (stepId: string, value: string) => void;
  nextPhase: () => void;
  runMonitor: () => void;
  completeDebrief: () => void;
  reset: () => void;
}

export const useGameStore = create<GameStore>((set, get) => ({
  session: null,
  chapter: null,
  simulationSnapshots: [],
  earnedXP: 0,

  startSession(chapter, difficulty) {
    set({ chapter, session: createSession(chapter, difficulty), simulationSnapshots: [], earnedXP: 0 });
  },

  toggleDiagnosis(id) {
    const { session } = get();
    if (!session) return;
    set({ session: submitDiagnosis(session, id) });
  },

  chooseStrategy(id) {
    const { session } = get();
    if (!session) return;
    set({ session: selectStrategy(session, id) });
  },

  updateImplementStep(stepId, value) {
    const { session } = get();
    if (!session) return;
    set({ session: submitImplementStep(session, stepId, value) });
  },

  nextPhase() {
    const { session } = get();
    if (!session) return;
    set({ session: advancePhase(session) });
  },

  runMonitor() {
    const { session, chapter } = get();
    if (!session || !chapter) return;
    const { snapshots, session: updated } = runMonitorPhase(session, chapter);
    const xp = calculateXP(updated.recoveryScore, updated.elapsedSeconds, chapter.xpReward, updated.difficulty);
    set({ session: updated, simulationSnapshots: snapshots, earnedXP: xp });
  },

  completeDebrief() {
    const { session } = get();
    if (!session) return;
    set({ session: { ...session, isComplete: true } });
  },

  reset() {
    set({ session: null, chapter: null, simulationSnapshots: [], earnedXP: 0 });
  },
}));

export const selectStars = (store: GameStore) =>
  store.session ? scoreToStars(store.session.recoveryScore) : 0;
