import { expect } from 'vitest';
import { CharStream, CommonTokenStream } from 'antlr4ng';

import { PseudocodeLexer } from '../../../app/hooks/interpreter/.antlr/PseudocodeLexer';
import { PseudocodeParser } from '../../../app/hooks/interpreter/.antlr/PseudocodeParser';
import TraceInterpreterVisitor from '../../../app/hooks/interpreter/TraceInterpreterVisitor';

/**
 * Parses pseudocode, failing loudly on any syntax error.
 */
export function parse(source: string) {
  const errors: string[] = [];
  const lexer = new PseudocodeLexer(CharStream.fromString(source));
  const parser = new PseudocodeParser(new CommonTokenStream(lexer));
  parser.removeErrorListeners();
  parser.addErrorListener({
    syntaxError: (_r, _s, line, col, msg) => errors.push(`${line}:${col} ${msg}`),
    reportAmbiguity: () => {},
    reportAttemptingFullContext: () => {},
    reportContextSensitivity: () => {},
  });
  const tree = parser.program();
  expect(errors).toEqual([]);
  return tree;
}

/**
 * Runs pseudocode through the trace interpreter and returns the steps.
 */
export function trace(source: string) {
  const visitor = new TraceInterpreterVisitor();
  visitor.visit(parse(source));
  return visitor.steps;
}

/**
 * Returns the final value assigned to a variable in a trace.
 */
export function finalValue(source: string, name: string) {
  let value: any = undefined;
  for (const step of trace(source)) {
    for (const action of step.actions) {
      if (action.cmd === 'var_add' && action.params.name === name) {
        value = action.params.value;
      }
    }
  }
  return value;
}
