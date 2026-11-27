import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

import { evaluateProgram } from '../../evals/harness/evaluate';
import { execute } from '../../evals/harness/execute';
import { findEntry, withInput } from '../../evals/harness/inputs';
import { checkTrace, unmarkedCursors } from '../../evals/harness/invariants';
import { bootstrapMean, passAtK } from '../../evals/harness/metrics';
import { sampleInputs } from '../../evals/harness/samples';
import { TaskById, Tasks } from '../../evals/tasks';

const kb = (name: string) =>
  readFileSync(new URL(`../../evals/fixtures/kb/${name}.avp`, import.meta.url), 'utf8');
const task = (id: string) => TaskById.get(id)!;

const Bubble = `a1 = arr[5, 1, 4, 2, 8]

fun Bubble_Sort(@init<table> array):
    n = length(array)
    for (i = 0; i < n; i += 1):
        for @mark<j, outline, yellow> (j = 0; j < n - i - 1; j += 1):
            if (array[j] > array[j + 1]):
                swap(array[j], array[j + 1])
            end if
        end for
    end for
    return array
end fun

result = Bubble_Sort(a1)`;

describe('the task set', () => {
  it('has about 40 tasks with unique ids', () => {
    expect(Tasks.length).toBeGreaterThanOrEqual(38);
    expect(TaskById.size).toBe(Tasks.length);
  });

  it.each(Tasks.map(t => [t.id, t] as const))('%s: its reference passes its own oracle', (_id, t) => {
    const params = t.params === 0 ? [] : [3];
    for (const input of sampleInputs(t.shape(params), params)) {
      // What an ideal program leaves: the answer in the table for in-place
      // tasks (references that build a new array return it), else the input
      const copy = [...input];
      const out = t.reference(copy, params);
      const inPlace = t.category === 'sort' || t.category === 'transform';
      let table = inPlace && Array.isArray(out) ? out : copy;
      let result = out;
      if (t.id === 'remove_duplicates_sorted') {
        table = [...out, ...input.slice(out.length)];
        result = out.length;
      }
      expect(t.check({ input, params, table, result }, t.reference([...input], params)),
        `${t.id} on ${JSON.stringify(input)}`).toBeNull();
    }
  });
});

describe('sampleInputs', () => {
  it('is deterministic for a seed and covers the edge cases', () => {
    const shape = task('bubble_sort').shape([]);
    const a = sampleInputs(shape, []);
    expect(sampleInputs(shape, [])).toEqual(a);
    expect(a).toContainEqual([]);
    expect(a.some(x => x.length === 1)).toBe(true);
    expect(a.length).toBeGreaterThanOrEqual(20);
  });

  it('puts the target in about half of the search inputs', () => {
    const inputs = sampleInputs(task('binary_search').shape([7]), [7]);
    const withTarget = inputs.filter(a => a.includes(7)).length;
    expect(withTarget).toBeGreaterThan(inputs.length / 4);
    expect(withTarget).toBeLessThan(inputs.length * 3 / 4);
    for (const a of inputs) expect(a).toEqual([...a].sort((x, y) => x - y));
  });
});

describe('findEntry', () => {
  it('finds the input array, result and scalar arguments', () => {
    const found = findEntry(kb('binary_search'), 1);
    expect(found).toMatchObject({
      entry: { arrayName: 'a1', params: [11], resultName: 'result', functionName: 'Binary_Search' },
    });
  });

  it('accepts bounds derived from the input', () => {
    expect(findEntry(kb('lomuto_partition'), 0)).toHaveProperty('entry');
  });

  it('reports bounds hardcoded from the original length', () => {
    const source = kb('lomuto_partition').replace('length(a1) - 1', '6');
    expect(findEntry(source, 0)).toEqual({ problem: 'array bounds are hardcoded in the top-level call' });
  });

  it('substitutes the input, including an empty one', () => {
    const { entry } = findEntry(Bubble, 0) as any;
    expect(withInput(Bubble, entry, [3, 2]).split('\n')[0]).toBe('a1 = arr[3, 2]');
    expect(withInput(Bubble, entry, []).split('\n')[0]).toBe('a1 = arr[]');
  });
});

describe('execute', () => {
  it('counts element comparisons of the visualized array', () => {
    // Selection sort makes n(n-1)/2 comparisons on any input
    const run = execute(kb('selection_sort'));
    expect(run.arrayComparisons).toBe(21);
  });

  it('stops a runaway program', () => {
    const run = execute(`fun F(@init<table> a):
    for (i = 0; i < 1000; i += 1):
        for (j = 0; j < 1000; j += 1):
            a[0] = j
        end for
    end for
    return a
end fun
x = arr[1]
result = F(x)`, 10_000);
    expect(run.statementLimit).toBe(true);
  });
});

describe('invariants', () => {
  it('pass when the table follows the array', () => {
    expect(checkTrace(execute(Bubble))).toEqual({ shownIsTrue: null, marksInBounds: null });
  });

  it('catch a swap that is drawn but not done', () => {
    const fake = Bubble.replace('swap(array[j], array[j + 1])', 'k = j + 1\n                @swap<j, k> t = 0');
    expect(checkTrace(execute(fake)).shownIsTrue).toMatch(/the table shows/);
  });

  const markAt = (index: string) => Bubble.replace('            if (array[j]',
    `            k = ${index}\n            @mark<k, highlight, red> t = 0\n            if (array[j]`);

  it('catch a mark outside the table', () => {
    expect(checkTrace(execute(markAt('n + 1'))).marksInBounds).toMatch(/not a cell of the table/);
    expect(checkTrace(execute(markAt('-2'))).marksInBounds).toMatch(/not a cell of the table/);
    expect(checkTrace(execute(markAt('1.5'))).marksInBounds).toMatch(/not a cell of the table/);
  });

  it('allow a pointer just outside the table (Lomuto i = low - 1, a scan ending at n)', () => {
    expect(checkTrace(execute(markAt('-1'))).marksInBounds).toBeNull();
    expect(checkTrace(execute(markAt('n'))).marksInBounds).toBeNull();
  });

  it('find loop cursors that are never marked', () => {
    expect(unmarkedCursors(Bubble)).toEqual([]);
    expect(unmarkedCursors(Bubble.replace('@mark<j, outline, yellow> ', ''))).toEqual(['j']);
    // A directive between for and its condition
    expect(unmarkedCursors(kb('check_unique'))).toEqual([]);
    // A mark on an if line is dropped by the interpreter, so it doesn't count
    const onIf = Bubble.replace('for @mark<j, outline, yellow> (', 'for (')
      .replace('if (array[j]', '@mark<j, outline, yellow> @mark<j, text, red> if (array[j]');
    expect(unmarkedCursors(onIf)).toEqual(['j']);
  });
});

describe('evaluateProgram', () => {
  it.each([
    ['bubble_sort', 'bubble_sort'],
    ['insertion_sort', 'insertion_sort'],
    ['selection_sort', 'selection_sort'],
    ['linear_search', 'linear_search'],
  ])('passes the KB program %s on task %s', (file, id) => {
    const v = evaluateProgram(task(id), kb(file));
    expect(v.correct, v.detail ?? '').toBe(true);
    expect(v.inputs).toBeGreaterThanOrEqual(20);
  });

  it('matches the comparison formula on the KB selection sort', () => {
    const v = evaluateProgram(task('selection_sort'), kb('selection_sort'));
    expect(v.comparisonsMatched).toBe(v.inputs);
  });

  it('fails an off-by-one bubble sort', () => {
    const v = evaluateProgram(task('bubble_sort'), Bubble.replace('j < n - i - 1', 'j < n - i - 2'));
    expect(v.bucket).toBe('wrong_result');
  });

  it('fails a sort with the swap removed', () => {
    const v = evaluateProgram(task('bubble_sort'), Bubble.replace('swap(array[j], array[j + 1])', 'k = 0'));
    expect(v.bucket).toBe('wrong_result');
  });

  it('fails a syntax error before running anything', () => {
    const v = evaluateProgram(task('bubble_sort'), Bubble.replace('end for\n    end for', 'end for'));
    expect(v.bucket).toBe('syntax');
    expect(v.inputs).toBe(0);
  });

  it('fails a correct sort whose cursor is never marked on the invariants only', () => {
    const v = evaluateProgram(task('bubble_sort'), Bubble.replace('@mark<j, outline, yellow> ', ''));
    expect(v.correct).toBe(true);
    expect(v.bucket).toBe('invariant_cursor_unmarked');
  });

  // Known problems in the backend knowledge base, which retrieval shows the
  // model as examples. If one is fixed there, update its fixture and this test.
  it('finds that the KB comparison counting sort overwrites its own input', () => {
    const v = evaluateProgram(task('comparison_counting_sort'), kb('comparison_counting_sort'));
    expect(v.bucket).toBe('wrong_result');
  });

  it('finds that the KB binary search drifts off integer indices (no floor)', () => {
    const v = evaluateProgram(task('binary_search'), kb('binary_search'));
    expect(v.bucket).toBe('wrong_result');
    // With floor it passes
    const fixed = kb('binary_search').replace('mid = (low + high) / 2', 'mid = floor((low + high) / 2)');
    expect(evaluateProgram(task('binary_search'), fixed).correct).toBe(true);
  });

  it('finds that the KB check_unique returns 1/0, not true/false', () => {
    const v = evaluateProgram(task('unique_elements'), kb('check_unique'));
    expect(v.bucket).toBe('wrong_result');
  });
});

describe('metrics', () => {
  it('computes unbiased pass@k', () => {
    expect(passAtK(5, 0, 1)).toBe(0);
    expect(passAtK(5, 5, 1)).toBe(1);
    expect(passAtK(5, 2, 1)).toBeCloseTo(0.4);
    // 1 - C(3,5)/C(5,5): with only 3 failures, 5 draws always include a pass
    expect(passAtK(5, 2, 5)).toBe(1);
    expect(passAtK(5, 1, 2)).toBeCloseTo(0.4);
  });

  it('gives a reproducible bootstrap interval around the mean', () => {
    const xs = [0, 1, 1, 0, 1, 1, 1, 0, 1, 1];
    const a = bootstrapMean(xs);
    expect(bootstrapMean(xs)).toEqual(a);
    expect(a.mean).toBeCloseTo(0.7);
    expect(a.low).toBeLessThan(0.7);
    expect(a.high).toBeGreaterThan(0.7);
  });
});
