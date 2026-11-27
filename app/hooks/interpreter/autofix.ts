import {
  Directives,
  misplacedArrayLiterals,
  PlainArg,
  scanDirectives,
} from './validate';

// Arithmetic only: names, numbers, operators, brackets and parentheses
const Arithmetic = /^[\w\s+\-*/%().[\]]+$/;

/**
 * Fixes two directive mistakes whose intent is unambiguous, which language
 * models make even when told not to:
 *
 * - A directive on a line by itself is moved to the start of the next
 *   statement (unless that line is `else`/`end`, where it can't go).
 * - An arithmetic directive argument (`@mark<n - 1, ...>`) is computed into
 *   a new variable on the line before. Lines starting a loop or `else` are
 *   left alone: hoisting would compute the value once, not every iteration.
 *
 * - An array literal outside an assignment (`return arr[i, j]`,
 *   `Sort(arr[3, 1, 2])`) is assigned to a new variable on the line before.
 *
 * Anything else is left as is, for validateSource to report.
 *
 * @param source The pseudocode to fix
 */
export default function autoFixDirectives(source: string) {
  const joined = joinStandaloneDirectives(source);
  return hoistArrayLiterals(hoistExpressionArgs(joined));
}

/**
 * Returns a function giving `${prefix}1`, `${prefix}2`, ... skipping names
 * already used in the source.
 */
function nameMaker(source: string, prefix: string) {
  const used = new Set(source.match(/\b[A-Za-z_]\w*\b/g) ?? []);
  let counter = 0;
  return () => {
    let name: string;
    do name = `${prefix}${++counter}`; while (used.has(name));
    used.add(name);
    return name;
  };
}

// Lines where a hoisted assignment would run once instead of each iteration,
// or could not be placed at all
const NoHoist = /^(while|for|do|else|end|fun)\b/;

function indentOf(line: string) {
  return /^\s*/.exec(line)![0];
}

function joinStandaloneDirectives(source: string) {
  const lines = source.split('\n');
  const out: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const { directives, rest } = scanDirectives(lines[i]);
    if (directives.length === 0 || rest) {
      out.push(lines[i]);
      continue;
    }

    let j = i + 1;
    while (j < lines.length && /^\s*(\/\/.*)?\r?$/.test(lines[j])) j++;
    if (j >= lines.length || /^\s*(else|end)\b/.test(lines[j])) {
      out.push(lines[i]);
      continue;
    }

    const text = directives.map(d => d.text).join(' ');
    lines[j] = `${indentOf(lines[j])}${text} ${lines[j].trimStart()}`;
  }
  return out.join('\n');
}

function hoistExpressionArgs(source: string) {
  const freshName = nameMaker(source, 'mark');

  const out: string[] = [];
  for (const line of source.split('\n')) {
    const { directives, rest } = scanDirectives(line);
    if (directives.length === 0 || !rest || NoHoist.test(rest)) {
      out.push(line);
      continue;
    }

    let fixed = line;
    for (const { name, args, text } of directives) {
      if (!Directives.has(name)) continue;
      let newText = text;
      for (const arg of args) {
        if (!arg || PlainArg.test(arg) || !Arithmetic.test(arg)) continue;
        const variable = freshName();
        out.push(`${indentOf(line)}${variable} = ${arg}`);
        newText = newText.replace(arg, variable);
      }
      fixed = fixed.replace(text, newText);
    }
    out.push(fixed);
  }
  return out.join('\n');
}

function hoistArrayLiterals(source: string) {
  const freshName = nameMaker(source, 'array');
  const out: string[] = [];
  for (const line of source.split('\n')) {
    const literals = misplacedArrayLiterals(line);
    const { rest } = scanDirectives(line);
    if (literals.length === 0 || NoHoist.test(rest || line.trim())) {
      out.push(line);
      continue;
    }

    let fixed = '';
    let last = 0;
    for (const literal of literals) {
      const variable = freshName();
      out.push(`${indentOf(line)}${variable} = ${literal.text}`);
      fixed += line.slice(last, literal.start) + variable;
      last = literal.end;
    }
    out.push(fixed + line.slice(last));
  }
  return out.join('\n');
}
