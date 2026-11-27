/**
 * Writes evals/cached/baseline.json for the CI replay test: sample 0 of each
 * task from the given results files, with the verdict the current harness
 * gives it. Re-run after an intended harness or interpreter change, and say
 * in the commit which verdicts changed and why.
 *
 * npx vite-node evals/make-cached.ts -- evals/results/a.jsonl [...]
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

import { evaluateProgram } from './harness/evaluate';
import { TaskById } from './tasks';

const files = process.argv.slice(2).filter(a => a !== '--');
const programs = new Map<string, string>();
for (const file of files) {
  for (const text of readFileSync(file, 'utf8').split('\n').filter(Boolean)) {
    const line = JSON.parse(text);
    if (line.sample === 0 && !line.error && !programs.has(line.task)) programs.set(line.task, line.pipeline.final);
  }
}

const cases = [...programs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([task, code]) => {
  const v = evaluateProgram(TaskById.get(task)!, code);
  return { task, code, expected: { bucket: v.bucket, valid: v.valid, correct: v.correct, invariants: v.invariants } };
});
mkdirSync(new URL('./cached/', import.meta.url), { recursive: true });
writeFileSync(new URL('./cached/baseline.json', import.meta.url), JSON.stringify(cases, null, 2) + '\n');
console.log(`${cases.length} cached programs`);
