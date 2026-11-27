import { describe, expect, it } from 'vitest';

import { evaluateProgram } from '../../evals/harness/evaluate';
import { TaskById } from '../../evals/tasks';
import cached from '../../evals/cached/baseline.json';

/**
 * Replays saved AI Tutor programs (one per eval task) through the harness,
 * with no model call. A change to the interpreter, validator, autofix or
 * harness that flips a verdict fails here: if the change is intended,
 * regenerate evals/cached/baseline.json (evals/make-cached.ts) and explain
 * the flipped verdicts in the commit. This checks the toolchain, not the
 * model's quality.
 */
describe('cached AI Tutor programs', () => {
  it('covers every task', () => {
    expect(new Set(cached.map(c => c.task))).toEqual(new Set(TaskById.keys()));
  });

  it.each(cached.map(c => [c.task, c] as const))('%s keeps its verdict', (_task, c) => {
    const v = evaluateProgram(TaskById.get(c.task)!, c.code);
    expect({ bucket: v.bucket, valid: v.valid, correct: v.correct, invariants: v.invariants })
      .toEqual(c.expected);
  });
});
