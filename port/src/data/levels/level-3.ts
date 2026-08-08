/* ─────────────────────────────────────────────────────────────
   Supply Chain Disaster — Level 3: JIT & Safety Stock
   CSCP concept: Reorder Point (ROP) & Safety Stock · Domain SCPE
   4 scenarios. Signature reveal: "reorder-sawtooth".

   Ported from src/data/scenarios-expanded.js → CHAPTER_SCENARIOS.jit_safety_stock
   Strategy options/tradeoffs are the original SC content; diagnosisItems
   (ASSESS) and implementSteps (procurement) are newly authored.
   ──────────────────────────────────────────────────────────── */

import type { Chapter, LevelMeta } from "@/types";

const CURVE = {
  optimal:  [0.12, 0.34, 0.62, 0.85, 0.97, 1.0],
  cautious: [0.10, 0.26, 0.42, 0.52, 0.57, 0.58],
  risky:    [0.16, 0.44, 0.55, 0.28, -0.05, -0.28],
} as const;

const level3Chapters: Chapter[] = [
  // ── 3-1 ───────────────────────────────────────────────────
  {
    id: "3-1",
    level: 3,
    chapter: 1,
    title: "Zero Waste Initiative",
    theme: "$2.1M in holding costs. The board wants JIT — but your tier-2 suppliers miss 22% of quarters.",
    highlightNode: "factory",
    isHook: false,
    narrative: `
Your CFO dropped a number in the board meeting: **$2.1M** in holding costs last year —
**8.4% of COGS**, nearly double the **4.5%** industry benchmark. The COO wants it halved
with a full JIT rollout before Q3.

Your 3 tier-1 suppliers hit on-time **94%** of quarters. Your tier-2 raw-material suppliers:
**78%**. JIT turns that 22% failure rate into a production stoppage.
**How aggressively do you roll out JIT?**
    `.trim(),
    initialMetrics: { turn: 0, serviceLevel: 90, cash: 240_000, inventory: 1600, backlog: 0, satisfaction: 84 },
    diagnosisItems: [
      { id: "d1", label: "Holding cost at 8.4% of COGS is ~2× benchmark — real cash is trapped in inventory", severity: "major", isCorrect: true,
        hint: "This is the pressure driving the JIT push." },
      { id: "d2", label: "Tier-2 supplier reliability (78%) makes pure JIT a stockout risk on raw materials", severity: "critical", isCorrect: true,
        hint: "JIT removes the buffer that currently hides that 22% failure rate." },
      { id: "d3", label: "Tier-1 suppliers (94%) are the weak link that JIT would expose", severity: "minor", isCorrect: false,
        hint: "Tier-1 is reliable; tier-2 is the exposure." },
    ],
    strategyOptions: [
      { id: "s1", title: "Phased JIT + Safety Stock on Critical Parts",
        description: "JIT on commodity items; keep safety stock for critical components.",
        riskLevel: "low", timeToRecovery: "2 quarters",
        tradeoff: "Holding costs dropped ~25% with minimal disruption risk.",
        alignment: "optimal", isOptimal: true },
      { id: "s2", title: "Keep Current Inventory Levels (Too Risky)",
        description: "Pass on JIT entirely and hold today's buffers.",
        riskLevel: "medium", timeToRecovery: "n/a",
        tradeoff: "The board is disappointed and competitors gain a cost advantage.",
        alignment: "cautious", isOptimal: false },
      { id: "s3", title: "Full JIT Across All Lines (Max Savings)",
        description: "Strip buffers everywhere for maximum holding-cost savings.",
        riskLevel: "high", timeToRecovery: "2+ quarters",
        tradeoff: "One supplier hiccup away from a full production shutdown.",
        alignment: "risky", isOptimal: false },
    ],
    implementSteps: [
      { id: "impl-1", instruction: "Which items keep safety stock under the phased rollout?",
        type: "select_option", correctValue: "Critical components (unreliable tier-2)",
        options: ["Critical components (unreliable tier-2)", "All items equally", "None — pure JIT"],
        hint: "Protect the parts whose suppliers miss delivery windows." },
      { id: "impl-2", instruction: "Set weeks of safety stock to hold on critical components:",
        type: "number_input", correctValue: "2", tolerance: 1,
        hint: "Enough to cover typical tier-2 slippage without rebuilding the old buffer." },
    ],
    simulationCurves: { s1: [...CURVE.optimal], s2: [...CURVE.cautious], s3: [...CURVE.risky] },
    xpReward: 140,
  },

  // ── 3-2 ───────────────────────────────────────────────────
  {
    id: "3-2",
    level: 3,
    chapter: 2,
    title: "Automation vs. Flexibility",
    theme: "87-minute changeovers are throttling JIT — but the robotic cell means 30% fewer jobs.",
    highlightNode: "factory",
    isHook: false,
    narrative: `
Assembly Line 3 runs 6 SKUs with an **87-minute** average changeover — a figure your TPS
consultant called "career-ending." A Fanuc robotic cell brings it to **9 minutes**, but the
**$1.4M** investment requires cutting that line's headcount by **30%**.

The union represents **340 workers** here and the rumor is already spreading. Your production
manager needs a decision before the union meeting in 5 days.
    `.trim(),
    initialMetrics: { turn: 0, serviceLevel: 87, cash: 210_000, inventory: 1400, backlog: 20, satisfaction: 82 },
    diagnosisItems: [
      { id: "d1", label: "Long changeovers (87 min) cap SKU flexibility — the real constraint on JIT here", severity: "critical", isCorrect: true,
        hint: "JIT needs small, frequent lots; slow changeovers block that." },
      { id: "d2", label: "Losing experienced operators risks the manual fallback when automation glitches", severity: "major", isCorrect: true,
        hint: "Institutional knowledge is a hidden asset the headcount cut would destroy." },
      { id: "d3", label: "The $1.4M capital cost is the primary blocker", severity: "minor", isCorrect: false,
        hint: "The payback is clear; the workforce and knowledge trade-off is the real question." },
    ],
    strategyOptions: [
      { id: "s1", title: "Retrain Workers to Run the Cells (Upskill)",
        description: "Operators become robot supervisors; no layoffs.",
        riskLevel: "low", timeToRecovery: "2 quarters",
        tradeoff: "Changeover fell to ~12 min, no layoffs, and the union became an advocate.",
        alignment: "optimal", isOptimal: true },
      { id: "s2", title: "Keep Manual Changeovers (Avoid Conflict)",
        description: "Sidestep the union fight and keep the line as-is.",
        riskLevel: "medium", timeToRecovery: "n/a",
        tradeoff: "Competitors with faster changeovers now offer shorter lead times and wider ranges.",
        alignment: "cautious", isOptimal: false },
      { id: "s3", title: "Full Automation, Cut Headcount",
        description: "Fastest changeovers via automation and a 30% headcount cut.",
        riskLevel: "high", timeToRecovery: "2+ quarters",
        tradeoff: "Morale cratered; when robots glitched, nobody knew the manual fallback.",
        alignment: "risky", isOptimal: false },
    ],
    implementSteps: [
      { id: "impl-1", instruction: "Choose the workforce approach for the robotic cell:",
        type: "select_option", correctValue: "Retrain operators as cell supervisors",
        options: ["Retrain operators as cell supervisors", "Reduce headcount by 30%"],
        hint: "Keep the people who know the manual fallback." },
      { id: "impl-2", instruction: "Target changeover time after the cell goes live (minutes):",
        type: "number_input", correctValue: "12", tolerance: 4,
        hint: "Retraining lands near ~12 min, not the theoretical 9." },
    ],
    simulationCurves: { s1: [...CURVE.optimal], s2: [...CURVE.cautious], s3: [...CURVE.risky] },
    xpReward: 150,
  },

  // ── 3-3 ───────────────────────────────────────────────────
  {
    id: "3-3",
    level: 3,
    chapter: 3,
    title: "Delayed Shipment",
    theme: "Your PCB supplier (65% of volume) is frozen in lockdown. The line goes dark Wednesday.",
    highlightNode: "ship",
    isHook: false,
    narrative: `
Friday 4:47pm — an email from **Foxlink**, your primary PCB supplier and **65%** of component
volume: their Zhengzhou facility is under emergency lockdown. The **$340,000** shipment due
Monday is frozen.

Under your JIT policy you have **3 days** of production stock left. The line goes dark
**Wednesday** unless something changes. **What's your move?**
    `.trim(),
    initialMetrics: { turn: 0, serviceLevel: 85, cash: 200_000, inventory: 600, backlog: 40, satisfaction: 80 },
    diagnosisItems: [
      { id: "d1", label: "3 days of stock vs a frozen 65%-volume supplier = imminent line stoppage", severity: "critical", isCorrect: true,
        hint: "The clock, not the cost, is the emergency." },
      { id: "d2", label: "Single-source concentration on Foxlink is the underlying vulnerability", severity: "major", isCorrect: true,
        hint: "No qualified backup is why one lockdown threatens the whole line." },
      { id: "d3", label: "The $340K shipment value is the main problem to solve", severity: "minor", isCorrect: false,
        hint: "Continuity of supply matters more than this one invoice right now." },
    ],
    strategyOptions: [
      { id: "s1", title: "Activate Backup Supplier + Ration Stock",
        description: "Trigger the pre-qualified backup and stretch current stock.",
        riskLevel: "low", timeToRecovery: "1 quarter",
        tradeoff: "Backup filled the gap at a slight premium; customers barely noticed.",
        alignment: "optimal", isOptimal: true },
      { id: "s2", title: "Spot Buy at Any Price (Panic Mode)",
        description: "Buy whatever is available on the spot market immediately.",
        riskLevel: "medium", timeToRecovery: "1 quarter",
        tradeoff: "Production continued at ~2× cost — margins vanished.",
        alignment: "cautious", isOptimal: false },
      { id: "s3", title: "Wait for Primary Supplier (Trust the Relationship)",
        description: "Hold and count on Foxlink to recover in time.",
        riskLevel: "high", timeToRecovery: "3+ weeks",
        tradeoff: "Production stopped for 11 days; orders piled up. JIT without backups is a gamble.",
        alignment: "risky", isOptimal: false },
    ],
    implementSteps: [
      { id: "impl-1", instruction: "Choose the continuity response:",
        type: "select_option", correctValue: "Backup supplier + ration current stock",
        options: ["Backup supplier + ration current stock", "Spot buy at any price", "Wait for Foxlink"],
        hint: "A pre-qualified backup is why you can survive this." },
      { id: "impl-2", instruction: "Days of stock you must bridge until backup parts land (order the bridge):",
        type: "number_input", correctValue: "3", tolerance: 1,
        hint: "You have 3 days of stock before the line goes dark." },
    ],
    simulationCurves: { s1: [...CURVE.optimal], s2: [...CURVE.cautious], s3: [...CURVE.risky] },
    xpReward: 150,
  },

  // ── 3-4 ───────────────────────────────────────────────────
  {
    id: "3-4",
    level: 3,
    chapter: 4,
    title: "Finding the Sweet Spot",
    theme: "73% of disruptions trace to 4 parts. How much safety stock buys the most protection?",
    highlightNode: "warehouse",
    isHook: false,
    narrative: `
Six months of JIT data tells a clear story: **73%** of disruptions trace to just **4 components** —
the main PCB, power module, display unit, and housing seal — all from long-lead-time,
high-variance suppliers.

A hybrid model (JIT on everything else, safety stock only on these 4) costs **+$85K/year** in
holding but could eliminate roughly **$340K/year** in expediting. **How much safety stock?**
    `.trim(),
    initialMetrics: { turn: 0, serviceLevel: 89, cash: 230_000, inventory: 1300, backlog: 10, satisfaction: 85 },
    diagnosisItems: [
      { id: "d1", label: "A Pareto few (4 parts) drive most disruption — target safety stock there", severity: "major", isCorrect: true,
        hint: "73% of the problem sits in 4 SKUs; don't buffer everything." },
      { id: "d2", label: "+$85K holding vs −$340K expediting means targeted buffer pays ~4:1", severity: "major", isCorrect: true,
        hint: "The trade-off math favours the hybrid, not pure JIT." },
      { id: "d3", label: "The right answer is maximum safety stock on all items", severity: "minor", isCorrect: false,
        hint: "That rebuilds the holding costs JIT was meant to cut." },
    ],
    strategyOptions: [
      { id: "s1", title: "2 Weeks Safety Stock on Critical Items (Data-Backed)",
        description: "Buffer only the 4 disruption-driving parts, sized to the data.",
        riskLevel: "low", timeToRecovery: "1 quarter",
        tradeoff: "Analysis showed 2 weeks covers 95% of disruptions — the cost/protection sweet spot.",
        alignment: "optimal", isOptimal: true },
      { id: "s2", title: "6 Weeks Safety Stock (Maximum Buffer)",
        description: "Hold a deep buffer so you never stock out.",
        riskLevel: "medium", timeToRecovery: "1 quarter",
        tradeoff: "You'll never stock out — but you're back to pre-JIT holding costs.",
        alignment: "cautious", isOptimal: false },
      { id: "s3", title: "No Safety Stock (Pure JIT)",
        description: "Commit to pure JIT despite the disruption data.",
        riskLevel: "high", timeToRecovery: "2+ quarters",
        tradeoff: "Bold — but the next disruption could be devastating.",
        alignment: "risky", isOptimal: false },
    ],
    implementSteps: [
      { id: "impl-1", instruction: "Which parts receive strategic safety stock?",
        type: "select_option", correctValue: "The 4 disruption-driving components only",
        options: ["The 4 disruption-driving components only", "Every component", "No components"],
        hint: "Follow the Pareto data — 4 parts, 73% of disruptions." },
      { id: "impl-2", instruction: "Set safety-stock coverage on the critical 4 (weeks):",
        type: "number_input", correctValue: "2", tolerance: 1,
        hint: "2 weeks covers ~95% of disruptions per the analysis." },
    ],
    simulationCurves: { s1: [...CURVE.optimal], s2: [...CURVE.cautious], s3: [...CURVE.risky] },
    xpReward: 170,
  },
];

export const level3: LevelMeta = {
  id: 3,
  slug: "jit_safety_stock",
  title: "JIT & Safety Stock",
  tagline: "Lean enough to free cash, buffered enough to survive the shock.",
  revealType: "reorder-sawtooth",
  concept: {
    term: "Reorder Point (ROP) & Safety Stock",
    domain: "SCPE",
    domainFull: "Supply Chain Planning & Execution",
    definition:
      "The Reorder Point is the inventory level at which a new order must be placed to avoid a stockout during lead time. Safety Stock is the buffer held above the ROP to absorb variability in demand or lead time. ROP = (Average Daily Demand × Lead Time) + Safety Stock.",
    whyItMatters:
      "ROP and safety-stock calculations are guaranteed to appear on the CSCP exam as numerical questions. They bridge JIT philosophy (minimize inventory) with operational reality (variability exists). Getting them wrong means either stockouts or millions in excess inventory.",
    examTip:
      "Safety Stock = Z × σ_LTD, where Z is the service-level z-score and σ_LTD is the standard deviation of demand during lead time. A 95% service level uses Z = 1.65; 99% uses Z = 2.33. Know these z-scores by heart.",
    memoryHook:
      "ROP is your “order now” alarm. Safety stock is the snooze button that keeps you running if the alarm goes off late.",
  },
  insightTitle:
    "JIT without safety stock is a bet that nothing goes wrong — target the buffer where variability actually lives.",
  insightBody: `
**The principle.** Just-in-time frees the cash trapped in inventory, but variability doesn't
disappear — it just loses its buffer. The winning move every time in this chapter is *targeted*:
phase JIT onto reliable items, and hold safety stock precisely where lead time and supplier
variance are worst (Zero Waste, Sweet Spot), keep a qualified backup for single-source risk
(Delayed Shipment), and protect the knowledge that runs the line (Automation vs. Flexibility).

**The trap.** Pure JIT looks cheapest on the spreadsheet and detonates on the first disruption;
maximum buffer is safe but rebuilds the holding costs you set out to cut. The reorder point plus
a data-sized safety stock is the line between the two.
  `.trim(),
  chapters: level3Chapters,
};

export { level3Chapters };
