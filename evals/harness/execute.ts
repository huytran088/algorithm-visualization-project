import { CharStream, CommonTokenStream, ParserRuleContext } from 'antlr4ng';

import { PseudocodeLexer } from '../../app/hooks/interpreter/.antlr/PseudocodeLexer';
import {
  ArrayAccessExpressionContext,
  CompareExprContext,
  ParenExpressionContext,
  PseudocodeParser,
  StatementContext,
} from '../../app/hooks/interpreter/.antlr/PseudocodeParser';
import TraceInterpreterVisitor from '../../app/hooks/interpreter/TraceInterpreterVisitor';
import type { TraceStep } from '../../app/hooks/interpreter/TraceType';

/** Thrown when a program runs more statements than the eval allows. */
export class StatementLimit extends Error {}

/** What the real array held after the statement that ended at trace step `step`. */
export type Checkpoint = { step: number, actual: number[] | null };

export type Execution = {
  syntaxErrors: string[]
  runtimeError?: string
  statementLimit: boolean
  steps: TraceStep[]
  /** The array the table shows, at the end of the run (null: none) */
  visualized: number[] | null
  /** Top-level variables at the end of the run */
  globals: Map<string, any>
  checkpoints: Checkpoint[]
  /** Comparisons with an element of the visualized array as an operand */
  arrayComparisons: number
  /** Distinct errors the interpreter logged */
  errorLogs: string[]
};

/**
 * Descends through parentheses and single-child precedence rules, so
 * ((array[j])) is still an element read.
 */
function unwrap(node: any): any {
  for (;;) {
    if (node instanceof ParenExpressionContext) node = node.expression();
    else if (node instanceof ParserRuleContext && node.getChildCount() === 1 &&
      node.getChild(0) instanceof ParserRuleContext) node = node.getChild(0);
    else return node;
  }
}

/**
 * The app's trace interpreter, unchanged, plus eval-only bookkeeping: a cap
 * on statements run, a snapshot of the real visualized array after every
 * statement, and a count of element comparisons.
 */
class EvalVisitor extends TraceInterpreterVisitor {
  statements = 0;
  checkpoints: Checkpoint[] = [];
  arrayComparisons = 0;

  constructor(private maxStatements: number) {
    super();
  }

  private get self(): any {
    return this as any;
  }

  visitStatement(ctx: StatementContext): any {
    if (++this.statements > this.maxStatements) throw new StatementLimit();
    const result = super.visitStatement(ctx);
    const visualized = this.self.visualized as number[] | null;
    this.checkpoints.push({
      step: this.steps.length,
      actual: visualized ? [...visualized] : null,
    });
    return result;
  }

  visitCompareExpr(ctx: CompareExprContext): any {
    const rights = ctx._right;
    const rightList = Array.isArray(rights) ? rights : rights ? [rights] : [];
    if (rightList.length > 0) {
      const visualized = this.self.visualized;
      const readsVisualized = (node: any) => {
        const inner = unwrap(node);
        return inner instanceof ArrayAccessExpressionContext &&
          visualized !== null &&
          this.self.memory.get(inner.ID().getText()) === visualized;
      };
      // Checked before the comparison runs, against the array shown now
      if ([ctx._left, ...rightList].some(readsVisualized)) {
        this.arrayComparisons += rightList.length;
      }
    }
    return super.visitCompareExpr(ctx);
  }
}

/**
 * Parses and runs pseudocode the way the visualizer does.
 *
 * @param source The program
 * @param maxStatements Statements to run before giving up (a runaway loop)
 */
export function execute(source: string, maxStatements = 200_000): Execution {
  const syntaxErrors: string[] = [];
  const listener = {
    syntaxError: (_r: unknown, _s: unknown, line: number, col: number, msg: string) =>
      syntaxErrors.push(`${line}:${col} ${msg}`),
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

  const visitor = new EvalVisitor(maxStatements);
  const self = visitor as any;
  const execution: Execution = {
    syntaxErrors,
    statementLimit: false,
    steps: [],
    visualized: null,
    globals: new Map(),
    checkpoints: [],
    arrayComparisons: 0,
    errorLogs: [],
  };
  if (syntaxErrors.length > 0) return execution;

  try {
    visitor.visit(tree);
  } catch (err) {
    if (err instanceof StatementLimit) execution.statementLimit = true;
    else execution.runtimeError = err instanceof Error ? err.message : String(err);
  }

  execution.steps = visitor.steps;
  execution.visualized = self.visualized ? [...self.visualized] : null;
  execution.globals = self.globalScope;
  execution.checkpoints = visitor.checkpoints;
  execution.arrayComparisons = visitor.arrayComparisons;
  execution.errorLogs = [...new Set(
    visitor.steps.flatMap(s => s.actions)
      .filter(a => a.cmd === 'vis_log' && a.params.level === 'error')
      .map(a => String(a.params.text)),
  )];
  return execution;
}
