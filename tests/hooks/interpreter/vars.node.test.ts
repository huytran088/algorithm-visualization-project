import { describe, expect, it } from 'vitest';

import { TraceStep } from '../../../app/hooks/interpreter/TraceType';

import { trace } from './helpers';

type Vars = { [name: string]: [any, number] };

/**
 * Applies the var_* actions of steps[0..upTo] the way useSteps does, and
 * returns the Vars pane contents: name -> [value, 0 normal | -1 greyed].
 */
function replay(steps: TraceStep[], upTo = steps.length - 1) {
  const vars: Vars = {};
  for (const step of steps.slice(0, upTo + 1)) {
    for (const { cmd, params } of step.actions) {
      const name = params.name!;
      if (cmd === 'var_add') {
        if (name in vars) vars[name][0] = params.value;
        else vars[name] = [params.value, 0];
      } else if (cmd === 'var_delete') {
        delete vars[name];
      } else if (cmd === 'var_greyout' && vars[name]) {
        vars[name][1] = -1;
      } else if (cmd === 'var_normal' && vars[name]) {
        vars[name][1] = 0;
      }
    }
  }
  return vars;
}

/**
 * Index of the last step on the given source line. (A function's entry step
 * shares its first statement's line, so the last one is the statement.)
 */
function stepAt(steps: TraceStep[], line: number) {
  const index = steps.findLastIndex(s => s.line === line);
  expect(index).toBeGreaterThanOrEqual(0);
  return index;
}

describe('interpreter: Vars pane values', () => {
  it('updates every name of an array written through an alias', () => {
    const steps = trace(`a1 = arr[3, 1, 2]

fun Write(array):
    array[0] = 9
    return 0
end fun

r = Write(a1)
`);
    const vars = replay(steps, stepAt(steps, 4));
    expect(vars.array[0]).toEqual([9, 1, 2]);
    expect(vars.a1).toEqual([[9, 1, 2], -1]); // still greyed while in Write
    expect(replay(steps).a1).toEqual([[9, 1, 2], 0]);
  });

  it('updates every name of an array swapped through an alias', () => {
    const steps = trace(`a1 = arr[3, 1, 2]

fun Run(@init<table> array):
    swap(array[0], array[2])
    return 0
end fun

r = Run(a1)
`);
    expect(replay(steps).a1[0]).toEqual([2, 1, 3]);
  });

  it('keeps the caller\'s variables when a nested call returns', () => {
    const steps = trace(`g = 1

fun Inner(x):
    return x
end fun

fun Outer(x):
    y = Inner(7)
    z = x
    return z
end fun

r = Outer(5)
`);
    const vars = replay(steps, stepAt(steps, 9));
    expect(vars.x).toEqual([5, 0]); // Inner's x must not delete Outer's
    expect(vars.g).toEqual([1, -1]); // globals stay greyed inside Outer
  });

  it('shows the caller\'s values again after a recursive call', () => {
    const steps = trace(`fun Count(n):
    if (n > 0):
        k = Count(n - 1)
    end if
    m = n
    return n
end fun

r = Count(2)
`);
    // The first time line 5 runs after a recursive call returned, the
    // innermost caller (n = 1) is active again
    const first = steps.findIndex((s, i) => s.line === 5 && i > 0 &&
      replay(steps, i - 1).n?.[0] === 1);
    expect(first).toBeGreaterThan(0);
    expect(replay(steps, first).n).toEqual([1, 0]);
  });

  it('removes a function\'s variables when it returns to the top level', () => {
    const vars = replay(trace(`fun F(x):
    y = x
    return y
end fun

r = F(5)
`));
    expect(vars.x).toBeUndefined();
    expect(vars.y).toBeUndefined();
    expect(vars.r).toEqual([5, 0]);
  });
});
