import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { outputsMatch } from "@/modules/grading/compare";
import { JudgeNotConfiguredError, type JudgeClient, type RunOutcome } from "@/modules/judge/types";

export const MAX_SOURCE_BYTES = 64 * 1024;
export const MAX_STDIN_BYTES = 16 * 1024;

const bytes = (s: string) => Buffer.byteLength(s, "utf8");
const source = z
  .string()
  .refine((s) => s.trim().length > 0, "Source code is empty.")
  .refine((s) => bytes(s) <= MAX_SOURCE_BYTES, "Source code exceeds 64 KB.");
const slug = z.string().min(1).max(100);
const stdin = z.string().refine((s) => bytes(s) <= MAX_STDIN_BYTES, "Input exceeds 16 KB.");

export type ActionError = {
  ok: false;
  code: "INVALID" | "NOT_FOUND" | "RATE_LIMITED" | "JUDGE_UNAVAILABLE" | "JUDGE_NOT_CONFIGURED";
  message: string;
};

const fail = (code: ActionError["code"], message: string): ActionError => ({ ok: false, code, message });
const isError = (r: RunOutcome | ActionError): r is ActionError => "ok" in r;

export interface SampleResult {
  index: number;
  passed: boolean;
  outcome: RunOutcome;
  input: string;
  expected: string;
}

function loadProblem(problemSlug: string) {
  return db.problem.findFirst({
    where: { slug: problemSlug, isPublished: true },
    select: { id: true, timeLimitMs: true, memoryLimitMb: true, normalizeWhitespace: true, floatTolerance: true },
  });
}

async function execute(client: JudgeClient, ...args: Parameters<JudgeClient["run"]>): Promise<RunOutcome | ActionError> {
  try {
    return await client.run(...args);
  } catch (e) {
    if (e instanceof JudgeNotConfiguredError) {
      return fail("JUDGE_NOT_CONFIGURED", "The judge service is not configured. Ask an administrator to set JUDGE0_URL.");
    }
    // Details stay in server logs; the client gets a generic message.
    console.error("judge error", e);
    return fail("JUDGE_UNAVAILABLE", "The judge service is unavailable. Please try again shortly.");
  }
}

export async function runCode(userId: string, client: JudgeClient, input: unknown) {
  const parsed = z.object({ slug, sourceCode: source, stdin }).safeParse(input);
  if (!parsed.success) return fail("INVALID", parsed.error.issues[0].message);
  if (!rateLimit(`run:${userId}`, 20, 60_000)) return fail("RATE_LIMITED", "Too many runs. Wait a moment.");

  const problem = await loadProblem(parsed.data.slug);
  if (!problem) return fail("NOT_FOUND", "Problem not found.");

  const outcome = await execute(client, parsed.data.sourceCode, parsed.data.stdin, problem);
  if (isError(outcome)) return outcome;
  return { ok: true as const, outcome };
}

/** Runs the visible sample tests only. Hidden tests are never selected here. */
export async function runSamples(userId: string, client: JudgeClient, input: unknown) {
  const parsed = z.object({ slug, sourceCode: source }).safeParse(input);
  if (!parsed.success) return fail("INVALID", parsed.error.issues[0].message);
  if (!rateLimit(`run:${userId}`, 20, 60_000)) return fail("RATE_LIMITED", "Too many runs. Wait a moment.");

  const problem = await loadProblem(parsed.data.slug);
  if (!problem) return fail("NOT_FOUND", "Problem not found.");
  const samples = await db.testCase.findMany({
    where: { problemId: problem.id, isSample: true },
    orderBy: { orderIndex: "asc" },
    select: { inputData: true, expectedOutput: true },
  });

  const results: SampleResult[] = [];
  for (const [i, t] of samples.entries()) {
    const outcome = await execute(client, parsed.data.sourceCode, t.inputData, problem);
    if (isError(outcome)) return outcome;
    const passed = outcome.status === "OK" && outputsMatch(outcome.stdout, t.expectedOutput, problem);
    results.push({ index: i + 1, passed, outcome, input: t.inputData, expected: t.expectedOutput });
    if (outcome.status === "COMPILATION_ERROR") break; // remaining samples would fail identically
  }
  return { ok: true as const, results };
}

export async function saveDraft(userId: string, input: unknown) {
  const parsed = z
    .object({ slug, code: z.string().refine((s) => bytes(s) <= MAX_SOURCE_BYTES, "Code exceeds 64 KB.") })
    .safeParse(input);
  if (!parsed.success) return fail("INVALID", parsed.error.issues[0].message);
  const problem = await loadProblem(parsed.data.slug);
  if (!problem) return fail("NOT_FOUND", "Problem not found.");
  await db.codeDraft.upsert({
    where: { userId_problemId: { userId, problemId: problem.id } },
    update: { code: parsed.data.code },
    create: { userId, problemId: problem.id, code: parsed.data.code },
  });
  return { ok: true as const };
}

export async function deleteDraft(userId: string, input: unknown) {
  const parsed = z.object({ slug }).safeParse(input);
  if (!parsed.success) return fail("INVALID", "Invalid problem.");
  const problem = await loadProblem(parsed.data.slug);
  if (!problem) return fail("NOT_FOUND", "Problem not found.");
  await db.codeDraft.deleteMany({ where: { userId, problemId: problem.id } });
  return { ok: true as const };
}
