import { describe, expect, it } from "vitest";
import { computeStreak } from "../src/modules/progress/streak";

const now = new Date("2026-11-04T12:00:00Z");
const d = (s: string) => new Date(`${s}T08:00:00Z`);

describe("computeStreak", () => {
  it("is 0 with no submissions", () => expect(computeStreak([], now)).toBe(0));
  it("counts consecutive days including today", () =>
    expect(computeStreak([d("2026-11-04"), d("2026-11-03"), d("2026-11-02")], now)).toBe(3));
  it("keeps the streak alive if the last submission was yesterday", () =>
    expect(computeStreak([d("2026-11-03"), d("2026-11-02")], now)).toBe(2));
  it("resets after a gap", () => expect(computeStreak([d("2026-11-01")], now)).toBe(0));
  it("counts multiple submissions per day once", () =>
    expect(computeStreak([d("2026-11-04"), d("2026-11-04")], now)).toBe(1));
});
