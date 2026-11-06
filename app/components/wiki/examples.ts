/**
 * Pseudocode content shown on the wiki page.
 *
 * This file has no React imports so that node tests can run every example
 * through the real interpreter.
 */

/**
 * Complete programs. Each one must parse and run as written.
 */
export const WikiExamples = {
  fileFormat: `// Linear Search

a1 = arr[1, 10, 5, 6, 4, 7, 19]
key = 7

// Finds the first occurrence of an element in an array
fun Linear_Search(@init<table> a, k):
    n = length(a)

    for @mark<i, outline, yellow> (i = 0; i < n; i += 1):
        if (a[i] == k):
            @mark<i, highlight, green> return i
        end if
    end for

    @log<"Not found: "> return -1
end fun

result = Linear_Search(a1, key)
`,

  doWhile: `// Count Up

fun Count_Up(limit):
    i = 0
    do:
        i += 1
    while (i < limit)
    return i
end fun

result = Count_Up(3)
`,

  directives: `// Array Editing

fun Edit(@init<table> a):
    @log<"Starting"> n = length(a)
    @mark<0, outline, yellow> x = a[0]
    @update<0, 9> a[0] = 9
    @insert<1, 5> x = 5
    @delete<1> x = 0
    @swap<0, 1> x = 1
    @sort<a> x = 2
end fun

values = arr[3, 1, 2]
Edit(values)
`,
} as const;

/**
 * Visual directives. Names must match the table in docs/PSEUDOCODE.md.
 */
export const WikiDirectives = [
  {
    name: 'init',
    usage: '@init<table>',
    parameters: 'table',
    effect: 'Visualize this array parameter',
  },
  {
    name: 'mark',
    usage: '@mark<index, kind, color>',
    parameters: 'kind: outline (default) or highlight. ' +
      'color: for example yellow (default), green or red.',
    effect: 'Mark a cell',
  },
  {
    name: 'log',
    usage: '@log<level, "text"> or @log<"text">',
    parameters: 'level: info (default), warn or error',
    effect: 'Show a message',
  },
  {
    name: 'insert',
    usage: '@insert<index, value>',
    parameters: 'Position and value',
    effect: 'Insert a cell',
  },
  {
    name: 'delete',
    usage: '@delete<index>',
    parameters: 'Position',
    effect: 'Remove a cell',
  },
  {
    name: 'update',
    usage: '@update<index, value>',
    parameters: 'Position and value',
    effect: 'Change a cell value',
  },
  {
    name: 'swap',
    usage: '@swap<i, j>',
    parameters: 'Two positions',
    effect: 'Animate a swap',
  },
  {
    name: 'sort',
    usage: '@sort<name>',
    parameters: 'Array name',
    effect: 'Show the array as sorted (experimental)',
  },
] as const;
