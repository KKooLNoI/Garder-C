import { Prisma, type Role, type SubmissionStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { MAX_SOURCE_BYTES } from "@/modules/editor/service";
import type { JudgeClient, RunOutcome } from "@/modules/judge/types";
import { outputsMatch } from "./compare";
import { summarize, type TestVerdict } from "./scoring";

const MAX_IN_FLIGHT_PER_USER = 3;
/** A RUNNING submission older than this is assumed to belong to a crashed worker. */
export const STALE_RUNNING_MS = 3 * 60_000;

const submitSchema = z.object({
  slug: z.string().min(1).max(100),
  sourceCode: z
    .string()
    .refine((s) => s.trim().length > 0, "Source code is empty.")
    .refine((s) => Buffer.byteLength(s, "utf8") <= MAX_SOURCE_BYTES, "Source code exceeds 64 KB."),
});

export type SubmitError = {
  ok: false;
  code: "INVALID" | "NOT_FOUND" | "RATE_LIMITED" | "TOO_MANY_PENDING" | "JUDGE_NOT_CONFIGURED";
  message: string;
};
const fail = (code: SubmitError["code"], message: string): SubmitError => ({ ok: false, code, message });

export async function createSubmission(userId: string, judgeConfigured: boolean, input: unknown) {
  const parsed = submitSchema.safeParse(input);
  if (!parsed.success) return fail("INVALID", parsed.error.issues[0].message);
  if (!judgeConfigured) return fail("JUDGE_NOT_CONFIGURED", "The judge service is not configured. Ask an administrator to set JUDGE0_URL.");
  if (!rateLimit(`submit:${userId}`, 10, 60_000)) return fail("RATE_LIMITED", "Too many submissions. Wait a moment.");

  const problem = await db.problem.findFirst({
    where: { slug: parsed.data.slug, isPublished: true },
    select: { id: true, version: true },
  });
  if (!problem) return fail("NOT_FOUND", "Problem not found.");

  const inFlight = await db.submission.count({ where: { userId, status: { in: ["PENDING", "RUNNING"] } } });
  if (inFlight >= MAX_IN_FLIGHT_PER_USER) return fail("TOO_MANY_PENDING", "You have several submissions still being judged. Wait for them to finish.");

  const submission = await db.submission.create({
    data: { userId, problemId: problem.id, problemVersion: problem.version, sourceCode: parsed.data.sourceCode, status: "PENDING" },
    select: { id: true },
  });
  return { ok: true as const, id: submission.id };
}

export interface SubmissionView {
  id: string;
  problemTitle: string;
  problemSlug: string;
  status: SubmissionStatus;
  score: number;
  maxScore: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
  compilerMessage: string | null;
  sourceCode: string;
  createdAt: Date;
  /** Hidden tests expose status and resource usage only, never input or expected output. */
  results: { n: number; isSample: boolean; status: SubmissionStatus; timeMs: number | null; memoryKb: number | null }[];
}

/** Returns null for both "missing" and "not yours" so ids cannot be probed. */
export async function getSubmissionView(userId: string, role: Role, id: string): Promise<SubmissionView | null> {
  if (!z.string().uuid().safeParse(id).success) return null;
  const s = await db.submission.findUnique({
    where: { id },
    include: {
      problem: { select: { title: true, slug: true, score: true } },
      results: { include: { testCase: { select: { isSample: true, orderIndex: true } } } },
    },
  });
  if (!s || (s.userId !== userId && role !== "ADMIN")) return null;
  return {
    id: s.id,
    problemTitle: s.problem.title,
    problemSlug: s.problem.slug,
    status: s.status,
    score: s.score,
    maxScore: s.problem.score,
    executionTimeMs: s.executionTimeMs,
    memoryUsedKb: s.memoryUsedKb,
    compilerMessage: s.compilerMessage,
    sourceCode: s.sourceCode,
    createdAt: s.createdAt,
    results: s.results
      .sort((a, b) => a.testCase.orderIndex - b.testCase.orderIndex)
      .map((r, i) => ({ n: i + 1, isSample: r.testCase.isSample, status: r.status, timeMs: r.executionTimeMs, memoryKb: r.memoryUsedKb })),
  };
}

// ---------------------------------------------------------------- worker side

/** Atomically claims the oldest PENDING submission. Safe with several workers (SKIP LOCKED). */
export async function claimNextSubmission(): Promise<string | null> {
  const rows = await db.$queryRaw<{ id: string }[]>`
    UPDATE "Submission" SET status = 'RUNNING'::"SubmissionStatus", "startedAt" = now()
    WHERE id = (
      SELECT id FROM "Submission" WHERE status = 'PENDING'::"SubmissionStatus"
      ORDER BY "createdAt" FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING id`;
  return rows[0]?.id ?? null;
}

/** Fails submissions whose worker died mid-run, so they never sit in RUNNING forever. */
export async function failStaleSubmissions(now = new Date()): Promise<number> {
  const { count } = await db.submission.updateMany({
    where: { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } },
    data: { status: "SYSTEM_ERROR", compilerMessage: "Judging was interrupted. Please submit again." },
  });
  return count;
}

function verdictFor(outcome: RunOutcome, matches: boolean): SubmissionStatus {
  switch (outcome.status) {
    case "OK":
      return matches ? "ACCEPTED" : "WRONG_ANSWER";
    default:
      return outcome.status; // remaining RunStatus names are valid SubmissionStatus names
  }
}

/** Marks a RUNNING submission as SYSTEM_ERROR. Never produces ACCEPTED. */
async function markSystemError(id: string, message: string) {
  await db.submission.updateMany({
    where: { id, status: "RUNNING" },
    data: { status: "SYSTEM_ERROR", score: 0, compilerMessage: message },
  });
}

/**
 * Grades a RUNNING submission against ALL of its problem's test cases (hidden included),
 * then writes results, final verdict and progress in one transaction. The verdict is only
 * persisted inside that transaction, so a DB failure can never leave a false ACCEPTED.
 */
export async function gradeSubmission(id: string, judge: JudgeClient): Promise<SubmissionStatus> {
  const submission = await db.submission.findUnique({
    where: { id },
    include: { problem: { include: { testCases: { orderBy: { orderIndex: "asc" } } } } },
  });
  if (!submission || submission.status !== "RUNNING") throw new Error(`Submission ${id} is not RUNNING`);
  const { problem } = submission;

  const verdicts: (TestVerdict & { testCaseId: string })[] = [];
  let compilerMessage: string | null = null;
  try {
    if (problem.testCases.length === 0) throw new Error("Problem has no test cases");
    for (const t of problem.testCases) {
      const outcome = await judge.run(submission.sourceCode, t.inputData, problem);
      const matches = outcome.status === "OK" && outputsMatch(outcome.stdout, t.expectedOutput, problem);
      verdicts.push({ testCaseId: t.id, status: verdictFor(outcome, matches), points: t.points, timeMs: outcome.timeMs, memoryKb: outcome.memoryKb });
      if (outcome.status === "COMPILATION_ERROR") {
        compilerMessage = outcome.compileOutput.slice(0, 4000);
        break; // every remaining test would fail identically
      }
    }
  } catch (e) {
    console.error(`judge failure for submission ${id}`, e);
    await markSystemError(id, "The judge service failed. Please submit again.").catch((err) => console.error("could not record SYSTEM_ERROR", err));
    return "SYSTEM_ERROR";
  }

  const totalPoints = problem.testCases.reduce((s, t) => s + t.points, 0);
  const summary = summarize(verdicts, totalPoints, problem.score);

  try {
    await db.$transaction(async (tx) => {
      const claimed = await tx.submission.updateMany({
        where: { id, status: "RUNNING" }, // guards against double-grading
        data: { status: summary.status, score: summary.score, executionTimeMs: summary.executionTimeMs, memoryUsedKb: summary.memoryUsedKb, compilerMessage },
      });
      if (claimed.count !== 1) throw new Error("Submission was already finalised");
      await tx.submissionResult.createMany({
        data: verdicts.map((v) => ({ submissionId: id, testCaseId: v.testCaseId, status: v.status, executionTimeMs: v.timeMs, memoryUsedKb: v.memoryKb })),
      });
      await recordProgress(tx, submission.userId, problem.id, problem.lessonId, summary.status === "ACCEPTED", summary.score);
    });
  } catch (e) {
    console.error(`could not persist result for submission ${id}`, e);
    await markSystemError(id, "Saving the result failed. Please submit again.").catch((err) => console.error("could not record SYSTEM_ERROR", err));
    return "SYSTEM_ERROR";
  }
  return summary.status;
}

/** Atomic upsert, so concurrent submissions by one user cannot lose attempts or lower bestScore. */
async function recordProgress(tx: Prisma.TransactionClient, userId: string, problemId: string, lessonId: string, accepted: boolean, score: number) {
  await tx.$executeRaw`
    INSERT INTO "UserProgress" (id, "userId", "problemId", solved, "bestScore", attempts, "solvedAt")
    VALUES (gen_random_uuid(), ${userId}::uuid, ${problemId}::uuid, ${accepted}, ${score}, 1, CASE WHEN ${accepted} THEN now() ELSE NULL END)
    ON CONFLICT ("userId", "problemId") DO UPDATE SET
      attempts = "UserProgress".attempts + 1,
      "bestScore" = GREATEST("UserProgress"."bestScore", EXCLUDED."bestScore"),
      solved = "UserProgress".solved OR EXCLUDED.solved,
      "solvedAt" = COALESCE("UserProgress"."solvedAt", EXCLUDED."solvedAt")`;

  if (accepted) {
    const unsolved = await tx.problem.count({
      where: { lessonId, isPublished: true, progress: { none: { userId, solved: true } } },
    });
    if (unsolved === 0) {
      await tx.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId } },
        update: {},
        create: { userId, lessonId, completed: true, completedAt: new Date() },
      });
    }
  }
}

/** One worker iteration. Returns false when the queue was empty. */
export async function processNext(judge: JudgeClient): Promise<boolean> {
  const id = await claimNextSubmission();
  if (!id) return false;
  await gradeSubmission(id, judge);
  return true;
}
