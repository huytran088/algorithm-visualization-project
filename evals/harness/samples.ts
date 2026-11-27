import fc from 'fast-check';

import type { Shape } from '../tasks';

/**
 * Input arrays for one program: the edge cases the shape allows (empty, one
 * element, all equal, sorted, reversed), then random ones from fast-check.
 * The same seed always gives the same arrays.
 */
export function sampleInputs(
  shape: Shape,
  params: number[],
  { seed = 42, random = 24 }: { seed?: number, random?: number } = {},
) {
  const fit = (a: number[], i: number) => finish(shape, params, a, i);
  const mid = Math.floor((shape.min + shape.max) / 2);
  const edges: number[][] = [];
  if (shape.minLength === 0) edges.push([]);
  if (shape.minLength <= 1) edges.push([mid]);
  const n = Math.max(shape.minLength, Math.min(5, shape.maxLength));
  const ramp = Array.from({ length: n }, (_, i) => shape.min + i * 2)
    .map(v => Math.min(v, shape.max));
  if (!shape.distinct) edges.push(Array.from({ length: n }, () => mid));
  edges.push(ramp);
  if (!shape.sorted) edges.push([...ramp].reverse());

  const arb = fc.array(fc.integer({ min: shape.min, max: shape.max }), {
    minLength: shape.minLength,
    maxLength: shape.maxLength,
  });
  const randoms = fc.sample(arb, { seed, numRuns: random });

  const seen = new Set<string>();
  const out: number[][] = [];
  [...edges, ...randoms].forEach((a, i) => {
    const fitted = fit(a, i);
    const key = fitted.join(',');
    if (seen.has(key)) return;
    seen.add(key);
    out.push(fitted);
  });
  return out;

  function finish(s: Shape, p: number[], a: number[], i = 0) {
    let v = [...a];
    if (s.target) {
      const t = p[0];
      v = v.filter(x => x !== t);
      // Every other array gets the target, at a position that varies
      if (i % 2 === 0) v.splice(v.length === 0 ? 0 : i % (v.length + 1), 0, t);
    }
    if (s.distinct) v = [...new Set(v)];
    if (s.sorted) v.sort((x, y) => x - y);
    return v;
  }
}
