// Cross-checks every seeded test case: the TypeScript reference output must equal
// the output of an independent C reference solution compiled with the local gcc.
import { describe, expect, it } from "vitest";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { problems } from "../prisma/seed-data";

const dir = mkdtempSync(join(tmpdir(), "cref-"));

describe("seed problems match C reference solutions", () => {
  for (const p of problems) {
    it(p.slug, () => {
      const exe = join(dir, `${p.slug}.exe`);
      execFileSync("gcc", ["-std=c11", "-O1", "-o", exe, join(__dirname, "c-reference", `${p.slug}.c`)]);
      for (const input of p.inputs) {
        const r = spawnSync(exe, { input, encoding: "utf8" });
        // Windows console text mode emits \r\n; normalise before comparing.
        expect(r.stdout.split("\r\n").join("\n")).toBe(p.solve(input));
      }
    });
  }
  it("has 20 problems with samples and hidden tests", () => {
    expect(problems).toHaveLength(20);
    for (const p of problems) {
      expect(p.samples).toBeGreaterThan(0);
      expect(p.inputs.length).toBeGreaterThan(p.samples);
    }
  });
});
