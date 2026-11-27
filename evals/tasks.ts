/**
 * The AI Tutor eval tasks: what a user asks for, and how to tell whether the
 * generated program did it.
 *
 * References follow Levitin, "Introduction to the Design and Analysis of
 * Algorithms" (3rd ed.), where it has the algorithm, and CLRS (3rd ed.)
 * otherwise. They are written from the books' standard pseudocode, not
 * checked line by line against the printed page.
 */

/** Constraints on generated input arrays. */
export type Shape = {
  min: number
  max: number
  minLength: number
  maxLength: number
  sorted?: boolean
  distinct?: boolean
  /** Put params[0] in about half the arrays and leave it out of the rest */
  target?: boolean
};

/** One run of a generated program on one input. */
export type Run = {
  input: number[]
  params: number[]
  /** The array the table shows at the end (null: no table) */
  table: number[] | null
  /** The value the top-level call returned */
  result: any
};

export type Category = 'sort' | 'search' | 'partition' | 'transform' | 'scalar';

export type Task = {
  id: string
  category: Category
  request: string
  /** Scalar arguments the program takes (target, k) */
  params: number
  shape: (params: number[]) => Shape
  /** The textbook algorithm, on a copy of the input */
  reference: (input: number[], params: number[]) => any
  /** null when the run is right, else why it's wrong */
  check: (run: Run, expected: any) => string | null
  /** Exact element comparisons for an input of length n, when fixed */
  comparisons?: (n: number) => number
  /** data/*.avp functions retrieval should find (empty: none in the KB) */
  kb: string[]
  source: string
};

const Base: Shape = { min: -9, max: 20, minLength: 0, maxLength: 10 };
const NonEmpty: Shape = { ...Base, minLength: 1 };
const Sorted: Shape = { ...Base, sorted: true, target: true };

const same = (a: any, b: any) => JSON.stringify(a) === JSON.stringify(b);
const show = (v: any) => JSON.stringify(v);

/** The table must end equal to the expected array. */
function tableIs(run: Run, expected: number[]) {
  if (run.table === null) return 'no array is visualized';
  return same(run.table, expected) ?
    null :
    `table ends ${show(run.table)}, expected ${show(expected)}`;
}

/** The returned value must equal the expected one. */
function resultIs(run: Run, expected: any) {
  return same(run.result, expected) ?
    null :
    `returned ${show(run.result)}, expected ${show(expected)}`;
}

function isPermutation(a: number[] | null, b: number[]) {
  return a !== null && same([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y));
}

const quadratic = (n: number) => n * (n - 1) / 2;

function sortTask(
  id: string,
  request: string,
  algorithm: (a: number[]) => number[],
  extra: Partial<Task> = {},
): Task {
  return {
    id,
    category: 'sort',
    request,
    params: 0,
    shape: () => Base,
    reference: input => algorithm([...input]),
    check: tableIs,
    kb: [],
    source: '',
    ...extra,
  };
}

// --- Textbook algorithms --------------------------------------------------

function bubbleSort(a: number[]) {
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = 0; j < a.length - 1 - i; j++) {
      if (a[j + 1] < a[j]) [a[j], a[j + 1]] = [a[j + 1], a[j]];
    }
  }
  return a;
}

function selectionSort(a: number[], descending = false) {
  for (let i = 0; i < a.length - 1; i++) {
    let min = i;
    for (let j = i + 1; j < a.length; j++) {
      if (descending ? a[j] > a[min] : a[j] < a[min]) min = j;
    }
    [a[i], a[min]] = [a[min], a[i]];
  }
  return a;
}

function insertionSort(a: number[]) {
  for (let i = 1; i < a.length; i++) {
    const v = a[i];
    let j = i - 1;
    while (j >= 0 && a[j] > v) {
      a[j + 1] = a[j];
      j--;
    }
    a[j + 1] = v;
  }
  return a;
}

function comparisonCountingSort(a: number[]) {
  const count = a.map(() => 0);
  for (let i = 0; i < a.length - 1; i++) {
    for (let j = i + 1; j < a.length; j++) {
      if (a[i] < a[j]) count[j]++;
      else count[i]++;
    }
  }
  const s: number[] = [];
  a.forEach((v, i) => (s[count[i]] = v));
  return s;
}

/** Levitin's LomutoPartition on a[l..r], pivot a[l]; CLRS uses a[r]. */
function lomutoLast(a: number[], lo: number, hi: number) {
  const pivot = a[hi];
  let i = lo - 1;
  for (let j = lo; j < hi; j++) {
    if (a[j] <= pivot) {
      i++;
      [a[i], a[j]] = [a[j], a[i]];
    }
  }
  [a[i + 1], a[hi]] = [a[hi], a[i + 1]];
  return i + 1;
}

/** Levitin's HoarePartition: pivot a[l] ends at the returned index. */
function hoare(a: number[], l: number, r: number) {
  const p = a[l];
  let i = l;
  let j = r + 1;
  for (;;) {
    do i++; while (i <= r && a[i] < p);
    do j--; while (a[j] > p);
    if (i >= j) break;
    [a[i], a[j]] = [a[j], a[i]];
  }
  [a[l], a[j]] = [a[j], a[l]];
  return j;
}

function quickSort(a: number[], part: typeof hoare, l = 0, r = a.length - 1) {
  if (l < r) {
    const s = part(a, l, r);
    quickSort(a, part, l, s - 1);
    quickSort(a, part, s + 1, r);
  }
  return a;
}

function mergeSort(a: number[]): number[] {
  if (a.length <= 1) return a;
  const mid = Math.floor(a.length / 2);
  const b = mergeSort(a.slice(0, mid));
  const c = mergeSort(a.slice(mid));
  let i = 0;
  let j = 0;
  let k = 0;
  while (i < b.length && j < c.length) a[k++] = b[i] <= c[j] ? b[i++] : c[j++];
  while (i < b.length) a[k++] = b[i++];
  while (j < c.length) a[k++] = c[j++];
  return a;
}

function heapSort(a: number[]) {
  const sift = (n: number, i: number) => {
    for (;;) {
      let big = i;
      const l = 2 * i + 1;
      const r = l + 1;
      if (l < n && a[l] > a[big]) big = l;
      if (r < n && a[r] > a[big]) big = r;
      if (big === i) return;
      [a[i], a[big]] = [a[big], a[i]];
      i = big;
    }
  };
  for (let i = Math.floor(a.length / 2) - 1; i >= 0; i--) sift(a.length, i);
  for (let n = a.length - 1; n > 0; n--) {
    [a[0], a[n]] = [a[n], a[0]];
    sift(n, 0);
  }
  return a;
}

const ascending = (a: number[]) => a.sort((x, y) => x - y);

function linearSearch(a: number[], k: number) {
  return a.indexOf(k);
}

/** Any index holding k is right for binary/interpolation search. */
function anyIndexOf(run: Run, __: any) {
  const k = run.params[0];
  if (!run.input.includes(k)) {
    return run.result === -1 ? null : `returned ${show(run.result)}, but ${k} is absent (expected -1)`;
  }
  return typeof run.result === 'number' && run.input[run.result] === k ?
    null :
    `returned ${show(run.result)}, but ${k} is at ${show(run.input.flatMap((v, i) => (v === k ? [i] : [])))}`;
}

/** Partitioned around the pivot value, which ends at the returned index. */
function partitionedAround(pivotOf: (input: number[]) => number) {
  return (run: Run, __: any) => {
    const t = run.table;
    if (!isPermutation(t, run.input)) return `table ${show(t)} is not a permutation of the input`;
    const p = run.result;
    if (typeof p !== 'number' || p < 0 || p >= t!.length) return `returned ${show(p)}, not an index`;
    if (t![p] !== pivotOf(run.input)) return `pivot ${pivotOf(run.input)} is not at the returned index ${p}`;
    for (let i = 0; i < t!.length; i++) {
      if (i < p && t![i] > t![p]) return `${t![i]} at ${i} is left of pivot ${t![p]}`;
      if (i > p && t![i] < t![p]) return `${t![i]} at ${i} is right of pivot ${t![p]}`;
    }
    return null;
  };
}

// --- The tasks -------------------------------------------------------------

export const Tasks: Task[] = [
  // Sorts: the table must end sorted
  sortTask('bubble_sort', 'Write Bubble Sort.', bubbleSort,
    { kb: ['Bubble_Sort'], source: 'Levitin 3e, BubbleSort' }),
  sortTask('bubble_sort_early_exit', 'Write Bubble Sort that stops as soon as a pass makes no swaps.', bubbleSort,
    { kb: ['Bubble_Sort'], source: 'Levitin 3e, BubbleSort (improved version, exercise)' }),
  sortTask('selection_sort', 'Write Selection Sort.', a => selectionSort(a),
    { kb: ['Selection_Sort'], comparisons: quadratic, source: 'Levitin 3e, SelectionSort' }),
  sortTask('selection_sort_descending', 'Sort the array in descending order with Selection Sort.',
    a => selectionSort(a, true),
    { kb: ['Selection_Sort'], comparisons: quadratic, source: 'Levitin 3e, SelectionSort (reversed comparison)' }),
  sortTask('insertion_sort', 'Write Insertion Sort.', insertionSort,
    { kb: ['Insertion_Sort'], source: 'Levitin 3e, InsertionSort' }),
  sortTask('comparison_counting_sort',
    'Write Comparison Counting Sort: for each element, count the elements smaller than it, then place each element at its count. Copy the result back so the visualized array ends sorted.',
    comparisonCountingSort,
    { kb: ['Comparison_Counting_Sort'], comparisons: quadratic, source: 'Levitin 3e, ComparisonCountingSort' }),
  sortTask('distribution_counting_sort',
    'Write Counting Sort for values between 0 and 9: count how many times each value occurs, then rewrite the array in order.',
    ascending,
    { shape: () => ({ ...Base, min: 0, max: 9 }), source: 'Levitin 3e, DistributionCountingSort' }),
  sortTask('quick_sort_lomuto', 'Write Quick Sort using the Lomuto partition scheme with the last element as the pivot.',
    a => quickSort(a, lomutoLast),
    { kb: ['Lomuto_Partition'], source: 'CLRS 3e, QUICKSORT / PARTITION (Lomuto)' }),
  sortTask('quick_sort_hoare', 'Write Quick Sort using Hoare\'s partition with the first element as the pivot.',
    a => quickSort(a, hoare),
    { kb: ['Hoare_Partition'], source: 'Levitin 3e, Quicksort / HoarePartition' }),
  sortTask('quick_sort', 'Write QuickSort.', ascending,
    { kb: ['Lomuto_Partition', 'Hoare_Partition'], source: 'Levitin 3e, Quicksort' }),
  sortTask('merge_sort', 'Write Merge Sort. Merge into a temporary array and copy back so the visualized array ends sorted.',
    mergeSort,
    { source: 'Levitin 3e, Mergesort / Merge' }),
  sortTask('heap_sort', 'Write Heap Sort that builds a max heap in the array itself.', heapSort,
    { source: 'Levitin 3e, Heapsort (array heap)' }),
  sortTask('shell_sort', 'Write Shell Sort with gaps n/2, n/4, ..., 1.', ascending,
    { kb: ['Insertion_Sort'], source: 'Levitin 3e, Shellsort (exercise)' }),
  sortTask('cocktail_sort', 'Write Cocktail Shaker Sort, a bubble sort that alternates passes left-to-right and right-to-left.',
    ascending,
    { kb: ['Bubble_Sort'], source: 'Knuth TAOCP vol. 3, 5.2.2 (cocktail-shaker sort)' }),
  sortTask('gnome_sort', 'Write Gnome Sort.', ascending,
    { kb: ['Insertion_Sort'], source: 'Standard definition (Grune)' }),
  sortTask('odd_even_sort', 'Write Odd-Even Transposition Sort.', ascending,
    { kb: ['Bubble_Sort'], source: 'Standard definition' }),
  sortTask('dutch_national_flag',
    'Sort an array of 0s, 1s and 2s in a single pass with three pointers (Dutch national flag problem).',
    ascending,
    { shape: () => ({ ...Base, min: 0, max: 2 }), source: 'Dijkstra, Dutch national flag (Levitin 3e exercise)' }),

  // Searches: return an index, or -1
  {
    id: 'linear_search',
    category: 'search',
    request: 'Write Linear Search: return the index of the first occurrence of the target, or -1 if it is not in the array.',
    params: 1,
    shape: () => ({ ...Base, target: true }),
    reference: (a, [k]) => linearSearch(a, k),
    check: resultIs,
    kb: ['Linear_Search'],
    source: 'Levitin 3e, SequentialSearch',
  },
  {
    id: 'last_occurrence',
    category: 'search',
    request: 'Search the array from the end and return the index of the last occurrence of the target, or -1 if it is absent.',
    params: 1,
    shape: () => ({ ...Base, target: true }),
    reference: (a, [k]) => a.lastIndexOf(k),
    check: resultIs,
    kb: ['Linear_Search'],
    source: 'Levitin 3e, SequentialSearch (reversed)',
  },
  {
    id: 'binary_search',
    category: 'search',
    request: 'Write iterative Binary Search on a sorted array: return an index of the target, or -1 if it is not found.',
    params: 1,
    shape: () => Sorted,
    reference: (a, [k]) => a.indexOf(k),
    check: anyIndexOf,
    kb: ['Binary_Search'],
    source: 'Levitin 3e, BinarySearch',
  },
  {
    id: 'binary_search_recursive',
    category: 'search',
    request: 'Write recursive Binary Search on a sorted array: return an index of the target, or -1 if it is not found.',
    params: 1,
    shape: () => Sorted,
    reference: (a, [k]) => a.indexOf(k),
    check: anyIndexOf,
    kb: ['Binary_Search'],
    source: 'Levitin 3e, BinarySearch (recursive form)',
  },
  {
    id: 'interpolation_search',
    category: 'search',
    request: 'Write Interpolation Search on a sorted array: return an index of the target, or -1 if it is not found.',
    params: 1,
    shape: () => ({ ...Sorted, distinct: true }),
    reference: (a, [k]) => a.indexOf(k),
    check: anyIndexOf,
    kb: ['Binary_Search'],
    source: 'Levitin 3e, interpolation search',
  },
  {
    id: 'lower_bound',
    category: 'search',
    request: 'In a sorted array, use binary search to find the first index whose value is greater than or equal to the target. Return the array length if there is none.',
    params: 1,
    shape: () => Sorted,
    reference: (a, [k]) => {
      const i = a.findIndex(v => v >= k);
      return i < 0 ? a.length : i;
    },
    check: resultIs,
    kb: ['Binary_Search'],
    source: 'CLRS 3e, binary search (lower-bound variant)',
  },
  {
    id: 'count_occurrences',
    category: 'search',
    request: 'Count how many times the target occurs in the array and return the count.',
    params: 1,
    shape: () => ({ ...Base, target: true }),
    reference: (a, [k]) => a.filter(v => v === k).length,
    check: resultIs,
    kb: ['Linear_Search'],
    source: 'Brute force (Levitin 3e, Ch. 3)',
  },

  // Partitions: one pass over the whole array
  {
    id: 'lomuto_partition',
    category: 'partition',
    request: 'Partition the whole array around its last element with the Lomuto scheme and return the pivot\'s final index.',
    params: 0,
    shape: () => NonEmpty,
    reference: a => lomutoLast(a, 0, a.length - 1),
    check: partitionedAround(a => a[a.length - 1]),
    comparisons: n => Math.max(n - 1, 0),
    kb: ['Lomuto_Partition'],
    source: 'CLRS 3e, PARTITION',
  },
  {
    id: 'hoare_partition',
    category: 'partition',
    request: 'Partition the whole array around its first element with Hoare\'s scheme, put the pivot at its final position, and return that index.',
    params: 0,
    shape: () => NonEmpty,
    reference: a => hoare(a, 0, a.length - 1),
    check: partitionedAround(a => a[0]),
    kb: ['Hoare_Partition'],
    source: 'Levitin 3e, HoarePartition',
  },
  {
    id: 'even_odd_partition',
    category: 'partition',
    request: 'Rearrange the array in place so all even numbers come before all odd numbers, using two pointers.',
    params: 0,
    shape: () => Base,
    reference: (a) => {
      let i = 0;
      let j = a.length - 1;
      while (i < j) {
        if (a[i] % 2 === 0) i++;
        else if (a[j] % 2 !== 0) j--;
        else [a[i], a[j]] = [a[j], a[i]];
      }
      return a;
    },
    check: (run) => {
      const t = run.table;
      if (!isPermutation(t, run.input)) return `table ${show(t)} is not a permutation of the input`;
      const firstOdd = t!.findIndex(v => Math.abs(v) % 2 === 1);
      return firstOdd >= 0 && t!.slice(firstOdd).some(v => v % 2 === 0) ?
        `table ${show(t)} has an even number after an odd one` :
        null;
    },
    kb: ['Hoare_Partition'],
    source: 'Two-pointer partition (Levitin 3e, Ch. 4 exercises)',
  },
  {
    id: 'move_zeros',
    category: 'transform',
    request: 'Move all zeros to the end of the array in place, keeping the other numbers in their original order.',
    params: 0,
    shape: () => ({ ...Base, min: 0, max: 5 }),
    reference: a => [...a.filter(v => v !== 0), ...a.filter(v => v === 0)],
    check: tableIs,
    kb: [],
    source: 'Standard two-pointer exercise',
  },

  // In-place transforms and two pointers
  {
    id: 'reverse_array',
    category: 'transform',
    request: 'Reverse the array in place using two pointers that move toward each other.',
    params: 0,
    shape: () => Base,
    reference: a => a.reverse(),
    check: tableIs,
    kb: [],
    source: 'Standard two-pointer exercise',
  },
  {
    id: 'rotate_left',
    category: 'transform',
    request: 'Rotate the array left by k positions in place, using three reversals.',
    params: 1,
    shape: () => Base,
    reference: (a, [k]) => {
      if (a.length === 0) return a;
      const s = ((k % a.length) + a.length) % a.length;
      return [...a.slice(s), ...a.slice(0, s)];
    },
    check: tableIs,
    kb: [],
    source: 'Bentley, Programming Pearls, Column 2 (reversal rotation)',
  },
  {
    id: 'prefix_sums',
    category: 'transform',
    request: 'Replace each element with the sum of all elements up to and including it, in place.',
    params: 0,
    shape: () => Base,
    reference: (a) => {
      for (let i = 1; i < a.length; i++) a[i] += a[i - 1];
      return a;
    },
    check: tableIs,
    kb: ['sum_array'],
    source: 'Standard prefix-sum definition',
  },
  {
    id: 'remove_duplicates_sorted',
    category: 'transform',
    request: 'Remove duplicates from a sorted array in place: move the distinct values to the front and return how many there are.',
    params: 0,
    shape: () => ({ ...Base, sorted: true }),
    reference: a => [...new Set(a)],
    check: (run, expected: number[]) => {
      if (run.result !== expected.length) return `returned ${show(run.result)}, expected ${expected.length}`;
      if (run.table === null) return 'no array is visualized';
      const front = run.table.slice(0, expected.length);
      return same(front, expected) ? null : `front of table is ${show(front)}, expected ${show(expected)}`;
    },
    kb: ['check_unique'],
    source: 'Standard two-pointer exercise',
  },
  {
    id: 'two_sum_sorted',
    category: 'search',
    request: 'In a sorted array, find two different positions whose values add up to the target using two pointers. Return them as an array of two indices, or arr[-1, -1] if there is no such pair.',
    params: 1,
    shape: () => ({ ...Base, sorted: true, maxLength: 8 }),
    reference: (a, [t]) => {
      let i = 0;
      let j = a.length - 1;
      while (i < j) {
        if (a[i] + a[j] === t) return [i, j];
        if (a[i] + a[j] < t) i++;
        else j--;
      }
      return [-1, -1];
    },
    check: (run, expected: number[]) => {
      const r = run.result;
      if (expected[0] === -1) return same(r, [-1, -1]) ? null : `returned ${show(r)}, but no pair exists`;
      if (!Array.isArray(r) || r.length !== 2) return `returned ${show(r)}, not a pair`;
      const [i, j] = r;
      const a = run.input;
      return i !== j && a[i] !== undefined && a[j] !== undefined && a[i] + a[j] === run.params[0] ?
        null :
        `returned ${show(r)}, which doesn't add up to ${run.params[0]}`;
    },
    kb: [],
    source: 'Standard two-pointer exercise',
  },
  {
    id: 'is_palindrome',
    category: 'scalar',
    request: 'Check whether the array reads the same forwards and backwards using two pointers. Return true or false.',
    params: 0,
    shape: () => ({ ...Base, min: 0, max: 2, maxLength: 6 }),
    reference: a => same(a, [...a].reverse()),
    check: resultIs,
    kb: ['check_unique'],
    source: 'Standard two-pointer exercise',
  },

  // Scalar results
  {
    id: 'max_element',
    category: 'scalar',
    request: 'Find the largest value in a non-empty array and return it.',
    params: 0,
    shape: () => NonEmpty,
    reference: a => Math.max(...a),
    check: resultIs,
    comparisons: n => Math.max(n - 1, 0),
    kb: ['max_value'],
    source: 'Levitin 3e, MaxElement',
  },
  {
    id: 'min_and_max',
    category: 'scalar',
    request: 'Find both the smallest and the largest value of a non-empty array in one pass. Return them as an array [min, max].',
    params: 0,
    shape: () => NonEmpty,
    reference: a => [Math.min(...a), Math.max(...a)],
    check: resultIs,
    kb: ['max_value'],
    source: 'CLRS 3e, 9.1 (simultaneous minimum and maximum)',
  },
  {
    id: 'sum_array',
    category: 'scalar',
    request: 'Add up all the values in the array and return the total.',
    params: 0,
    shape: () => Base,
    reference: a => a.reduce((s, v) => s + v, 0),
    check: resultIs,
    kb: ['sum_array'],
    source: 'Standard definition',
  },
  {
    id: 'unique_elements',
    category: 'scalar',
    request: 'Check whether all the elements of the array are distinct by comparing every pair. Return true or false.',
    params: 0,
    shape: () => ({ ...Base, min: 0, max: 9, maxLength: 6 }),
    reference: a => new Set(a).size === a.length,
    check: resultIs,
    kb: ['check_unique'],
    source: 'Levitin 3e, UniqueElements',
  },
  {
    id: 'count_inversions',
    category: 'scalar',
    request: 'Count the inversions in the array by checking every pair: an inversion is a pair i < j with a[i] > a[j]. Return the count.',
    params: 0,
    shape: () => Base,
    reference: (a) => {
      let c = 0;
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) c++;
      return c;
    },
    check: resultIs,
    comparisons: quadratic,
    kb: ['check_unique'],
    source: 'CLRS 3e, Problem 2-4 (inversions, brute force)',
  },
  {
    id: 'majority_element',
    category: 'scalar',
    request: 'Find the majority element (one that occurs more than n/2 times) with the Boyer-Moore voting algorithm and a checking pass. Return it, or -1 if there is none.',
    params: 0,
    shape: () => ({ ...Base, min: 0, max: 3 }),
    reference: (a) => {
      const counts = new Map<number, number>();
      for (const v of a) counts.set(v, (counts.get(v) ?? 0) + 1);
      for (const [v, c] of counts) if (c > a.length / 2) return v;
      return -1;
    },
    check: resultIs,
    kb: [],
    source: 'Boyer & Moore, MJRTY (1991)',
  },
  {
    id: 'quickselect',
    category: 'scalar',
    request: 'Write Quickselect with Lomuto partitioning to find the k-th smallest element (k counts from 1) and return it.',
    params: 1,
    shape: ([k]) => ({ ...Base, minLength: Math.max(k, 1) }),
    reference: (a, [k]) => ascending([...a])[k - 1],
    check: resultIs,
    kb: ['Lomuto_Partition'],
    source: 'Levitin 3e, Quickselect',
  },
  {
    id: 'max_subarray',
    category: 'scalar',
    request: 'Find the largest sum of a contiguous, non-empty subarray in linear time (Kadane\'s algorithm) and return it.',
    params: 0,
    shape: () => NonEmpty,
    reference: (a) => {
      let best = a[0];
      let cur = a[0];
      for (const v of a.slice(1)) {
        cur = Math.max(v, cur + v);
        best = Math.max(best, cur);
      }
      return best;
    },
    check: resultIs,
    kb: ['sum_array'],
    source: 'CLRS 3e, Exercise 4.1-5 (linear-time maximum subarray)',
  },
];

export const TaskById = new Map(Tasks.map(t => [t.id, t]));
