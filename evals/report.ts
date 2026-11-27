/**
 * Summarizes eval results.
 *
 * npx vite-node evals/report.ts -- evals/results/baseline-tune.jsonl [...]
 * Add --tasks to print a row per task.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

import { bootstrapMean, mean, passAtK, percentile } from './harness/metrics';

const args = process.argv.slice(2).filter(a => a !== '--');
const perTask = args.includes('--tasks');
const files = args.filter(a => !a.startsWith('--'));

const pct = (x: number) => `${(100 * x).toFixed(0)}%`;
const ci = (xs: number[]) => {
  const b = bootstrapMean(xs);
  return `${pct(b.mean)} [${pct(b.low)}, ${pct(b.high)}]`;
};

export function summarize(lines: any[]) {
  const byTask = new Map<string, any[]>();
  for (const l of lines) byTask.set(l.task, [...(byTask.get(l.task) ?? []), l]);
  const tasks = [...byTask.entries()].sort(([a], [b]) => a.localeCompare(b));

  const rate = (pick: (l: any) => boolean) => tasks.map(([, ls]) => mean(ls.map(l => (pick(l) ? 1 : 0))));
  const ok = (l: any) => !l.error;
  const at = (k: number, pick: (l: any) => boolean) => tasks.map(([, ls]) =>
    passAtK(ls.length, ls.filter(pick).length, Math.min(k, ls.length)));

  const buckets = new Map<string, number>();
  for (const l of lines) {
    const b = l.error ? 'provider_error' : l.final.bucket;
    buckets.set(b, (buckets.get(b) ?? 0) + 1);
  }
  const samples = lines.filter(ok);
  const latency = samples.map(l => l.wall_ms);
  const models = [...new Set(samples.flatMap(l => l.pipeline.calls.map((c: any) => `${c.provider}/${c.model}@${c.temperature}`)))];
  const prompts = new Set(samples.flatMap(l => l.pipeline.calls.map((c: any) => c.prompt_sha256))).size;

  return {
    tasks: tasks.length,
    samples: lines.length,
    errors: lines.length - samples.length,
    models,
    distinctPrompts: prompts,
    validFirst: ci(rate(l => ok(l) && l.first.valid)),
    validFinal: ci(rate(l => ok(l) && l.final.valid)),
    pass1First: ci(at(1, l => ok(l) && l.first.correct)),
    pass1: ci(at(1, l => ok(l) && l.final.correct)),
    pass5: ci(at(5, l => ok(l) && l.final.correct)),
    invariants1: ci(at(1, l => ok(l) && l.final.invariants)),
    repairRate: pct(mean(samples.map(l => (l.pipeline.repairAttempted ? 1 : 0)))),
    repairAccepted: pct(mean(samples.filter(l => l.pipeline.repairAttempted).map(l => (l.pipeline.repairAccepted ? 1 : 0)))),
    latencyP50: `${(percentile(latency, 0.5) / 1000).toFixed(1)}s`,
    latencyP95: `${(percentile(latency, 0.95) / 1000).toFixed(1)}s`,
    buckets: Object.fromEntries([...buckets.entries()].sort((a, b) => b[1] - a[1])),
    perTask: tasks.map(([id, ls]) => ({
      id,
      n: ls.length,
      valid: ls.filter(l => ok(l) && l.final.valid).length,
      correct: ls.filter(l => ok(l) && l.final.correct).length,
      invariants: ls.filter(l => ok(l) && l.final.invariants).length,
      buckets: [...new Set(ls.map(l => (l.error ? 'provider_error' : l.final.bucket)))].join(' '),
    })),
  };
}

if (files.length > 0) {
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
    const { perTask: rows, ...s } = summarize(lines);
    console.log(`\n## ${basename(file)}\n`);
    console.log(JSON.stringify(s, null, 2));
    if (perTask) {
      console.log('\n| task | n | valid | correct | invariants | buckets |\n|---|---|---|---|---|---|');
      for (const r of rows) console.log(`| ${r.id} | ${r.n} | ${r.valid} | ${r.correct} | ${r.invariants} | ${r.buckets} |`);
    }
  }
}
