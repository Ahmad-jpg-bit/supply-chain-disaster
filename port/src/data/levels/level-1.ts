/* ─────────────────────────────────────────────────────────────
   Supply Chain Disaster — Level 1: Demand Forecasting & Inventory Basics
   CSCP concept: Mean Absolute Percentage Error (MAPE) · Domain SCPE
   4 scenarios (FREE tier). Signature reveal: "forecast-lock".

   Ported from src/data/scenarios-expanded.js → CHAPTER_SCENARIOS.demand_forecasting
   Strategy options/tradeoffs are the original SC content; diagnosisItems
   (ASSESS phase) and implementSteps (procurement) are newly authored.
   simulationCurves are derived from each option's conceptAlignment.
   ──────────────────────────────────────────────────────────── */

import type { Chapter, LevelMeta } from "@/types";

/* Reusable per-turn gap-closure shapes keyed off conceptAlignment.
   Each value = fraction of the gap to the optimal outcome closed that turn.
   optimal → clean convergence · cautious → muted, capped · risky → volatile crash. */
const CURVE = {
  optimal:  [0.12, 0.34, 0.62, 0.85, 0.97, 1.0],
  cautious: [0.10, 0.26, 0.42, 0.52, 0.57, 0.58],
  risky:    [0.16, 0.44, 0.55, 0.28, -0.05, -0.28],
} as const;

const level1Chapters: Chapter[] = [
  // ── 1-1 ───────────────────────────────────────────────────
  {
    id: "1-1",
    level: 1,
    chapter: 1,
    title: "Steady Seas",
    theme: "Q1 nearly matched forecast — now set a documented Q2 ordering policy.",
    highlightNode: "warehouse",
    isHook: false,
    narrative: `
Q1 just closed with **987 units** sold — nearly matching your **1,000-unit** forecast.
Your Shenzhen supplier confirmed on-time delivery for the next 3 months and the
warehouse holds **1,450 units**.

The board wants a documented ordering policy before Q2 begins.
**How do you set your initial inventory strategy?**
    `.trim(),
    initialMetrics: { turn: 0, serviceLevel: 94, cash: 250_000, inventory: 1450, backlog: 0, satisfaction: 90 },
    diagnosisItems: [
      { id: "d1", label: "Forecast error is low (~1.3% MAPE) — demand is stable and predictable", severity: "minor", isCorrect: true,
        hint: "987 actual vs 1,000 forecast is a tiny miss — the forecast is trustworthy." },
      { id: "d2", label: "1,450 units on hand against ~1,000 demand ties up cash in holding costs", severity: "major", isCorrect: true,
        hint: "Excess buffer is the real cost here, not accuracy." },
      { id: "d3", label: "Supplier lead time is the binding constraint this quarter", severity: "major", isCorrect: false,
        hint: "Delivery is confirmed on-time — lead time isn't the problem." },
    ],
    strategyOptions: [
      { id: "s1", title: "Match Forecast Exactly (Lean Start)",
        description: "Order precisely to the forecast — minimal waste, no excess buffer.",
        riskLevel: "low", timeToRecovery: "1 quarter",
        tradeoff: "Minimal waste, but no buffer if anything changes.",
        alignment: "optimal", isOptimal: true },
      { id: "s2", title: "Order 50% Extra (Play It Safe)",
        description: "Build a comfortable buffer against surprises.",
        riskLevel: "medium", timeToRecovery: "1 quarter",
        tradeoff: "Warehouse is full — and so are your holding costs.",
        alignment: "cautious", isOptimal: false },
      { id: "s3", title: "Order Minimum (Cut Costs)",
        description: "Keep orders razor-thin to free up cash.",
        riskLevel: "high", timeToRecovery: "1 quarter",
        tradeoff: "If demand ticks up even slightly, you're caught short.",
        alignment: "risky", isOptimal: false },
    ],
    implementSteps: [
      { id: "impl-1", instruction: "Choose the supplier for your Q2 order:",
        type: "select_option", correctValue: "Shenzhen — on-time confirmed (6-week lead)",
        options: ["Shenzhen — on-time confirmed (6-week lead)", "New domestic vendor — 2-week lead, +40% unit cost"],
        hint: "Your existing supplier already confirmed on-time delivery at your normal cost." },
      { id: "impl-2", instruction: "Set the Q2 order quantity (units) to match the documented forecast:",
        type: "number_input", correctValue: "1000", tolerance: 100,
        hint: "Forecast is ~1,000 units and you already hold buffer stock." },
    ],
    simulationCurves: { s1: [...CURVE.optimal], s2: [...CURVE.cautious], s3: [...CURVE.risky] },
    xpReward: 100,
  },

  // ── 1-2 ───────────────────────────────────────────────────
  {
    id: "1-2",
    level: 1,
    chapter: 2,
    title: "Holiday Season Approaching",
    theme: "Q4 historically runs 2.1× baseline — and your lead time is 6 weeks.",
    highlightNode: "store",
    isHook: false,
    narrative: `
Three years of POS data shows Q4 demand averaging **2,340 units** — **2.1×** your
Q1–Q3 baseline of 1,100. Marketing just confirmed a **$200K Black Friday campaign**
launching in **6 weeks**.

Current inventory sits at **800 units** and your Shenzhen supplier needs **6 weeks**
lead time to fill a large order. Miss the window and you miss the quarter.
**How do you prepare?**
    `.trim(),
    initialMetrics: { turn: 0, serviceLevel: 88, cash: 220_000, inventory: 800, backlog: 0, satisfaction: 85 },
    diagnosisItems: [
      { id: "d1", label: "Lead time (6 wks) exactly equals the campaign runway — zero slack to react later", severity: "critical", isCorrect: true,
        hint: "If you wait for demand signals, the order arrives after Black Friday." },
      { id: "d2", label: "Three years of seasonal data gives a reliable 2.1× multiplier to plan against", severity: "major", isCorrect: true,
        hint: "This is a data-driven forecast, not a guess." },
      { id: "d3", label: "800 units on hand already covers projected Q4 demand", severity: "minor", isCorrect: false,
        hint: "800 vs ~2,340 projected — you're badly short." },
    ],
    strategyOptions: [
      { id: "s1", title: "Scale Up Gradually (Data-Driven)",
        description: "Increase orders ~80% based on the historical seasonal trend.",
        riskLevel: "low", timeToRecovery: "1 quarter",
        tradeoff: "Smart use of data leaves you well-positioned.",
        alignment: "optimal", isOptimal: true },
      { id: "s2", title: "Double Everything (Max Prep)",
        description: "Go all-in on holiday stock to guarantee no stockout.",
        riskLevel: "medium", timeToRecovery: "1 quarter",
        tradeoff: "If demand matches you're golden; if not, you're sitting on expensive stock.",
        alignment: "cautious", isOptimal: false },
      { id: "s3", title: "Wait and React (See What Happens)",
        description: "Hold and wait for real demand signals before committing.",
        riskLevel: "high", timeToRecovery: "1+ quarters",
        tradeoff: "By the time orders spiked, your 6-week lead time worked against you.",
        alignment: "risky", isOptimal: false },
    ],
    implementSteps: [
      { id: "impl-1", instruction: "When should you place the Q4 order to land stock before Black Friday?",
        type: "select_option", correctValue: "Now — 6+ weeks ahead of the campaign",
        options: ["Now — 6+ weeks ahead of the campaign", "After the campaign launches and demand is confirmed"],
        hint: "Order arrival = order date + 6 weeks. Work backwards from Black Friday." },
      { id: "impl-2", instruction: "Set the order quantity (units) using the 2.1× seasonal multiplier off baseline:",
        type: "number_input", correctValue: "2340", tolerance: 250,
        hint: "1,100 baseline × 2.1 ≈ 2,340; net of your 800 on hand." },
    ],
    simulationCurves: { s1: [...CURVE.optimal], s2: [...CURVE.cautious], s3: [...CURVE.risky] },
    xpReward: 120,
  },

  // ── 1-3 ───────────────────────────────────────────────────
  {
    id: "1-3",
    level: 1,
    chapter: 3,
    title: "New Competitor Enters Market",
    theme: "A funded rival is taking ~15% of your category — your forecast assumed sole leadership.",
    highlightNode: "store",
    isHook: false,
    narrative: `
**VeloTech** — a Singapore rival backed by **$40M Series B** — launched last week at
pricing **12% below yours**. Retail intelligence shows them winning shelf space at
Target and Walmart already.

Their first-month data suggests they're taking roughly **15%** of your category.
Your forecast was built assuming sole market leadership.
**How do you adjust?**
    `.trim(),
    initialMetrics: { turn: 0, serviceLevel: 91, cash: 240_000, inventory: 1300, backlog: 0, satisfaction: 88 },
    diagnosisItems: [
      { id: "d1", label: "Forecast assumption (sole market leader) is now invalid — a structural demand shift", severity: "critical", isCorrect: true,
        hint: "This isn't noise; the market itself changed. The baseline must move." },
      { id: "d2", label: "~15% category share loss should be reflected as a lower demand multiplier", severity: "major", isCorrect: true,
        hint: "Re-forecast down, don't just absorb it as excess stock." },
      { id: "d3", label: "The 12% price gap means you must immediately match their price", severity: "minor", isCorrect: false,
        hint: "A price war is a strategy choice with real margin cost — not a forced diagnosis." },
    ],
    strategyOptions: [
      { id: "s1", title: "Reduce Forecast by 15% (Realistic Adjustment)",
        description: "Re-forecast to reflect the new competitive reality.",
        riskLevel: "low", timeToRecovery: "1 quarter",
        tradeoff: "Inventory levels stay efficient and matched to true demand.",
        alignment: "optimal", isOptimal: true },
      { id: "s2", title: "Maintain Current Levels (Hold Steady)",
        description: "Keep ordering the same amounts and ride it out.",
        riskLevel: "medium", timeToRecovery: "1–2 quarters",
        tradeoff: "Excess inventory builds up as demand softens.",
        alignment: "cautious", isOptimal: false },
      { id: "s3", title: "Increase Orders to Compete (Price War)",
        description: "Ramp orders and slash prices to defend share.",
        riskLevel: "high", timeToRecovery: "2+ quarters",
        tradeoff: "Margins bleed, but you hold market share.",
        alignment: "risky", isOptimal: false },
    ],
    implementSteps: [
      { id: "impl-1", instruction: "How should you treat the ~15% share loss in your model?",
        type: "select_option", correctValue: "Lower the demand baseline (structural shift)",
        options: ["Lower the demand baseline (structural shift)", "Treat it as one-off noise and keep the baseline"],
        hint: "A funded competitor winning shelf space is permanent, not a blip." },
      { id: "impl-2", instruction: "Set the adjusted order quantity (units) after a 15% demand reduction off ~1,100:",
        type: "number_input", correctValue: "935", tolerance: 100,
        hint: "1,100 × 0.85 ≈ 935." },
    ],
    simulationCurves: { s1: [...CURVE.optimal], s2: [...CURVE.cautious], s3: [...CURVE.risky] },
    xpReward: 120,
  },

  // ── 1-4 ───────────────────────────────────────────────────
  {
    id: "1-4",
    level: 1,
    chapter: 4,
    title: "AI Demand Sensing",
    theme: "An $8.4K/mo AI forecasting platform promises 8% MAPE — but it's untrained on your category.",
    highlightNode: "warehouse",
    isHook: false,
    narrative: `
**Crisp.co** is pitching a demand-sensing platform that ingests 3M daily POS signals,
social trends, and weather to forecast demand 30 days out. Case study: a CPG brand cut
forecast error from **22% MAPE to 8%** in six months. Cost: **$8,400/month**.

Catch: the model has never seen your product category, and your planners have no idea
how it weights signals. **How do you deploy it?**
    `.trim(),
    initialMetrics: { turn: 0, serviceLevel: 89, cash: 210_000, inventory: 1200, backlog: 0, satisfaction: 86 },
    diagnosisItems: [
      { id: "d1", label: "An untrained model with no human oversight is an unbounded MAPE risk", severity: "critical", isCorrect: true,
        hint: "A model that's never seen your category can miss badly on unfamiliar events." },
      { id: "d2", label: "Rejecting AI entirely cedes reaction speed to competitors already using it", severity: "major", isCorrect: true,
        hint: "Doing nothing is also a decision with a cost." },
      { id: "d3", label: "$8,400/month is the primary reason to walk away", severity: "minor", isCorrect: false,
        hint: "Cost matters, but the real question is model risk vs. accuracy gain." },
    ],
    strategyOptions: [
      { id: "s1", title: "Deploy with Human Oversight (Hybrid)",
        description: "AI generates forecasts; planners review and adjust outliers.",
        riskLevel: "low", timeToRecovery: "1–2 quarters",
        tradeoff: "Accuracy improved ~18% and the team learned to trust — and challenge — the model.",
        alignment: "optimal", isOptimal: true },
      { id: "s2", title: "Reject the Platform (Stick to Spreadsheets)",
        description: "Stay with manual forecasting you already understand.",
        riskLevel: "medium", timeToRecovery: "2+ quarters",
        tradeoff: "Competitors using AI demand sensing react faster and win shelf space.",
        alignment: "cautious", isOptimal: false },
      { id: "s3", title: "Full Automation (Trust the Algorithm)",
        description: "Let the AI run forecasts end-to-end, no human in the loop.",
        riskLevel: "high", timeToRecovery: "2+ quarters",
        tradeoff: "It nailed routine weeks, then a regional event it had never seen caused a massive misforecast.",
        alignment: "risky", isOptimal: false },
    ],
    implementSteps: [
      { id: "impl-1", instruction: "Choose the deployment model for the AI forecaster:",
        type: "select_option", correctValue: "Hybrid — AI proposes, planners review outliers",
        options: ["Hybrid — AI proposes, planners review outliers", "Full automation — no human review"],
        hint: "Keep a human in the loop until the model is proven on your category." },
      { id: "impl-2", instruction: "Target forecast error to plan against for the first quarter (% MAPE, hybrid ramp):",
        type: "number_input", correctValue: "14", tolerance: 4,
        hint: "You won't hit the 8% case-study number immediately — plan for a ~14% ramp from 22%." },
    ],
    simulationCurves: { s1: [...CURVE.optimal], s2: [...CURVE.cautious], s3: [...CURVE.risky] },
    xpReward: 140,
  },
];

/* The concept container (= SEO "Level"): CSCP term + reveal + scenarios.
   CSCP copy ported verbatim from src/data/cscp-definitions.js. */
export const level1: LevelMeta = {
  id: 1,
  slug: "demand_forecasting",
  title: "Demand Forecasting & Inventory Basics",
  tagline: "Every supply chain begins with one question: how much will customers want?",
  revealType: "forecast-lock",
  concept: {
    term: "Mean Absolute Percentage Error (MAPE)",
    domain: "SCPE",
    domainFull: "Supply Chain Planning & Execution",
    definition:
      "MAPE measures forecast accuracy as the average absolute percentage difference between forecasted and actual demand. A lower MAPE indicates a more accurate forecast. It is the most widely used metric for comparing forecast performance across products and time periods.",
    whyItMatters:
      "Every inventory and procurement decision is downstream of your forecast. A 20% MAPE means 1 in 5 units is either excess stock tying up cash or a stockout costing you revenue. CSCP candidates must understand how MAPE, MAD, and bias work together to diagnose forecasting problems.",
    examTip:
      "MAPE = (Σ |Actual − Forecast| / Actual) × 100 ÷ n. Watch for questions that contrast MAPE (percentage-based, good for cross-product comparison) with MAD (absolute units, good for reorder-point calculations).",
    memoryHook:
      "Think of MAPE as your “miss rate” — the higher it is, the more often your forecast is embarrassingly wrong.",
  },
  insightTitle:
    "A low MAPE means your forecast is trustworthy — don't over-buffer against noise, and don't ignore a structural shift.",
  insightBody: `
**The principle.** Forecast accuracy (MAPE) is the foundation every other decision sits on.
A tiny miss (Steady Seas) means you can run lean; a reliable seasonal signal (Holiday) means
you commit early despite lead time; a structural change (VeloTech) means you move the baseline,
not just the buffer; and a powerful-but-unproven tool (AI sensing) earns trust through oversight,
not blind automation.

**The trap.** Treating a real signal as noise — or noise as a real signal — is how forecasts
break. Both directions cost you: one in stockouts, the other in dead inventory.
  `.trim(),
  chapters: level1Chapters,
};

export { level1Chapters };
