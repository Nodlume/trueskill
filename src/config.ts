import { ppf } from "./gaussian.js";
import type { ResolvedConfig, TrueSkillConfig } from "./types.js";

/** Compute the draw margin epsilon from draw probability and beta. */
export function drawMargin(drawProbability: number, beta: number): number {
  if (drawProbability <= 0) return 0;
  // epsilon = ppf((1 + drawProbability) / 2) * sqrt(2) * beta
  return ppf((1 + drawProbability) / 2) * Math.SQRT2 * beta;
}

/** Resolve optional config into concrete values. */
export function resolveConfig(config: TrueSkillConfig = {}): ResolvedConfig {
  const mu = config.mu ?? 25;
  const sigma = config.sigma ?? mu / 3;
  const beta = config.beta ?? sigma / 2;
  const tau = config.tau ?? sigma / 100;
  const dp = config.drawProbability ?? 0.1;
  const epsilon = drawMargin(dp, beta);
  return { mu, sigma, beta, tau, epsilon };
}
