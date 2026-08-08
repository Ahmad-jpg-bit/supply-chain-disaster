"use client";

/* PlayFlow — drives one level's scenarios through the 5-phase loop
   (ASSESS → STRATEGIZE → IMPLEMENT → MONITOR → DEBRIEF) via the store.

   Note: phase swaps use a plain keyed <div> (each phase component owns
   its entrance animation) — AnimatePresence mode="wait" hangs under
   React 19 StrictMode. */

import { useEffect, useState } from "react";
import { useGameStore } from "@/stores/gameStore";
import { scoreToStars } from "@/lib/game/simulation";
import { validate } from "@/components/game/ImplementStep";
import { DiagnosisPanel } from "@/components/game/DiagnosisPanel";
import { StrategySelector } from "@/components/game/StrategySelector";
import { ImplementStep } from "@/components/game/ImplementStep";
import { RecoveryReveal } from "@/components/game/RecoveryReveal";
import { DebriefCard } from "@/components/game/DebriefCard";
import type { LevelMeta, GamePhase } from "@/types";

const PHASES: GamePhase[] = ["ASSESS", "STRATEGIZE", "IMPLEMENT", "MONITOR", "DEBRIEF"];
const PHASE_LABELS = ["Assess", "Strategize", "Implement", "Monitor", "Debrief"];
const stripMd = (s: string) => s.replace(/\*\*/g, "").trim();

export function PlayFlow({ level, startChapter = 0 }: { level: LevelMeta; startChapter?: number }) {
  const [chapterIndex, setChapterIndex] = useState(startChapter);
  const chapter = level.chapters[chapterIndex];

  const {
    session, simulationSnapshots, earnedXP,
    startSession, toggleDiagnosis, chooseStrategy, updateImplementStep, nextPhase, runMonitor,
  } = useGameStore();

  useEffect(() => {
    startSession(chapter, "guided");
  }, [chapter, startSession]);

  if (!session || session.chapterId !== chapter.id) return null;

  const phase = session.phase;
  const phaseIdx = PHASES.indexOf(phase);
  const isLast = chapterIndex === level.chapters.length - 1;
  const allImplementComplete = chapter.implementSteps.every((s) => validate(s, session.implementProgress[s.id] ?? ""));
  const finish = () => setChapterIndex((i) => (isLast ? 0 : i + 1));

  return (
    <div className="space-y-6">
      {/* Scenario + phase stepper */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs font-mono text-[var(--text-tertiary)]">
          <span>{level.title}</span>
          <span>Scenario {chapterIndex + 1} / {level.chapters.length}</span>
        </div>
        <div className="flex gap-1.5">
          {PHASES.map((p, i) => (
            <div key={p} className="flex-1 space-y-1">
              <div className={`h-1 rounded-full transition-colors ${i <= phaseIdx ? "bg-[var(--color-primary)]" : "bg-[var(--surface-overlay)]"}`} />
              <span className={`block text-[9px] uppercase tracking-wider ${i === phaseIdx ? "text-[var(--color-primary)]" : "text-[var(--text-tertiary)]"}`}>
                {PHASE_LABELS[i]}
              </span>
            </div>
          ))}
        </div>
        <div>
          <h1 className="text-lg font-bold text-[var(--text-primary)]">{chapter.title}</h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1 whitespace-pre-line">{stripMd(chapter.narrative)}</p>
        </div>
      </div>

      <div key={phase}>
        {phase === "ASSESS" && (
          <DiagnosisPanel
            items={chapter.diagnosisItems}
            selected={session.selectedDiagnoses}
            difficulty={session.difficulty}
            onToggle={toggleDiagnosis}
            onContinue={nextPhase}
          />
        )}
        {phase === "STRATEGIZE" && (
          <StrategySelector
            options={chapter.strategyOptions}
            selected={session.selectedStrategy}
            onSelect={chooseStrategy}
            onContinue={nextPhase}
          />
        )}
        {phase === "IMPLEMENT" && (
          <ImplementStep
            steps={chapter.implementSteps}
            progress={session.implementProgress}
            difficulty={session.difficulty}
            onUpdate={updateImplementStep}
            onComplete={() => { nextPhase(); runMonitor(); }}
            allComplete={allImplementComplete}
          />
        )}
        {phase === "MONITOR" && (
          <RecoveryReveal
            revealType={level.revealType}
            snapshots={simulationSnapshots}
            conceptTerm={level.concept.term}
            onContinue={nextPhase}
          />
        )}
        {phase === "DEBRIEF" && (
          <DebriefCard
            concept={level.concept}
            insightTitle={level.insightTitle}
            insightBody={level.insightBody}
            recoveryScore={session.recoveryScore}
            stars={scoreToStars(session.recoveryScore)}
            xp={earnedXP}
            onFinish={finish}
            finishLabel={isLast ? "Replay level ↺" : "Next scenario →"}
          />
        )}
      </div>
    </div>
  );
}
