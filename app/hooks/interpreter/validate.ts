import { CharStream, CommonTokenStream } from 'antlr4ng';

import { PseudocodeLexer } from './.antlr/PseudocodeLexer';
import { PseudocodeParser } from './.antlr/PseudocodeParser';
import TraceInterpreterVisitor from './TraceInterpreterVisitor';

export const Directives = new Set([
  'init', 'mark', 'log', 'insert', 'delete', 'update', 'swap', 'sort',
]);
export const PlainArg = /^(?:[A-Za-z_]\w*|-?\d+(?:\.\d+)?|"[^"]*")$/;

/**
 * Splits a line into its leading `@name<args>` directives and the rest of
 * the line. Commas and `>` inside "strings" don't end an argument.
 */
export function scanDirectives(line: string) {
  const directives: { name: string, args: string[], text: string }[] = [];
  let i = 0;
  for (;;) {
    while (line[i] === ' ' || line[i] === '\t') i++;
    const head = /^@(\w+)</.exec(line.slice(i));
    if (!head) break;
    const start = i;
    i += head[0].length;

    const args: string[] = [];
    let arg = '';
    let inString = false;
    for (; i < line.length; i++) {
      const c = line[i];
      if (c === '"') inString = !inString;
      if (!inString && (c === ',' || c === '>')) {
        args.push(arg.trim());
        arg = '';
        if (c === '>') break;
      } else {
        arg += c;
      }
    }
    i++;
    directives.push({ name: head[1], args, text: line.slice(start, i) });
  }
  return { directives, rest: line.slice(i).replace(/\/\/.*$/, '').trim() };
}

/**
 * Finds `arr[...]` / `arr(...)` literals in a line that are not directly
 * assigned (`a = arr[...]`), the only place the grammar allows them.
 * Text inside "strings" and after `//` is ignored.
 */
export function misplacedArrayLiterals(line: string) {
  const found: { start: number, end: number, text: string }[] = [];
  let inString = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') inString = !inString;
    if (inString) continue;
    if (c === '/' && line[i + 1] === '/') break;

    const head = /^arr\s*([[(])/.exec(line.slice(i));
    if (!head || /\w/.test(line[i - 1] ?? '')) continue;

    // Match the closing bracket
    const open = head[1];
    const close = open === '[' ? ']' : ')';
    let depth = 0;
    let end = i + head[0].length - 1;
    for (; end < line.length; end++) {
      if (line[end] === open) depth++;
      else if (line[end] === close && --depth === 0) break;
    }
    if (end >= line.length) break;

    const before = line.slice(0, i).trimEnd();
    const assigned = /(^|[^=!<>])=$/.test(before) || /[+-]=$/.test(before);
    if (!assigned) {
      found.push({ start: i, end: end + 1, text: line.slice(i, end + 1) });
    }
    i = end;
  }
  return found;
}

/**
 * Explains the directive and array-literal mistakes the parser only reports
 * as "no viable alternative", so a reader (or the AI Tutor's repair request)
 * can fix them.
 */
function directiveProblems(source: string) {
  const problems: string[] = [];
  source.split(/\r?\n/).forEach((text, index) => {
    const line = index + 1;
    for (const literal of misplacedArrayLiterals(text)) {
      problems.push(
        `Line ${line}: an array literal (${literal.text}) can only be used ` +
        'right after = in an assignment. Assign it to a variable on the ' +
        'line before, then use the variable.',
      );
    }

    const { directives, rest } = scanDirectives(text);
    if (directives.length === 0) return;

    for (const { name, args } of directives) {
      if (!Directives.has(name)) {
        problems.push(
          `Line ${line}: @${name} is not a directive. Use only @init, ` +
          '@mark, @log, @insert, @delete, @update, @swap and @sort.',
        );
        continue;
      }
      for (const arg of args) {
        if (arg && !PlainArg.test(arg)) {
          problems.push(
            `Line ${line}: directive argument "${arg}" is an expression. ` +
            'Arguments must be a single variable name, number or "string": ' +
            'assign the value to a variable on the line before ' +
            `(e.g. k = ${arg}) and use @${name}<k, ...>.`,
          );
        }
      }
    }
    // A directive may also decorate a parameter: fun F(@init<table> a)
    if (!rest) {
      problems.push(
        `Line ${line}: a directive cannot be on a line by itself. Put it at ` +
        'the start of the statement it marks, on the same line.',
      );
    }
  });
  return problems;
}

/**
 * Checks pseudocode the way the visualizer will run it, and returns the
 * problems found (empty when the code is fine). Used to vet AI Tutor output.
 *
 * Reports syntax errors (with line and column, plus plain explanations of
 * directive mistakes), runtime exceptions, errors
 * the interpreter logs, a program with no top-level call, and arrays that are
 * never visualized.
 *
 * @param source The pseudocode to check
 */
export default function validateSource(source: string): string[] {
  const syntax: string[] = [];
  const listener = {
    syntaxError: (
      _recognizer: unknown,
      _symbol: unknown,
      line: number,
      column: number,
      message: string,
    ) => {
      syntax.push(`Line ${line}:${column}: ${message}`);
    },
    reportAmbiguity: () => {},
    reportAttemptingFullContext: () => {},
    reportContextSensitivity: () => {},
  };

  const lexer = new PseudocodeLexer(CharStream.fromString(source));
  lexer.removeErrorListeners();
  lexer.addErrorListener(listener);
  const parser = new PseudocodeParser(new CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener(listener);
  const tree = parser.program();

  const hints = directiveProblems(source);
  if (syntax.length > 0) return [...hints, ...syntax];

  const visitor = new TraceInterpreterVisitor();
  try {
    visitor.visit(tree);
  } catch (err) {
    return [
      ...hints,
      `Runtime error: ${err instanceof Error ? err.message : String(err)}`,
    ];
  }

  const actions = visitor.steps.flatMap(step => step.actions);
  const problems = [...hints, ...new Set(
    actions
      .filter(a => a.cmd === 'vis_log' && a.params.level === 'error')
      .map(a => String(a.params.text)),
  )];

  // Function declarations are the only steps with a [start, end] line range
  if (visitor.steps.every(step => Array.isArray(step.line))) {
    problems.push(
      'The program does nothing: add a top-level call such as result = Name(a1).',
    );
  }

  const usesArrays = /\barr\s*[[(]/.test(source);
  if (usesArrays && !actions.some(a => a.cmd === 'vis_init')) {
    problems.push(
      'No array is visualized: put @init<table> on the array parameter of ' +
      'the first function called.',
    );
  }

  return problems;
}
