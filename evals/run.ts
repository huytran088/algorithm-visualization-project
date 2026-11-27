/**
 * Samples the AI Tutor on the eval tasks and judges every program.
 *
 * Start the eval server first (avp_rag_system):
 *   uv run uvicorn evals.server:app --port 8799
 * Then:
 *   npx vite-node evals/run.ts -- --config baseline --split tune --n 5
 *
 * Appends one JSON line per sample to evals/results/<config>-<split>[-tag].jsonl,
 * and skips samples already in that file, so an interrupted run resumes.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

import { evaluateProgram } from './harness/evaluate';
import { Configs, runPipeline, serverGenerate } from './harness/pipeline';
import { TaskById } from './tasks';
import split from './split.json';

const { values } = parseArgs({
  args: process.argv.slice(2).filter(a => a !== '--'),
  options: {
    config: { type: 'string', default: 'baseline' },
    split: { type: 'string', default: 'tune' },
    n: { type: 'string', default: '5' },
    server: { type: 'string', default: 'http://localhost:8799' },
    concurrency: { type: 'string', default: '3' },
    tag: { type: 'string', default: '' },
    tasks: { type: 'string', default: '' },
  },
});

const config = Configs[values.config!];
if (!config) throw new Error(`unknown config ${values.config}; one of ${Object.keys(Configs)}`);
const ids = values.tasks ?
  values.tasks.split(',') :
  values.split === 'all' ? [...split.tune, ...split.heldout] : (split as any)[values.split!] as string[];
if (!ids) throw new Error(`unknown split ${values.split}`);
const n = Number(values.n);

const dir = new URL('./results/', import.meta.url);
mkdirSync(dir, { recursive: true });
const name = [config.name, values.split, values.tag].filter(Boolean).join('-');
const out = new URL(`${name}.jsonl`, dir);
const done = new Set(
  existsSync(out) ?
    readFileSync(out, 'utf8').split('\n').filter(Boolean).map((l) => {
      const r = JSON.parse(l);
      return `${r.task}#${r.sample}`;
    }) :
    [],
);

const jobs = ids.flatMap(id => Array.from({ length: n }, (_, sample) => ({ id, sample })))
  .filter(j => !done.has(`${j.id}#${j.sample}`));
console.log(`${name}: ${jobs.length} samples to run (${done.size} done) -> ${out.pathname}`);

const generate = serverGenerate(values.server!);
let finished = 0;
async function worker() {
  for (let job = jobs.shift(); job; job = jobs.shift()) {
    const task = TaskById.get(job.id);
    if (!task) throw new Error(`unknown task ${job.id}`);
    const started = Date.now();
    let line: any;
    try {
      const pipeline = await runPipeline(task.request, config, generate);
      line = {
        task: job.id,
        sample: job.sample,
        config: config.name,
        split: values.split,
        at: new Date().toISOString(),
        wall_ms: Date.now() - started,
        pipeline,
        first: evaluateProgram(task, pipeline.first),
        final: evaluateProgram(task, pipeline.final),
      };
    } catch (err) {
      // The first call failed (provider error): recorded, not retried
      line = {
        task: job.id,
        sample: job.sample,
        config: config.name,
        split: values.split,
        at: new Date().toISOString(),
        wall_ms: Date.now() - started,
        error: err instanceof Error ? err.message : String(err),
      };
    }
    appendFileSync(out, JSON.stringify(line) + '\n');
    finished++;
    const mark = line.error ? `error ${line.error.slice(0, 80)}` : line.final.bucket;
    console.log(`[${finished}] ${job.id}#${job.sample} ${mark}`);
  }
}
await Promise.all(Array.from({ length: Number(values.concurrency) }, worker));
