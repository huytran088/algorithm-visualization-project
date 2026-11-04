# AVP Pseudocode Reference

Algorithms are written in a small Python/Pascal-flavoured pseudocode stored in
`.avp` files. The grammar lives in
[`app/hooks/interpreter/Pseudocode.g4`](../app/hooks/interpreter/Pseudocode.g4).

## File format

The **first line must be a title comment** followed by a blank line. The app
uses this line as the page title and strips it before running the code.

```
// Linear Search

a1 = arr[1, 10, 5, 6, 4, 7, 19]
...
```

To add a bundled algorithm, place it in `public/code/<name>.avp`, add a card to
`Globals.AlgorithmCards` in `app/globals.ts`, and add light/dark thumbnails to
`public/img/`. It is then reachable at `/run?algorithm=<name>`.
`tests/hooks/interpreter/interpreter.node.test.ts` automatically checks that
every bundled file parses and runs without errors.

## Syntax

| Feature | Example |
| --- | --- |
| Comment | `// text` or `# text` |
| Assignment | `x = 5`, `x += 1`, `x -= 1` |
| Array literal | `a = arr[3, 1, 2]` |
| Range array | `a = arr[1 to 10]` |
| Sized array | `a = arr(5)` or `a = arr(5, 0)` (size, default value) |
| Index | `a[i]`, `a[i] = v` (indices are floored) |
| Arithmetic | `+ - * / % **` (`/` is real division; use `floor(x)`) |
| Comparison | `== != < > <= >=` |
| Logic | `and`, `or` |
| Literals | `123`, `1.5`, `"text"`, `True`/`true`, `False`/`false`, `Null`/`null` |

### Control flow

Every block ends with a matching `end` keyword. Parentheses around conditions
are optional except in `for (...)` and `do ... while (...)`.

```
if (x < y):
    ...
else if (x > y):
    ...
else:
    ...
end if

while (i < n):
    ...
end while

for (i = 0; i < n; i += 1):     # commas also accepted as separators
    ...
end for

for item in a:
    ...
end for

do:
    ...
while (cond)

break          # exits the innermost loop
continue       # skips to the next iteration of the innermost loop
```

### Functions

Function names should start with a capital letter. Every program needs a
top-level call so it actually runs.

```
fun Linear_Search(@init<table> a, k):
    for n in a:
        if n == k:
            return n
        end if
    end for
    return -1
end fun

result = Linear_Search(a1, 4)
```

### Built-ins

| Function | Meaning |
| --- | --- |
| `length(a)` / `size(a)` | Array length |
| `floor(x)` | Round down |
| `swap(a[i], a[j])` | Swap two array elements (animated) |

## Visual directives

Directives have the form `@name<param, ...>`. They are placed **at the start
of a line, before the statement** they annotate, or before a function
parameter. Several can be chained on one line (`@a<..> @b<..> x = 1`), but a
directive cannot sit on a line by itself. Parameters may be numbers, strings,
identifiers (resolved to the variable's current numeric value), or bare words.

| Directive | Parameters | Effect |
| --- | --- | --- |
| `@init<type>` | `table` | Visualize this array parameter |
| `@mark<index, kind, color>` | kind: `outline` (default) / `highlight` / `text`; color: e.g. `yellow` (default), `green`, `red` | Mark a cell |
| `@log<level, "text">` or `@log<"text">` | level: `info` (default), `warn`, `error` | Show a message |
| `@insert<index, value>` | | Insert a cell |
| `@delete<index>` | | Remove a cell |
| `@update<index, value>` | | Change a cell value |
| `@swap<i, j>` | | Animate a swap |
| `@sort<name>` | | Show the array as sorted |

Style guidance, which is also given to the AI generator:

- Use outlines for cursors and iterators.
- Use highlights sparingly, for found, swap and warning states.
- Use the `text` mark only on `if`/`while` statements.

The interpreter also adds comparison and array-access marks automatically.
