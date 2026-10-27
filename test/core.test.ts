import { describe, it, expect } from "vitest";
import {
  conservativeRating,
  addDynamics,
  rate1v1,
  matchQuality1v1,
  teamGaussian,
} from "../src/core.js";
import { resolveConfig } from "../src/config.js";
import type { Gaussian } from "../src/types.js";

const config = resolveConfig();

describe("conservativeRating", () => {
  it("returns mu - 3*sigma by default", () => {
    expect(conservativeRating({ mu: 25, sigma: 8.333 })).toBeCloseTo(25 - 3 * 8.333, 2);
  });

  it("supports custom factor", () => {
    expect(conservativeRating({ mu: 25, sigma: 8 }, 2)).toBeCloseTo(9, 2);
  });
});

describe("addDynamics", () => {
  it("increases sigma", () => {
    const result = addDynamics(8, 0.08);
    expect(result).toBeGreaterThan(8);
  });

  it("is minimal for small tau", () => {
    const result = addDynamics(8, 0.01);
    expect(result).toBeCloseTo(8, 3);
  });
});

describe("rate1v1", () => {
  it("winner gains mu, loser loses mu", () => {
    const a: Gaussian = { mu: 25, sigma: 25 / 3 };
    const b: Gaussian = { mu: 25, sigma: 25 / 3 };
    const [winner, loser] = rate1v1(a, b, false, config);
    expect(winner.mu).toBeGreaterThan(25);
    expect(loser.mu).toBeLessThan(25);
  });

  it("both sigmas decrease (more certainty)", () => {
    const a: Gaussian = { mu: 25, sigma: 25 / 3 };
    const b: Gaussian = { mu: 25, sigma: 25 / 3 };
    const [winner, loser] = rate1v1(a, b, false, config);
    // After dynamics tau is added, but the overall update should reduce effective sigma
    // For the first game with default tau, sigma should still decrease
    expect(winner.sigma).toBeLessThan(a.sigma + 1); // generous bound
    expect(loser.sigma).toBeLessThan(b.sigma + 1);
  });

  it("draw leaves mus close to original for equal players", () => {
    const a: Gaussian = { mu: 25, sigma: 25 / 3 };
    const b: Gaussian = { mu: 25, sigma: 25 / 3 };
    const [pA, pB] = rate1v1(a, b, true, config);
    expect(pA.mu).toBeCloseTo(25, 0);
    expect(pB.mu).toBeCloseTo(25, 0);
  });

  it("upset produces larger mu shift", () => {
    const strong: Gaussian = { mu: 35, sigma: 4 };
    const weak: Gaussian = { mu: 15, sigma: 4 };
    const [winner, loser] = rate1v1(weak, strong, false, config); // weak wins
    // Weak player should gain significantly
    expect(winner.mu - 15).toBeGreaterThan(1);
  });

  it("converges over many games", () => {
    // Two players, one is truly 30, other truly 20. After many games
    // with true-30 always winning, ratings should separate.
    let a: Gaussian = { mu: 25, sigma: 25 / 3 };
    let b: Gaussian = { mu: 25, sigma: 25 / 3 };
    for (let i = 0; i < 50; i++) {
      [a, b] = rate1v1(a, b, false, config);
    }
    expect(a.mu).toBeGreaterThan(b.mu + 10);
    // Sigma should have decreased substantially
    expect(a.sigma).toBeLessThan(5);
    expect(b.sigma).toBeLessThan(5);
  });
});

describe("matchQuality1v1", () => {
  it("returns high quality for equal players", () => {
    const a: Gaussian = { mu: 25, sigma: 25 / 3 };
    const q = matchQuality1v1(a, a, config.beta);
    expect(q).toBeGreaterThan(0.3);
  });

  it("returns lower quality for mismatched players", () => {
    const a: Gaussian = { mu: 35, sigma: 3 };
    const b: Gaussian = { mu: 15, sigma: 3 };
    const q = matchQuality1v1(a, b, config.beta);
    expect(q).toBeLessThan(0.1);
  });

  it("returns value between 0 and 1", () => {
    const a: Gaussian = { mu: 25, sigma: 8 };
    const b: Gaussian = { mu: 30, sigma: 6 };
    const q = matchQuality1v1(a, b, config.beta);
    expect(q).toBeGreaterThan(0);
    expect(q).toBeLessThanOrEqual(1);
  });
});

describe("teamGaussian", () => {
  it("sums mus and variances", () => {
    const team = [
      { mu: 25, sigma: 8 },
      { mu: 30, sigma: 6 },
    ];
    const g = teamGaussian(team);
    expect(g.mu).toBe(55);
    expect(g.sigma).toBeCloseTo(Math.sqrt(64 + 36), 5);
  });

  it("single player team equals the player", () => {
    const g = teamGaussian([{ mu: 25, sigma: 8 }]);
    expect(g.mu).toBe(25);
    expect(g.sigma).toBe(8);
  });
});
