import { describe, it, expect } from "vitest";
import { vWin, wWin, vDraw, wDraw } from "../src/truncated.js";

describe("vWin", () => {
  it("returns positive value for favorable t", () => {
    expect(vWin(1, 0)).toBeGreaterThan(0);
  });

  it("returns larger correction for smaller margin", () => {
    // When t is small (close match), correction is larger
    expect(vWin(0, 0)).toBeGreaterThan(vWin(3, 0));
  });

  it("handles edge case of very negative t", () => {
    // Should not throw or return NaN
    const v = vWin(-10, 0);
    expect(Number.isFinite(v)).toBe(true);
  });
});

describe("wWin", () => {
  it("returns value between 0 and 1 for typical inputs", () => {
    const w = wWin(1, 0);
    expect(w).toBeGreaterThan(0);
    expect(w).toBeLessThan(1);
  });

  it("approaches 0 for large t (clear winner)", () => {
    expect(wWin(5, 0)).toBeLessThan(0.01);
  });
});

describe("vDraw", () => {
  it("returns 0 for equal ratings (t=0)", () => {
    // For symmetric case, v should be 0
    expect(vDraw(0, 0.5)).toBeCloseTo(0, 5);
  });

  it("returns finite values for typical inputs", () => {
    expect(Number.isFinite(vDraw(1, 0.5))).toBe(true);
    expect(Number.isFinite(vDraw(-1, 0.5))).toBe(true);
  });
});

describe("wDraw", () => {
  it("returns positive value", () => {
    expect(wDraw(0, 0.5)).toBeGreaterThan(0);
  });

  it("returns value less than 1 for typical inputs", () => {
    expect(wDraw(0, 0.5)).toBeLessThan(1);
  });
});
