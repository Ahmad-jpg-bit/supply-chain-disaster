"use client";

/* ─────────────────────────────────────────────────────────────
   ImplementStep — the IMPLEMENT (procurement) phase (ported, lean).

   Supply Chain Disaster needs two input types, not SEO's four:
     · select_option — pick a supplier / shipping mode / policy
     · number_input  — set an order quantity / safety-stock level
                       (validated within `tolerance`)
   ──────────────────────────────────────────────────────────── */

import { useState, type CSSProperties } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { ImplementStep as IStep, DifficultyMode } from "@/types";

export function validate(step: IStep, value: string): boolean {
  if (!value.trim()) return false;
  if (step.type === "number_input") {
    const v = parseFloat(value);
    const target = parseFloat(step.correctValue);
    if (Number.isNaN(v)) return false;
    return Math.abs(v - target) <= (step.tolerance ?? 0);
  }
  const norm = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
  return norm(value) === norm(step.correctValue);
}

interface Props {
  steps: IStep[];
  progress: Record<string, string>;
  difficulty: DifficultyMode;
  onUpdate: (stepId: string, value: string) => void;
  onComplete: () => void;
  allComplete: boolean;
}

export function ImplementStep({ steps, progress, difficulty, onUpdate, onComplete, allComplete }: Props) {
  const [active, setActive] = useState(0);
  const step = steps[active];
  const value = progress[step?.id] ?? "";
  const isCorrect = step ? validate(step, value) : false;
  const isWrong = value.trim() !== "" && !isCorrect;
  const completed = steps.filter((s) => validate(s, progress[s.id] ?? "")).length;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-4"
      style={{ viewTransitionName: "implement-panel" } as CSSProperties}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono uppercase tracking-widest text-[var(--text-tertiary)]">
          Phase 3: Implement — Procurement
        </span>
        <span className="text-xs font-mono text-[var(--text-tertiary)]">
          <span className="text-[var(--color-win)]">{completed}</span> / {steps.length}
        </span>
      </div>

      {/* Step rail */}
      <div className="flex gap-1.5">
        {steps.map((s, i) => (
          <button
            key={s.id}
            onClick={() => setActive(i)}
            aria-label={`Step ${i + 1}`}
            className={`flex-1 h-1.5 rounded-full transition-all duration-300 ${
              validate(s, progress[s.id] ?? "")
                ? "bg-[var(--color-win)]"
                : i === active
                ? "bg-[var(--color-primary)]"
                : "bg-[var(--surface-overlay)]"
            }`}
          />
        ))}
      </div>

      {/* Active step — keyed remount replays the enter animation (no
          AnimatePresence: mode="wait" can hang under React 19 StrictMode). */}
      <div>
        <motion.div
          key={active}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className={`rounded-[var(--radius-lg)] border p-4 space-y-3 ${
            isCorrect
              ? "border-[var(--color-win)]/60"
              : isWrong
              ? "border-[var(--color-disaster)]/50"
              : "border-[var(--surface-border)]"
          }`}
        >
          <p className="text-sm font-medium text-[var(--text-primary)]">{step?.instruction}</p>

          {step?.type === "select_option" && (
            <div className="grid gap-2">
              {(step.options ?? []).map((opt) => {
                const selected = value === opt;
                return (
                  <button
                    key={opt}
                    onClick={() => onUpdate(step.id, opt)}
                    className={`text-left text-sm px-3 py-2.5 rounded-[var(--radius-md)] border transition-colors ${
                      selected
                        ? "border-[var(--color-primary)] bg-[var(--color-primary)]/10 text-[var(--text-primary)]"
                        : "border-[var(--surface-border)] text-[var(--text-secondary)] hover:border-[var(--color-primary)]/50"
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          )}

          {step?.type === "number_input" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="numeric"
                value={value}
                onChange={(e) => onUpdate(step.id, e.target.value)}
                placeholder="Enter a value…"
                className="w-40 px-3 py-2 rounded-[var(--radius-md)] bg-[var(--surface-overlay)] border border-[var(--surface-border)] text-[var(--text-primary)] font-mono focus:border-[var(--color-primary)] outline-none"
              />
              {step.tolerance ? (
                <span className="text-xs text-[var(--text-tertiary)]">± {step.tolerance} accepted</span>
              ) : null}
            </div>
          )}

          {(difficulty === "guided" && step?.hint) && (
            <p className="text-xs text-[var(--text-tertiary)]">{step.hint}</p>
          )}

          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-mono">
              {isCorrect ? (
                <span className="text-[var(--color-win)]">✓ looks right</span>
              ) : isWrong ? (
                <span className="text-[var(--color-disaster)]">✕ not quite</span>
              ) : (
                <span className="text-[var(--text-tertiary)]">awaiting input</span>
              )}
            </span>
            {isCorrect && active < steps.length - 1 && (
              <Button variant="secondary" size="sm" onClick={() => setActive((n) => Math.min(n + 1, steps.length - 1))}>
                Next →
              </Button>
            )}
          </div>
        </motion.div>
      </div>

      <AnimatePresence>
        {allComplete && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="flex justify-end">
            <Button size="lg" onClick={onComplete}>Execute &amp; Monitor →</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
