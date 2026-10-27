import type { Gaussian, ResolvedConfig } from "./types.js";
import { vWin, wWin, vDraw, wDraw } from "./truncated.js";

/**
 * Conservative skill estimate: mu - 3*sigma.
 * This is the "display rating" in TrueSkill (e.g., Xbox Live uses this).
 */
export function conservativeRating(g: Gaussian, factor: number = 3): number {
  return g.mu - factor * g.sigma;
}

/**
 * Apply dynamics factor (tau) to a player's sigma before a match.
 * Prevents sigma from collapsing to zero over many games.
 */
export function addDynamics(sigma: number, tau: number): number {
  return Math.sqrt(sigma * sigma + tau * tau);
}

/**
 * Update two players (or team composites) after a 1v1 outcome.
 *
 * @param winner - Gaussian belief of the winning side
 * @param loser  - Gaussian belief of the losing side
 * @param isDraw - Whether the match was a draw
 * @param config - Resolved TrueSkill config
 * @returns [updatedWinner, updatedLoser]
 */
export function rate1v1(
  winner: Gaussian,
  loser: Gaussian,
  isDraw: boolean,
  config: ResolvedConfig,
): [Gaussian, Gaussian] {
  // Apply dynamics
  const sigmaW = addDynamics(winner.sigma, config.tau);
  const sigmaL = addDynamics(loser.sigma, config.tau);

  // Total variance: 2*beta^2 + sigmaW^2 + sigmaL^2
  const c = Math.sqrt(2 * config.beta * config.beta + sigmaW * sigmaW + sigmaL * sigmaL);
  const t = (winner.mu - loser.mu) / c;
  const eps = config.epsilon / c;

  let v: number, w: number;
  if (isDraw) {
    v = vDraw(t, eps);
    w = wDraw(t, eps);
  } else {
    v = vWin(t, eps);
    w = wWin(t, eps);
  }

  // Clamp w to prevent sigma going imaginary
  const wClamped = Math.min(w, 1 - 1e-10);

  const muW = winner.mu + (sigmaW * sigmaW / c) * v;
  const muL = loser.mu - (sigmaL * sigmaL / c) * v;
  const newSigmaW = sigmaW * Math.sqrt(1 - (sigmaW * sigmaW / (c * c)) * wClamped);
  const newSigmaL = sigmaL * Math.sqrt(1 - (sigmaL * sigmaL / (c * c)) * wClamped);

  return [
    { mu: muW, sigma: newSigmaW },
    { mu: muL, sigma: newSigmaL },
  ];
}

/**
 * Compute match quality for a 1v1 — the probability of a draw.
 * Higher quality = more balanced match. Range [0, 1].
 */
export function matchQuality1v1(a: Gaussian, b: Gaussian, beta: number): number {
  const totalSigmaSq = a.sigma * a.sigma + b.sigma * b.sigma + 2 * beta * beta;
  const muDiff = a.mu - b.mu;
  return Math.sqrt(2 * beta * beta / totalSigmaSq) *
    Math.exp(-0.5 * muDiff * muDiff / totalSigmaSq);
}

/**
 * Combine a team of Gaussians into a single composite Gaussian.
 * Team mu = sum of individual mus, team sigma^2 = sum of individual sigma^2s.
 */
export function teamGaussian(players: Gaussian[]): Gaussian {
  let mu = 0;
  let sigmaSq = 0;
  for (const p of players) {
    mu += p.mu;
    sigmaSq += p.sigma * p.sigma;
  }
  return { mu, sigma: Math.sqrt(sigmaSq) };
}

/**
 * Distribute a team-level delta back to individual players proportional
 * to their uncertainty (sigma^2).
 */
export function distributeTeamDelta(
  players: Gaussian[],
  oldTeam: Gaussian,
  newTeam: Gaussian,
  tau: number,
): Gaussian[] {
  const teamSigmaSq = oldTeam.sigma * oldTeam.sigma;
  const muDelta = newTeam.mu - oldTeam.mu;
  // Ratio of new team sigma to old team sigma
  const sigmaRatio = teamSigmaSq > 0 ? newTeam.sigma / oldTeam.sigma : 1;

  return players.map((p) => {
    const dynSigma = addDynamics(p.sigma, tau);
    const weight = teamSigmaSq > 0 ? (dynSigma * dynSigma) / teamSigmaSq : 1 / players.length;
    return {
      mu: p.mu + weight * muDelta,
      sigma: dynSigma * sigmaRatio,
    };
  });
}
