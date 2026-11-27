import { describe, expect, it } from 'vitest';

import { problemMarkers } from '../../app/hooks/useSourceProblems';

describe('problemMarkers', () => {
  it('marks the character a syntax error points at', () => {
    expect(problemMarkers([
      { kind: 'syntax', line: 4, column: 41, message: 'extraneous input \'@\'' },
    ])).toEqual([{
      startLineNumber: 4,
      startColumn: 42,
      endLineNumber: 4,
      endColumn: 43,
      message: 'extraneous input \'@\'',
      severity: 'error',
    }]);
  });

  it('marks the whole line when there is no column', () => {
    const [marker] = problemMarkers([
      { kind: 'runtime', line: 2, column: undefined, message: 'm' },
    ]);
    expect(marker).toMatchObject({
      startLineNumber: 2,
      startColumn: 1,
      endLineNumber: 2,
      severity: 'error',
    });
    expect(marker.endColumn).toBeGreaterThan(1000);
  });

  it('shows hints as warnings', () => {
    expect(problemMarkers([
      { kind: 'hint', line: undefined, column: undefined, message: 'h' },
    ])[0]).toMatchObject({ startLineNumber: 1, severity: 'warning' });
  });
});
