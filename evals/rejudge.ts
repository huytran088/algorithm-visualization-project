/**
 * Re-judges saved samples with the current harness, without calling the
 * model: verdicts depend only on the saved code, so a harness change (a new
 * invariant, a fixed oracle) can be applied to old runs.
 *
 * npx vite-node evals/rejudge.ts -- evals/results/baseline-tune.jsonl [...]
 */
import { readFileSync, writeFileSync } from 'node:fs';

import { evaluateProgram } from './harness/evaluate';
import { TaskById } from './tasks';

const files = process.argv.slice(2).filter(a => a !== '--');
for (const file of files) {
  let changed = 0;
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((text) => {
    const line = JSON.parse(text);
    if (line.error) return line;
    const task = TaskById.get(line.task)!;
    const first = evaluateProgram(task, line.pipeline.first);
    const final = evaluateProgram(task, line.pipeline.final);
    if (final.bucket !== line.final.bucket) changed++;
    return { ...line, first, final, rejudged_at: new Date().toISOString() };
  });
  writeFileSync(file, lines.map(l => JSON.stringify(l)).join('\n') + '\n');
  console.log(`${file}: ${lines.length} samples, ${changed} final verdicts changed`);
}
