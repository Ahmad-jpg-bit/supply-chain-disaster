"use client";

/* ASSESS phase — pick the real problems out of the red herrings. */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { DiagnosisItem, DifficultyMode } from "@/types";

const SEV: Record<DiagnosisItem["severity"], { label: string; color: string }> = {
  critical: { label: "Critical", color: "var(--color-disaster)" },
  major: { label: "Major", color: "var(--color-warn)" },
  minor: { label: "Minor", color: "var(--text-tertiary)" },
};

interface Props {
  items: DiagnosisItem[];
  selected: string[];
  difficulty: DifficultyMode;
  onToggle: (id: string) => void;
  onContinue: () => void;
}

export function DiagnosisPanel({ items, selected, difficulty, onToggle, onContinue }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-1">Phase 1: Assess</p>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Diagnose the real problem</h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Select every issue you believe is genuinely at play. Red herrings cost nothing to rule out.
        </p>
      </header>

      <div className="grid gap-2">
        {items.map((item) => {
          const isSel = selected.includes(item.id);
          const verdict = isSel ? (item.isCorrect ? "real" : "herring") : null;
          return (
            <button
              key={item.id}
              onClick={() => onToggle(item.id)}
              className={`text-left rounded-[var(--radius-md)] border p-3 transition-colors ${
                verdict === "real"
                  ? "border-[var(--color-win)]/60 bg-[var(--color-win)]/5"
                  : verdict === "herring"
                  ? "border-[var(--color-disaster)]/50 bg-[var(--color-disaster)]/5"
                  : "border-[var(--surface-border)] hover:border-[var(--color-primary)]/50"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span
                  className="mt-0.5 w-4 h-4 rounded-[4px] border flex items-center justify-center text-[10px] shrink-0 text-[var(--text-primary)]"
                  style={{ borderColor: isSel ? "currentColor" : "var(--surface-border)" }}
                >
                  {isSel ? "✓" : ""}
                </span>
                <div className="flex-1">
                  <span className="text-sm text-[var(--text-primary)]">{item.label}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] uppercase tracking-wider" style={{ color: SEV[item.severity].color }}>
                      {SEV[item.severity].label}
                    </span>
                    {verdict === "real" && <span className="text-[10px] text-[var(--color-win)]">✓ real issue</span>}
                    {verdict === "herring" && <span className="text-[10px] text-[var(--color-disaster)]">✕ red herring</span>}
                  </div>
                  {difficulty === "guided" && item.hint && (
                    <p className="text-xs text-[var(--text-tertiary)] mt-1.5">{item.hint}</p>
                  )}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={selected.length === 0}>Choose a strategy →</Button>
      </div>
    </motion.div>
  );
}
