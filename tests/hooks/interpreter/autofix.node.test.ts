import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import autoFixDirectives from '../../../app/hooks/interpreter/autofix';
import validateSource from '../../../app/hooks/interpreter/validate';

const codeDir = join(import.meta.dirname, '../../../public/code');
const samples = readdirSync(codeDir).filter(f => f.endsWith('.avp'));

describe('autoFixDirectives', () => {
  it.each(samples)('leaves bundled algorithm %s unchanged', (file) => {
    const source = readFileSync(join(codeDir, file), 'utf8');
    expect(autoFixDirectives(source)).toBe(source);
  });

  it('moves a directive on its own line onto the next statement', () => {
    // From a real AI Tutor generation (two-pointer two sum)
    const src = `    while (left < right):
        @mark<left, outline, yellow> @mark<right, outline, yellow>

        current_sum = array[left] + array[right]
`;
    expect(autoFixDirectives(src)).toBe(`    while (left < right):

        @mark<left, outline, yellow> @mark<right, outline, yellow> current_sum = array[left] + array[right]
`);
  });

  it('computes an expression argument into a variable first', () => {
    // From a real AI Tutor generation (reverse an array)
    const src = `    for (i = 0; i < floor(n / 2); i += 1):
        @mark<i, outline, yellow> @mark<n - i - 1, outline, yellow> swap(array[i], array[n - i - 1])
    end for
`;
    expect(autoFixDirectives(src)).toBe(`    for (i = 0; i < floor(n / 2); i += 1):
        mark1 = n - i - 1
        @mark<i, outline, yellow> @mark<mark1, outline, yellow> swap(array[i], array[n - i - 1])
    end for
`);
  });

  it('applies both fixes together', () => {
    const src = `x = 1
@mark<x + 1, highlight, green>
y = 2
`;
    expect(autoFixDirectives(src)).toBe(`x = 1
mark1 = x + 1
@mark<mark1, highlight, green> y = 2
`);
  });

  it('assigns a returned array literal to a variable first', () => {
    // From a real AI Tutor generation (two-pointer two sum)
    const src = `        if (current_sum == target):
            @log<info, "Found pair at indices"> return arr[left, right]
        end if
`;
    expect(autoFixDirectives(src)).toBe(`        if (current_sum == target):
            array1 = arr[left, right]
            @log<info, "Found pair at indices"> return array1
        end if
`);
  });

  it('assigns an array literal argument to a variable first', () => {
    const src = 'result = Sort(arr[3, 1, 2], 0, size(arr(2)))\n';
    expect(autoFixDirectives(src)).toBe(
      'array1 = arr[3, 1, 2]\narray2 = arr(2)\nresult = Sort(array1, 0, size(array2))\n',
    );
  });

  it('leaves array literals that are assigned directly', () => {
    const src = 'a1 = arr[3, 1, 2]\ncounts = arr(5, 0)\nr = arr[1 to 10]\n';
    expect(autoFixDirectives(src)).toBe(src);
  });

  it('picks a variable name that is not already used', () => {
    const src = `mark1 = 5
@mark<mark1 + 1, outline, yellow> y = 2
`;
    expect(autoFixDirectives(src)).toContain('mark2 = mark1 + 1\n@mark<mark2,');
  });

  it('does not hoist an argument out of a loop condition', () => {
    // Hoisting would compute it once instead of on every iteration
    const src = `@mark<i + 1, text, fg> while (i < n):
    i += 1
end while
`;
    expect(autoFixDirectives(src)).toBe(src);
  });

  it('does not move a directive in front of else or end', () => {
    const src = `if (x):
    y = 1
    @mark<y, outline, yellow>
else:
    y = 2
end if
`;
    expect(autoFixDirectives(src)).toBe(src);
  });

  it('turns real failing generations into valid programs', () => {
    const src = `a1 = arr[1, 2, 3, 4]

fun Reverse(@init<table> array):
    n = length(array)
    for (i = 0; i < floor(n / 2); i += 1):
        @mark<i, outline, yellow> @mark<n - i - 1, outline, yellow>
        swap(array[i], array[n - i - 1])
    end for
    return array
end fun

result = Reverse(a1)
`;
    expect(validateSource(src).length).toBeGreaterThan(0);
    expect(validateSource(autoFixDirectives(src))).toEqual([]);
  });
});
