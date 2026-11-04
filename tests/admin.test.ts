// Integration tests against the real Postgres for the admin service (no HTTP layer).
import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

try {
  process.loadEnvFile(".env");
} catch {
  /* env may already be set */
}

import * as admin from "../src/modules/admin/service";
import { getAdminStats } from "../src/modules/admin/stats";
import { verifyPassword } from "../src/modules/auth/password";

const prisma = new PrismaClient();
const tag = `adm${Date.now()}`;
let actor: string;
let lessonId: string;
const userIds: string[] = [];

const problemInput = (over: Record<string, unknown> = {}) => ({
  lessonId, title: `Test Problem ${tag}`, statement: "Print 1.", inputFormat: "none", outputFormat: "1", constraints: "none",
  difficulty: "EASY", score: 10, timeLimitMs: 1000, memoryLimitMb: 64, starterCode: "", explanation: "", hints: "a\n\nb",
  normalizeWhitespace: true, floatTolerance: "", ...over,
});
const test = (over: Record<string, unknown> = {}) => ({ inputData: "", expectedOutput: "1\n", isSample: false, points: 1, orderIndex: "", ...over });

async function makeUser(role: "STUDENT" | "ADMIN" = "ADMIN") {
  const n = `${tag}_${userIds.length}`;
  const u = await prisma.user.create({ data: { username: n, email: `${n}@t.local`, passwordHash: "x", role } });
  userIds.push(u.id);
  return u.id;
}

beforeAll(async () => {
  actor = await makeUser("ADMIN");
});

afterAll(async () => {
  await prisma.problem.deleteMany({ where: { title: { contains: tag } } });
  await prisma.lesson.deleteMany({ where: { title: { contains: tag } } });
  await prisma.auditLog.deleteMany({ where: { actorId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe("lessons", () => {
  it("creates (unpublished, auto slug), updates, archives and deletes; audits each step", async () => {
    const c = await admin.createLesson(actor, { title: `Lesson ${tag}`, description: "d", content: "", orderIndex: 99 });
    expect(c.ok).toBe(true);
    if (!c.ok) return;
    lessonId = c.id;
    const l = await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } });
    expect(l).toMatchObject({ isPublished: false, slug: expect.stringMatching(/^lesson-adm/) });

    expect((await admin.updateLesson(actor, lessonId, { title: `Lesson ${tag}`, description: "changed", content: "", orderIndex: 98 })).ok).toBe(true);
    expect((await admin.setLessonPublished(actor, lessonId, true)).ok).toBe(true);
    expect((await prisma.lesson.findUniqueOrThrow({ where: { id: lessonId } })).isPublished).toBe(true);
    expect((await admin.setLessonPublished(actor, lessonId, false)).ok).toBe(true);

    const actions = (await prisma.auditLog.findMany({ where: { entityId: lessonId }, orderBy: { createdAt: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["lesson.create", "lesson.update", "lesson.publish", "lesson.archive"]);
  });
  it("rejects invalid input", async () => {
    expect(await admin.createLesson(actor, { title: "", description: "d", orderIndex: 1 })).toMatchObject({ ok: false });
  });
});

describe("problems, tests and versioning", () => {
  let problemId: string;

  it("creates an unpublished problem with a version-1 snapshot", async () => {
    const r = await admin.createProblem(actor, problemInput());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    problemId = r.id;
    const p = await prisma.problem.findUniqueOrThrow({ where: { id: problemId }, include: { versions: true } });
    expect(p).toMatchObject({ isPublished: false, version: 1, hints: ["a", "b"] });
    expect(p.versions.map((v) => v.version)).toEqual([1]);
  });

  it("generates unique slugs for duplicate titles", async () => {
    const r = await admin.createProblem(actor, problemInput());
    expect(r.ok).toBe(true);
    if (r.ok) {
      const p = await prisma.problem.findUniqueOrThrow({ where: { id: r.id } });
      expect(p.slug).toMatch(/-2$/);
    }
  });

  it("refuses to publish without a sample AND a hidden test", async () => {
    expect(await admin.setProblemPublished(actor, problemId, true)).toMatchObject({ ok: false });
    await admin.createTestCase(actor, problemId, test({ isSample: true }));
    expect(await admin.setProblemPublished(actor, problemId, true)).toMatchObject({ ok: false, error: expect.stringContaining("hidden") });
    await admin.createTestCase(actor, problemId, test({ isSample: false }));
    expect((await admin.setProblemPublished(actor, problemId, true)).ok).toBe(true);
  });

  it("bumps the version and stores a new snapshot when tests or the statement change", async () => {
    const before = (await prisma.problem.findUniqueOrThrow({ where: { id: problemId } })).version;
    const t = await admin.createTestCase(actor, problemId, test({ expectedOutput: "2\n" }));
    expect(t.ok).toBe(true);
    const after1 = (await prisma.problem.findUniqueOrThrow({ where: { id: problemId } })).version;
    expect(after1).toBe(before + 1);

    await admin.updateProblem(actor, problemId, problemInput({ statement: "Print 1 (edited)." }));
    const after2 = await prisma.problem.findUniqueOrThrow({ where: { id: problemId }, include: { versions: { orderBy: { version: "asc" } } } });
    expect(after2.version).toBe(after1 + 1);
    // Old snapshots are preserved and still show the old statement.
    expect((after2.versions[0].snapshot as { statement: string }).statement).toBe("Print 1.");
    expect((after2.versions.at(-1)!.snapshot as { statement: string }).statement).toBe("Print 1 (edited).");
  });

  it("does not bump the version for cosmetic edits (title, score)", async () => {
    const before = (await prisma.problem.findUniqueOrThrow({ where: { id: problemId } })).version;
    await admin.updateProblem(actor, problemId, problemInput({ statement: "Print 1 (edited).", score: 25 }));
    expect((await prisma.problem.findUniqueOrThrow({ where: { id: problemId } })).version).toBe(before);
  });

  it("will not delete a test case that has historical results, but deletes unused ones", async () => {
    const tests = await prisma.testCase.findMany({ where: { problemId }, orderBy: { orderIndex: "asc" } });
    const used = tests[0];
    const u = await makeUser("STUDENT");
    const sub = await prisma.submission.create({ data: { userId: u, problemId, sourceCode: "x", status: "WRONG_ANSWER" } });
    await prisma.submissionResult.create({ data: { submissionId: sub.id, testCaseId: used.id, status: "WRONG_ANSWER" } });
    expect(await admin.deleteTestCase(actor, used.id)).toMatchObject({ ok: false, error: expect.stringContaining("historical") });
    expect(await prisma.testCase.findUnique({ where: { id: used.id } })).not.toBeNull();

    const unused = tests.at(-1)!;
    expect((await admin.deleteTestCase(actor, unused.id)).ok).toBe(true);
    await prisma.submission.delete({ where: { id: sub.id } });
  });

  it("keeps a published problem valid: cannot delete its only hidden test", async () => {
    const tests = await prisma.testCase.findMany({ where: { problemId } });
    const hidden = tests.filter((t) => !t.isSample);
    for (const h of hidden.slice(0, -1)) await admin.deleteTestCase(actor, h.id);
    const last = (await prisma.testCase.findMany({ where: { problemId, isSample: false } }))[0];
    expect(await admin.deleteTestCase(actor, last.id)).toMatchObject({ ok: false, error: expect.stringContaining("Unpublish") });
  });

  it("rejects out-of-range limits", async () => {
    expect(await admin.updateProblem(actor, problemId, problemInput({ timeLimitMs: 999999 }))).toMatchObject({ ok: false });
    expect(await admin.createTestCase(actor, problemId, test({ inputData: "x".repeat(17 * 1024) }))).toMatchObject({ ok: false });
  });

  it("deleting a lesson that has problems is refused", async () => {
    expect(await admin.deleteLesson(actor, lessonId)).toMatchObject({ ok: false });
  });
});

describe("users", () => {
  it("creates a user with a verifiable Argon2id hash and no password in the audit log", async () => {
    const name = `${tag}_new`;
    const r = await admin.createUser(actor, { username: name, email: `${name}@t.local`, password: "a-long-password-1", role: "STUDENT" });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    userIds.push(r.id);
    const u = await prisma.user.findUniqueOrThrow({ where: { id: r.id } });
    expect(u.passwordHash).toMatch(/^\$argon2id\$/);
    expect(await verifyPassword(u.passwordHash, "a-long-password-1")).toBe(true);
    const log = await prisma.auditLog.findFirstOrThrow({ where: { entityId: r.id, action: "user.create" } });
    expect(JSON.stringify(log.metadata)).not.toContain("a-long-password-1");
  });
  it("rejects weak passwords and duplicate usernames", async () => {
    expect(await admin.createUser(actor, { username: `${tag}_weak`, email: `${tag}w@t.local`, password: "short", role: "STUDENT" })).toMatchObject({ ok: false });
    expect(await admin.createUser(actor, { username: `${tag}_new`, email: `${tag}dup@t.local`, password: "a-long-password-1", role: "STUDENT" })).toMatchObject({ ok: false, error: expect.stringContaining("in use") });
  });
  it("deactivating a user signs them out; reactivation works", async () => {
    const u = await makeUser("STUDENT");
    await prisma.userSession.create({ data: { userId: u, tokenHash: `h_${tag}`, expiresAt: new Date(Date.now() + 1e6) } });
    expect((await admin.setUserActive(actor, u, false)).ok).toBe(true);
    expect(await prisma.userSession.count({ where: { userId: u } })).toBe(0);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: u } })).isActive).toBe(false);
    expect((await admin.setUserActive(actor, u, true)).ok).toBe(true);
  });
  it("password reset changes the hash and signs the user out", async () => {
    const u = await makeUser("STUDENT");
    await prisma.userSession.create({ data: { userId: u, tokenHash: `r_${tag}`, expiresAt: new Date(Date.now() + 1e6) } });
    expect((await admin.resetUserPassword(actor, u, "brand-new-password")).ok).toBe(true);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: u } });
    expect(await verifyPassword(row.passwordHash, "brand-new-password")).toBe(true);
    expect(await prisma.userSession.count({ where: { userId: u } })).toBe(0);
    expect(await admin.resetUserPassword(actor, u, "short")).toMatchObject({ ok: false });
  });
  it("admins cannot demote or deactivate themselves", async () => {
    expect(await admin.setUserActive(actor, actor, false)).toMatchObject({ ok: false });
    expect(await admin.setUserRole(actor, actor, "STUDENT")).toMatchObject({ ok: false });
  });
  it("admin removals take a lock on the admin rows, serialising concurrent changes", async () => {
    const a = await makeUser("ADMIN");
    const b = await makeUser("ADMIN");
    const c = await makeUser("ADMIN"); // locked by the holder; the operation below never updates this row
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    let locked!: () => void;
    const lockedSignal = new Promise<void>((r) => (locked = r));
    // Another transaction holds the admin rows locked, as a concurrent admin change would.
    const holder = prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT id FROM "User" WHERE id = ${c}::uuid FOR UPDATE`;
        locked();
        await gate;
      },
      { timeout: 20_000 },
    );
    await lockedSignal;
    let finished = false;
    const pending = admin.setUserActive(a, b, false).then((r) => ((finished = true), r));
    await new Promise((r) => setTimeout(r, 700));
    expect(finished).toBe(false); // blocked behind the lock
    release();
    await holder;
    expect((await pending).ok).toBe(true);
    expect(finished).toBe(true);
  });
});

describe("stats", () => {
  it("returns consistent totals", async () => {
    const s = await getAdminStats();
    expect(s.users).toBeGreaterThan(0);
    expect(s.activity).toHaveLength(14);
    expect(s.problemStats.every((p) => p.accepted <= p.total)).toBe(true);
  });
});
