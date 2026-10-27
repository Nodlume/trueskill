/** A Gaussian belief about a player's skill: N(mu, sigma^2). */
export interface Gaussian {
  /** Mean (skill estimate). */
  mu: number;
  /** Standard deviation (uncertainty). */
  sigma: number;
}

/** TrueSkill environment parameters. */
export interface TrueSkillConfig {
  /** Initial mean. Default: 25. */
  mu?: number;
  /** Initial standard deviation. Default: mu/3 ≈ 8.333. */
  sigma?: number;
  /** Performance variation (how much a single game deviates from true skill). Default: sigma/2. */
  beta?: number;
  /** Dynamics factor (additive variance per game to prevent sigma collapse). Default: sigma/100. */
  tau?: number;
  /** Draw probability. Default: 0.1 (10%). Set to 0 for no-draw games. */
  drawProbability?: number;
}

/** Resolved (non-optional) config. */
export interface ResolvedConfig {
  mu: number;
  sigma: number;
  beta: number;
  tau: number;
  epsilon: number;
}

/** A player's rating snapshot. */
export interface Rating extends Gaussian {
  id: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
}

/** Result of updating a single player's rating. */
export interface RatingDelta {
  id: string;
  oldMu: number;
  oldSigma: number;
  newMu: number;
  newSigma: number;
  /** Change in conservative estimate (mu - 3*sigma). */
  deltaConservative: number;
}

/** A team is a list of player IDs. */
export type Team = string[];

/**
 * Match outcome: ranks[i] is the rank (1-based) of teams[i].
 * Lower rank = better. Equal ranks = draw.
 */
export interface MatchResult {
  teams: Team[];
  /** 1-based ranks. ranks[i] is the placement of teams[i]. */
  ranks: number[];
}

/** Result of a full match update. */
export interface MatchUpdateResult {
  deltas: RatingDelta[];
}

/** Entry for a free-for-all match. */
export interface FreeForAllEntry {
  id: string;
  /** Placement rank (1 = first). Equal ranks = draw. */
  rank: number;
}
