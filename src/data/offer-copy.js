/**
 * Public wording for the free introduction and the Core Game Pass, derived
 * from the package catalog (packages.js) so templates can't drift from what
 * the game and checkout actually grant. Used by the blog build transform;
 * safe to import in the browser too (no DOM, no network).
 */

import { FREE_INTRO, CORE_CATALOG, OFFERS } from './packages.js';
import { CHAPTERS } from './chapters.js';
import { EXPANSION_CHAPTERS } from './expansion-chapters.js';
import { INDUSTRIES } from '../logic/industries.js';

const INDUSTRY_BY_ID = Object.fromEntries(Object.values(INDUSTRIES).map(i => [i.id, i]));
const CHAPTER_COUNT = CORE_CATALOG.chapters.length;
const TURNS = [...CHAPTERS, ...EXPANSION_CHAPTERS]
    .filter(c => CORE_CATALOG.chapters.includes(c.id))
    .reduce((n, c) => n + (c.turnsRange[1] - c.turnsRange[0] + 1), 0);

export const industryName = (id) => INDUSTRY_BY_ID[id]?.name || '';
const shortName = (id) => ({ fmcg: 'FMCG', pharma: 'Pharma', electronics: 'Electronics' }[id] || industryName(id));

export const CORE_PRICE_TEXT = new Intl.NumberFormat('en-US', { style: 'currency', currency: OFFERS.core.currency })
    .format(OFFERS.core.priceCents / 100);

const list = (xs) => (xs.length < 3 ? xs.join(' and ') : `${xs.slice(0, -1).join(', ')} and ${xs.at(-1)}`);

export const OFFER = Object.freeze({
    freeIndustryId: FREE_INTRO.industryId,
    /** "FMCG Chapter 1" */
    freeLabel: `${shortName(FREE_INTRO.industryId)} Chapter ${FREE_INTRO.chapterNumber}`,
    free: `${shortName(FREE_INTRO.industryId)} Chapter ${FREE_INTRO.chapterNumber} is free — four quarters with results and a debrief, no account needed.`,
    core: `The ${OFFERS.core.name} (${CORE_PRICE_TEXT}, one-time, not a subscription) unlocks all ${CHAPTER_COUNT} chapters (${TURNS} quarterly turns) of the ${list(CORE_CATALOG.campaigns.map(shortName))} campaigns. Content released later isn't automatically included; tax is calculated at checkout where it applies.`,
    coreName: OFFERS.core.name,
    campaigns: CORE_CATALOG.campaigns,
    /** /play preselects the industry and shows its mission; it never starts a game or touches a save. */
    playUrl: (industryId = FREE_INTRO.industryId) => `/play?start=1&industry=${encodeURIComponent(industryId)}`,
    pricingUrl: '/pricing',
});
