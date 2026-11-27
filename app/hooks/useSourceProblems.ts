import {
  useEffect,
  useState,
} from 'react';

import {
  checkSource,
  type SourceProblem,
} from './interpreter/validate';

/** Delay after the last edit before the code is checked again. */
export const CheckDelayMs = 300;

/** A Monaco editor marker, with the severity as a name. */
export type ProblemMarker = {
  startLineNumber: number
  startColumn: number
  endLineNumber: number
  endColumn: number
  message: string
  severity: 'error' | 'warning'
};

/**
 * Converts problems to Monaco markers. A problem with a column marks that
 * character; one without marks its whole line (Monaco clamps the end column).
 * Hints are warnings; syntax and runtime problems are errors.
 */
export function problemMarkers(problems: SourceProblem[]): ProblemMarker[] {
  return problems.map((p) => {
    const line = p.line ?? 1;
    const hasColumn = p.column !== undefined;
    return {
      startLineNumber: line,
      startColumn: hasColumn ? p.column! + 1 : 1,
      endLineNumber: line,
      endColumn: hasColumn ? p.column! + 2 : Number.MAX_SAFE_INTEGER,
      message: p.message,
      severity: p.kind === 'hint' ? 'warning' : 'error',
    };
  });
}

/**
 * Provides a hook that checks pseudocode with the visualizer's own grammar
 * and interpreter, CheckDelayMs after it last changed.
 *
 * @param source The code to check (e.g. the editor buffer)
 */
export default function useSourceProblems(source: string) {
  const [problems, setProblems] = useState([] as SourceProblem[]);

  useEffect(() => {
    const timer = setTimeout(
      () => setProblems(checkSource(source)),
      CheckDelayMs,
    );
    return () => clearTimeout(timer);
  }, [source]);

  return problems;
}
