/**
 * Public entry point for the TrueSkill package. Re-exports the Gaussian
 * helpers (pdf/cdf/ppf), the truncated-Gaussian v/w update functions for
 * wins and draws, config resolution, the core 1v1 and team rating
 * functions, the `RatingPool` class, and the shared types. Docs for each
 * export live with its declaration in the source module.
 */
export { pdf, cdf, ppf } from "./gaussian.js";
export { vWin, wWin, vDraw, wDraw } from "./truncated.js";
export { drawMargin, resolveConfig } from "./config.js";
export {
  conservativeRating,
  addDynamics,
  rate1v1,
  matchQuality1v1,
  teamGaussian,
  distributeTeamDelta,
} from "./core.js";
export { RatingPool } from "./pool.js";
export type {
  Gaussian,
  TrueSkillConfig,
  ResolvedConfig,
  Rating,
  RatingDelta,
  Team,
  MatchResult,
  MatchUpdateResult,
  FreeForAllEntry,
} from "./types.js";
