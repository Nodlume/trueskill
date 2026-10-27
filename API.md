# @quokkaquery/trueskill — API Reference

Distilled API surface for agent prompts and quick reference.

Zero-dependency TrueSkill (Microsoft Bayesian rating) implementation. Models player skill as Gaussian distributions, updates beliefs after match outcomes. Supports 1v1, teams, and free-for-all.

## Types

```ts
interface Gaussian { mu: number; sigma: number; }

interface TrueSkillConfig {
  mu?: number;              // default 25
  sigma?: number;           // default mu/3 (≈8.333)
  beta?: number;            // default sigma/2 — performance variation
  tau?: number;             // default sigma/100 — dynamics factor (prevents sigma collapse)
  drawProbability?: number; // default 0.1 — set 0 for no-draw games
}

interface ResolvedConfig {
  mu: number; sigma: number; beta: number; tau: number;
  epsilon: number; // draw margin, derived from drawProbability + beta
}

interface Rating extends Gaussian {
  id: string;
  gamesPlayed: number;
  wins: number; losses: number; draws: number;
}

interface RatingDelta {
  id: string;
  oldMu: number; oldSigma: number;
  newMu: number; newSigma: number;
  deltaConservative: number; // change in mu - 3*sigma
}

type Team = string[];

interface MatchResult {
  teams: Team[];
  ranks: number[]; // 1-based, lower = better, equal = draw
}

interface MatchUpdateResult { deltas: RatingDelta[]; }

interface FreeForAllEntry { id: string; rank: number; } // 1 = first place
```

## RatingPool (managed player tracking)

```ts
class RatingPool {
  readonly config: ResolvedConfig;

  constructor(config?: TrueSkillConfig);

  addPlayer(id: string, mu?: number, sigma?: number): Rating;
  // Idempotent — returns existing Rating if id already registered (ignores mu/sigma args).

  getPlayer(id: string): Rating;
  // Auto-registers with default mu/sigma if id is unknown.

  getConservativeRating(id: string): number;
  // Returns mu - 3*sigma.

  leaderboard(): (Rating & { conservative: number })[];
  // All players sorted by conservative rating descending.

  matchQuality(playerA: string, playerB: string): number;
  // Draw probability estimate, 0–1. Higher = more balanced.

  teamMatchQuality(teamA: Team, teamB: Team): number;
  // Beta scaled by sqrt(totalPlayers) / sqrt(2).

  record1v1(winner: string, loser: string, isDraw?: boolean): MatchUpdateResult;
  // Mutates stored Ratings in place. isDraw defaults to false.

  recordTeamMatch(winningTeam: Team, losingTeam: Team, isDraw?: boolean): MatchUpdateResult;
  // Distributes team-level delta to individuals proportional to sigma^2.

  recordFreeForAll(entries: FreeForAllEntry[]): MatchUpdateResult;
  // Decomposes into adjacent rank pairs (1v2, 2v3, ...). Equal ranks = draw.

  get size(): number;
  has(id: string): boolean;
  removePlayer(id: string): boolean;
  reset(): void;
}
```

## Standalone Functions

```ts
function resolveConfig(config?: TrueSkillConfig): ResolvedConfig;
// Fills defaults, computes epsilon from drawProbability + beta.

function conservativeRating(g: Gaussian, factor?: number): number;
// mu - factor*sigma. Default factor = 3.

function rate1v1(winner: Gaussian, loser: Gaussian, isDraw: boolean, config: ResolvedConfig): [Gaussian, Gaussian];
// Pure — returns new Gaussians without mutation.

function matchQuality1v1(a: Gaussian, b: Gaussian, beta: number): number;
// Draw probability between two players. Range [0, 1].

function teamGaussian(players: Gaussian[]): Gaussian;
// Composite: mu = sum(mus), sigma = sqrt(sum(sigma^2s)).

function distributeTeamDelta(players: Gaussian[], oldTeam: Gaussian, newTeam: Gaussian, tau: number): Gaussian[];
// Splits team-level update to individuals proportional to sigma^2.

function addDynamics(sigma: number, tau: number): number;
// sqrt(sigma^2 + tau^2). Applied before each match to prevent sigma collapse.

function drawMargin(drawProbability: number, beta: number): number;
// Computes epsilon: ppf((1 + drawProbability) / 2) * sqrt(2) * beta. Returns 0 if drawProbability <= 0.
```

## Gaussian Math (low-level)

```ts
function pdf(x: number): number;   // Standard normal PDF
function cdf(x: number): number;   // Standard normal CDF (~1.5e-7 accuracy)
function ppf(p: number): number;   // Inverse CDF / quantile function (~4.5e-4 accuracy)

function vWin(t: number, epsilon: number): number;  // Truncated Gaussian mean correction (win)
function wWin(t: number, epsilon: number): number;  // Truncated Gaussian variance correction (win)
function vDraw(t: number, epsilon: number): number; // Truncated Gaussian mean correction (draw)
function wDraw(t: number, epsilon: number): number; // Truncated Gaussian variance correction (draw)
```

## Key Behaviors

- **Auto-registration**: `getPlayer()` and all `record*` methods auto-register unknown IDs with default mu/sigma. No error on typos.
- **`addPlayer` is idempotent**: Returns existing Rating if ID exists, ignoring mu/sigma args.
- **`rate1v1` is pure** (returns new Gaussians); `RatingPool.record1v1` mutates stored Ratings.
- **Free-for-all decomposition**: Adjacent rank pairs are compared. Middle-ranked players get updated twice per call.
- **Team beta scaling**: Team matches and team match quality scale beta by `sqrt(totalPlayers) / sqrt(2)`.
- **Winner/loser order matters in `record1v1`**: First arg is the winner. For draws, order has minimal effect for equal-skill players but is not fully symmetric.
