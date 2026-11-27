/**
 * Finds a generated program's input array and scalar arguments, so the
 * harness can run it on other inputs.
 *
 * The tutor writes programs shaped like
 *
 *     a1 = arr[5, 1, 4]
 *     target = 4
 *     fun Name(...): ... end fun
 *     result = Name(a1, target)
 *
 * The input is the top-level array literal passed to the last top-level call.
 * Scalar arguments (target, k) keep the program's own values.
 */

/** The program's top-level call, with what the harness can vary. */
export type Entry = {
  /** Line index (0-based) of `name = arr[...]` */
  arrayLine: number
  arrayName: string
  original: number[]
  /** Values of the scalar arguments that aren't array bounds, in call order */
  params: number[]
  /** Variable the call's result is assigned to (null: a bare call) */
  resultName: string | null
  functionName: string
};

export type EntryResult = { entry: Entry } | { problem: string };

const ArrayLine = /^\s*([A-Za-z_]\w*)\s*=\s*arr\s*\[([^\]]*)\]\s*(?:(?:\/\/|#).*)?$/;
const ScalarLine = /^\s*([A-Za-z_]\w*)\s*=\s*(-?\d+(?:\.\d+)?)\s*(?:(?:\/\/|#).*)?$/;
const CallLine = /^\s*(?:([A-Za-z_]\w*)\s*=\s*)?([A-Za-z_]\w*)\s*\((.*)\)\s*(?:(?:\/\/|#).*)?$/;
const Number_ = /^-?\d+(?:\.\d+)?$/;

/** Splits "a, f(b, c), d" on top-level commas. */
function splitArgs(text: string) {
  const args: string[] = [];
  let depth = 0;
  let current = '';
  for (const ch of text) {
    if (ch === '(' || ch === '[') depth++;
    if (ch === ')' || ch === ']') depth--;
    if (ch === ',' && depth === 0) {
      args.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) args.push(current.trim());
  return args;
}

/** Indices of lines outside any fun ... end fun block. */
function topLevelLines(lines: string[]) {
  const top: number[] = [];
  let depth = 0;
  lines.forEach((line, i) => {
    const code = line.replace(/(\/\/|#).*$/, '');
    if (/^\s*fun\b/.test(code)) {
      depth++;
      return;
    }
    if (/^\s*end\s+fun\b/.test(code)) {
      depth = Math.max(depth - 1, 0);
      return;
    }
    if (depth === 0 && code.trim()) top.push(i);
  });
  return top;
}

/**
 * Finds the input array and scalar arguments of a program's top-level call.
 *
 * @param source The program
 * @param paramCount How many scalar arguments the task takes (target, k...)
 */
export function findEntry(source: string, paramCount: number): EntryResult {
  const lines = source.split('\n');
  const top = topLevelLines(lines);
  const defined = new Set(
    [...source.matchAll(/^\s*fun\s+([A-Za-z_]\w*)/gm)].map(m => m[1]),
  );

  const arrays = new Map<string, { line: number, values: number[] }>();
  const scalars = new Map<string, number>();
  let call: RegExpMatchArray | null = null;
  for (const i of top) {
    const line = lines[i];
    const arrayMatch = line.match(ArrayLine);
    if (arrayMatch) {
      const body = arrayMatch[2].trim();
      const values = body ? body.split(',').map(v => Number(v.trim())) : [];
      if (values.some(v => Number.isNaN(v))) continue;
      arrays.set(arrayMatch[1], { line: i, values });
      continue;
    }
    const scalarMatch = line.match(ScalarLine);
    if (scalarMatch) {
      scalars.set(scalarMatch[1], Number(scalarMatch[2]));
      continue;
    }
    const callMatch = line.match(CallLine);
    if (callMatch && defined.has(callMatch[2])) call = callMatch;
  }

  if (!call) return { problem: 'no top-level call to a defined function' };
  const args = splitArgs(call[3]);
  const arrayArg = args.find(a => arrays.has(a));
  if (!arrayArg) return { problem: 'the top-level call takes no array literal' };
  const array = arrays.get(arrayArg)!;
  const n = array.values.length;

  // Literal or constant scalar arguments; derived ones (length(a1) - 1)
  // follow the input by themselves
  const scalarArgs: number[] = [];
  for (const arg of args) {
    if (arg === arrayArg) continue;
    if (Number_.test(arg)) scalarArgs.push(Number(arg));
    else if (scalars.has(arg)) scalarArgs.push(scalars.get(arg)!);
  }

  // Bounds hardcoded from the original length (Quick_Sort(a1, 0, 4)) make
  // the program unusable on other inputs
  const isBound = (v: number) => v === 0 || v === n - 1 || v === n;
  const nonBounds = scalarArgs.filter(v => !isBound(v));
  let params = scalarArgs;
  if (scalarArgs.length > paramCount) {
    if (nonBounds.length < paramCount) {
      return { problem: 'cannot tell the task arguments from array bounds' };
    }
    if (scalarArgs.some(v => v !== 0 && isBound(v)) &&
      nonBounds.length === paramCount) {
      return { problem: 'array bounds are hardcoded in the top-level call' };
    }
    params = nonBounds;
  }
  if (params.length !== paramCount) {
    return { problem: `expected ${paramCount} scalar argument(s), found ${params.length}` };
  }

  return {
    entry: {
      arrayLine: array.line,
      arrayName: arrayArg,
      original: array.values,
      params,
      resultName: call[1] ?? null,
      functionName: call[2],
    },
  };
}

/**
 * The program with its input array replaced.
 */
export function withInput(source: string, entry: Entry, values: number[]) {
  const lines = source.split('\n');
  lines[entry.arrayLine] = `${entry.arrayName} = arr[${values.join(', ')}]`;
  return lines.join('\n');
}
