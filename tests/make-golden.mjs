// Regenerates tests/fixtures/engine-golden.json from the CURRENT engine.
// Only run this deliberately (e.g. after an intentional rules change):
//   node tests/make-golden.mjs
import { writeFileSync, mkdirSync } from 'node:fs';
import { withSeed, playCampaign, digest } from './helpers.mjs';
import { GameEngine, GAME_PHASES } from '../src/logic/engine.js';

const SEEDS = [1, 42, 20261018];
const INDUSTRIES = ['electronics', 'fmcg', 'pharma'];

const golden = {};
for (const industryId of INDUSTRIES) {
    for (const seed of SEEDS) {
        golden[`${industryId}:${seed}`] = withSeed(seed, () =>
            digest(playCampaign(GameEngine, GAME_PHASES, { industryId })));
    }
}
mkdirSync(new URL('./fixtures/', import.meta.url), { recursive: true });
writeFileSync(new URL('./fixtures/engine-golden.json', import.meta.url), JSON.stringify(golden));
console.log(`wrote ${Object.keys(golden).length} golden runs`);
