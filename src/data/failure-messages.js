/**
 * Failure Messages & Cause-of-Death Detection
 *
 * Each cause maps to 4 sarcastic termination letter messages.
 * getCauseOfDeath() derives the cause from end-of-game state.
 * getFailureMessage() picks a random message from the matching category.
 */

export const CAUSES = {
    BANKRUPTCY:         'BANKRUPTCY',
    CUSTOMER_REVOLT:    'CUSTOMER_REVOLT',
    CUSTOMS_SEIZURE:    'CUSTOMS_SEIZURE',
    LATE_DELIVERY:      'LATE_DELIVERY',
    SUPPLY_COLLAPSE:    'SUPPLY_COLLAPSE',
    MANAGEMENT_FAILURE: 'MANAGEMENT_FAILURE',
};

const CAUSE_LABELS = {
    BANKRUPTCY:         'Financial Insolvency (Self-Inflicted)',
    CUSTOMER_REVOLT:    'Mass Customer Defection',
    CUSTOMS_SEIZURE:    'Regulatory Non-Compliance / Defective Goods',
    LATE_DELIVERY:      'Chronic Delivery Failure',
    SUPPLY_COLLAPSE:    'Supply Chain Disintegration',
    MANAGEMENT_FAILURE: 'General Incompetence (Multiple Counts)',
};

const MESSAGES = {
    BANKRUPTCY: [
        {
            headline: 'Visionary Leader Burns Company to Financial Rubble',
            body: 'Your aggressive cost-cutting strategy successfully cut everything, including the company. Wall Street analysts are calling it "a bold, if terminal, interpretation of lean manufacturing." The janitor is being retained. You are not.',
            sign: 'The Accounting Department',
        },
        {
            headline: 'Cash Flow Achieves Unprecedented Agility',
            body: 'Congratulations on achieving a negative cash position. Finance textbooks define this as "bankruptcy," but we prefer to think of it as extreme liquidity flexibility. The bank uses the other term. Please return your company card.',
            sign: 'Former CFO (Also Filing)',
        },
        {
            headline: 'Budget Optimisation Goes Precisely One Step Too Far',
            body: 'Your vision for a zero-waste supply chain was genuinely inspirational. Running a zero-asset supply chain is not what we meant. There is a difference. We have enclosed a diagram.',
            sign: 'Board of Directors',
        },
        {
            headline: 'Finance Team Requests Your Dictionary Define "Profit"',
            body: 'After 32 turns, our finance team has concluded that you may have been playing a different game entirely — one where negative numbers are celebrated. They are not. This one is not that game.',
            sign: 'Treasury Department (Liquidating)',
        },
    ],

    CUSTOMER_REVOLT: [
        {
            headline: 'Customer Satisfaction Scores Break Records (Downward)',
            body: 'Our NPS score has reached a number typically associated with medieval tax collection. Customers are not merely dissatisfied — they are organising. There is a subreddit. It has more subscribers than we have customers.',
            sign: 'Head of Customer Success (On Extended Leave)',
        },
        {
            headline: 'Company Achieves Perfect Unity: Everyone Agrees We Are Terrible',
            body: 'In a rare display of cross-demographic alignment, surveyed customers unanimously agreed they would rather receive nothing than receive what we delivered. This is technically a customer alignment success. We are not celebrating.',
            sign: 'VP of Brand Experience',
        },
        {
            headline: '"Anti-Delivery" Strategy Confounds Entire Industry',
            body: 'Our customers have not merely switched to competitors. They have written essays about it. One was published in a logistics journal. It won an award. We were cited under "What Not to Do (Section 4)."',
            sign: 'Marketing Department (Restructured Out of Existence)',
        },
        {
            headline: 'Loyalty Programme Achieves 0% Retention',
            body: 'The loyalty programme you ignored was, in hindsight, the least of our problems. Customers have demonstrated a different kind of loyalty — to our competitors, permanently.',
            sign: 'Customer Retention Team (Formerly)',
        },
    ],

    CUSTOMS_SEIZURE: [
        {
            headline: 'Quality Control Department Asks That You Not Mention Them',
            body: 'Customs officials have confiscated your shipment and are using it as a training example titled "How Not To Do This." Your defect rate is now a case study in three universities. Two of them have named the failure mode after you.',
            sign: 'Legal (Extremely Busy Right Now)',
        },
        {
            headline: 'Regulatory Compliance: A Bold Optional Strategy',
            body: 'Your belief that customs inspections were "suggestions" has been formally disproven at a cost that will appear in next quarter\'s earnings call. There will not be a next quarter. The inspectors send their regards.',
            sign: 'The Compliance Team You Defunded in Chapter 3',
        },
        {
            headline: 'Product Quality Officially Described as "Technically a Product"',
            body: 'Inspectors noted your products did pass the "is this a product?" screening test. They failed every subsequent test. All 47 of them. Customs has kept the shipment as a monument to ambition over execution.',
            sign: 'International Trade Authority, Enforcement Division',
        },
        {
            headline: 'Inspection Bypass Strategy Works Perfectly Until It Doesn\'t',
            body: 'The good news: your low-cost supplier delivered on schedule. The bad news: so did their defect rate. The worse news: customs noticed before your customers did. The worse-worse news: barely.',
            sign: 'Quality Assurance (Retroactively Hired, Too Late)',
        },
    ],

    LATE_DELIVERY: [
        {
            headline: 'Company Redefines "Just-In-Time" as "Eventually, Probably"',
            body: 'Your interpretation of delivery timelines has baffled logistics experts across four continents. When our key partner requested same-day delivery, they did not mean the same day in a different month and a different hemisphere.',
            sign: 'Head of Operations (Resigned, On Time)',
        },
        {
            headline: 'Manager Discovers Time Is, In Fact, Linear',
            body: 'Despite multiple briefings confirming that Thursday comes before Friday, shipments continued to arrive on the following Thursday. A different Thursday. The customers had already moved on. Emotionally and physically.',
            sign: 'Your Remaining 2 Customers',
        },
        {
            headline: 'Deadlines Treated as Decorative Suggestions Throughout',
            body: 'In a field where timing is literally the product, your delivery record suggests a deep philosophical opposition to punctuality. We respect the commitment to principle. We cannot continue the employment arrangement.',
            sign: 'Supply Chain Review Board',
        },
        {
            headline: 'Lead Times Set New Company Record (Wrong Direction)',
            body: 'At current velocity, your last shipment is expected to arrive during a fiscal year that does not yet exist. We have modelled this. The model was not optimistic. Neither is the board.',
            sign: 'Logistics Analytics Team',
        },
    ],

    SUPPLY_COLLAPSE: [
        {
            headline: 'Single Point of Failure Fails Spectacularly at Single Point',
            body: 'Your supplier network, described internally as "definitely fine," has collapsed in the exact sequence risk analysts warned about in the briefing you did not attend. The presentation slides are available. The slides were correct.',
            sign: 'The Risk Management Team You Ignored',
        },
        {
            headline: 'Diversification Strategy Documented as "One Supplier Is Enough"',
            body: 'Experts recommend 3–5 backup suppliers. You had one. That supplier had one factory. That factory had one forklift. The forklift is fine, for the record. It has a new job with a competitor.',
            sign: 'Procurement Department',
        },
        {
            headline: 'Resilience Initiative Achieves Perfect Fragility',
            body: 'Your supply chain responded to disruption the way a house of cards responds to a ceiling fan: briefly, beautifully, and all at once. The debrief will be long. You will not be present for it.',
            sign: 'Emergency Response Committee',
        },
        {
            headline: 'Upstream Dependency Risk Becomes Downstream Reality',
            body: 'The risk matrix flagged this. The scenario planning flagged this. The supplier\'s own annual report flagged this. We have attached the flags. There were many flags.',
            sign: 'Strategic Risk Office',
        },
    ],

    MANAGEMENT_FAILURE: [
        {
            headline: 'Performance Review Concludes: Technically Present',
            body: 'After extensive committee review, we agreed you were physically present for most decisions. Mentally, the committee remains uncertain. The decisions remain as evidence. The evidence is not flattering.',
            sign: 'Human Resources',
        },
        {
            headline: 'Manager Sets New Benchmark for Benchmarks to Avoid',
            body: 'Future supply chain training modules will include a new section titled "The Manager Method," categorised under "Historical Cautionary Examples (Advanced)." It is not a compliment. We checked with the lawyers.',
            sign: 'NexTrack Academy',
        },
        {
            headline: 'Synergistic Strategic Pivot Fails to Generate Synergy',
            body: 'Despite deploying several industry buzzwords correctly in meetings, the underlying supply chain continued to behave as if strategic alignment were optional. We have concluded the supply chain had a point.',
            sign: 'Strategic Alignment Council',
        },
        {
            headline: 'Decision Consistency Described as "Consistently Wrong"',
            body: 'In 32 turns you demonstrated an impressive ability to select the least optimal option with statistical regularity that our analysts initially mistook for a deliberate experiment. It was not.',
            sign: 'Data Science Team',
        },
    ],
};

function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * Determine cause of death from end-of-game state.
 * Returns a CAUSES constant, or null if no failure condition is met.
 *
 * @param {{ cash: number, overall: object, summaries: object[], history: object[] }} params
 * @returns {string|null}
 */
export function getCauseOfDeath({ cash, overall, summaries, history }) {
    const totalRisky = summaries.reduce((sum, s) => sum + (s.decisions?.risky ?? 0), 0);
    const totalDecisions = summaries.reduce(
        (sum, s) => sum + (s.decisions?.optimal ?? 0) + (s.decisions?.cautious ?? 0) + (s.decisions?.risky ?? 0),
        0,
    );
    const riskyRatio = totalDecisions > 0 ? totalRisky / totalDecisions : 0;
    const totalPassedDefects = history.reduce((sum, t) => sum + (t.defectsPassed || 0), 0);
    const avgSatisfaction = history.length
        ? history.reduce((sum, t) => sum + (t.satisfaction || 0), 0) / history.length
        : 50;

    if (cash < 0)                return CAUSES.BANKRUPTCY;
    if (avgSatisfaction < 20)    return CAUSES.CUSTOMER_REVOLT;
    if (totalPassedDefects > 25) return CAUSES.CUSTOMS_SEIZURE;
    if (riskyRatio >= 0.50)      return CAUSES.LATE_DELIVERY;
    if (riskyRatio >= 0.35)      return CAUSES.SUPPLY_COLLAPSE;
    if (overall.percentage < 35) return CAUSES.MANAGEMENT_FAILURE;

    return null; // no failure — game completed with a passing grade
}

/**
 * Pick a random message for the given cause.
 * @param {string} cause
 * @returns {{ headline, body, sign, causeLabel }}
 */
export function getFailureMessage(cause) {
    const pool = MESSAGES[cause] ?? MESSAGES[CAUSES.MANAGEMENT_FAILURE];
    return {
        ...pick(pool),
        causeLabel: CAUSE_LABELS[cause] ?? CAUSE_LABELS[CAUSES.MANAGEMENT_FAILURE],
    };
}
