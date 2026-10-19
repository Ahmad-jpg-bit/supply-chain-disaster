/**
 * Pre-game (/play landing) strings.
 *
 * The site has no i18n framework yet, so the pre-game copy lives here as one
 * keyed dictionary per locale. Keys are UI keys — never scenario or industry
 * IDs — so a translation never has to touch game data. Only locales with a
 * usable translated GAME belong in AVAILABLE_LOCALES; the game itself is
 * English-only today, so no language switcher is shown.
 *
 * Interpolation: t('key', { name: 'X' }) replaces {name}.
 */

export const AVAILABLE_LOCALES = ['en'];
export const LOCALE = 'en';

const STRINGS = {
    en: {
        // Hero
        'hero.eyebrow': 'Interactive supply-chain strategy simulation',
        'hero.title': 'Your supplier cuts capacity. Demand keeps rising. What do you order next?',
        'hero.sub': 'You start as a procurement analyst answering to a board. Each quarter you read a briefing, choose a response, then set your supplier, shipping, order quantity, pricing, quality inspection and safety stock — and see what it did to cash, stock and customers before the next quarter begins.',
        'hero.facts.industries': '{n} industries',
        'hero.facts.chapters': '{n} chapters',
        'hero.facts.turns': '{n} quarterly turns',
        'hero.facts.free': 'Full campaign free · no account or card needed',
        'hero.choose': 'Choose your industry',

        // Resume
        'resume.checking': 'Checking for your saved game…',
        'resume.eyebrow': 'Saved game',
        'resume.title': '{industry} — continue at Chapter {chapter}: {chapterTitle}',
        'resume.titleMid': '{industry} — continue Chapter {chapter}: {chapterTitle}, quarter {quarter} of {quarters}',
        'resume.meta.device': 'Saved on this device {date} · cash {cash} · {done} of {total} quarters played',
        'resume.meta.email': 'Backed up to {email} {date} · cash {cash} · {done} of {total} quarters played',
        'resume.cta': 'Resume {industry}',
        'resume.new': 'Start a new game instead',
        'resume.completed': 'Your last saved {industry} campaign is complete. Pick an industry to play again.',
        'resume.error': 'We couldn’t check for a saved game right now. You can still start a new one.',

        // Industry picker
        'picker.title': 'Choose your industry',
        'picker.sub': 'Same 10 chapters in every industry — different economics. Pick one to see your mission; nothing starts until you press Start.',
        'picker.recommended': 'Suggested first run',
        'picker.selected': 'Selected',
        'picker.saved': 'Your saved game',
        'picker.free': 'Free · full campaign',
        'picker.difficulty': 'Difficulty: {level}',
        'picker.toPreview': 'See the mission briefing',
        'difficulty.Easy': 'Easier',
        'difficulty.Medium': 'Moderate',
        'difficulty.Hard': 'Harder',

        // Industry challenge + decision themes (values come from the engine)
        'ind.fmcg.challenge': 'High volume on a thin margin. Demand is steady, so the money is won or lost on cost discipline and replenishment rhythm.',
        'ind.fmcg.t1': 'Thin margin — sell at {price} a unit against a {cost} base cost',
        'ind.fmcg.t2': 'Fastest restock: {lead}-quarter base lead time',
        'ind.fmcg.t3': 'Steadiest demand (±{swing} a quarter), so overstock quietly eats margin',
        'ind.pharma.challenge': 'Long lead times and sudden regulatory demand spikes. Margins are generous, but running out is costly.',
        'ind.pharma.t1': '{chance} chance each quarter of a +{spikeLo}–{spikeHi} regulatory demand spike',
        'ind.pharma.t2': 'Longest base lead time: {lead} quarters',
        'ind.pharma.t3': 'Budget supplier: {saving} cheaper, {defects} defective, +{weeks} weeks',
        'ind.electronics.challenge': 'The most volatile demand in the game. Forecasting is hard and cheap suppliers ship more defects.',
        'ind.electronics.t1': 'Demand swings up to ±{swing} a quarter',
        'ind.electronics.t2': '{lead}-quarter base lead time — order before you see demand',
        'ind.electronics.t3': 'Budget supplier: {saving} cheaper but {defects} defective',

        // Mission preview
        'preview.empty.title': 'Pick an industry to see your mission',
        'preview.empty.body': 'You’ll see your starting position, what’s at stake and the decisions you’ll make. Selecting an industry doesn’t start a game.',
        'preview.eyebrow': 'Mission briefing · {industry}',
        'preview.role.h': 'Your role',
        'preview.role.body': '{rank} — {remit} You answer to a board: stockouts, losses and broken promises lower its confidence, and at zero you’re dismissed.',
        'preview.opening.h': 'Opening situation',
        'preview.opening.body': 'Chapter 1: {title}. {desc}',
        'preview.opening.roll': 'Your opening market condition is drawn at random when you start — one of {n}, from a balanced start to a cash crunch or an active disruption.',
        'preview.stakes.h': 'What’s at stake',
        'preview.stakes.capital': 'Starting capital',
        'preview.stakes.capitalNote': 'before the opening condition',
        'preview.stakes.lead': 'Base lead time',
        'preview.stakes.leadVal.one': '{n} quarter',
        'preview.stakes.leadVal.other': '{n} quarters',
        'preview.stakes.swing': 'Demand swing',
        'preview.stakes.holding': 'Holding cost',
        'preview.stakes.holdingVal': '{rate} of stock value per quarter',
        'preview.stakes.margin': 'Base margin',
        'preview.decisions.h': 'Decisions each quarter',
        'preview.decisions.body': 'Respond to the quarter’s briefing (three options), then set supplier, shipping, order quantity, pricing, quality inspection and safety-stock target. A breaking crisis can still land before the quarter resolves.',
        'preview.practice.h': 'What you’ll practise first',
        'preview.practice.body': 'Chapters 1–3 cover {c1}, {c2} and {c3}. Seven more chapters follow, through risk, cost of ownership, logistics, quality, sustainability and global networks.',
        'preview.case.h': 'Chapter 1 case study in this industry',
        'preview.sample.summary': 'Preview a real Chapter 1 briefing',
        'preview.sample.note': 'Preview only — briefings come in a random order, so yours may differ. Outcomes aren’t shown and nothing is saved.',
        'preview.start': 'Start the {industry} campaign',
        'preview.startNew': 'Start a new {industry} game',
        'preview.startNote': 'Begins at Chapter 1 · free · no account needed · saves automatically in this browser',
        'preview.status': '{industry} selected',

        // Confirm overwrite
        'confirm.title': 'Start a new game?',
        'confirm.bodyDevice': 'Your {industry} game saved on this device is replaced as soon as the new game starts.',
        'confirm.bodyEmail': 'Your {industry} game backed up to {email} stays available until the new game backs up to that email — when you press Save or finish a chapter.',
        'confirm.yes': 'Start new game',
        'confirm.no': 'Keep my saved game',

        // How it works
        'how.title': 'How it works',
        'how.s1.h': '1. Choose an industry',
        'how.s1.b': 'Each has its own demand, lead times, margins and suppliers.',
        'how.s2.h': '2. Decide under disruption',
        'how.s2.b': 'Answer the quarter’s briefing, then set the six operating decisions with live cost and timing estimates.',
        'how.s3.h': '3. Review the consequences',
        'how.s3.b': 'See shipments, demand, shortages and profit for the quarter — then adjust your strategy for the next one.',
        'how.img1': 'A quarterly briefing with three responses',
        'how.img2': 'The decision workspace with cost, arrival and stock estimates',
        'how.img3': 'Quarterly results: shipments received, demand, units fulfilled, shortage, stock and cash',
        'learn.title': 'What the decisions teach',
        'learn.l1': 'Unit cost vs defect rate vs lead time when choosing a supplier',
        'learn.l2': 'Freight cost vs arrival time — and why an order can land after the shortage',
        'learn.l3': 'Stock availability vs holding cost, and how safety stock buffers uncertain demand',
        'learn.l4': 'Price vs demand: premium, market and discount strategies',
        'learn.l5': 'How ordering habits amplify swings upstream (the bullwhip effect)',
        'learn.note': 'Each chapter ends with a definition card for one APICS CSCP concept. The game is practice, not a certification.',

        // More ways to play
        'more.title': 'More ways to play',
        'more.endless.h': 'Endless Survival',
        'more.endless.b': 'No chapters — difficulty rises every 5 turns. The run ends when cash finishes a quarter below $0 or customer satisfaction hits zero. Free.',
        'more.endless.cta': 'Endless: {industry}',
        'more.weekly.h': 'Weekly challenge',
        'more.weekly.b': 'Everyone gets the same seeded crisis sequence this week ({industry}). Free; the leaderboard asks for a display name only if you submit a score.',
        'more.weekly.cta': 'Play this week’s challenge',
        'more.weekly.board': 'View leaderboard',
        'more.jump.h': 'Start at a later chapter',
        'more.jump.b': 'Chapters 1–3 can be started directly for free; later starting chapters come with more starting capital and stock. Starting directly at Chapter 4 or later needs Full Access — or reach it free by playing on from Chapter 1.',
        'more.jump.needIndustry': 'Choose an industry above first.',
        'more.jump.label': 'Starting chapter',
        'more.jump.opt': 'Chapter {n}: {title}',
        'more.jump.optLocked': 'Chapter {n}: {title} (Full Access)',
        'more.jump.start': 'Start {industry} at Chapter {n}',
        'more.jump.startNoIndustry': 'Start at Chapter {n}',
        'more.jump.locked': 'View Full Access to start at Chapter {n}',

        // Access
        'access.title': 'What’s free and what’s paid',
        'access.free.h': 'Free',
        'access.free.l1': 'The full campaign: 10 chapters, 40 quarterly turns, in all 3 industries',
        'access.free.l2': 'Starting directly at Chapters 1–3',
        'access.free.l3': 'Endless Survival and the weekly challenge',
        'access.free.l4': 'Quarterly results, analytics charts and the in-game debrief',
        'access.paid.h': 'Full Access — {price} one-time',
        'access.paid.period': 'Lifetime access. Not a subscription.',
        'access.paid.l1': 'Downloadable 5-page Advanced Report (PDF) after your campaign',
        'access.paid.l2': 'Start directly at any chapter from 4 onwards',
        'access.paid.cta': 'View Full Access options',
        'access.paid.note': 'Opens the purchase options. You’re only charged if you complete checkout.',

        // FAQ
        'faq.title': 'Questions',
        'faq.free.q': 'Is it free?',
        'faq.free.a': 'Yes. The whole 10-chapter campaign, Endless Survival and the weekly challenge are free to play in your browser, with no account or card.',
        'faq.prior.q': 'Do I need supply-chain knowledge?',
        'faq.prior.a': 'No. Every chapter opens with a short concept card and closes with a definition card, and every decision shows its estimated cost and timing before you commit.',
        'faq.save.q': 'Can I save and resume?',
        'faq.save.a': 'Yes. Your campaign saves automatically in this browser as you play — after every decision and every quarter — so you can close the tab and resume here. Press Save in the game header at any time to save straight away. To resume on another device, add your email (the game offers after Chapter 2, or use Back up to email after saving): Save then also backs up to your email, and so does the end of every chapter. Email backups are kept for 180 days after the last save.',
        'faq.poor.q': 'What happens if I make a poor decision?',
        'faq.poor.a': 'It carries forward: cash, stock, backlog, customer satisfaction and board confidence all change. Each quarter’s results show what happened. If board confidence reaches zero you’re dismissed and the run ends — you can start again any time.',
        'faq.paid.q': 'What does paid access include?',
        'faq.paid.a': 'Full Access is a one-time {price} purchase with lifetime access. It adds the downloadable 5-page Advanced Report (PDF) and lets you start directly at Chapter 4 or later. It isn’t needed to play the campaign.',
        'faq.lang.q': 'Which languages are available?',
        'faq.lang.a': 'English only for now.',

        // Restore on another device
        'restore.title': 'Resume on another device',
        'restore.body': 'Enter the email you saved your game with.',
        'restore.label': 'Email',
        'restore.cta': 'Find my saved game',
        'restore.checking': 'Checking…',
        'restore.invalid': 'Enter a valid email address.',
        'restore.notFound': 'No saved game found for that email. Games are backed up to email when you press Save in the game (after adding your email) and at the end of each chapter.',
        'restore.found': 'Saved game found — see the top of the page.',
        'restore.foundOlder': 'Found your email backup, but the game saved on this device is more recent — that one is shown at the top of the page.',
        'restore.error': 'Couldn’t reach the save service. Try again in a moment.',
    },
};

/** Translate a key for the active locale (falls back to English, then the key). */
export function t(key, vars) {
    const str = STRINGS[LOCALE]?.[key] ?? STRINGS.en[key] ?? key;
    return vars ? str.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? `{${k}}`)) : str;
}

const pluralRules = new Intl.PluralRules(LOCALE);

/** Plural-aware translate: looks up `${key}.${category}` (one/other/…) for count n. */
export function tp(key, n, vars = {}) {
    const k = `${key}.${pluralRules.select(n)}`;
    return t(STRINGS[LOCALE]?.[k] || STRINGS.en[k] ? k : `${key}.other`, { n, ...vars });
}

/** Locale-aware formatters. */
export const fmt = {
    money: (n) => new Intl.NumberFormat(LOCALE, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(n),
    num:   (n) => new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 }).format(n),
    pct:   (x) => new Intl.NumberFormat(LOCALE, { style: 'percent', maximumFractionDigits: 0 }).format(x),
    date:  (ms) => new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium' }).format(new Date(ms)),
    dateTime: (ms) => new Intl.DateTimeFormat(LOCALE, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)),
};
