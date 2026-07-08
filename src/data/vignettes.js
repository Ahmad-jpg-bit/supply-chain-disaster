/**
 * Human vignettes — one-line voices from the ground, shown on turn outcomes.
 * Numbers become memorable when they land on a person.
 */

const VIGNETTES = {
    stockout: [
        { quote: 'Third week of gaps on the shelf. Customers stopped asking — they just walk to the competitor aisle now.', source: 'Store manager, Columbus' },
        { quote: 'I promised the Hendersons their order by Friday. I don\'t make promises anymore.', source: 'Retail associate, Tucson' },
        { quote: 'Head office keeps sending apology scripts. What I need is product.', source: 'Franchise owner, Leeds' },
    ],
    defects: [
        { quote: 'Second return this month for the same fault. She didn\'t yell this time. That\'s worse.', source: 'Customer service lead, Atlanta' },
        { quote: 'We\'re unboxing every unit before it goes on the floor now. That\'s not my team\'s job.', source: 'Store manager, Rotterdam' },
    ],
    backlog: [
        { quote: 'The waitlist spreadsheet has a waitlist now.', source: 'Order desk, Chicago' },
        { quote: 'Customers will wait once. The second time, they order two — one from you, one from your rival — and keep whichever ships.', source: 'Distribution partner, Singapore' },
    ],
    overstock: [
        { quote: 'We\'re renting a second lot for the overflow trailers. The units in them aren\'t getting newer.', source: 'Warehouse supervisor, Memphis' },
    ],
    strong: [
        { quote: 'Full shelves, no substitutions, trucks on time. Nobody notices when supply chain works. That\'s the point.', source: 'Regional ops manager, Denver' },
        { quote: 'First quarter in a year I didn\'t have to apologise to a single account.', source: 'Key account manager, Munich' },
    ],
};

/**
 * Pick a vignette for a turn result, or null. Fires on notable outcomes;
 * strong quarters only sometimes, so praise stays scarce.
 * @param {Object} result — engine turn result
 */
export function pickVignette(result) {
    const pool =
        result.missedSales > 300               ? VIGNETTES.stockout :
        result.defectsPassed > 50              ? VIGNETTES.defects :
        result.backlog > 200                   ? VIGNETTES.backlog :
        (result.holdingCost > 60000)           ? VIGNETTES.overstock :
        (result.profit > 60000 && Math.random() < 0.4) ? VIGNETTES.strong :
        null;
    if (!pool) return null;
    return pool[Math.floor(Math.random() * pool.length)];
}
