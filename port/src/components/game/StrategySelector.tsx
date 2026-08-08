"use client";

/* STRATEGIZE phase — pick the ordering / response policy. */

import { motion } from "framer-motion";
import { Button } from "@/components/ui/Button";
import type { StrategyOption } from "@/types";

const RISK: Record<StrategyOption["riskLevel"], string> = {
  low: "var(--color-win)",
  medium: "var(--color-warn)",
  high: "var(--color-disaster)",
};

interface Props {
  options: StrategyOption[];
  selected: string | null;
  onSelect: (id: string) => void;
  onContinue: () => void;
}

export function StrategySelector({ options, selected, onSelect, onContinue }: Props) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="space-y-4">
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-1">Phase 2: Strategize</p>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Choose your response</h2>
      </header>

      <div className="grid gap-3">
        {options.map((o) => {
          const isSel = selected === o.id;
          return (
            <button
              key={o.id}
              onClick={() => onSelect(o.id)}
              className={`text-left rounded-[var(--radius-lg)] border p-4 transition-colors ${
                isSel
                  ? "border-[var(--color-primary)] bg-[var(--color-primary)]/8"
                  : "border-[var(--surface-border)] hover:border-[var(--color-primary)]/40"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">{o.title}</h3>
                <span
                  className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
                  style={{ color: RISK[o.riskLevel], background: "color-mix(in srgb, currentColor 12%, transparent)" }}
                >
                  {o.riskLevel} risk
                </span>
              </div>
              <p className="text-sm text-[var(--text-secondary)] mt-1.5">{o.description}</p>
              <div className="flex items-start gap-3 mt-2 text-xs text-[var(--text-tertiary)]">
                <span className="whitespace-nowrap">⏱ {o.timeToRecovery}</span>
                <span className="flex-1">↳ {o.tradeoff}</span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="flex justify-end">
        <Button onClick={onContinue} disabled={!selected}>Implement →</Button>
      </div>
    </motion.div>
  );
}
