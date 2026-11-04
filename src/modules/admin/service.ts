import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/modules/auth/password";
import { audit } from "./audit";
import {
  lessonSchema,
  passwordSchema,
  problemSchema,
  slugify,
  testCaseSchema,
  userCreateSchema,
} from "./schemas";

export type Result<T = object> = ({ ok: true } & T) | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Invalid input.";

class UserError extends Error {}

/** Runs a mutation, turning expected failures into messages and hiding unexpected ones. */
async function guard<T>(fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof UserError) return fail(e.message);
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return fail("That value is already in use.");
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") return fail("Record not found.");
    console.error("admin service error", e);
    return fail("Something went wrong. Nothing was changed.");
  }
}

// ------------------------------------------------------------------ lessons

async function uniqueSlug(table: "lesson" | "problem", base: string, excludeId?: string) {
  const root = base || "item";
  for (let i = 1; i < 100; i++) {
    const candidate = i === 1 ? root : `${root}-${i}`;
    const where = { slug: candidate, ...(excludeId ? { NOT: { id: excludeId } } : {}) };
    const exists = table === "lesson" ? await db.lesson.findFirst({ where }) : await db.problem.findFirst({ where });
    if (!exists) return candidate;
  }
  throw new UserError("Could not generate a unique slug; provide one.");
}

export function createLesson(actorId: string, input: unknown) {
  return guard<{ id: string }>(async () => {
    const p = lessonSchema.safeParse(input);
    if (!p.success) return fail(firstIssue(p.error));
    const slug = await uniqueSlug("lesson", p.data.slug || slugify(p.data.title));
    const lesson = await db.$transaction(async (tx) => {
      const l = await tx.lesson.create({
        data: { title: p.data.title, slug, description: p.data.description, content: p.data.content, orderIndex: p.data.orderIndex, isPublished: false },
      });
      await audit(tx, actorId, "lesson.create", "Lesson", l.id, { title: l.title });
      return l;
    });
    return { ok: true, id: lesson.id };
  });
}

export function updateLesson(actorId: string, id: string, input: unknown) {
  return guard(async () => {
    const p = lessonSchema.safeParse(input);
    if (!p.success) return fail(firstIssue(p.error));
    const slug = await uniqueSlug("lesson", p.data.slug || slugify(p.data.title), id);
    await db.$transaction(async (tx) => {
      await tx.lesson.update({
        where: { id },
        data: { title: p.data.title, slug, description: p.data.description, content: p.data.content, orderIndex: p.data.orderIndex },
      });
      await audit(tx, actorId, "lesson.update", "Lesson", id, { title: p.data.title });
    });
    return { ok: true };
  });
}

/** Publishing toggles visibility; unpublishing is the "archive" operation. */
export function setLessonPublished(actorId: string, id: string, published: boolean) {
  return guard(async () => {
    await db.$transaction(async (tx) => {
      await tx.lesson.update({ where: { id }, data: { isPublished: published } });
      await audit(tx, actorId, published ? "lesson.publish" : "lesson.archive", "Lesson", id);
    });
    return { ok: true };
  });
}

export function deleteLesson(actorId: string, id: string) {
  return guard(async () => {
    const problems = await db.problem.count({ where: { lessonId: id } });
    if (problems > 0) return fail("This lesson still has problems. Archive it instead, or move its problems first.");
    await db.$transaction(async (tx) => {
      const l = await tx.lesson.delete({ where: { id } });
      await audit(tx, actorId, "lesson.delete", "Lesson", id, { title: l.title });
    });
    return { ok: true };
  });
}

// ----------------------------------------------------------------- problems

const hintsFrom = (s: string) => s.split("\n").map((h) => h.trim()).filter(Boolean);

/** Stores an immutable copy of the problem and its tests at its current version. */
async function snapshot(tx: Prisma.TransactionClient, problemId: string) {
  const p = await tx.problem.findUniqueOrThrow({ where: { id: problemId }, include: { testCases: { orderBy: { orderIndex: "asc" } } } });
  const { testCases, ...fields } = p;
  await tx.problemVersion.upsert({
    where: { problemId_version: { problemId, version: p.version } },
    update: { snapshot: JSON.parse(JSON.stringify({ ...fields, testCases })) },
    create: { problemId, version: p.version, snapshot: JSON.parse(JSON.stringify({ ...fields, testCases })) },
  });
}

/** New version for any change that can alter how a submission is judged or what it was shown. */
async function bumpVersion(tx: Prisma.TransactionClient, problemId: string) {
  await tx.problem.update({ where: { id: problemId }, data: { version: { increment: 1 } } });
  await snapshot(tx, problemId);
}

export function createProblem(actorId: string, input: unknown) {
  return guard<{ id: string }>(async () => {
    const p = problemSchema.safeParse(input);
    if (!p.success) return fail(firstIssue(p.error));
    const d = p.data;
    const slug = await uniqueSlug("problem", d.slug || slugify(d.title));
    const created = await db.$transaction(async (tx) => {
      const problem = await tx.problem.create({
        data: {
          lessonId: d.lessonId, title: d.title, slug, statement: d.statement, inputFormat: d.inputFormat, outputFormat: d.outputFormat,
          constraints: d.constraints, difficulty: d.difficulty, score: d.score, timeLimitMs: d.timeLimitMs, memoryLimitMb: d.memoryLimitMb,
          starterCode: d.starterCode, explanation: d.explanation, hints: hintsFrom(d.hints),
          normalizeWhitespace: d.normalizeWhitespace, floatTolerance: d.floatTolerance, isPublished: false,
        },
      });
      await snapshot(tx, problem.id);
      await audit(tx, actorId, "problem.create", "Problem", problem.id, { title: problem.title });
      return problem;
    });
    return { ok: true, id: created.id };
  });
}

export function updateProblem(actorId: string, id: string, input: unknown) {
  return guard(async () => {
    const p = problemSchema.safeParse(input);
    if (!p.success) return fail(firstIssue(p.error));
    const d = p.data;
    const slug = await uniqueSlug("problem", d.slug || slugify(d.title), id);
    await db.$transaction(async (tx) => {
      const before = await tx.problem.findUniqueOrThrow({ where: { id } });
      const judgingChanged =
        before.statement !== d.statement || before.inputFormat !== d.inputFormat || before.outputFormat !== d.outputFormat ||
        before.constraints !== d.constraints || before.timeLimitMs !== d.timeLimitMs || before.memoryLimitMb !== d.memoryLimitMb ||
        before.normalizeWhitespace !== d.normalizeWhitespace || before.floatTolerance !== d.floatTolerance;
      await tx.problem.update({
        where: { id },
        data: {
          lessonId: d.lessonId, title: d.title, slug, statement: d.statement, inputFormat: d.inputFormat, outputFormat: d.outputFormat,
          constraints: d.constraints, difficulty: d.difficulty, score: d.score, timeLimitMs: d.timeLimitMs, memoryLimitMb: d.memoryLimitMb,
          starterCode: d.starterCode, explanation: d.explanation, hints: hintsFrom(d.hints),
          normalizeWhitespace: d.normalizeWhitespace, floatTolerance: d.floatTolerance,
        },
      });
      if (judgingChanged) await bumpVersion(tx, id);
      await audit(tx, actorId, "problem.update", "Problem", id, { title: d.title, newVersion: judgingChanged });
    });
    return { ok: true };
  });
}

export function setProblemPublished(actorId: string, id: string, published: boolean) {
  return guard(async () => {
    if (published) {
      const tests = await db.testCase.findMany({ where: { problemId: id }, select: { isSample: true } });
      if (!tests.some((t) => t.isSample)) return fail("Add at least one sample test case before publishing.");
      if (!tests.some((t) => !t.isSample)) return fail("Add at least one hidden test case before publishing.");
    }
    await db.$transaction(async (tx) => {
      await tx.problem.update({ where: { id }, data: { isPublished: published } });
      await audit(tx, actorId, published ? "problem.publish" : "problem.unpublish", "Problem", id);
    });
    return { ok: true };
  });
}

// --------------------------------------------------------------- test cases

export function createTestCase(actorId: string, problemId: string, input: unknown) {
  return guard<{ id: string }>(async () => {
    const p = testCaseSchema.safeParse(input);
    if (!p.success) return fail(firstIssue(p.error));
    const created = await db.$transaction(async (tx) => {
      const last = await tx.testCase.aggregate({ where: { problemId }, _max: { orderIndex: true } });
      const t = await tx.testCase.create({
        data: { problemId, inputData: p.data.inputData, expectedOutput: p.data.expectedOutput, isSample: p.data.isSample, points: p.data.points, orderIndex: p.data.orderIndex ?? (last._max.orderIndex ?? -1) + 1 },
      });
      await bumpVersion(tx, problemId);
      await audit(tx, actorId, "testcase.create", "TestCase", t.id, { problemId, isSample: t.isSample });
      return t;
    });
    return { ok: true, id: created.id };
  });
}

export function updateTestCase(actorId: string, id: string, input: unknown) {
  return guard(async () => {
    const p = testCaseSchema.safeParse(input);
    if (!p.success) return fail(firstIssue(p.error));
    await db.$transaction(async (tx) => {
      const existing = await tx.testCase.findUniqueOrThrow({ where: { id } });
      await tx.testCase.update({
        where: { id },
        data: { inputData: p.data.inputData, expectedOutput: p.data.expectedOutput, isSample: p.data.isSample, points: p.data.points, orderIndex: p.data.orderIndex ?? existing.orderIndex },
      });
      await bumpVersion(tx, existing.problemId);
      await audit(tx, actorId, "testcase.update", "TestCase", id, { problemId: existing.problemId });
    });
    return { ok: true };
  });
}

export function deleteTestCase(actorId: string, id: string) {
  return guard(async () => {
    const t = await db.testCase.findUnique({ where: { id }, include: { problem: { select: { isPublished: true } } } });
    if (!t) return fail("Record not found.");
    // Historical results reference the test case; deleting it would erase audit evidence.
    if ((await db.submissionResult.count({ where: { testCaseId: id } })) > 0) {
      return fail("This test case has historical submission results and cannot be deleted. Edit it instead; the previous version is kept in the problem history.");
    }
    if (t.problem.isPublished) {
      const others = await db.testCase.findMany({ where: { problemId: t.problemId, NOT: { id } }, select: { isSample: true } });
      if (!others.some((o) => o.isSample) || !others.some((o) => !o.isSample)) return fail("Unpublish the problem first: it needs at least one sample and one hidden test.");
    }
    await db.$transaction(async (tx) => {
      await tx.testCase.delete({ where: { id } });
      await bumpVersion(tx, t.problemId);
      await audit(tx, actorId, "testcase.delete", "TestCase", id, { problemId: t.problemId });
    });
    return { ok: true };
  });
}

// -------------------------------------------------------------------- users

/**
 * True if some active admin other than `exceptId` exists. Locks the admin rows first so two admins
 * removing each other concurrently are serialised and the second one sees the first one's change.
 */
async function otherActiveAdmin(tx: Prisma.TransactionClient, exceptId: string) {
  await tx.$queryRaw`SELECT id FROM "User" WHERE role = 'ADMIN'::"Role" AND "isActive" ORDER BY id FOR UPDATE`;
  return (await tx.user.count({ where: { role: "ADMIN", isActive: true, NOT: { id: exceptId } } })) > 0;
}

export function createUser(actorId: string, input: unknown) {
  return guard<{ id: string }>(async () => {
    const p = userCreateSchema.safeParse(input);
    if (!p.success) return fail(firstIssue(p.error));
    const passwordHash = await hashPassword(p.data.password);
    const u = await db.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { username: p.data.username, email: p.data.email, passwordHash, role: p.data.role } });
      await audit(tx, actorId, "user.create", "User", user.id, { username: user.username, role: user.role });
      return user;
    });
    return { ok: true, id: u.id };
  });
}

export function setUserActive(actorId: string, id: string, active: boolean) {
  return guard(async () => {
    if (id === actorId) return fail("You cannot change your own active status.");
    await db.$transaction(async (tx) => {
      const target = await tx.user.findUniqueOrThrow({ where: { id } });
      if (!active && target.role === "ADMIN" && !(await otherActiveAdmin(tx, id))) throw new UserError("At least one active admin must remain.");
      await tx.user.update({ where: { id }, data: { isActive: active } });
      if (!active) await tx.userSession.deleteMany({ where: { userId: id } }); // sign them out everywhere
      await audit(tx, actorId, active ? "user.activate" : "user.deactivate", "User", id);
    });
    return { ok: true };
  });
}

export function setUserRole(actorId: string, id: string, role: "STUDENT" | "ADMIN") {
  return guard(async () => {
    if (id === actorId) return fail("You cannot change your own role.");
    await db.$transaction(async (tx) => {
      const target = await tx.user.findUniqueOrThrow({ where: { id } });
      if (role === "STUDENT" && target.role === "ADMIN" && !(await otherActiveAdmin(tx, id))) throw new UserError("At least one active admin must remain.");
      await tx.user.update({ where: { id }, data: { role } });
      await audit(tx, actorId, "user.role", "User", id, { from: target.role, to: role });
    });
    return { ok: true };
  });
}

export function resetUserPassword(actorId: string, id: string, newPassword: unknown) {
  return guard(async () => {
    const p = passwordSchema.safeParse(newPassword);
    if (!p.success) return fail(firstIssue(p.error));
    const passwordHash = await hashPassword(p.data);
    await db.$transaction(async (tx) => {
      await tx.user.update({ where: { id }, data: { passwordHash } });
      await tx.userSession.deleteMany({ where: { userId: id } });
      await audit(tx, actorId, "user.password_reset", "User", id); // the password itself is never logged
    });
    return { ok: true };
  });
}
