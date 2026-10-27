import { describe, it, expect } from "vitest";
import { pdf, cdf, ppf } from "../src/gaussian.js";

describe("pdf", () => {
  it("peaks at 0", () => {
    expect(pdf(0)).toBeCloseTo(1 / Math.sqrt(2 * Math.PI), 10);
  });

  it("is symmetric", () => {
    expect(pdf(1)).toBeCloseTo(pdf(-1), 10);
    expect(pdf(2.5)).toBeCloseTo(pdf(-2.5), 10);
  });

  it("decays for large |x|", () => {
    expect(pdf(4)).toBeLessThan(0.001);
  });
});

describe("cdf", () => {
  it("returns 0.5 at 0", () => {
    expect(cdf(0)).toBeCloseTo(0.5, 5);
  });

  it("returns ~0.8413 at 1", () => {
    expect(cdf(1)).toBeCloseTo(0.8413, 3);
  });

  it("returns ~0.1587 at -1", () => {
    expect(cdf(-1)).toBeCloseTo(0.1587, 3);
  });

  it("approaches 1 for large positive x", () => {
    expect(cdf(5)).toBeGreaterThan(0.999999);
  });

  it("approaches 0 for large negative x", () => {
    expect(cdf(-5)).toBeLessThan(0.000001);
  });

  it("is monotonically increasing", () => {
    for (let x = -3; x < 3; x += 0.5) {
      expect(cdf(x + 0.5)).toBeGreaterThan(cdf(x));
    }
  });
});

describe("ppf", () => {
  it("returns 0 for p=0.5", () => {
    expect(ppf(0.5)).toBeCloseTo(0, 4);
  });

  it("inverts cdf", () => {
    for (const x of [-2, -1, 0, 0.5, 1, 2]) {
      expect(ppf(cdf(x))).toBeCloseTo(x, 2);
    }
  });

  it("returns -Infinity for p=0", () => {
    expect(ppf(0)).toBe(-Infinity);
  });

  it("returns Infinity for p=1", () => {
    expect(ppf(1)).toBe(Infinity);
  });

  it("returns ~1.645 for p=0.95", () => {
    expect(ppf(0.95)).toBeCloseTo(1.645, 2);
  });

  it("returns ~-1.645 for p=0.05", () => {
    expect(ppf(0.05)).toBeCloseTo(-1.645, 2);
  });
});
