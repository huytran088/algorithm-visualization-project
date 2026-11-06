import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  WikiDirectives,
  WikiExamples,
} from '../../../app/components/wiki/examples';
import TsInterpreterVisitor from '../../../app/hooks/interpreter/TsInterpreterVisitor';

import {
  finalValue,
  parse,
  trace,
} from '../../hooks/interpreter/helpers';

const examples = Object.entries(WikiExamples);
const allCode = examples.map(([, source]) => source).join('\n');

const docs = readFileSync(
  join(import.meta.dirname, '../../../docs/PSEUDOCODE.md'),
  'utf8',
);

describe('wiki examples', () => {
  it.each(examples)('%s starts with a title comment', (_name, source) => {
    expect(source).toMatch(/^\/\/ .+\n\n/);
  });

  it.each(examples)('%s parses and produces a trace', (_name, source) => {
    expect(trace(source).length).toBeGreaterThan(0);
  });

  it.each(examples)('%s passes the debug visitor', (_name, source) => {
    expect(new TsInterpreterVisitor().visit(parse(source))).toBeTypeOf('string');
  });

  it('do-while example returns the expected value', () => {
    expect(finalValue(WikiExamples.doWhile, 'result')).toBe(3);
  });

  it('do-while example has no end keyword for the loop', () => {
    expect(WikiExamples.doWhile).not.toContain('end do');
    expect(WikiExamples.doWhile).not.toContain('end while');
  });
});

describe('wiki directives', () => {
  it('match the directive table in docs/PSEUDOCODE.md', () => {
    const documented = [...docs.matchAll(/^\| `@([a-z]+)</gm)]
      .map(match => match[1])
      .sort();

    expect(documented.length).toBeGreaterThan(0);
    expect(WikiDirectives.map(d => d.name).sort()).toEqual(documented);
  });

  it.each(WikiDirectives.map(d => d.name))(
    '@%s appears in an example and emits its action',
    (name) => {
      expect(allCode).toContain(`@${name}<`);

      const commands = examples.flatMap(
        ([, source]) => trace(source).flatMap(
          step => step.actions.map(action => action.cmd as string),
        ),
      );

      expect(commands).toContain(`vis_${name}`);
    },
  );
});
