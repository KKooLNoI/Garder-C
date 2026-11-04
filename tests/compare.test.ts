import { describe, expect, it } from "vitest";
import { outputsMatch } from "../src/modules/grading/compare";

const loose = { normalizeWhitespace: true };
const exact = { normalizeWhitespace: false };

describe("outputsMatch", () => {
  it("ignores trailing spaces, CRLF and trailing blank lines when normalising", () => {
    expect(outputsMatch("1 2  \r\n3\n\n", "1 2\n3", loose)).toBe(true);
  });
  it("does not ignore leading or inner differences", () => {
    expect(outputsMatch(" 1", "1", loose)).toBe(false);
    expect(outputsMatch("1  2", "1 2", loose)).toBe(false);
  });
  it("is byte-exact when normalisation is off", () => {
    expect(outputsMatch("5\n", "5\n", exact)).toBe(true);
    expect(outputsMatch("5", "5\n", exact)).toBe(false);
  });
  it("detects wrong answers", () => expect(outputsMatch("6\n", "5\n", loose)).toBe(false));
  it("compares floats within tolerance but text exactly", () => {
    const f = { normalizeWhitespace: true, floatTolerance: 1e-6 };
    expect(outputsMatch("3.1415927\n", "3.1415926\n", f)).toBe(true);
    expect(outputsMatch("3.15\n", "3.14\n", f)).toBe(false);
    expect(outputsMatch("x 1\n", "y 1\n", f)).toBe(false);
    expect(outputsMatch("1 2\n", "1\n", f)).toBe(false);
  });
});
