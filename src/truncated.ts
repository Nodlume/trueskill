import { pdf, cdf } from "./gaussian.js";

/**
 * V function for win outcome (truncated Gaussian correction for mean).
 * v(t, epsilon) = pdf(t - epsilon) / cdf(t - epsilon)
 */
export function vWin(t: number, epsilon: number): number {
  const diff = t - epsilon;
  const denom = cdf(diff);
  if (denom < 1e-100) return -diff; // numerical safety
  return pdf(diff) / denom;
}

/**
 * W function for win outcome (truncated Gaussian correction for variance).
 * w(t, epsilon) = v * (v + t - epsilon)
 */
export function wWin(t: number, epsilon: number): number {
  const diff = t - epsilon;
  const denom = cdf(diff);
  if (denom < 1e-100) return 1; // numerical safety
  const v = pdf(diff) / denom;
  return v * (v + diff);
}

/**
 * V function for draw outcome.
 * v_draw(t, epsilon) = (pdf(-epsilon - t) - pdf(epsilon - t)) / (cdf(epsilon - t) - cdf(-epsilon - t))
 */
export function vDraw(t: number, epsilon: number): number {
  const diffUpper = epsilon - t;
  const diffLower = -epsilon - t;
  const denom = cdf(diffUpper) - cdf(diffLower);
  if (Math.abs(denom) < 1e-100) return 0;
  return (pdf(diffLower) - pdf(diffUpper)) / denom;
}

/**
 * W function for draw outcome.
 */
export function wDraw(t: number, epsilon: number): number {
  const diffUpper = epsilon - t;
  const diffLower = -epsilon - t;
  const denom = cdf(diffUpper) - cdf(diffLower);
  if (Math.abs(denom) < 1e-100) return 1;
  const numer =
    diffUpper * pdf(diffUpper) - diffLower * pdf(diffLower);
  // w_draw = (upperDiff*pdf(upper) - lowerDiff*pdf(lower)) / denom + v_draw^2
  const v = (pdf(diffLower) - pdf(diffUpper)) / denom;
  return numer / denom + v * v;
}
