import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import TsInterpreterVisitor from '../../../app/hooks/interpreter/TsInterpreterVisitor';

import { finalValue, parse, trace } from './helpers';

const codeDir = join(import.meta.dirname, '../../../public/code');
const samples = readdirSync(codeDir).filter(f => f.endsWith('.avp'));

describe('interpreter', () => {
  it.each(samples)('parses and traces bundled algorithm %s', (file) => {
    const source = readFileSync(join(codeDir, file), 'utf8');

    expect(source).toMatch(/^\/\/ .+\r?\n/);

    const steps = trace(source);
    expect(steps.length).toBeGreaterThan(0);
    for (const step of steps) {
      expect(Array.isArray(step.actions)).toBe(true);
      for (const action of step.actions) {
        if (action.cmd === 'vis_log') {
          expect(action.params.level).not.toBe('error');
        }
      }
    }

    expect(new TsInterpreterVisitor().visit(parse(source))).toBeTypeOf('string');
  });

  it('evaluates arithmetic and assignment operators', () => {
    expect(finalValue('x = 2 + 3 * 4\n', 'x')).toBe(14);
    expect(finalValue('x = 10\nx -= 4\n', 'x')).toBe(6);
    expect(finalValue('x = 10\nx += 4\n', 'x')).toBe(14);
    expect(finalValue('x = 2 ** 3\n', 'x')).toBe(8);
  });

  it('supports break inside loops', () => {
    const src = `total = 0
for (i = 0; i < 10; i += 1):
    if (i == 3):
        break
    end if
    total += 1
end for
`;
    expect(finalValue(src, 'total')).toBe(3);
  });

  it('supports continue inside for loops', () => {
    const src = `total = 0
for (i = 0; i < 5; i += 1):
    if (i == 2):
        continue
    end if
    total += 1
end for
`;
    expect(finalValue(src, 'total')).toBe(4);
  });

  it('supports continue inside while loops', () => {
    const src = `i = 0
total = 0
while (i < 5):
    i += 1
    if (i % 2 == 0):
        continue
    end if
    total += i
end while
`;
    expect(finalValue(src, 'total')).toBe(9);
  });

  it('supports continue inside for-each loops', () => {
    const src = `a = arr[1, 2, 3, 4]
total = 0
for n in a:
    if (n == 2):
        continue
    end if
    total += n
end for
`;
    expect(finalValue(src, 'total')).toBe(8);
  });

  it('emits continue in the generated JavaScript', () => {
    const src = `for (i = 0; i < 5; i += 1):
    continue
end for
`;
    expect(new TsInterpreterVisitor().visit(parse(src))).toContain('continue;');
  });
});
