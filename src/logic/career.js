/**
 * Career progression — your title climbs (or slips) as the campaign advances.
 *
 * Rank tracks progress through the story, nudged by board confidence. Reviews
 * between chapters are framed on the CSCP exam domain you just demonstrated,
 * so the ladder doubles as curriculum signposting.
 */

export const RANKS = [
    { title: 'Procurement Analyst',       icon: '🔰', remit: 'Placing orders, learning the trade-offs.' },
    { title: 'Procurement Manager',       icon: '📋', remit: 'Owning supplier selection and order policy.' },
    { title: 'Supply Chain Manager',      icon: '🧭', remit: 'Balancing service, cost, and inventory end to end.' },
    { title: 'Director of Operations',    icon: '🏭', remit: 'Steering the network through disruption.' },
    { title: 'VP, Supply Chain',          icon: '🎖️', remit: 'Setting strategy across regions and risk.' },
    { title: 'Chief Supply Chain Officer', icon: '👑', remit: 'The whole chain answers to you now.' },
];

/**
 * Compute rank from progress and performance.
 * Promotions come roughly every two chapters; strong board confidence can
 * pull you up a rung early, weak confidence holds you back.
 * @param {number} chaptersCompleted
 * @param {number} boardConfidence 0–100
 */
export function evaluateCareer(chaptersCompleted, boardConfidence = 70) {
    const base = Math.floor(chaptersCompleted / 2);
    const bump = boardConfidence >= 78 ? 1 : boardConfidence < 30 ? -1 : 0;
    const rankIndex = Math.max(0, Math.min(RANKS.length - 1, base + bump));
    return { rankIndex, ...RANKS[rankIndex] };
}

/**
 * Build a between-chapters review comparing old and new rank.
 * @param {number} prevIndex
 * @param {number} newIndex
 * @param {string} domainFull — CSCP domain demonstrated (e.g. "Supply Chain Design")
 * @returns {{ direction, title, icon, text } | null} null when unchanged
 */
export function careerReview(prevIndex, newIndex, domainFull = '') {
    if (newIndex === prevIndex) return null;
    const rank = RANKS[newIndex];
    const domainLine = domainFull ? ` Your grip on ${domainFull} is what the board noticed.` : '';

    if (newIndex > prevIndex) {
        return {
            direction: 'promotion',
            title: `Promoted to ${rank.title}`,
            icon: rank.icon,
            text: `${rank.remit}${domainLine}`,
        };
    }
    return {
        direction: 'demotion',
        title: `Reassigned to ${rank.title}`,
        icon: rank.icon,
        text: `The board pulled you back a rung after a rough stretch.${domainLine} Rebuild their confidence and you'll climb again.`,
    };
}
