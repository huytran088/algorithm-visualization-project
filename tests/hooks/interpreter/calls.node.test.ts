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

describe('interpreter: visualized array', () => {
  it('initializes the table once when recursing on the same array', () => {
    expect(actions(QuickSort, 'vis_init')).toHaveLength(1);
  });

  it('does not let a helper\'s temporary array replace the table', () => {
    const src = `a1 = arr[4, 3, 2, 1]

fun Copy_Half(tmp):
    tmp[0] = 9
    return tmp
end fun

fun Run(@init<table> array):
    half = arr(2, 0)
    Copy_Half(half)
    return array
end fun

result = Run(a1)
`;
    const inits = actions(src, 'vis_init');
    expect(inits).toHaveLength(1);
    expect(inits[0].params.data).toEqual([4, 3, 2, 1]);
  });

  it('only draws writes to the visualized array', () => {
    const src = `a1 = arr[5, 6, 7]

fun Run(@init<table> array):
    count = arr(3, 0)
    count[1] = 42
    array[2] = 8
    return array
end fun

result = Run(a1)
`;
    expect(actions(src, 'vis_update')).toEqual([
      { cmd: 'vis_update', params: { index: 2, value: 8 } },
    ]);
  });

  it('only draws swaps on the visualized array', () => {
    const src = `a1 = arr[5, 6, 7]

fun Run(@init<table> array):
    other = arr[1, 2, 3]
    swap(other[0], other[1])
    swap(array[0], array[2])
    return array
end fun

result = Run(a1)
`;
    expect(actions(src, 'vis_swap')).toEqual([
      { cmd: 'vis_swap', params: { index: 0, index2: 2 } },
    ]);
    expect(finalValue(src, 'result')).toEqual([7, 6, 5]);
  });

  it('keeps the table on the first array while its call runs', () => {
    // The shape language models generate: halves copied into new arrays,
    // with @init on every parameter of every call
    const src = `a1 = arr[4, 1, 3, 2]

fun Merge(@init<table> array, @init<table> left, @init<table> right, @init<int> n):
    i = 0
    j = 0
    k = 0
    while (k < n):
        if (j >= length(right)):
            array[k] = left[i]
            i += 1
        else if (i < length(left) and left[i] <= right[j]):
            array[k] = left[i]
            i += 1
        else:
            array[k] = right[j]
            j += 1
        end if
        k += 1
    end while
    return array
end fun

fun Merge_Sort(@init<table> array):
    n = length(array)
    if (n < 2):
        return array
    end if
    mid = floor(n / 2)
    left = arr(mid, 0)
    right = arr(n - mid, 0)
    for (i = 0; i < mid; i += 1):
        left[i] = array[i]
    end for
    for (i = mid; i < n; i += 1):
        right[i - mid] = array[i]
    end for
    left = Merge_Sort(left)
    right = Merge_Sort(right)
    Merge(array, left, right, n)
    return array
end fun

result = Merge_Sort(a1)
`;
    const inits = actions(src, 'vis_init');
    expect(inits).toHaveLength(1);
    expect(inits[0].params.data).toEqual([4, 1, 3, 2]);
    expect(finalValue(src, 'result')).toEqual([1, 2, 3, 4]);
    // The final merge into a1 is drawn on the table
    expect(actions(src, 'vis_update').map(a => a.params.value))
      .toEqual([1, 2, 3, 4]);
  });

  it('lets a later top-level call show its own array', () => {
    const src = `a1 = arr[1, 2]
a2 = arr[3, 4, 5]

fun Show(@init<table> array):
    return array
end fun

r1 = Show(a1)
r2 = Show(a2)
`;
    expect(actions(src, 'vis_init').map(a => a.params.data))
      .toEqual([[1, 2], [3, 4, 5]]);
  });

  it('ignores @init on a value that is not an array', () => {
    const src = `a1 = arr[1, 2]

fun Run(@init<table> array, @init<int> n):
    return n
end fun

r = Run(a1, 2)
`;
    expect(actions(src, 'vis_init').map(a => a.params.data)).toEqual([[1, 2]]);
  });

  it('ignores @init on a nested temporary assignment', () => {
    const src = `a1 = arr[1, 2]

fun Helper(n):
    @init<table> tmp = arr(n, 0)
    return tmp
end fun

fun Run(@init<table> array):
    t = Helper(3)
    return array
end fun

r = Run(a1)
`;
    expect(actions(src, 'vis_init').map(a => a.params.data)).toEqual([[1, 2]]);
  });
});
