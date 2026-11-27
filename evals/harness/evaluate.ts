import { checkSource } from '../../app/hooks/interpreter/validate';
import type { Task } from '../tasks';
import { execute } from './execute';
import { findEntry, withInput } from './inputs';
import { checkTrace, unmarkedCursors } from './invariants';
import { sampleInputs } from './samples';

/**
 * Why a program failed, most fundamental first. A program gets the first
 * bucket that applies.
 */
export type Bucket =
  | 'pass' |
  'syntax' |
  'not_substitutable' |
  'runtime' |
  'statement_limit' |
  'wrong_result' |
  'invariant_shown_is_true' |
  'invariant_marks_in_bounds' |
  'invariant_cursor_unmarked';

export type Verdict = {
  bucket: Bucket
  /** Parses and runs with no problems the editor would show */
  valid: boolean
  /** Right on every input */
  correct: boolean
  /** Correct, and the table is truthful and shows its cursors */
  invariants: boolean
  inputs: number
  passedInputs: number
  /** Inputs whose element-comparison count matched the task's formula */
  comparisonsMatched: number | null
  detail: string | null
  problems: string[]
};

/**
 * Runs a generated program on the task's inputs and judges it.
 */
export function evaluateProgram(task: Task, code: string, seed = 42): Verdict {
  const problems = checkSource(code);
  const text = problems.map(p => p.message);
  const verdict: Verdict = {
    bucket: 'pass',
    valid: problems.length === 0,
    correct: false,
    invariants: false,
    inputs: 0,
    passedInputs: 0,
    comparisonsMatched: null,
    detail: null,
    problems: text,
  };
  const fail = (bucket: Bucket, detail: string | null) => {
    if (verdict.bucket === 'pass') {
      verdict.bucket = bucket;
      verdict.detail = detail;
    }
  };

  const syntax = problems.filter(p => p.kind === 'syntax');
  if (syntax.length > 0) {
    fail('syntax', syntax[0].message);
    return verdict;
  }

  const found = findEntry(code, task.params);
  if ('problem' in found) {
    fail('not_substitutable', found.problem);
    return verdict;
  }
  const { entry } = found;

  const inputs = sampleInputs(task.shape(entry.params), entry.params, { seed });
  verdict.inputs = inputs.length;
  let matched = 0;
  let shownIsTrue: string | null = null;
  let marksInBounds: string | null = null;
  for (const input of inputs) {
    const run = execute(withInput(code, entry, input));
    if (run.syntaxErrors.length > 0) {
      fail('not_substitutable', `substituted program fails to parse: ${run.syntaxErrors[0]}`);
      continue;
    }
    if (run.runtimeError || run.errorLogs.length > 0) {
      fail('runtime', `on ${JSON.stringify(input)}: ${run.runtimeError ?? run.errorLogs[0]}`);
      continue;
    }
    if (run.statementLimit) {
      fail('statement_limit', `on ${JSON.stringify(input)}: ran over the statement limit`);
      continue;
    }

    const result = entry.resultName ? run.globals.get(entry.resultName) : null;
    const expected = task.reference([...input], entry.params);
    const wrong = task.check(
      { input, params: entry.params, table: run.visualized, result },
      expected,
    );
    if (wrong) {
      fail('wrong_result', `on ${JSON.stringify(input)}: ${wrong}`);
      continue;
    }
    verdict.passedInputs++;

    const trace = checkTrace(run);
    shownIsTrue ??= trace.shownIsTrue && `on ${JSON.stringify(input)}: ${trace.shownIsTrue}`;
    marksInBounds ??= trace.marksInBounds && `on ${JSON.stringify(input)}: ${trace.marksInBounds}`;
    if (task.comparisons && run.arrayComparisons === task.comparisons(input.length)) matched++;
  }
  if (task.comparisons) verdict.comparisonsMatched = matched;

  // Runtime problems the editor shows on the original program (hints such as
  // "no array is visualized" are judged by the oracle and invariants instead)
  const runtime = problems.find(p => p.kind === 'runtime');
  if (runtime) fail('runtime', runtime.message);

  verdict.correct = verdict.bucket === 'pass' && verdict.passedInputs === verdict.inputs;
  if (!verdict.correct) return verdict;

  if (shownIsTrue) fail('invariant_shown_is_true', shownIsTrue);
  else if (marksInBounds) fail('invariant_marks_in_bounds', marksInBounds);
  else {
    const unmarked = unmarkedCursors(code);
    if (unmarked.length > 0) fail('invariant_cursor_unmarked', `no @mark for ${unmarked.join(', ')}`);
  }
  verdict.invariants = verdict.bucket === 'pass';
  return verdict;
}
