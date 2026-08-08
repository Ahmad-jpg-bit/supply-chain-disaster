/* ─────────────────────────────────────────────────────────────
   Supply Chain Disaster — Core Game Types  (ported onto the
   SEO Disaster Next.js shell)

   Container mapping vs. SEO Disaster:
     SEO "Level"   → SC "Chapter"  (holds one CSCP concept)   = LevelMeta
     SEO "Chapter" → SC "Scenario" (one 5-phase disaster arc) = Chapter
   ──────────────────────────────────────────────────────────── */

export type DifficultyMode = "guided" | "normal" | "expert";

export type PlayerTier = "free" | "full";

export type GamePhase =
  | "ASSESS"       // diagnose the root supply-chain problem
  | "STRATEGIZE"   // pick the ordering / response policy
  | "IMPLEMENT"    // execute procurement: supplier, shipping, quantity
  | "MONITOR"      // watch KPIs resolve over the turns
  | "DEBRIEF";     // CSCP concept + real-world principle

/** 1–10 → one CSCP concept each (was SEO's 1–4 levels). */
export type LevelId = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

export type StarRating = 0 | 1 | 2 | 3;

/** Every strategy option lands in one of three CSCP-alignment buckets. */
export type ConceptAlignment = "optimal" | "cautious" | "risky";

/** Node highlighted in the supply-chain-flow SVG during ASSESS/MONITOR. */
export type FlowNode =
  | "supplier"
  | "factory"
  | "ship"
  | "truck"
  | "warehouse"
  | "store";

// ─── Outcome metrics (the animated KPI snapshot) ──────────────
// Only *outcomes* live here. Inputs (leadTime, unitCost) are
// IMPLEMENT-phase choices, not snapshot fields.

export interface MetricSnapshot {
  turn: number;          // ← SEO "week"
  serviceLevel: number;  // HERO metric, 0–100 (% of demand fulfilled)
  cash: number;          // $ runway
  inventory: number;     // units on hand
  backlog: number;       // unfulfilled units — LOWER is better (inverse metric)
  satisfaction: number;  // customer satisfaction, 0–100
}

// ─── Scenario data shapes ─────────────────────────────────────

export interface DiagnosisItem {
  id: string;
  label: string;
  severity: "critical" | "major" | "minor";
  hint?: string;          // shown in Guided mode only
  isCorrect: boolean;     // whether this is a real issue to identify
}

export interface StrategyOption {
  id: string;
  title: string;
  description: string;
  riskLevel: "low" | "medium" | "high";
  timeToRecovery: string;      // e.g. "1 quarter"
  tradeoff: string;            // one-liner on the downside (SC "outcomeText")
  alignment: ConceptAlignment; // optimal | cautious | risky
  isOptimal: boolean;          // === alignment === "optimal"; drives 3-star scoring
}

export type ImplementType = "select_option" | "number_input";

export interface ImplementStep {
  id: string;
  instruction: string;
  type: ImplementType;
  correctValue: string;
  hint?: string;
  /** select_option: explicit choices. */
  options?: string[];
  /** number_input: acceptable tolerance around correctValue (± units). */
  tolerance?: number;
}

/** SEO "Level" analogue: the CSCP concept container (= one SC chapter). */
export interface CSCPConcept {
  term: string;
  domain: "SCD" | "SCPE" | "SCIBP";
  domainFull: string;
  definition: string;
  whyItMatters: string;
  examTip: string;
  memoryHook: string;
}

/**
 * Per-level signature reveal — the animated moment after finishing a
 * level, themed to that level's CSCP concept (the supply-chain answer
 * to SEO Disaster's "traffic climbing" graph). One distinct motion each.
 */
export type LevelRevealType =
  | "forecast-lock"       // L1 Demand Forecasting — forecast & actual converge, error band shrinks
  | "bullwhip-dampen"     // L2 Bullwhip Effect — order oscillation amplitude decays to calm
  | "reorder-sawtooth"    // L3 JIT / Safety Stock — inventory sawtooth rides the ROP line, safety band fills
  | "network-contain"     // L4 Risk Management — disruption ripple spreads then is contained across nodes
  | "tco-stack"           // L5 Total Cost of Ownership — hidden cost layers stack up to true landed cost
  | "intermodal-flow"     // L6 Logistics — cargo hops ship→rail→truck across a route
  | "quality-funnel"      // L7 Quality (COQ) — defect funnel tightens, yield climbs
  | "circular-loop"       // L8 Sustainability — reverse-logistics loop closes into a circle
  | "continuity-reroute"  // L9 BCP — supply reroutes around a failed region
  | "nearshore-map";      // L10 Network Design — nodes migrate / nearshore on a map

export interface Chapter {
  id: string;                 // e.g. "1-1" (level-scenario)
  level: LevelId;             // which CSCP concept (= SC chapter)
  chapter: number;            // scenario index within the level (1–4)
  title: string;
  theme: string;              // one-line dramatic summary
  narrative: string;          // the disaster briefing story (markdown)
  highlightNode: FlowNode;    // drives the supply-chain-flow SVG
  isHook: boolean;            // free cliffhanger scenario
  hookCliffhanger?: string;
  initialMetrics: MetricSnapshot;
  diagnosisItems: DiagnosisItem[];
  strategyOptions: StrategyOption[];
  implementSteps: ImplementStep[];
  simulationCurves: Record<string, number[]>; // strategyId → per-turn gap-closure fractions (0..1)
  xpReward: number;
}

/** The concept container: one CSCP term + its scenarios + its signature reveal. */
export interface LevelMeta {
  id: LevelId;
  slug: string;               // e.g. "demand_forecasting"
  title: string;
  tagline: string;            // shown on the level intro card
  concept: CSCPConcept;       // DefinitionCard shown at level debrief
  revealType: LevelRevealType;
  insightTitle: string;       // headline for the level-end insight
  insightBody: string;        // the real-world principle (markdown)
  chapters: Chapter[];
}

// ─── Live game session ────────────────────────────────────────

export interface GameSession {
  chapterId: string;
  phase: GamePhase;
  difficulty: DifficultyMode;
  selectedDiagnoses: string[];
  selectedStrategy: string | null;
  implementProgress: Record<string, string>;
  simulationTurn: number;
  currentMetrics: MetricSnapshot;
  recoveryScore: number;      // 0–100
  elapsedSeconds: number;
  isComplete: boolean;
}
