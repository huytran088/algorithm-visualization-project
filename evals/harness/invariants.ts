import type { Execution } from './execute';

/**
 * Checks that what the table shows is true, from a run's trace.
 */

export type InvariantResult = {
  /** The replayed table matched the real array after every statement */
  shownIsTrue: string | null
  /**
   * Every mark pointed at a cell of the table, or just outside it (-1 or
   * the length): textbook pointers start or end there (Lomuto's i = low - 1,
   * a scan that stops at n), and the table simply doesn't draw them
   */
  marksInBounds: string | null
};

/** Replays the table actions and compares them with the real array. */
export function checkTrace(run: Execution): InvariantResult {
  let table: any[] | null = null;
  let shownIsTrue: string | null = null;
  let marksInBounds: string | null = null;
  let next = 0;

  const compare = (stepIndex: number, actual: number[] | null) => {
    if (shownIsTrue || actual === null || table === null) return;
    if (JSON.stringify(table) !== JSON.stringify(actual)) {
      const line = run.steps[stepIndex - 1]?.line;
      shownIsTrue = `after line ${Array.isArray(line) ? line[0] : line} the table shows ` +
        `${JSON.stringify(table)} but the array is ${JSON.stringify(actual)}`;
    }
  };

  for (const checkpoint of run.checkpoints) {
    for (; next < checkpoint.step; next++) {
      for (const a of run.steps[next].actions) {
        const p = a.params;
        switch (a.cmd) {
          case 'vis_init':
            table = Array.isArray(p.data) ? [...p.data] : [];
            break;
          case 'vis_update':
            if (table) table[p.index!] = p.value;
            break;
          case 'vis_swap':
            if (table) [table[p.index!], table[p.index2!]] = [table[p.index2!], table[p.index!]];
            break;
          case 'vis_insert':
            table?.splice(p.index!, 0, p.value);
            break;
          case 'vis_delete':
            table?.splice(p.index!, 1);
            break;
          case 'vis_sort':
            table?.sort((x, y) => x - y);
            break;
          case 'vis_mark':
            if (!marksInBounds && table &&
              (!Number.isInteger(p.index) || p.index! < -1 || p.index! > table.length)) {
              marksInBounds = `mark at ${JSON.stringify(p.index)} on line ` +
                `${run.steps[next].line} is not a cell of the table (length ${table.length})`;
            }
            break;
        }
      }
    }
    compare(checkpoint.step, checkpoint.actual);
  }
  return { shownIsTrue, marksInBounds };
}

/**
 * Loop cursors that index an array but are never the index of an @mark
 * (a learner can't follow a pointer the table doesn't show).
 *
 * A cursor is a for-loop variable, or a variable in a while condition, that
 * appears as a plain subscript (array[j]). Only marks the interpreter applies
 * count.
 */
export function unmarkedCursors(source: string) {
  const withMarks = source.replace(/(\/\/|#).*$/gm, '');
  // Directives can sit between a keyword and its condition: for @mark<i> (i = 0; ...)
  const code = withMarks.replace(/@\w+\s*<[^>]*>/g, '');
  const cursors = new Set<string>();
  for (const m of code.matchAll(/\bfor\s*\(?\s*([A-Za-z_]\w*)\s*=/g)) cursors.add(m[1]);
  for (const m of code.matchAll(/\bwhile\s*\(?(.*?)\)?\s*:?\s*$/gm)) {
    for (const id of m[1].matchAll(/[A-Za-z_]\w*/g)) cursors.add(id[0]);
  }
  const subscripts = new Set(
    [...code.matchAll(/\b[A-Za-z_]\w*\s*\[\s*([A-Za-z_]\w*)\s*\]/g)].map(m => m[1]),
  );
  // The interpreter drops directives on if/else/break/continue lines, so a
  // mark there never shows (TraceInterpreterVisitor.visitIfStatement)
  const marked = new Set(
    [...withMarks.matchAll(/@mark\s*<\s*([A-Za-z_]\w*)[^>]*>((?:\s*@\w+\s*<[^>]*>)*)\s*([A-Za-z_]\w*)?/g)]
      .filter(m => !['if', 'else', 'break', 'continue'].includes(m[3] ?? ''))
      .map(m => m[1]),
  );
  return [...cursors].filter(c => subscripts.has(c) && !marked.has(c)).sort();
}
