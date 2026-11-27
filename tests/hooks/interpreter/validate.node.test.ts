import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import validateSource from '../../../app/hooks/interpreter/validate';

const codeDir = join(import.meta.dirname, '../../../public/code');
const samples = readdirSync(codeDir).filter(f => f.endsWith('.avp'));

describe('validateSource', () => {
  it.each(samples)('accepts bundled algorithm %s', (file) => {
    expect(validateSource(readFileSync(join(codeDir, file), 'utf8'))).toEqual([]);
  });

  it('reports syntax errors with their line', () => {
    // Real failure from the AI Tutor: an invented @call directive
    const problems = validateSource(`a1 = arr[3, 1, 2]

fun Run(@init<table> array):
    pi = @call<Part, array>
    return array
end fun

result = Run(a1)
`);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems[0]).toMatch(/^Line 4:\d+: /);
  });

  it('explains an array literal outside an assignment', () => {
    const problems = validateSource(`fun Run(@init<table> array):
    return array
end fun

result = Run(arr[3, 1, 2])
`);
    expect(problems[0]).toBe(
      'Line 5: an array literal (arr[3, 1, 2]) can only be used right ' +
      'after = in an assignment. Assign it to a variable on the line ' +
      'before, then use the variable.',
    );
  });

  it('explains a directive on a line by itself', () => {
    const problems = validateSource(`a1 = arr[3, 1, 2]

fun Run(@init<table> array):
    i = 0
    @mark<i, outline, yellow>
    swap(array[0], array[1])
    return array
end fun

result = Run(a1)
`);
    expect(problems[0]).toBe(
      'Line 5: a directive cannot be on a line by itself. Put it at the ' +
      'start of the statement it marks, on the same line.',
    );
  });

  it('explains an expression used as a directive argument', () => {
    const problems = validateSource(`a1 = arr[3, 1, 2]

fun Run(@init<table> array):
    n = length(array)
    @mark<n - 1, outline, yellow> swap(array[0], array[n - 1])
    return array
end fun

result = Run(a1)
`);
    expect(problems[0]).toBe(
      'Line 5: directive argument "n - 1" is an expression. Arguments must ' +
      'be a single variable name, number or "string": assign the value to ' +
      'a variable on the line before (e.g. k = n - 1) and use @mark<k, ...>.',
    );
  });

  it('explains an unknown directive', () => {
    const problems = validateSource(`a1 = arr[3, 1, 2]
@call<Run, a1> x = 1
`);
    expect(problems[0]).toMatch(/^Line 2: @call is not a directive/);
  });

  it('accepts chained directives and string arguments', () => {
    expect(validateSource(`a1 = arr[3, 1, 2]

fun Run(@init<table> array):
    i = 0
    j = 2
    @mark<i, outline, yellow> @log<info, "a, b > c"> @mark<j, highlight, green> swap(array[i], array[j])
    return array
end fun

result = Run(a1)
`)).toEqual([]);
  });

  it('reports interpreter errors', () => {
    const problems = validateSource(`a1 = arr[3, 1, 2]
m = max(a1)
`);
    expect(problems).toContainEqual(expect.stringContaining('Unknown function \'max\''));
  });

  it('reports a program that never runs anything', () => {
    expect(validateSource(`fun Run(@init<table> array):
    return array
end fun
`)).toContainEqual(expect.stringContaining('top-level call'));
  });

  it('reports arrays that are never visualized', () => {
    expect(validateSource(`a1 = arr[3, 1, 2]
x = a1[0]
`)).toContainEqual(expect.stringContaining('@init<table>'));
  });

  it('accepts a program without arrays', () => {
    expect(validateSource(`fun Gcd(a, b):
    while (b != 0):
        t = b
        b = a % b
        a = t
    end while
    return a
end fun

result = Gcd(48, 18)
`)).toEqual([]);
  });
});
