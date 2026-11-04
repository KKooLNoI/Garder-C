// Integration tests: real Postgres, FAKE judge. The "student program" is simulated by a marker in the
// source text, so these verify grading/scoring/persistence logic, NOT real compilation or sandboxing.
import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it, vi } from "vitest";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may already be set */
}

import { db } from "../src/lib/db";
import * as service from "../src/modules/grading/service";
import { getProblemForDisplay } from "../src/modules/problems/queries";
import type { JudgeClient, RunOutcome } from "../src/modules/judge/types";
import { summarize } from "../src/modules/grading/scoring";

const prisma = new PrismaClient();
const SLUG = "sum-of-two-numbers"; // 6 tests: 2 sample + 4 hidden, 1 point each, problem score 10
const created: string[] = [];

const out = (o: Partial<RunOutcome>): RunOutcome => ({ status: "OK", stdout: "", stderr: "", compileOutput: "", timeMs: 7, memoryKb: 900, ...o });
const sum = (stdin: string) => stdin.trim().split(/\s+/).map(Number).reduce((a, b) => a + b, 0);

/** Fake "compiler + CPU": behaviour chosen by a marker in the source. */
const fake: JudgeClient = {
  async run(src, stdin) {
    if (src.includes("SYNTAX")) return out({ status: "COMPILATION_ERROR", compileOutput: "main.c:3: error: expected ';'" });
    if (src.includes("CRASH")) return out({ status: "RUNTIME_ERROR", stderr: "Segmentation fault" });
    if (src.includes("LOOP")) return out({ status: "TIME_LIMIT_EXCEEDED", timeMs: 1000 });
    if (src.includes("MEMHOG")) return out({ status: "MEMORY_LIMIT_EXCEEDED", memoryKb: 65536 });
    if (src.includes("WRONG")) return out({ stdout: "0\n" });
    // Passes only the small (sample) inputs; wrong on the large hidden ones.
    if (src.includes("SAMPLES_ONLY")) return out({ stdout: Math.abs(sum(stdin)) > 1000 ? "0\n" : `${sum(stdin)}\n` });
    return out({ stdout: `${sum(stdin)}\n` });
  },
};

async function newUser() {
  const n = `g_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const u = await prisma.user.create({ data: { username: n, email: `${n}@test.local`, passwordHash: "x" } });
  created.push(u.id);
  return u.id;
}

async function submitAndGrade(userId: string, sourceCode: string, judge = fake) {
  const r = await service.createSubmission(userId, true, { slug: SLUG, sourceCode });
  if (!r.ok) throw new Error(r.message);
  await db.submission.update({ where: { id: r.id }, data: { status: "RUNNING", startedAt: new Date() } });
  const status = await service.gradeSubmission(r.id, judge);
  return { id: r.id, status };
}

const progress = async (userId: string) => {
  const p = await prisma.problem.findUniqueOrThrow({ where: { slug: SLUG } });
  return prisma.userProgress.findUnique({ where: { userId_problemId: { userId, problemId: p.id } } });
};

afterAll(async () => {
  for (const id of created) {
    await prisma.submission.deleteMany({ where: { userId: id } });
    await prisma.user.delete({ where: { id } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe("summarize (pure)", () => {
  const v = (status: "ACCEPTED" | "WRONG_ANSWER", points = 1) => ({ status, points, timeMs: 1, memoryKb: 1 });
  it("awards full score only when every test passes", () => {
    expect(summarize([v("ACCEPTED"), v("ACCEPTED")], 2, 10)).toMatchObject({ status: "ACCEPTED", score: 10 });
  });
  it("awards partial credit by points", () => {
    expect(summarize([v("ACCEPTED", 3), v("WRONG_ANSWER", 1)], 4, 20)).toMatchObject({ status: "WRONG_ANSWER", score: 15 });
  });
  it("never accepts an empty verdict list", () => {
    expect(summarize([], 0, 10)).toMatchObject({ status: "SYSTEM_ERROR", score: 0 });
  });
});

describe("verdicts and scoring", () => {
  it("1. correct code is ACCEPTED, full score, problem marked solved", async () => {
    const u = await newUser();
    const { id, status } = await submitAndGrade(u, "CORRECT");
    expect(status).toBe("ACCEPTED");
    const s = await prisma.submission.findUniqueOrThrow({ where: { id }, include: { results: true } });
    expect(s).toMatchObject({ status: "ACCEPTED", score: 10 });
    expect(s.results).toHaveLength(6);
    expect(await progress(u)).toMatchObject({ solved: true, bestScore: 10, attempts: 1 });
  });
  it("2. wrong output is WRONG_ANSWER with partial score and not solved", async () => {
    const u = await newUser();
    const { id, status } = await submitAndGrade(u, "SAMPLES_ONLY");
    expect(status).toBe("WRONG_ANSWER");
    const s = await prisma.submission.findUniqueOrThrow({ where: { id } });
    expect(s.score).toBeGreaterThan(0);
    expect(s.score).toBeLessThan(10);
    expect(await progress(u)).toMatchObject({ solved: false, attempts: 1 });
    expect((await submitAndGrade(u, "WRONG")).status).toBe("WRONG_ANSWER");
  });
  it("3. invalid syntax is COMPILATION_ERROR, stops early, keeps the message", async () => {
    const u = await newUser();
    const { id } = await submitAndGrade(u, "SYNTAX");
    const s = await prisma.submission.findUniqueOrThrow({ where: { id }, include: { results: true } });
    expect(s.status).toBe("COMPILATION_ERROR");
    expect(s.compilerMessage).toContain("expected ';'");
    expect(s.results).toHaveLength(1);
    expect(s.score).toBe(0);
  });
  it("4-6. runtime error, time limit and memory limit map to their statuses", async () => {
    const u = await newUser();
    expect((await submitAndGrade(u, "CRASH")).status).toBe("RUNTIME_ERROR");
    expect((await submitAndGrade(u, "LOOP")).status).toBe("TIME_LIMIT_EXCEEDED");
    expect((await submitAndGrade(u, "MEMHOG")).status).toBe("MEMORY_LIMIT_EXCEEDED");
    expect(await progress(u)).toMatchObject({ solved: false, attempts: 3 });
  });
});

describe("input validation and access", () => {
  it("7. rejects empty and oversized source without creating a submission", async () => {
    const u = await newUser();
    expect(await service.createSubmission(u, true, { slug: SLUG, sourceCode: "  \n" })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await service.createSubmission(u, true, { slug: SLUG, sourceCode: "x".repeat(65 * 1024) })).toMatchObject({ ok: false, code: "INVALID" });
    expect(await prisma.submission.count({ where: { userId: u } })).toBe(0);
  });
  it("8. unknown problem is NOT_FOUND; malformed or unknown submission ids return null", async () => {
    const u = await newUser();
    expect(await service.createSubmission(u, true, { slug: "no-such-problem", sourceCode: "int main(){}" })).toMatchObject({ ok: false, code: "NOT_FOUND" });
    expect(await service.getSubmissionView(u, "STUDENT", "not-a-uuid")).toBeNull();
    expect(await service.getSubmissionView(u, "STUDENT", "00000000-0000-4000-8000-000000000000")).toBeNull();
  });
  it("9. other students cannot read a submission; its owner and admins can", async () => {
    const owner = await newUser();
    const other = await newUser();
    const { id } = await submitAndGrade(owner, "CORRECT");
    expect(await service.getSubmissionView(other, "STUDENT", id)).toBeNull();
    expect(await service.getSubmissionView(owner, "STUDENT", id)).not.toBeNull();
    expect(await service.getSubmissionView(other, "ADMIN", id)).not.toBeNull();
  });
  it("refuses to queue when the judge is not configured, creating nothing", async () => {
    const u = await newUser();
    expect(await service.createSubmission(u, false, { slug: SLUG, sourceCode: "int main(){}" })).toMatchObject({ code: "JUDGE_NOT_CONFIGURED" });
    expect(await prisma.submission.count({ where: { userId: u } })).toBe(0);
  });
  it("caps submissions in flight per user", async () => {
    const u = await newUser();
    for (let i = 0; i < 3; i++) expect((await service.createSubmission(u, true, { slug: SLUG, sourceCode: `int main(){}//${i}` })).ok).toBe(true);
    expect(await service.createSubmission(u, true, { slug: SLUG, sourceCode: "int main(){}" })).toMatchObject({ code: "TOO_MANY_PENDING" });
  });
});

describe("hidden test protection", () => {
  it("10. problem display and submission views never contain hidden test data", async () => {
    const p = await prisma.problem.findUniqueOrThrow({ where: { slug: SLUG }, include: { testCases: true } });
    const hidden = p.testCases.filter((t) => !t.isSample);
    expect(hidden.length).toBeGreaterThan(0);

    const display = await getProblemForDisplay(SLUG);
    expect(display?.testCases.every((t) => p.testCases.find((x) => x.id === t.id)?.isSample)).toBe(true);
    const shown = JSON.stringify(display);
    for (const h of hidden) expect(shown).not.toContain(JSON.stringify(h.inputData));

    const u = await newUser();
    const { id } = await submitAndGrade(u, "WRONG");
    const view = JSON.stringify(await service.getSubmissionView(u, "STUDENT", id));
    for (const h of hidden) {
      expect(view).not.toContain(JSON.stringify(h.inputData));
      expect(view).not.toContain(JSON.stringify(h.expectedOutput));
    }
  });
});

describe("concurrency and failure handling", () => {
  it("11a. concurrent grading of one user's submissions does not corrupt progress", async () => {
    const u = await newUser();
    // The in-flight cap is 3 per user, so queue in batches of 3 and grade each batch concurrently.
    for (const batch of [["WRONG", "SAMPLES_ONLY", "CORRECT"], ["CORRECT 2", "WRONG 2"]]) {
      const ids: string[] = [];
      for (const src of batch) {
        const r = await service.createSubmission(u, true, { slug: SLUG, sourceCode: src });
        if (!r.ok) throw new Error(r.message);
        await db.submission.update({ where: { id: r.id }, data: { status: "RUNNING", startedAt: new Date() } });
        ids.push(r.id);
      }
      await Promise.all(ids.map((id) => service.gradeSubmission(id, fake)));
    }
    expect(await progress(u)).toMatchObject({ solved: true, bestScore: 10, attempts: 5 });
    expect(await prisma.userProgress.count({ where: { userId: u } })).toBe(1);
  });
  it("11b. parallel workers never claim the same submission", async () => {
    const u = await newUser();
    const ids = new Set<string>();
    for (let i = 0; i < 3; i++) {
      const r = await service.createSubmission(u, true, { slug: SLUG, sourceCode: `int main(){}//q${i}` });
      if (r.ok) ids.add(r.id);
    }
    const claimed = (await Promise.all(Array.from({ length: 6 }, () => service.claimNextSubmission()))).filter(Boolean) as string[];
    const mine = claimed.filter((c) => ids.has(c));
    expect(new Set(mine).size).toBe(mine.length);
    expect(mine).toHaveLength(3);
  });
  it("12. a database failure while saving yields SYSTEM_ERROR, never a false ACCEPTED", async () => {
    const u = await newUser();
    const spy = vi.spyOn(db, "$transaction").mockRejectedValueOnce(new Error("connection lost"));
    const { id, status } = await submitAndGrade(u, "CORRECT");
    spy.mockRestore();
    expect(status).toBe("SYSTEM_ERROR");
    const s = await prisma.submission.findUniqueOrThrow({ where: { id } });
    expect(s).toMatchObject({ status: "SYSTEM_ERROR", score: 0 });
    expect(await progress(u)).toBeNull();
  });
  it("a judge outage yields SYSTEM_ERROR and does not count as an attempt", async () => {
    const u = await newUser();
    const down: JudgeClient = { run: async () => { throw new Error("ECONNREFUSED"); } };
    const { status } = await submitAndGrade(u, "CORRECT", down);
    expect(status).toBe("SYSTEM_ERROR");
    expect(await progress(u)).toBeNull();
  });
  it("fails submissions stuck in RUNNING after a worker crash", async () => {
    const u = await newUser();
    const r = await service.createSubmission(u, true, { slug: SLUG, sourceCode: "int main(){}" });
    if (!r.ok) throw new Error("setup");
    await db.submission.update({ where: { id: r.id }, data: { status: "RUNNING", startedAt: new Date(Date.now() - 10 * 60_000) } });
    expect(await service.failStaleSubmissions()).toBeGreaterThanOrEqual(1);
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("SYSTEM_ERROR");
  });
  it("end to end through the queue: claim then grade", async () => {
    const u = await newUser();
    const r = await service.createSubmission(u, true, { slug: SLUG, sourceCode: "CORRECT" });
    if (!r.ok) throw new Error("setup");
    // Drain anything left in the queue by earlier tests, then ours must be graded.
    while (await service.processNext(fake)) { /* drain */ }
    expect((await prisma.submission.findUniqueOrThrow({ where: { id: r.id } })).status).toBe("ACCEPTED");
  });
  it("completes the lesson once every problem in it is solved", async () => {
    const u = await newUser();
    const lesson = await prisma.lesson.findUniqueOrThrow({ where: { slug: "basic-io" }, include: { problems: true } });
    for (const p of lesson.problems) {
      const r = await service.createSubmission(u, true, { slug: p.slug, sourceCode: "x" });
      if (!r.ok) throw new Error(r.message);
      await db.submission.update({ where: { id: r.id }, data: { status: "RUNNING", startedAt: new Date() } });
      // This fake answers every problem correctly using the problem's own stored tests.
      const tests = await prisma.testCase.findMany({ where: { problemId: p.id } });
      const oracle: JudgeClient = { run: async (_s, stdin) => out({ stdout: tests.find((t) => t.inputData === stdin)!.expectedOutput }) };
      expect(await service.gradeSubmission(r.id, oracle)).toBe("ACCEPTED");
    }
    const lp = await prisma.lessonProgress.findUnique({ where: { userId_lessonId: { userId: u, lessonId: lesson.id } } });
    expect(lp?.completed).toBe(true);
  });
});
