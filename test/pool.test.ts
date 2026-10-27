import { describe, it, expect } from "vitest";
import { RatingPool } from "../src/pool.js";

describe("RatingPool", () => {
  it("auto-registers players", () => {
    const pool = new RatingPool();
    pool.record1v1("alice", "bob");
    expect(pool.size).toBe(2);
    expect(pool.has("alice")).toBe(true);
  });

  it("uses default mu=25 and sigma=25/3", () => {
    const pool = new RatingPool();
    const p = pool.getPlayer("x");
    expect(p.mu).toBe(25);
    expect(p.sigma).toBeCloseTo(25 / 3, 2);
  });

  it("accepts custom config", () => {
    const pool = new RatingPool({ mu: 1500, sigma: 500 });
    const p = pool.getPlayer("x");
    expect(p.mu).toBe(1500);
    expect(p.sigma).toBe(500);
  });

  it("winner gains mu, loser loses mu", () => {
    const pool = new RatingPool();
    const result = pool.record1v1("winner", "loser");
    expect(result.deltas[0].newMu).toBeGreaterThan(25);
    expect(result.deltas[1].newMu).toBeLessThan(25);
  });

  it("tracks wins/losses/draws", () => {
    const pool = new RatingPool();
    pool.record1v1("a", "b", false);
    pool.record1v1("b", "a", false);
    pool.record1v1("a", "b", true);

    const a = pool.getPlayer("a");
    expect(a.wins).toBe(1);
    expect(a.losses).toBe(1);
    expect(a.draws).toBe(1);
    expect(a.gamesPlayed).toBe(3);
  });

  it("reduces sigma over games (increasing certainty)", () => {
    const pool = new RatingPool();
    const initialSigma = pool.getPlayer("a").sigma;
    for (let i = 0; i < 10; i++) {
      pool.record1v1("a", "b");
    }
    expect(pool.getPlayer("a").sigma).toBeLessThan(initialSigma);
  });

  it("leaderboard sorts by conservative rating", () => {
    const pool = new RatingPool();
    pool.addPlayer("low", 15, 8);
    pool.addPlayer("mid", 25, 8);
    pool.addPlayer("high", 35, 8);
    const board = pool.leaderboard();
    expect(board[0].id).toBe("high");
    expect(board[2].id).toBe("low");
    // Each entry has conservative field
    expect(board[0].conservative).toBeCloseTo(35 - 24, 0);
  });

  it("matchQuality is high for equal players", () => {
    const pool = new RatingPool();
    pool.addPlayer("a");
    pool.addPlayer("b");
    expect(pool.matchQuality("a", "b")).toBeGreaterThan(0.3);
  });

  it("matchQuality is low for mismatched players", () => {
    const pool = new RatingPool();
    pool.addPlayer("strong", 40, 2);
    pool.addPlayer("weak", 10, 2);
    expect(pool.matchQuality("strong", "weak")).toBeLessThan(0.05);
  });

  it("getConservativeRating returns mu - 3*sigma", () => {
    const pool = new RatingPool();
    const p = pool.getPlayer("x");
    expect(pool.getConservativeRating("x")).toBeCloseTo(p.mu - 3 * p.sigma, 5);
  });

  it("addPlayer is idempotent", () => {
    const pool = new RatingPool();
    pool.addPlayer("x", 30);
    pool.addPlayer("x", 40);
    expect(pool.getPlayer("x").mu).toBe(30);
  });

  it("removePlayer works", () => {
    const pool = new RatingPool();
    pool.addPlayer("x");
    expect(pool.removePlayer("x")).toBe(true);
    expect(pool.has("x")).toBe(false);
  });

  it("reset clears everything", () => {
    const pool = new RatingPool();
    pool.record1v1("a", "b");
    pool.reset();
    expect(pool.size).toBe(0);
  });
});

describe("RatingPool team matches", () => {
  it("winning team gains, losing team loses", () => {
    const pool = new RatingPool();
    const result = pool.recordTeamMatch(["a", "b"], ["c", "d"]);
    expect(result.deltas).toHaveLength(4);
    // Winners
    expect(pool.getPlayer("a").mu).toBeGreaterThan(25);
    expect(pool.getPlayer("b").mu).toBeGreaterThan(25);
    // Losers
    expect(pool.getPlayer("c").mu).toBeLessThan(25);
    expect(pool.getPlayer("d").mu).toBeLessThan(25);
  });

  it("team draw keeps mus close for equal players", () => {
    const pool = new RatingPool();
    pool.recordTeamMatch(["a", "b"], ["c", "d"], true);
    expect(pool.getPlayer("a").mu).toBeCloseTo(25, 0);
    expect(pool.getPlayer("c").mu).toBeCloseTo(25, 0);
  });

  it("tracks wins/losses for team members", () => {
    const pool = new RatingPool();
    pool.recordTeamMatch(["a", "b"], ["c", "d"]);
    expect(pool.getPlayer("a").wins).toBe(1);
    expect(pool.getPlayer("c").losses).toBe(1);
  });

  it("teamMatchQuality works", () => {
    const pool = new RatingPool();
    pool.addPlayer("a");
    pool.addPlayer("b");
    pool.addPlayer("c");
    pool.addPlayer("d");
    const q = pool.teamMatchQuality(["a", "b"], ["c", "d"]);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThanOrEqual(1);
  });
});

describe("RatingPool free-for-all", () => {
  it("processes ranked entries", () => {
    const pool = new RatingPool();
    const result = pool.recordFreeForAll([
      { id: "first", rank: 1 },
      { id: "second", rank: 2 },
      { id: "third", rank: 3 },
    ]);
    // Adjacent pairs: first>second, second>third
    expect(result.deltas.length).toBeGreaterThan(0);
    const board = pool.leaderboard();
    expect(board[0].id).toBe("first");
    expect(board[2].id).toBe("third");
  });

  it("handles ties (equal ranks)", () => {
    const pool = new RatingPool();
    pool.recordFreeForAll([
      { id: "a", rank: 1 },
      { id: "b", rank: 1 },
    ]);
    // Tied → draw → mus should stay close
    expect(pool.getPlayer("a").mu).toBeCloseTo(pool.getPlayer("b").mu, 0);
    expect(pool.getPlayer("a").draws).toBe(1);
  });
});
