/**
 * The unbiased pass@k estimator (Chen et al., 2021): the chance that at least
 * one of k samples drawn from n, c of which pass, passes.
 */
export function passAtK(n: number, c: number, k: number) {
  if (n - c < k) return 1;
  let fail = 1;
  for (let i = n - c + 1; i <= n; i++) fail *= 1 - k / i;
  return 1 - fail;
}

/** A small seeded PRNG (mulberry32), so bootstrap intervals are reproducible. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

/**
 * The mean of per-task scores with a 95% percentile bootstrap interval,
 * resampling tasks (the unit that varies most).
 */
export function bootstrapMean(xs: number[], { resamples = 2000, seed = 1 } = {}) {
  const random = rng(seed);
  const means: number[] = [];
  for (let r = 0; r < resamples; r++) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += xs[Math.floor(random() * xs.length)];
    means.push(s / (xs.length || 1));
  }
  means.sort((a, b) => a - b);
  return {
    mean: mean(xs),
    low: means[Math.floor(0.025 * resamples)] ?? 0,
    high: means[Math.ceil(0.975 * resamples) - 1] ?? 0,
  };
}

export function percentile(xs: number[], p: number) {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}
