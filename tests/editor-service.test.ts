// Integration tests against the real Postgres (DATABASE_URL) with a FAKE judge.
// They verify validation, sample-only execution and draft persistence, not real C execution.
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may already be set */
}

import * as service from "../src/modules/editor/service";
import { JudgeNotConfiguredError, type JudgeClient, type RunOutcome } from "../src/modules/judge/types";

const prisma = new PrismaClient();
const ok = (stdout: string): RunOutcome => ({ status: "OK", stdout, stderr: "", compileOutput: "", timeMs: 5, memoryKb: 100 });

let userId: string;
const SLUG = "sum-of-two-numbers";

// A fake that "solves" the problem by summing the two ints in stdin; records every stdin it receives.
function fakeJudge(handler?: (stdin: string) => RunOutcome): JudgeClient & { seen: string[] } {
  const seen: string[] = [];
  return {
    seen,
    async run(_src, stdin) {
      seen.push(stdin);
      if (handler) return handler(stdin);
      const [a, b] = stdin.trim().split(/\s+/).map(Number);
      return ok(`${a + b}\n`);
    },
  };
}

beforeAll(async () => {
  const u = await prisma.user.create({
    data: { username: `t_${Date.now()}`, email: `t_${Date.now()}@test.local`, passwordHash: "x" },
  });
  userId = u.id;
});
afterAll(async () => {
  await prisma.user.delete({ where: { id: userId } });
  await prisma.$disconnect();
});

describe("runCode", () => {
  it("rejects empty source", async () => {
    const r = await service.runCode(userId, fakeJudge(), { slug: SLUG, sourceCode: "   ", stdin: "" });
    expect(r).toMatchObject({ ok: false, code: "INVALID" });
  });
  it("rejects oversized source and stdin", async () => {
    expect(await service.runCode(userId, fakeJudge(), { slug: SLUG, sourceCode: "x".repeat(65 * 1024), stdin: "" })).toMatchObject({ code: "INVALID" });
    expect(await service.runCode(userId, fakeJudge(), { slug: SLUG, sourceCode: "int main(){}", stdin: "x".repeat(17 * 1024) })).toMatchObject({ code: "INVALID" });
  });
  it("returns NOT_FOUND for unknown problems", async () => {
    expect(await service.runCode(userId, fakeJudge(), { slug: "nope", sourceCode: "int main(){}", stdin: "" })).toMatchObject({ ok: false, code: "NOT_FOUND" });
  });
  it("passes custom input to the judge and returns its outcome", async () => {
    const j = fakeJudge();
    const r = await service.runCode(userId, j, { slug: SLUG, sourceCode: "int main(){}", stdin: "2 3\n" });
    expect(r).toMatchObject({ ok: true, outcome: { stdout: "5\n" } });
    expect(j.seen).toEqual(["2 3\n"]);
  });
  it("reports an unconfigured judge explicitly", async () => {
    const j: JudgeClient = { run: async () => { throw new JudgeNotConfiguredError(); } };
    expect(await service.runCode(userId, j, { slug: SLUG, sourceCode: "int main(){}", stdin: "" })).toMatchObject({ code: "JUDGE_NOT_CONFIGURED" });
  });
  it("hides judge failure details", async () => {
    const j: JudgeClient = { run: async () => { throw new Error("connect ECONNREFUSED 10.0.0.5:2358 token=abc"); } };
    const r = await service.runCode(userId, j, { slug: SLUG, sourceCode: "int main(){}", stdin: "" });
    expect(r).toMatchObject({ ok: false, code: "JUDGE_UNAVAILABLE" });
    expect(JSON.stringify(r)).not.toMatch(/ECONNREFUSED|10\.0\.0\.5|token/);
  });
});

describe("runSamples", () => {
  it("only ever sends sample inputs to the judge (hidden tests stay server-side)", async () => {
    const problem = await prisma.problem.findUniqueOrThrow({ where: { slug: SLUG }, include: { testCases: true } });
    const sampleInputs = problem.testCases.filter((t) => t.isSample).map((t) => t.inputData);
    const hiddenInputs = problem.testCases.filter((t) => !t.isSample).map((t) => t.inputData);
    expect(hiddenInputs.length).toBeGreaterThan(0);

    const j = fakeJudge();
    const r = await service.runSamples(userId, j, { slug: SLUG, sourceCode: "int main(){}" });
    expect(r.ok).toBe(true);
    expect(j.seen).toEqual(sampleInputs);
    for (const h of hiddenInputs) expect(j.seen).not.toContain(h);
    if (r.ok) {
      expect(r.results.every((x) => x.passed)).toBe(true);
      expect(JSON.stringify(r)).not.toContain(hiddenInputs[0] + "|");
    }
  });
  it("marks wrong answers as failed", async () => {
    const r = await service.runSamples(userId, fakeJudge(() => ok("0\n")), { slug: SLUG, sourceCode: "int main(){}" });
    expect(r.ok && r.results.every((x) => !x.passed)).toBe(true);
  });
  it("stops after a compilation error", async () => {
    const j = fakeJudge(() => ({ ...ok(""), status: "COMPILATION_ERROR", compileOutput: "error: expected ';'" }));
    const r = await service.runSamples(userId, j, { slug: SLUG, sourceCode: "int main(){" });
    expect(j.seen).toHaveLength(1);
    expect(r.ok && r.results[0].passed).toBe(false);
  });
  it("does not pass a runtime error even if stdout matches", async () => {
    const r = await service.runSamples(userId, fakeJudge(() => ({ ...ok("8\n"), status: "RUNTIME_ERROR" })), { slug: SLUG, sourceCode: "int main(){}" });
    expect(r.ok && r.results.every((x) => !x.passed)).toBe(true);
  });
});

describe("drafts", () => {
  it("saves, overwrites and deletes a draft", async () => {
    const problem = await prisma.problem.findUniqueOrThrow({ where: { slug: SLUG } });
    const key = { userId_problemId: { userId, problemId: problem.id } };
    expect(await service.saveDraft(userId, { slug: SLUG, code: "v1" })).toEqual({ ok: true });
    expect((await prisma.codeDraft.findUnique({ where: key }))?.code).toBe("v1");
    await service.saveDraft(userId, { slug: SLUG, code: "v2" });
    expect((await prisma.codeDraft.findUnique({ where: key }))?.code).toBe("v2");
    expect(await prisma.codeDraft.count({ where: { userId } })).toBe(1);
    await service.deleteDraft(userId, { slug: SLUG });
    expect(await prisma.codeDraft.findUnique({ where: key })).toBeNull();
  });
  it("rejects oversized drafts and unknown problems", async () => {
    expect(await service.saveDraft(userId, { slug: SLUG, code: "x".repeat(65 * 1024) })).toMatchObject({ code: "INVALID" });
    expect(await service.saveDraft(userId, { slug: "nope", code: "x" })).toMatchObject({ code: "NOT_FOUND" });
  });
});
