import { describe, expect, it } from 'vitest';

import { finalValue, trace } from './helpers';

/**
 * Returns every action with the given command across a trace.
 */
function actions(source: string, cmd: string) {
  return trace(source).flatMap(s => s.actions).filter(a => a.cmd === cmd);
}

/**
 * Returns the distinct error messages logged during a trace.
 */
function errorLogs(source: string) {
  return [...new Set(
    actions(source, 'vis_log')
      .filter(a => a.params.level === 'error')
      .map(a => a.params.text),
  )];
}

const QuickSort = `a1 = arr[10, 80, 30, 90, 40]

fun Partition(@init<table> array, low, high):
    pivot = array[high]
    i = low - 1
    for (j = low; j < high; j += 1):
        if (array[j] <= pivot):
            i += 1
            swap(array[i], array[j])
        end if
    end for
    k = i + 1
    swap(array[k], array[high])
    return k
end fun

fun Quick_Sort(array, low, high):
    if (low < high):
        p = Partition(array, low, high)
        Quick_Sort(array, low, p - 1)
        Quick_Sort(array, p + 1, high)
    end if
    return array
end fun

result = Quick_Sort(a1, 0, 4)
`;

describe('interpreter: function calls', () => {
  it('does not treat a call statement\'s value as a return', () => {
    const src = `fun Two():
    return 2
end fun

fun Run():
    Two()
    return 1
end fun

result = Run()
`;
    expect(finalValue(src, 'result')).toBe(1);
  });

  it('runs every recursive call in a recursive sort', () => {
    expect(finalValue(QuickSort, 'result')).toEqual([10, 30, 40, 80, 90]);
  });

  it('returns Null from a function without a return', () => {
    const src = `fun Nothing(a):
    a[0] = 1
end fun

a1 = arr[0, 0]
result = Nothing(a1)
`;
    expect(errorLogs(src)).toEqual([]);
    expect(finalValue(src, 'result')).toBeNull();
  });

  it('logs an error naming an unknown function', () => {
    const src = `x = arr[1, 2]
m = max(x)
`;
    expect(errorLogs(src)).toContainEqual(
      expect.stringContaining('Unknown function \'max\''),
    );
  });
});
