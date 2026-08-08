"use client";

/* DEBRIEF phase — score + the CSCP concept + the real-world principle. */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import { NumberTicker } from "@/components/ui/NumberTicker";
import type { CSCPConcept } from "@/types";

const DOMAIN: Record<CSCPConcept["domain"], string> = {
  SCD: "var(--color-primary)",
  SCPE: "var(--color-win)",
  SCIBP: "var(--color-warn)",
};

const stripMd = (s: string) => s.replace(/\*\*/g, "").trim();

interface Props {
  concept: CSCPConcept;
  insightTitle: string;
  insightBody: string;
  recoveryScore: number;
  stars: number;
  xp: number;
  onFinish: () => void;
  finishLabel: string;
}

export function DebriefCard({ concept, insightTitle, insightBody, recoveryScore, stars, xp, onFinish, finishLabel }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-5">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-1">Phase 5: Debrief</p>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">How it played out</h2>
      </header>

      {/* Score row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-[var(--radius-md)] p-3">
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Recovery Score</p>
          <NumberTicker value={recoveryScore} className="text-xl font-bold" />
        </div>
        <div className="bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-[var(--radius-md)] p-3">
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">Rating</p>
          <p className="text-xl font-bold tracking-widest" style={{ color: "var(--color-warn)" }}>
            {"★".repeat(stars)}<span className="text-[var(--surface-overlay)]" style={{ color: "var(--text-tertiary)" }}>{"★".repeat(3 - stars)}</span>
          </p>
        </div>
        <div className="bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-[var(--radius-md)] p-3">
          <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">XP Earned</p>
          <NumberTicker value={xp} prefix="+" className="text-xl font-bold" />
        </div>
      </div>

      {/* CSCP concept flashcard */}
      <div className="glass p-4 space-y-2">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{concept.term}</h3>
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{ color: DOMAIN[concept.domain], background: "color-mix(in srgb, currentColor 14%, transparent)" }}
          >
            {concept.domain}
          </span>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">{concept.definition}</p>
        <div className="pt-1 space-y-1.5">
          <p className="text-xs text-[var(--text-tertiary)]"><span className="text-[var(--color-primary)] font-semibold">Exam tip · </span>{concept.examTip}</p>
          <p className="text-xs text-[var(--text-tertiary)] italic">“{stripMd(concept.memoryHook)}”</p>
        </div>
      </div>

      {/* Real-world insight */}
      <div>
        <p className="text-sm font-semibold text-[var(--text-primary)]">{stripMd(insightTitle)}</p>
        <p className="text-sm text-[var(--text-secondary)] mt-1.5 whitespace-pre-line">{stripMd(insightBody)}</p>
      </div>

      <div className="flex justify-end">
        <Button onClick={onFinish}>{finishLabel}</Button>
      </div>
    </motion.div>
  );
}
