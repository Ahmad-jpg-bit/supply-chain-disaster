"use client";

/* ─────────────────────────────────────────────────────────────
   RecoveryReveal — the animated "level complete" moment.

   SEO Disaster ends a chapter with organic traffic climbing on an
   area chart. Here, EACH of the 10 levels gets its own signature
   motion themed to its CSCP concept (see REVEAL_BODY). All ten are
   built: two are Recharts-driven, the rest are bespoke SVG + Framer
   Motion pieces so no two levels feel alike.

   Stack: Recharts + Framer Motion + design tokens (globals.css),
   matching SimulationGraph.tsx / NumberTicker.tsx conventions.
   ──────────────────────────────────────────────────────────── */

import { useEffect, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  ReferenceLine, ReferenceArea, ResponsiveContainer,
} from "recharts";
import { NumberTicker } from "@/components/ui/NumberTicker";
import { Button } from "@/components/ui/Button";
import type { MetricSnapshot, LevelRevealType } from "@/types";

const TICK_MS = 380; // per-turn cadence (matches SimulationGraph feel)

interface Props {
  revealType: LevelRevealType;
  snapshots: MetricSnapshot[];
  conceptTerm: string;
  onContinue: () => void;
}

interface RevealProps {
  visible: MetricSnapshot[];
  accent: string;
}

/* One line of identity per level: headline verb, accent color, kicker. */
const REVEAL_SPEC: Record<LevelRevealType, { headline: string; accent: string; kicker: string }> = {
  "forecast-lock":      { headline: "Forecast locked in.",         accent: "var(--color-primary)", kicker: "Actual demand converged on your plan" },
  "bullwhip-dampen":    { headline: "The whip settled.",           accent: "var(--color-warn)",    kicker: "Order swings damped back to signal" },
  "reorder-sawtooth":   { headline: "Inventory found its rhythm.", accent: "var(--color-win)",     kicker: "Stock cycled cleanly above the reorder point" },
  "network-contain":    { headline: "Disruption contained.",       accent: "var(--color-warn)",    kicker: "The shock stopped spreading across nodes" },
  "tco-stack":          { headline: "True cost revealed.",         accent: "var(--color-primary)", kicker: "Hidden landed-cost layers surfaced" },
  "intermodal-flow":    { headline: "Freight kept moving.",        accent: "var(--color-win)",     kicker: "Cargo flowed sea → rail → road" },
  "quality-funnel":     { headline: "Yield climbed.",              accent: "var(--color-win)",     kicker: "Defects funnelled out of the line" },
  "circular-loop":      { headline: "The loop closed.",            accent: "var(--color-win)",     kicker: "Returns fed back into the chain" },
  "continuity-reroute": { headline: "Supply rerouted.",            accent: "var(--color-warn)",    kicker: "Flow bypassed the failed region" },
  "nearshore-map":      { headline: "Network re-drawn.",           accent: "var(--color-primary)", kicker: "Nodes migrated closer to demand" },
};

export function RecoveryReveal({ revealType, snapshots, conceptTerm, onContinue }: Props) {
  const visibleCount = usePlaythrough(snapshots.length);
  const visible = snapshots.slice(0, Math.max(1, visibleCount));
  const done = visibleCount >= snapshots.length;
  const spec = REVEAL_SPEC[revealType];
  const Body = REVEAL_BODY[revealType];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-5"
      style={{ viewTransitionName: "recovery-reveal" } as CSSProperties}
    >
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-[var(--text-tertiary)] mb-1">
          Level complete · {conceptTerm}
        </p>
        <h2 className="text-2xl font-bold text-[var(--text-primary)]">{spec.kicker}</h2>
      </header>

      <Body visible={visible} accent={spec.accent} />

      <AnimatePresence>
        {done && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="flex items-center justify-between gap-4"
          >
            <span
              className="text-sm font-semibold px-3 py-1.5 rounded-full"
              style={{ color: spec.accent, background: "color-mix(in srgb, currentColor 14%, transparent)" }}
            >
              ✓ {spec.headline}
            </span>
            <Button onClick={onContinue}>Continue →</Button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════
   Shared bits
   ══════════════════════════════════════════════════════════════ */

function RevealCard({ stats, children }: { stats: ReactNode; children: ReactNode }) {
  return (
    <div className="space-y-4">
      {stats}
      <div className="bg-[var(--surface-raised)] border border-[var(--surface-border)] rounded-[var(--radius-lg)] p-4">
        {children}
      </div>
    </div>
  );
}

function Stat({ label, value, suffix, decimals = 0, color, invert = false }:
  { label: string; value: number; suffix?: string; decimals?: number; color: string; invert?: boolean }) {
  return (
    <div className="bg-[var(--surface-overlay)] border border-[var(--surface-border)] rounded-[var(--radius-md)] p-3">
      <p className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider mb-1.5">{label}</p>
      <NumberTicker value={value} suffix={suffix} decimals={decimals} className="text-xl font-bold" />
      <span className="sr-only">{invert ? "lower is better" : "higher is better"}</span>
      <span aria-hidden className="block mt-1 h-0.5 rounded-full" style={{ background: color, opacity: 0.6 }} />
    </div>
  );
}

const Svg = ({ children }: { children: ReactNode }) => (
  <svg viewBox="0 0 400 180" className="w-full" style={{ height: 200 }} role="img">{children}</svg>
);

const last = (v: MetricSnapshot[]) => v[v.length - 1];

/* ══════════════════════════════════════════════════════════════
   L1 · forecast-lock — actual converges on forecast, error band shrinks
   ══════════════════════════════════════════════════════════════ */
function ForecastLockReveal({ visible, accent }: RevealProps) {
  const s = last(visible);
  const serviceLevel = s?.serviceLevel ?? 0;
  const forecastError = Math.max(0, Math.round(100 - serviceLevel));
  const data = visible.map((d) => ({
    turn: `T${d.turn}`,
    actual: Math.round(d.serviceLevel),
    gap: Math.max(0, Math.round(100 - d.serviceLevel)),
  }));

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Service Level" value={serviceLevel} suffix="%" color="var(--color-win)" />
        <Stat label="Forecast Error (MAPE)" value={forecastError} suffix="%" color={accent} invert />
      </div>
    }>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <defs>
            <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-win)" stopOpacity={0.28} />
              <stop offset="95%" stopColor="var(--color-win)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="turn" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={100} stroke={accent} strokeDasharray="5 4" strokeWidth={1.5}
            label={{ value: "Forecast target", position: "insideTopRight", fill: "var(--text-tertiary)", fontSize: 10 }} />
          <Area type="monotone" dataKey="actual" stackId="fc" stroke="var(--color-win)" strokeWidth={2}
            fill="url(#actualGrad)" dot={false} isAnimationActive={false} name="Demand fulfilled %" />
          <Area type="monotone" dataKey="gap" stackId="fc" stroke="none"
            fill={accent} fillOpacity={0.14} isAnimationActive={false} name="Forecast error band" />
        </AreaChart>
      </ResponsiveContainer>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L2 · bullwhip-dampen — order oscillation decays onto true demand
   ══════════════════════════════════════════════════════════════ */
function BullwhipDampenReveal({ visible, accent }: RevealProps) {
  const TRUE = 100, SUBSTEPS = 6, START_AMP = 58, DECAY = 0.62;
  const ampAt = (t: number) => START_AMP * Math.exp(-DECAY * t);
  const data = visible.flatMap((s) =>
    Array.from({ length: SUBSTEPS }, (_, j) => {
      const t = s.turn + j / SUBSTEPS;
      return { label: `T${s.turn}`, orders: Math.round(TRUE + ampAt(t) * Math.sin(t * Math.PI * 1.7)) };
    })
  );
  const lastTurn = last(visible)?.turn ?? 0;
  const ratio = 1 + ampAt(lastTurn) / TRUE;

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Bullwhip Ratio" value={ratio} decimals={2} color={accent} invert />
        <Stat label="Service Level" value={last(visible)?.serviceLevel ?? 0} suffix="%" color="var(--color-win)" />
      </div>
    }>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} interval={SUBSTEPS - 1} />
          <YAxis domain={[0, 170]} tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <ReferenceLine y={TRUE} stroke="var(--text-tertiary)" strokeDasharray="5 4" strokeWidth={1.5}
            label={{ value: "True demand", position: "insideTopRight", fill: "var(--text-tertiary)", fontSize: 10 }} />
          <Line type="monotone" dataKey="orders" stroke={accent} strokeWidth={2.5} dot={false} isAnimationActive={false} name="Upstream orders" />
        </LineChart>
      </ResponsiveContainer>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L3 · reorder-sawtooth — inventory cycles above the reorder point
   ══════════════════════════════════════════════════════════════ */
function ReorderSawtoothReveal({ visible }: RevealProps) {
  const ROP = 30, TOP = 92, K = 6;
  const data = visible.flatMap((s) =>
    Array.from({ length: K }, (_, j) => ({ label: `T${s.turn}`, inv: Math.round(TOP - (TOP - ROP) * (j / K)) }))
  );
  const s = last(visible);

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Service Level" value={s?.serviceLevel ?? 0} suffix="%" color="var(--color-win)" />
        <Stat label="Stockouts" value={s?.backlog ?? 0} suffix=" u" color="var(--color-disaster)" invert />
      </div>
    }>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="label" tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} interval={K - 1} />
          <YAxis domain={[0, 100]} tick={{ fill: "var(--text-tertiary)", fontSize: 11 }} axisLine={false} tickLine={false} />
          <ReferenceArea y1={0} y2={ROP} fill="var(--color-warn)" fillOpacity={0.10} />
          <ReferenceLine y={ROP} stroke="var(--color-warn)" strokeDasharray="5 4" strokeWidth={1.5}
            label={{ value: "Reorder point + safety stock", position: "insideTopRight", fill: "var(--text-tertiary)", fontSize: 10 }} />
          <Line type="linear" dataKey="inv" stroke="var(--color-win)" strokeWidth={2.5} dot={false} isAnimationActive={false} name="Inventory on hand" />
        </LineChart>
      </ResponsiveContainer>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L4 · network-contain — a disruption ripples, then is walled off
   ══════════════════════════════════════════════════════════════ */
function NetworkContainReveal({ visible }: RevealProps) {
  const labels = ["supplier", "factory", "ship", "warehouse", "store"];
  const xs = [44, 122, 200, 278, 356];
  const y = 84;

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Service Level" value={last(visible)?.serviceLevel ?? 0} suffix="%" color="var(--color-win)" />
        <Stat label="Nodes Affected" value={2} color="var(--color-warn)" invert />
      </div>
    }>
      <Svg>
        {xs.slice(0, -1).map((x, i) => (
          <line key={i} x1={x + 15} y1={y} x2={xs[i + 1] - 15} y2={y} stroke="var(--surface-border)" strokeWidth={2} />
        ))}
        <motion.circle cx={xs[2]} cy={y} r={28} fill="none" stroke="var(--color-win)" strokeWidth={2}
          initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: [0, 1, 0.5] }}
          transition={{ delay: 1.35, duration: 0.8 }}
          style={{ transformOrigin: `${xs[2]}px ${y}px`, transformBox: "view-box" } as CSSProperties} />
        {xs.map((x, i) => (
          <g key={x}>
            <circle cx={x} cy={y} r={15} fill="var(--color-win)" opacity={0.9} />
            {i < 3 && (
              <motion.circle cx={x} cy={y} r={15} fill="var(--color-disaster)"
                initial={{ opacity: 0 }} animate={{ opacity: [0, 0.95, 0] }}
                transition={{ delay: 0.2 + i * 0.35, duration: 0.9 }} />
            )}
            <text x={x} y={y + 34} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">{labels[i]}</text>
          </g>
        ))}
      </Svg>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L5 · tco-stack — hidden cost layers stack to true landed cost
   ══════════════════════════════════════════════════════════════ */
function TcoStackReveal({ visible }: RevealProps) {
  const layers = [
    { label: "Unit price", pct: 40, c: "#EF9F27" },
    { label: "Freight", pct: 20, c: "#BA7517" },
    { label: "Tariffs", pct: 15, c: "#854F0B" },
    { label: "Holding", pct: 15, c: "#F59E0B" },
    { label: "Risk", pct: 10, c: "#ef4444" },
  ];

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Sticker Price" value={40} suffix=" idx" color="#EF9F27" />
        <Stat label="True Landed Cost" value={100} color="var(--color-primary)" invert />
      </div>
    }>
      <div className="flex h-10 w-full rounded-[var(--radius-md)] overflow-hidden">
        {layers.map((l, i) => (
          <motion.div key={l.label} style={{ background: l.c }}
            initial={{ width: 0 }} animate={{ width: `${l.pct}%` }}
            transition={{ delay: i * 0.32, duration: 0.5, ease: [0.22, 1, 0.36, 1] }} />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
        {layers.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5 text-[11px] text-[var(--text-secondary)]">
            <span className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: l.c }} />
            {l.label} · {l.pct}%
          </span>
        ))}
      </div>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L6 · intermodal-flow — a container hops sea → rail → road
   ══════════════════════════════════════════════════════════════ */
function IntermodalFlowReveal({ visible }: RevealProps) {
  const legs = [
    { x1: 30, x2: 150, c: "#378add", label: "Sea" },
    { x1: 150, x2: 270, c: "#1d9e75", label: "Rail" },
    { x1: 270, x2: 366, c: "#ef9f27", label: "Road" },
  ];
  const y = 82;

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Service Level" value={last(visible)?.serviceLevel ?? 0} suffix="%" color="var(--color-win)" />
        <Stat label="On-Time Delivery" value={last(visible)?.satisfaction ?? 0} suffix="%" color="var(--color-win)" />
      </div>
    }>
      <Svg>
        {legs.map((l) => (
          <g key={l.label}>
            <line x1={l.x1} y1={y} x2={l.x2} y2={y} stroke={l.c} strokeWidth={4} strokeLinecap="round" />
            <text x={(l.x1 + l.x2) / 2} y={y + 26} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">{l.label}</text>
          </g>
        ))}
        {[30, 150, 270, 366].map((x) => (
          <circle key={x} cx={x} cy={y} r={4} fill="var(--surface-overlay)" stroke="var(--text-tertiary)" strokeWidth={1.5} />
        ))}
        <motion.circle cy={y} r={7} fill="var(--color-primary)"
          initial={{ cx: 30 }} animate={{ cx: [30, 150, 270, 366] }}
          transition={{ duration: 2.4, times: [0, 0.4, 0.75, 1], ease: "linear" }} />
      </Svg>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L7 · quality-funnel — defects eject, good units pass, yield climbs
   ══════════════════════════════════════════════════════════════ */
function QualityFunnelReveal({ visible }: RevealProps) {
  const yield_ = last(visible)?.serviceLevel ?? 0;
  const funnel = "M70,26 L330,26 L214,116 L214,150 L186,150 L186,116 Z";

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="First-Pass Yield" value={yield_} suffix="%" color="var(--color-win)" />
        <Stat label="Defect Rate" value={Math.max(0, Math.round(100 - yield_))} suffix="%" color="var(--color-disaster)" invert />
      </div>
    }>
      <Svg>
        <path d={funnel} fill="var(--color-win)" fillOpacity={0.06} stroke="var(--surface-border)" strokeWidth={2} />
        {[0, 1, 2, 3].map((i) => (
          <motion.circle key={`d${i}`} r={4} fill="var(--color-disaster)"
            initial={{ cx: 200, cy: 46 + i * 6, opacity: 0 }}
            animate={{ cx: i % 2 ? 336 : 64, cy: 40 + i * 8, opacity: [0, 1, 0] }}
            transition={{ delay: 0.2 + i * 0.25, duration: 0.9 }} />
        ))}
        {[0, 1, 2].map((i) => (
          <motion.circle key={`g${i}`} cx={200} r={5} fill="var(--color-win)"
            initial={{ cy: 32, opacity: 0 }} animate={{ cy: 152, opacity: [0, 1, 1, 0.2] }}
            transition={{ delay: 1 + i * 0.4, duration: 1.1 }} />
        ))}
      </Svg>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L8 · circular-loop — the reverse-logistics loop draws closed
   ══════════════════════════════════════════════════════════════ */
function CircularLoopReveal({ visible }: RevealProps) {
  const cx = 200, cy = 90, r = 52;
  const stages = [
    { t: "Make", x: 200, y: 24 }, { t: "Use", x: 286, y: 94 },
    { t: "Return", x: 200, y: 166 }, { t: "Recycle", x: 114, y: 94 },
  ];

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Service Level" value={last(visible)?.serviceLevel ?? 0} suffix="%" color="var(--color-win)" />
        <Stat label="Material Recovered" value={last(visible)?.satisfaction ?? 0} suffix="%" color="var(--color-win)" />
      </div>
    }>
      <Svg>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--surface-border)" strokeWidth={2} />
        {/* static -90° rotation (via <g>) starts the draw at the top */}
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          <motion.circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--color-win)" strokeWidth={3} strokeLinecap="round"
            initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 2.2, ease: "easeInOut" }} />
        </g>
        {stages.map((s) => (
          <text key={s.t} x={s.x} y={s.y} textAnchor="middle" fontSize={10} fill="var(--text-tertiary)">{s.t}</text>
        ))}
        <motion.circle cx={cx} cy={cy - r} r={6} fill="var(--color-win)"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2 }} />
      </Svg>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L9 · continuity-reroute — flow bypasses the failed region
   ══════════════════════════════════════════════════════════════ */
function ContinuityRerouteReveal({ visible }: RevealProps) {
  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Service Level" value={last(visible)?.serviceLevel ?? 0} suffix="%" color="var(--color-win)" />
        <Stat label="Downtime" value={0} suffix=" days" color="var(--color-warn)" invert />
      </div>
    }>
      <Svg>
        {/* primary route — fails */}
        <motion.path d="M40,90 Q200,38 360,90" fill="none" stroke="var(--text-tertiary)" strokeWidth={2}
          initial={{ opacity: 0.9 }} animate={{ opacity: [0.9, 0.9, 0.25] }} transition={{ duration: 1.2 }} />
        <motion.g initial={{ opacity: 0, scale: 0 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.8, duration: 0.4 }}
          style={{ transformOrigin: "200px 52px", transformBox: "view-box" } as CSSProperties}>
          <line x1={193} y1={45} x2={207} y2={59} stroke="var(--color-disaster)" strokeWidth={2.5} strokeLinecap="round" />
          <line x1={207} y1={45} x2={193} y2={59} stroke="var(--color-disaster)" strokeWidth={2.5} strokeLinecap="round" />
        </motion.g>
        {/* secondary route — engages */}
        <motion.path d="M40,90 Q200,146 360,90" fill="none" stroke="var(--color-win)" strokeWidth={2.5} strokeLinecap="round"
          initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 1.1, duration: 1.2, ease: "easeInOut" }} />
        <motion.circle r={6} fill="var(--color-win)"
          initial={{ cx: 40, cy: 90, opacity: 0 }}
          animate={{ cx: [40, 200, 360], cy: [90, 138, 90], opacity: [0, 1, 1] }}
          transition={{ delay: 1.1, duration: 1.3, ease: "easeInOut" }} />
        <circle cx={40} cy={90} r={9} fill="var(--surface-overlay)" stroke="var(--text-tertiary)" strokeWidth={1.5} />
        <circle cx={360} cy={90} r={9} fill="var(--surface-overlay)" stroke="var(--text-tertiary)" strokeWidth={1.5} />
      </Svg>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   L10 · nearshore-map — supply nodes migrate toward demand
   ══════════════════════════════════════════════════════════════ */
function NearshoreMapReveal({ visible }: RevealProps) {
  const hub = { x: 344, y: 90 };
  const nodes = [
    { y: 46, x0: 40, xn: 214 }, { y: 90, x0: 54, xn: 236 }, { y: 134, x0: 44, xn: 220 },
  ];

  return (
    <RevealCard stats={
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Service Level" value={last(visible)?.serviceLevel ?? 0} suffix="%" color="var(--color-win)" />
        <Stat label="Avg Lead Time" value={2} suffix=" wk" color="var(--color-primary)" invert />
      </div>
    }>
      <Svg>
        {nodes.map((n, i) => (
          <g key={i}>
            <motion.line y1={n.y} x2={hub.x} y2={hub.y} stroke="var(--surface-border)" strokeWidth={1.5}
              initial={{ x1: n.x0 }} animate={{ x1: n.xn }} transition={{ duration: 2, delay: i * 0.2, ease: [0.22, 1, 0.36, 1] }} />
            <motion.circle cy={n.y} r={9} fill="var(--color-primary)"
              initial={{ cx: n.x0 }} animate={{ cx: n.xn }} transition={{ duration: 2, delay: i * 0.2, ease: [0.22, 1, 0.36, 1] }} />
          </g>
        ))}
        <circle cx={hub.x} cy={hub.y} r={16} fill="var(--color-win)" />
        <text x={hub.x} y={hub.y + 32} textAnchor="middle" fontSize={9} fill="var(--text-tertiary)">demand</text>
      </Svg>
    </RevealCard>
  );
}

/* ══════════════════════════════════════════════════════════════
   Dispatch + playthrough
   ══════════════════════════════════════════════════════════════ */
const REVEAL_BODY: Record<LevelRevealType, (p: RevealProps) => ReactElement> = {
  "forecast-lock": ForecastLockReveal,
  "bullwhip-dampen": BullwhipDampenReveal,
  "reorder-sawtooth": ReorderSawtoothReveal,
  "network-contain": NetworkContainReveal,
  "tco-stack": TcoStackReveal,
  "intermodal-flow": IntermodalFlowReveal,
  "quality-funnel": QualityFunnelReveal,
  "circular-loop": CircularLoopReveal,
  "continuity-reroute": ContinuityRerouteReveal,
  "nearshore-map": NearshoreMapReveal,
};

/** Plays snapshots turn-by-turn, returning how many are currently visible. */
function usePlaythrough(total: number): number {
  const [count, setCount] = useState(1);
  useEffect(() => {
    if (total <= 1) return;
    setCount(1);
    const id = setInterval(() => {
      setCount((c) => {
        if (c >= total) { clearInterval(id); return c; }
        return c + 1;
      });
    }, TICK_MS);
    return () => clearInterval(id);
  }, [total]);
  return count;
}
