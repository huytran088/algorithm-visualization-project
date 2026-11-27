import { AbstractParseTreeVisitor } from 'antlr4ng';
import { PseudocodeVisitor } from './.antlr/PseudocodeVisitor';
import {
  ProgramContext,
  AssignmentContext,
  FunctionDeclContext,
  FunctionCallStmtContext,
  ForEachLoopContext,
  IfStatementContext,
  ReturnStatementContext,
  ValueArrayContext,
  AtomExpressionContext,
  CompareExprContext,
  ExpressionListContext,
  RangeArrayContext,
  SizeArrayContext,
  AddExprContext,
  MulExprContext,
  ParenExpressionContext,
  UnaryMinusExprContext,
  ArrayAccessExpressionContext,
  FunctionCallExpressionContext,
  WhileLoopContext,
  MetadataContext,
  BlockContext,
  StatementContext,
  PowerExpressionContext,
  LogicalAndExpressionContext,
  LogicalOrExpressionContext,
  ForLoopContext,
  DoWhileLoopContext,
  BreakStatementContext,
  ContinueStatementContext,
} from './.antlr/PseudocodeParser';
import { TraceStep, TraceAction } from './TraceType';

type Scope = Map<string, any>;

export default class TraceInterpreterVisitor
  extends AbstractParseTreeVisitor<any>
  implements PseudocodeVisitor<any> {
  public steps: TraceStep[] = [];
  private globalScope: Scope = new Map();
  private callStack: Scope[] = [];
  private functions: Map<string, FunctionDeclContext> = new Map();

  // Heuristics & States
  private activeLoopIndices: number[] = [];
  private lastComparisonLeft: any = null;
  private lastComparisonRight: any = null;
  private lastComparisonOp: string = '';
  private recentArrayAccesses: Array<{ index: number, arrayName: string }> = [];
  private isReferenceMode: boolean = false;

  private lastFlushedMarkedIndices: number[] = [];

  // The array shown in the table. Marks, updates and swaps are only drawn for
  // this array (compared by reference, so aliases like a1/array match).
  private visualized: any[] | null = null;
  // Call depth of the frame that showed `visualized` (0 = top level). While
  // that frame runs, @init on another array (a helper's temporary, a merge
  // sort half) is ignored, so the table doesn't jump between arrays.
  private visualizedDepth = 0;

  /**
   * Whether an @init on `value` may show it, from a frame at `depth`.
   */
  private canVisualize(value: any, depth: number) {
    if (!Array.isArray(value) || value === this.visualized) return false;
    return this.visualized === null ||
      this.callStack.length < this.visualizedDepth ||
      depth <= this.visualizedDepth;
  }

  protected defaultResult(): any {
    return null;
  }

  protected aggregateResult(aggregate: any, nextResult: any): any {
    if (aggregate !== null && aggregate !== undefined) return aggregate;
    return nextResult;
  }

  /**
   * The variables the Vars pane shows: globals overlaid by each call frame,
   * innermost last (the pane is keyed by name).
   */
  private visibleVars(): Map<string, any> {
    const visible = new Map<string, any>(this.globalScope);
    for (const frame of this.callStack) {
      frame.forEach((value, key) => visible.set(key, value));
    }
    return visible;
  }

  /**
   * var_add actions for every visible name bound to this array, so a write
   * through one alias (array) also updates the others (a1).
   */
  private aliasUpdates(arr: any[]): TraceAction[] {
    const actions: TraceAction[] = [];
    this.visibleVars().forEach((value, name) => {
      if (value === arr) {
        actions.push({ cmd: 'var_add', params: { name, value: [...arr] } });
      }
    });
    return actions;
  }

  private get memory(): Scope {
    return this.callStack.length > 0 ? this.callStack[this.callStack.length - 1] : this.globalScope;
  }

  private addStep(line: number | number[], actions: TraceAction[]) {
    const safeActions: TraceAction[] = [];

    for (const action of actions) {
      if (action.cmd === 'var_add' && action.params.value === undefined) {
        action.params.value = 'undefined';
        safeActions.push({
          cmd: 'vis_log',
          params: {
            level: 'error',
            text: `Evaluation Error: '${action.params.name}' resulted in undefined. Check your syntax.`,
          },
        });
      }
      safeActions.push(action);
    }
    this.steps.push({ line, actions: safeActions });
  }

  private processMetadata(ctx: MetadataContext): TraceAction | null {
    const directive = ctx.ID().getText();
    const paramsCtx = ctx.metadataParams();

    if (!paramsCtx) return null;

    const params = paramsCtx.metadataParam().map((p) => {
      const text = p.getText();
      if (text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1);
      if (!isNaN(Number(text))) return Number(text);

      const memVal = this.memory.get(text);
      if (memVal !== undefined && typeof memVal === 'number') return memVal;

      return text;
    });

    let action: TraceAction | null = null;

    if (directive === 'log') {
      action = { cmd: 'vis_log', params: { level: params.length > 1 ? String(params[0]) : 'info', text: String(params.length > 1 ? params[1] : params[0]) } };
    } else if (directive === 'init') {
      action = { cmd: 'vis_init', params: { type: String(params[0]) } };
    } else if (directive === 'mark') {
      const idx = Number(params[0]);
      if (!isNaN(idx)) {
        action = { cmd: 'vis_mark', params: { index: idx, type: params.length > 1 ? String(params[1]) : 'outline', color: params.length > 2 ? String(params[2]) : 'yellow' } };
      }
    } else if (directive === 'insert') {
      const idx = Number(params[0]);
      if (!isNaN(idx)) action = { cmd: 'vis_insert', params: { index: idx, value: params[1] } };
    } else if (directive === 'delete') {
      const idx = Number(params[0]);
      if (!isNaN(idx)) action = { cmd: 'vis_delete', params: { index: idx } };
    } else if (directive === 'update') {
      const idx = Number(params[0]);
      if (!isNaN(idx)) action = { cmd: 'vis_update', params: { index: idx, value: params[1] } };
    } else if (directive === 'swap') {
      const idx1 = Number(params[0]);
      const idx2 = Number(params[1]);
      if (!isNaN(idx1) && !isNaN(idx2)) action = { cmd: 'vis_swap', params: { index: idx1, index2: idx2 } };
    } else if (directive === 'sort') {
      action = { cmd: 'vis_sort', params: { name: String(params[0]) } };
    }

    return action;
  }

  private extractMetadataActions(ctx: any): TraceAction[] {
    const actions: TraceAction[] = [];
    if (typeof ctx.metadata === 'function') {
      const metadataList = ctx.metadata();
      if (metadataList && Array.isArray(metadataList)) {
        for (const metaCtx of metadataList) {
          const action = this.processMetadata(metaCtx);
          if (action) actions.push(action);
        }
      }
    }
    if (
      ctx.parent &&
      typeof ctx.parent.metadata === 'function' &&
      ctx.parent.constructor.name === 'StatementContext'
    ) {
      const parentMetadataList = ctx.parent.metadata();
      if (parentMetadataList && Array.isArray(parentMetadataList)) {
        for (const metaCtx of parentMetadataList) {
          const action = this.processMetadata(metaCtx);
          if (action) actions.push(action);
        }
      }
    }

    return actions;
  }

  private flushComparisons(line: number, extraActions: TraceAction[] = []) {
    const actions: TraceAction[] = [...extraActions];
    let targetIndex: number | null = null;
    for (const idx of this.lastFlushedMarkedIndices) {
      if (!this.recentArrayAccesses.some(a => a.index === idx)) {
        actions.push({ cmd: 'vis_unmark', params: { index: idx, type: 'all' } });
      }
    }
    this.lastFlushedMarkedIndices = [];
    const annotatedOutlineIndices = new Set(
      extraActions
        .filter(a => a.cmd === 'vis_mark' && a.params.type === 'outline')
        .map(a => a.params.index as number),
    );

    if (this.recentArrayAccesses.length > 0) {
      for (const access of this.recentArrayAccesses) {
        if (!annotatedOutlineIndices.has(access.index)) {
          actions.push({ cmd: 'vis_mark', params: { index: access.index, type: 'outline', color: 'yellow' } });
        }
        this.lastFlushedMarkedIndices.push(access.index);
      }
      targetIndex = this.recentArrayAccesses[this.recentArrayAccesses.length - 1].index;
    } else if (this.activeLoopIndices.length > 0) {
      targetIndex = this.activeLoopIndices[this.activeLoopIndices.length - 1];
      if (!annotatedOutlineIndices.has(targetIndex)) {
        actions.push({ cmd: 'vis_mark', params: { index: targetIndex, type: 'outline', color: 'yellow' } });
      }
      this.lastFlushedMarkedIndices.push(targetIndex);
    }

    if (targetIndex !== null && this.lastComparisonLeft !== null && this.lastComparisonRight !== null && this.lastComparisonOp) {
      actions.push({
        cmd: 'vis_mark',
        params: { index: targetIndex, type: 'text', color: 'fg', value: `${this.lastComparisonLeft} ${this.lastComparisonOp} ${this.lastComparisonRight}?` },
      });
    }

    if (actions.length > extraActions.length || extraActions.length > 0) {
      this.addStep(line, actions);
    }

    this.recentArrayAccesses = [];
    this.lastComparisonLeft = null;
    this.lastComparisonRight = null;
    this.lastComparisonOp = '';
  }

  // Called whenever the visualizer marks are fully resolved (swap or scope exit),
  // so that lastFlushedMarkedIndices doesn't carry stale indices into the next scope.
  private clearFlushedMarks() {
    this.lastFlushedMarkedIndices = [];
  }

  visitProgram(ctx: ProgramContext): any {
    if (ctx.statement()) for (const stmt of ctx.statement()) this.visit(stmt);
    return this.steps;
  }

  visitStatement(ctx: StatementContext): any {
    if (ctx.assignment()) return this.visit(ctx.assignment()!);
    if (ctx.functionDecl()) return this.visit(ctx.functionDecl()!);
    if (ctx.functionCallStmt()) return this.visit(ctx.functionCallStmt()!);
    if (ctx.forEachLoop()) return this.visit(ctx.forEachLoop()!);
    if (ctx.whileLoop()) return this.visit(ctx.whileLoop()!);
    if (ctx.ifStatement()) return this.visit(ctx.ifStatement()!);
    if (ctx.returnStatement()) return this.visit(ctx.returnStatement()!);
    if (ctx.forLoop()) return this.visit(ctx.forLoop()!);
    if (ctx.doWhileLoop()) return this.visit(ctx.doWhileLoop()!);
    if (ctx.breakStatement()) return this.visit(ctx.breakStatement()!);
    if (ctx.continueStatement()) return this.visit(ctx.continueStatement()!);
    return null;
  }

  visitBreakStatement(_: BreakStatementContext): any {
    return { __type: 'break' };
  }

  visitContinueStatement(_: ContinueStatementContext): any {
    return { __type: 'continue' };
  }

  visitAssignment(ctx: AssignmentContext): any {
    const assignableCtx = ctx.assignable();
    const name = assignableCtx.ID().getText();
    const isArrayAccess = !!assignableCtx.LBRACK();

    let value = ctx.arrayInitialization() ? this.visit(ctx.arrayInitialization()!) : this.visit(ctx.expression()!);

    if (!isArrayAccess) {
      if (ctx.PLUS_EQ()) value = (this.memory.get(name) || 0) + value;
      else if (ctx.MINUS_EQ()) value = (this.memory.get(name) || 0) - value;
    }

    if (isArrayAccess) {
      const prevRef = this.isReferenceMode;
      this.isReferenceMode = false;
      const index = Math.floor(this.visit(assignableCtx.expression()!));
      this.isReferenceMode = prevRef;

      const arr = this.memory.get(name);
      if (Array.isArray(arr)) {
        if (ctx.PLUS_EQ()) value = arr[index] + value;
        else if (ctx.MINUS_EQ()) value = arr[index] - value;
        arr[index] = value;

        // FIX 1: Extract metadata AFTER updating memory!
        const metadataActions = this.extractMetadataActions(ctx);

        // Writes to other arrays (counts, temporaries) only show in Vars
        const drawn: TraceAction[] = arr === this.visualized ?
          [
            { cmd: 'vis_mark', params: { index, type: 'highlight', color: 'green' } },
            { cmd: 'vis_update', params: { index, value } },
          ] :
          [];
        const actions: TraceAction[] = [...metadataActions,
          ...drawn,
          ...this.aliasUpdates(arr),
        ];
        this.addStep(ctx.start!.line, actions);
      }
      return;
    }

    this.memory.set(name, value);
    const snapshotValue = Array.isArray(value) ? [...value] : value;
    const metadataActions = this.extractMetadataActions(ctx)
      .filter((action) => {
        if (action.cmd !== 'vis_init') return true;
        // Same rule as @init on a parameter, from the current frame
        if (!this.canVisualize(value, this.callStack.length)) return false;
        action.params.data = snapshotValue;
        this.visualized = value;
        this.visualizedDepth = this.callStack.length;
        return true;
      });

    if (typeof value === 'number' && this.recentArrayAccesses.length > 0) {
      const unmarkActions: TraceAction[] = [...metadataActions];
      const accessedIndices = new Set(this.recentArrayAccesses.map(a => a.index));
      const explicitMarks = new Set(
        metadataActions.filter(a => a.cmd === 'vis_mark').map(a => a.params.index),
      );

      for (const idx of accessedIndices) {
        if (!explicitMarks.has(idx)) {
          unmarkActions.push({ cmd: 'vis_unmark', params: { index: idx, type: 'all' } });
        }
      }
      unmarkActions.push({ cmd: 'var_add', params: { name, value: snapshotValue } });
      this.addStep(ctx.start!.line, unmarkActions);
      this.recentArrayAccesses = [];
      return;
    }

    const actions: TraceAction[] = [...metadataActions, { cmd: 'var_add', params: { name, value: snapshotValue } }];
    this.addStep(ctx.start!.line, actions);
  }

  visitValueArray(ctx: ValueArrayContext): any[] {
    // arr[] is an empty array
    return (ctx.expressionList()?.expression() ?? []).map((e) => {
      const val = this.visit(e);
      return typeof val === 'number' ? val : parseInt(String(val), 10);
    });
  }

  visitRangeArray(ctx: RangeArrayContext): any[] {
    const from = Math.floor(this.visit(ctx._from_!));
    const to = Math.floor(this.visit(ctx._to!));
    const arr: number[] = [];
    for (let i = from; i <= to; i++) arr.push(i);
    return arr;
  }

  visitSizeArray(ctx: SizeArrayContext): any[] {
    const size = Math.floor(this.visit(ctx._size!));
    const defaultVal = ctx._defaultVal != null ? this.visit(ctx._defaultVal) : 0;
    return new Array(size).fill(defaultVal);
  }

  visitFunctionDecl(ctx: FunctionDeclContext): any {
    const metadataActions = this.extractMetadataActions(ctx);
    const funcName = ctx.ID().getText();
    this.functions.set(funcName, ctx);
    const start = ctx.start!.line;
    const end = ctx.stop?.line || start;

    this.addStep([start, end], [
      ...metadataActions,
      { cmd: 'var_add', params: { name: `${funcName}(...)`, value: '<function>' } },
    ]);
  }

  visitFunctionCallStmt(ctx: FunctionCallStmtContext): any {
    const metadataActions = this.extractMetadataActions(ctx);
    if (metadataActions.length > 0) this.addStep(ctx.start!.line, metadataActions);

    const funcName = ctx.ID().getText();
    const exprList = ctx.expressionList();

    if (funcName === 'swap' && exprList) {
      const exprs = exprList.expression();
      if (exprs.length === 2) {
        this.isReferenceMode = true;
        const ref1 = this.visit(exprs[0]);
        this.isReferenceMode = true;
        const ref2 = this.visit(exprs[1]);
        this.isReferenceMode = false;

        if (ref1?.isArrayAccess && ref2?.isArrayAccess) {
          const arr1 = this.memory.get(ref1.arrayName);
          const arr2 = this.memory.get(ref2.arrayName);

          if (Array.isArray(arr1) && Array.isArray(arr2)) {
            const temp = arr1[ref1.index];
            arr1[ref1.index] = arr2[ref2.index];
            arr2[ref2.index] = temp;
            this.clearFlushedMarks();

            if (arr1 === arr2 && arr1 === this.visualized) {
              this.addStep(ctx.start!.line, [
                ...this.aliasUpdates(arr1),
                { cmd: 'vis_mark', params: { index: ref1.index, type: 'highlight', color: 'green' } },
                { cmd: 'vis_mark', params: { index: ref2.index, type: 'highlight', color: 'green' } },
                { cmd: 'vis_swap', params: { index: ref1.index, index2: ref2.index } },
              ]);
            } else {
              // Not (only) the visualized array: update Vars, and redraw
              // just the cell of the visualized array that changed, if any
              const swapActions: TraceAction[] = [...this.aliasUpdates(arr1)];
              if (arr2 !== arr1) swapActions.push(...this.aliasUpdates(arr2));
              for (const [arr, index] of [[arr1, ref1.index], [arr2, ref2.index]] as const) {
                if (arr === this.visualized && arr1 !== arr2) {
                  swapActions.push(
                    { cmd: 'vis_mark', params: { index, type: 'highlight', color: 'green' } },
                    { cmd: 'vis_update', params: { index, value: arr[index] } },
                  );
                }
              }
              this.addStep(ctx.start!.line, swapActions);
            }
            return null;
          }
        }
      }
    }

    const args = exprList ? this.visit(exprList) : [];
    // A call statement's value is discarded: returning it would make the
    // enclosing function stop as if it had hit `return`
    this.executeFunction(funcName, args, ctx.start!.line);
    return null;
  }

  executeFunction(name: string, args: any[], callLine: number) {
    const funcCtx = this.functions.get(name);
    if (!funcCtx) {
      this.addStep(callLine, [{
        cmd: 'vis_log',
        params: {
          level: 'error',
          text: `Unknown function '${name}'. Only length, size, floor, swap and functions defined with fun can be called.`,
        },
      }]);
      return undefined;
    }
    const paramCtxs = funcCtx.paramList()?.param() || [];
    const newScope: Scope = new Map();
    const initActions: TraceAction[] = [];
    paramCtxs.forEach((pCtx, i) => {
      const pName = pCtx.ID().getText();
      const val = args[i];
      newScope.set(pName, val);
      const snapshotVal = Array.isArray(val) ? [...val] : val;
      initActions.push({ cmd: 'var_add', params: { name: pName, value: snapshotVal } });
      let hasInit = false;
      if (pCtx.metadata) {
        const metaList = pCtx.metadata();
        for (const meta of metaList) {
          const action = this.processMetadata(meta);
          if (action && action.cmd === 'vis_init') {
            hasInit = true;
            // Skip non-arrays, the array already shown (recursion), and other
            // arrays while the call that showed the table is still running
            if (!this.canVisualize(val, this.callStack.length + 1)) continue;
            action.params.data = snapshotVal;
            initActions.push(action);
            this.visualized = val;
            this.visualizedDepth = this.callStack.length + 1;
          }
        }
      }
      // Without @init, only show an array when nothing is shown yet, so a
      // helper's temporary array can't replace the table
      if (!hasInit && Array.isArray(val) && this.visualized === null) {
        initActions.push({ cmd: 'vis_init', params: { data: snapshotVal, type: 'table' } });
        this.visualized = val;
        this.visualizedDepth = this.callStack.length + 1;
      }
    });

    this.globalScope.forEach((_, key) => initActions.push({ cmd: 'var_greyout', params: { name: key } }));

    const funcBlock: BlockContext | null = funcCtx.block();
    let entryLine = funcCtx.start!.line;
    if (funcBlock && funcBlock.statement(0)) entryLine = funcBlock.statement(0)!.start!.line;
    this.addStep(entryLine, initActions);
    this.clearFlushedMarks();

    this.callStack.push(newScope);
    let retVal: any = undefined;

    const stmts = funcBlock?.statement();
    if (stmts) {
      for (const stmt of stmts) {
        const res = this.visit(stmt);
        if (res && (res.__type === 'break' || res.__type === 'continue')) break;
        if (res !== undefined && res !== null) {
          retVal = res;
          break;
        }
      }
    }

    this.callStack.pop();

    // Show what the caller sees again: a name this call shadowed (e.g. the
    // caller's own `array` in recursion) gets its caller value back instead
    // of disappearing. Globals stay greyed unless we're back at top level.
    const cleanup: TraceAction[] = [];
    const visible = this.visibleVars();
    newScope.forEach((_, key) => {
      if (visible.has(key)) {
        const value = visible.get(key);
        cleanup.push({ cmd: 'var_add', params: { name: key, value: Array.isArray(value) ? [...value] : value } });
      } else {
        cleanup.push({ cmd: 'var_delete', params: { name: key } });
      }
    });
    if (this.callStack.length === 0) {
      this.globalScope.forEach((_, key) => cleanup.push({ cmd: 'var_normal', params: { name: key } }));
    }
    if (retVal !== undefined && retVal !== null) {
      cleanup.push({ cmd: 'var_add', params: { name: 'result', value: retVal } });
    }

    this.addStep(callLine, cleanup);
    this.clearFlushedMarks();
    // A function without `return` gives Null, not undefined
    return retVal === undefined ? null : retVal;
  }

  visitForLoop(ctx: ForLoopContext): any {
    this.visit(ctx.assignment(0)!);

    let limit = 1000;
    while (true) {
      const condition = this.visit(ctx.expression()!);
      if (!condition || limit-- <= 0) break;
      const metadataActions = this.extractMetadataActions(ctx);
      this.flushComparisons(ctx.start!.line, metadataActions);
      const stmts = ctx.block()?.statement();
      let broke = false;
      if (stmts) {
        for (const stmt of stmts) {
          const res = this.visit(stmt);
          if (res && res.__type === 'break') {
            broke = true;
            break;
          }
          if (res && res.__type === 'continue') break;
          if (res !== undefined && res !== null) return res;
        }
      }
      if (broke) break;
      this.visit(ctx.assignment(1)!);
    }
  }

  visitWhileLoop(ctx: WhileLoopContext): any {
    let limit = 1000;

    while (true) {
      const condition = this.visit(ctx.expression()!);
      if (!condition || limit-- <= 0) break;
      const metadataActions = this.extractMetadataActions(ctx);
      this.flushComparisons(ctx.start!.line, metadataActions);
      const stmts = ctx.block()?.statement();
      let broke = false;
      if (stmts) {
        for (const stmt of stmts) {
          const res = this.visit(stmt);
          if (res && res.__type === 'break') {
            broke = true;
            break;
          }
          if (res && res.__type === 'continue') break;
          if (res !== undefined && res !== null) return res;
        }
      }
      if (broke) break;
    }
  }

  visitDoWhileLoop(ctx: DoWhileLoopContext): any {
    let limit = 1000;
    do {
      const stmts = ctx.block()?.statement();
      let broke = false;
      if (stmts) {
        for (const stmt of stmts) {
          const res = this.visit(stmt);
          if (res && res.__type === 'break') {
            broke = true;
            break;
          }
          if (res && res.__type === 'continue') break;
          if (res !== undefined && res !== null) return res;
        }
      }
      if (broke) break;
      const condition = this.visit(ctx.expression()!);
      const metadataActions = this.extractMetadataActions(ctx);
      this.flushComparisons(ctx.stop?.line || 0, metadataActions);
      if (!condition) break;
    } while (limit-- > 0);
  }

  visitForEachLoop(ctx: ForEachLoopContext): any {
    const iterVarName = ctx.ID(0)!.getText();
    const arrayName = ctx.ID(1)!.getText();
    const arrayData = this.memory.get(arrayName);
    if (Array.isArray(arrayData)) {
      for (let i = 0; i < arrayData.length; i++) {
        const val = arrayData[i];
        this.memory.set(iterVarName, val);
        this.activeLoopIndices.push(i);
        const metadataActions = this.extractMetadataActions(ctx);
        const actions: TraceAction[] = [
          ...metadataActions,
          { cmd: 'var_add', params: { name: iterVarName, value: val } },
          { cmd: 'vis_mark', params: { index: i, type: 'outline', color: 'yellow' } },
        ];
        if (i > 0) actions.unshift({ cmd: 'vis_unmark', params: { index: i - 1, type: 'all' } });
        this.addStep(ctx.start!.line, actions);
        const stmts = ctx.block()?.statement();
        if (stmts) {
          for (const stmt of stmts) {
            const res = this.visit(stmt);
            if (res && res.__type === 'break') {
              this.addStep(ctx.start!.line, [{ cmd: 'vis_unmark', params: { index: i, type: 'all' } }]);
              this.activeLoopIndices.pop();
              return undefined;
            }
            if (res && res.__type === 'continue') break;
            if (res !== undefined && res !== null) {
              this.addStep(ctx.start!.line, [{ cmd: 'vis_unmark', params: { index: i, type: 'all' } }]);
              this.activeLoopIndices.pop();
              return res;
            }
          }
        }
        this.activeLoopIndices.pop();
      }
      if (arrayData.length > 0) {
        this.addStep(ctx.start!.line, [{ cmd: 'vis_unmark', params: { index: arrayData.length - 1, type: 'all' } }]);
      }
    }
  }

  visitIfStatement(ctx: IfStatementContext): any {
    const expressions = ctx.expression();
    const blocks = ctx.block();
    let matchedBlockIndex = -1;
    for (let i = 0; i < expressions.length; i++) {
      const condition = this.visit(expressions[i]);
      this.flushComparisons(ctx.start!.line, []);
      if (condition) {
        matchedBlockIndex = i;
        break;
      }
    }
    if (matchedBlockIndex === -1 && blocks.length > expressions.length) matchedBlockIndex = blocks.length - 1;
    if (matchedBlockIndex !== -1) {
      const stmts = blocks[matchedBlockIndex].statement();
      if (stmts) {
        for (const stmt of stmts) {
          if (stmt.returnStatement()) {
            let idx = null;
            if (this.recentArrayAccesses.length > 0) idx = this.recentArrayAccesses[this.recentArrayAccesses.length - 1].index;
            else if (this.activeLoopIndices.length > 0) idx = this.activeLoopIndices[this.activeLoopIndices.length - 1];

            if (idx !== null) {
              this.addStep(stmt.start!.line, [
                { cmd: 'vis_mark', params: { index: idx, type: 'outline', color: 'green' } },
                { cmd: 'vis_mark', params: { index: idx, type: 'highlight', color: 'green' } },
              ]);
            }
          }

          const res = this.visit(stmt);
          if (res && (res.__type === 'break' || res.__type === 'continue')) return res;
          if (res !== undefined && res !== null) {
            this.recentArrayAccesses = [];
            return res;
          }
        }
      }
    }
    return undefined;
  }

  visitLogicalOrExpression(ctx: LogicalOrExpressionContext): any {
    let left = this.visit(ctx._left!);
    const rights = ctx._right;
    if (!rights || (Array.isArray(rights) && rights.length === 0)) return left;
    const rightArray = Array.isArray(rights) ? rights : [rights];
    for (let i = 0; i < rightArray.length; i++) left = left || this.visit(rightArray[i]);
    return left;
  }

  visitLogicalAndExpression(ctx: LogicalAndExpressionContext): any {
    let left = this.visit(ctx._left!);
    const rights = ctx._right;
    if (!rights || (Array.isArray(rights) && rights.length === 0)) return left;
    const rightArray = Array.isArray(rights) ? rights : [rights];
    for (let i = 0; i < rightArray.length; i++) left = left && this.visit(rightArray[i]);
    return left;
  }

  visitCompareExpr(ctx: CompareExprContext): boolean | any {
    let left = this.visit(ctx._left!);
    const rights = ctx._right;
    const ops = ctx._op;

    if (!rights || (Array.isArray(rights) && rights.length === 0)) return left;

    const rightArray = Array.isArray(rights) ? rights : [rights];
    const opArray = Array.isArray(ops) ? ops : [ops];

    for (let i = 0; i < rightArray.length; i++) {
      const right = this.visit(rightArray[i]);
      const opText = opArray[i].text!;

      this.lastComparisonLeft = left;
      this.lastComparisonRight = right;
      this.lastComparisonOp = opText;

      switch (opText) {
        case '==':
          left = left === right;
          break;
        case '!=':
          left = left !== right;
          break;
        case '<':
          left = left < right;
          break;
        case '>':
          left = left > right;
          break;
        case '<=':
          left = left <= right;
          break;
        case '>=':
          left = left >= right;
          break;
      }
    }
    return left;
  }

  visitAddExpr(ctx: AddExprContext): any {
    let left = this.visit(ctx._left!);
    const rights = ctx._right;
    const ops = ctx._op;
    if (!rights || (Array.isArray(rights) && rights.length === 0)) return left;

    const rightArray = Array.isArray(rights) ? rights : [rights];
    const opArray = Array.isArray(ops) ? ops : [ops];

    for (let i = 0; i < rightArray.length; i++) {
      const right = this.visit(rightArray[i]);
      const opText = opArray[i].text!;
      left = opText === '+' ? left + right : left - right;
    }
    return left;
  }

  visitMulExpr(ctx: MulExprContext): any {
    let left = this.visit(ctx._left!);
    const rights = ctx._right;
    const ops = ctx._op;
    if (!rights || (Array.isArray(rights) && rights.length === 0)) return left;

    const rightArray = Array.isArray(rights) ? rights : [rights];
    const opArray = Array.isArray(ops) ? ops : [ops];

    for (let i = 0; i < rightArray.length; i++) {
      const right = this.visit(rightArray[i]);
      const opText = opArray[i].text!;
      if (opText === '*') left = left * right;
      else if (opText === '/') left = left / right;
      else if (opText === '%') left = left % Math.floor(right);
    }
    return left;
  }

  visitPowerExpression(ctx: PowerExpressionContext): any {
    let left = this.visit(ctx._left!);
    const rights = ctx._right;
    if (!rights || (Array.isArray(rights) && rights.length === 0)) return left;
    const rightArray = Array.isArray(rights) ? rights : [rights];
    for (let i = 0; i < rightArray.length; i++) left = Math.pow(left, this.visit(rightArray[i]));
    return left;
  }

  visitParenExpression(ctx: ParenExpressionContext): any {
    return this.visit(ctx.expression()!);
  }

  visitUnaryMinusExpr(ctx: UnaryMinusExprContext): any {
    return -this.visit(ctx.unaryExpression()!);
  }

  visitArrayAccessExpression(ctx: ArrayAccessExpressionContext): any {
    const arrayName = ctx.ID().getText();

    // Disable ref mode deeply so nested indexes evaluate normally
    const prevRefMode = this.isReferenceMode;
    this.isReferenceMode = false;
    const index = Math.floor(this.visit(ctx.expression()!));
    this.isReferenceMode = prevRefMode;

    // Automatic marks only make sense for cells of the visualized array
    if (this.memory.get(arrayName) === this.visualized) {
      this.recentArrayAccesses.push({ index, arrayName });
      if (this.recentArrayAccesses.length > 5) this.recentArrayAccesses.shift();
    }

    if (this.isReferenceMode) {
      this.isReferenceMode = false; // consume it safely
      return { isArrayAccess: true, arrayName, index };
    }

    const arr = this.memory.get(arrayName);
    if (Array.isArray(arr)) return arr[index];
    return null;
  }

  visitFunctionCallExpression(ctx: FunctionCallExpressionContext): any {
    const funcName = ctx.ID().getText();
    const args = ctx.expressionList() ? this.visit(ctx.expressionList()!) : [];

    if ((funcName === 'size' || funcName === 'length') && Array.isArray(args[0])) return args[0].length;
    if (funcName === 'floor' && typeof args[0] === 'number') return Math.floor(args[0]);
    return this.executeFunction(funcName, args, ctx.start!.line);
  }

  visitAtomExpression(ctx: AtomExpressionContext): any {
    const text = ctx.getText();
    if (text === 'true' || text === 'True') return true;
    if (text === 'false' || text === 'False') return false;
    if (text === 'null' || text === 'Null') return null;
    if (!isNaN(Number(text))) return Number(text);
    if (text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1);
    return this.memory.get(text);
  }

  visitExpressionList(ctx: ExpressionListContext): any[] {
    return ctx.expression().map(e => this.visit(e));
  }

  visitReturnStatement(ctx: ReturnStatementContext): any {
    const metadataActions = this.extractMetadataActions(ctx);
    if (metadataActions.length > 0) this.addStep(ctx.start!.line, metadataActions);
    return this.visit(ctx.expression()!);
  }
}
