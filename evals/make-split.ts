/**
 * Writes evals/split.json: a seeded split of the tasks, stratified by
 * category, with about a third held out. Run once, before any eval run, and
 * commit the result; never re-run it after looking at results.
 *
 * npx vite-node evals/make-split.ts
 */
import { writeFileSync } from 'node:fs';

import { rng } from './harness/metrics';
import { Tasks } from './tasks';

const random = rng(20261126);
const tune: string[] = [];
const heldout: string[] = [];
const categories = [...new Set(Tasks.map(t => t.category))];
for (const category of categories) {
  const ids = Tasks.filter(t => t.category === category).map(t => t.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  const held = Math.round(ids.length / 3);
  heldout.push(...ids.slice(0, held));
  tune.push(...ids.slice(held));
}

writeFileSync(
  new URL('./split.json', import.meta.url),
  JSON.stringify({ seed: 20261126, tune: tune.sort(), heldout: heldout.sort() }, null, 2) + '\n',
);
console.log(`tune ${tune.length}, heldout ${heldout.length}`);
