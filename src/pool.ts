/**
 * Stateful wrapper over the core TrueSkill math: keeps a map of player
 * ratings and win/loss/draw counters, and turns 1v1, team, and free-for-all
 * results into in-place rating updates plus per-player deltas.
 */
import { resolveConfig } from "./config.js";
import {
  conservativeRating,
  rate1v1,
  matchQuality1v1,
  teamGaussian,
  distributeTeamDelta,
} from "./core.js";
import type {
  FreeForAllEntry,
  Gaussian,
  MatchUpdateResult,
  Rating,
  RatingDelta,
  ResolvedConfig,
  Team,
  TrueSkillConfig,
} from "./types.js";

/**
 * Managed TrueSkill rating pool. Tracks players, processes matches,
 * supports teams and free-for-all.
 */
export class RatingPool {
  private players = new Map<string, Rating>();
  readonly config: ResolvedConfig;
  private initialMu: number;
  private initialSigma: number;

  constructor(config: TrueSkillConfig = {}) {
    this.config = resolveConfig(config);
    this.initialMu = this.config.mu;
    this.initialSigma = this.config.sigma;
  }

  /**
   * Register a player with optional initial mu/sigma (defaulting to the
   * resolved config). An already-registered id is returned unchanged; the
   * supplied mu/sigma are ignored rather than overwriting its rating.
   */
  addPlayer(id: string, mu?: number, sigma?: number): Rating {
    if (this.players.has(id)) return this.players.get(id)!;
    const r: Rating = {
      id,
      mu: mu ?? this.initialMu,
      sigma: sigma ?? this.initialSigma,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
    };
    this.players.set(id, r);
    return r;
  }

  /** Get a player, auto-registering if needed. */
  getPlayer(id: string): Rating {
    if (!this.players.has(id)) this.addPlayer(id);
    return this.players.get(id)!;
  }

  /** Conservative rating (mu - 3*sigma) for display purposes. */
  getConservativeRating(id: string): number {
    return conservativeRating(this.getPlayer(id));
  }

  /** Leaderboard sorted by conservative rating descending. */
  leaderboard(): (Rating & { conservative: number })[] {
    return [...this.players.values()]
      .map((r) => ({ ...r, conservative: conservativeRating(r) }))
      .sort((a, b) => b.conservative - a.conservative);
  }

  /** Match quality between two players (0-1, higher = more balanced). */
  matchQuality(playerA: string, playerB: string): number {
    return matchQuality1v1(
      this.getPlayer(playerA),
      this.getPlayer(playerB),
      this.config.beta,
    );
  }

  /**
   * Match quality between two teams, comparing their combined team Gaussians.
   * Beta is scaled by sqrt(total players / 2) to match recordTeamMatch.
   * Unknown ids are auto-registered.
   */
  teamMatchQuality(teamA: Team, teamB: Team): number {
    const gA = teamGaussian(teamA.map((id) => this.getPlayer(id)));
    const gB = teamGaussian(teamB.map((id) => this.getPlayer(id)));
    return matchQuality1v1(gA, gB, this.config.beta * Math.sqrt(teamA.length + teamB.length) / Math.SQRT2);
  }

  /**
   * Record a 1v1 match.
   * @param winner - Winner's ID (or either player if draw)
   * @param loser  - Loser's ID (or the other player if draw)
   * @param isDraw - Whether the match was a draw
   */
  record1v1(winner: string, loser: string, isDraw: boolean = false): MatchUpdateResult {
    const w = this.getPlayer(winner);
    const l = this.getPlayer(loser);

    const oldW = { mu: w.mu, sigma: w.sigma };
    const oldL = { mu: l.mu, sigma: l.sigma };

    const [newW, newL] = rate1v1(w, l, isDraw, this.config);

    w.mu = newW.mu;
    w.sigma = newW.sigma;
    l.mu = newL.mu;
    l.sigma = newL.sigma;

    w.gamesPlayed++;
    l.gamesPlayed++;

    if (isDraw) {
      w.draws++;
      l.draws++;
    } else {
      w.wins++;
      l.losses++;
    }

    return {
      deltas: [
        makeDelta(winner, oldW, newW),
        makeDelta(loser, oldL, newL),
      ],
    };
  }

  /**
   * Record a team match: winningTeam beat losingTeam, or the two drew when
   * isDraw is set. Each team is rated as one combined Gaussian, then the
   * team-level change is distributed back to its members.
   */
  recordTeamMatch(
    winningTeam: Team,
    losingTeam: Team,
    isDraw: boolean = false,
  ): MatchUpdateResult {
    const wPlayers = winningTeam.map((id) => this.getPlayer(id));
    const lPlayers = losingTeam.map((id) => this.getPlayer(id));

    const oldWGaussians = wPlayers.map((p) => ({ mu: p.mu, sigma: p.sigma }));
    const oldLGaussians = lPlayers.map((p) => ({ mu: p.mu, sigma: p.sigma }));

    const wTeam = teamGaussian(wPlayers);
    const lTeam = teamGaussian(lPlayers);

    // Scale beta by sqrt of total players
    const scaledConfig = {
      ...this.config,
      beta: this.config.beta * Math.sqrt(winningTeam.length + losingTeam.length) / Math.SQRT2,
    };

    const [newWTeam, newLTeam] = rate1v1(wTeam, lTeam, isDraw, scaledConfig);

    const newWPlayers = distributeTeamDelta(wPlayers, wTeam, newWTeam, this.config.tau);
    const newLPlayers = distributeTeamDelta(lPlayers, lTeam, newLTeam, this.config.tau);

    const deltas: RatingDelta[] = [];

    for (let i = 0; i < wPlayers.length; i++) {
      const p = wPlayers[i];
      const old = oldWGaussians[i];
      p.mu = newWPlayers[i].mu;
      p.sigma = newWPlayers[i].sigma;
      p.gamesPlayed++;
      if (isDraw) p.draws++;
      else p.wins++;
      deltas.push(makeDelta(p.id, old, newWPlayers[i]));
    }

    for (let i = 0; i < lPlayers.length; i++) {
      const p = lPlayers[i];
      const old = oldLGaussians[i];
      p.mu = newLPlayers[i].mu;
      p.sigma = newLPlayers[i].sigma;
      p.gamesPlayed++;
      if (isDraw) p.draws++;
      else p.losses++;
      deltas.push(makeDelta(p.id, old, newLPlayers[i]));
    }

    return { deltas };
  }

  /**
   * Record a free-for-all / multi-player result.
   * Each adjacent pair of ranks is compared (1st vs 2nd, 2nd vs 3rd, etc.).
   * Equal ranks are treated as draws. Pairs are applied sequentially via
   * record1v1, so middle-ranked players are updated twice and appear twice
   * in the returned deltas.
   */
  recordFreeForAll(entries: FreeForAllEntry[]): MatchUpdateResult {
    // Sort by rank ascending
    const sorted = [...entries].sort((a, b) => a.rank - b.rank);
    const allDeltas: RatingDelta[] = [];

    for (let i = 0; i < sorted.length - 1; i++) {
      const higher = sorted[i];
      const lower = sorted[i + 1];
      const isDraw = higher.rank === lower.rank;
      const result = this.record1v1(higher.id, lower.id, isDraw);
      allDeltas.push(...result.deltas);
    }

    return { deltas: allDeltas };
  }

  /** Number of registered players. */
  get size(): number {
    return this.players.size;
  }

  /** Whether the id is registered; unlike getPlayer, never auto-registers. */
  has(id: string): boolean {
    return this.players.has(id);
  }

  /** Drop a player's rating; returns false if the id was not registered. */
  removePlayer(id: string): boolean {
    return this.players.delete(id);
  }

  /** Remove every player; the resolved config is kept. */
  reset(): void {
    this.players.clear();
  }
}

function makeDelta(id: string, old: Gaussian, updated: Gaussian): RatingDelta {
  return {
    id,
    oldMu: old.mu,
    oldSigma: old.sigma,
    newMu: updated.mu,
    newSigma: updated.sigma,
    deltaConservative:
      conservativeRating(updated) - conservativeRating(old),
  };
}
