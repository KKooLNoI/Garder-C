import type { SubmissionStatus } from "@prisma/client";

export interface TestVerdict {
  status: SubmissionStatus;
  points: number;
  timeMs: number | null;
  memoryKb: number | null;
}

export interface Summary {
  status: SubmissionStatus;
  score: number;
  executionTimeMs: number | null;
  memoryUsedKb: number | null;
}

const max = (xs: (number | null)[]) => {
  const v = xs.filter((x): x is number => x !== null);
  return v.length ? Math.max(...v) : null;
};

/**
 * Final verdict for a submission.
 * - ACCEPTED only if every test passed (and there was at least one test).
 * - Otherwise the status of the first failing test, in test order.
 * - Score is the problem score scaled by the share of test points earned (partial credit).
 */
export function summarize(verdicts: TestVerdict[], totalPoints: number, problemScore: number): Summary {
  const failing = verdicts.find((v) => v.status !== "ACCEPTED");
  const allPassed = verdicts.length > 0 && !failing;
  const earned = verdicts.filter((v) => v.status === "ACCEPTED").reduce((s, v) => s + v.points, 0);
  return {
    status: allPassed ? "ACCEPTED" : (failing?.status ?? "SYSTEM_ERROR"),
    score: allPassed ? problemScore : totalPoints > 0 ? Math.floor((problemScore * earned) / totalPoints) : 0,
    executionTimeMs: max(verdicts.map((v) => v.timeMs)),
    memoryUsedKb: max(verdicts.map((v) => v.memoryKb)),
  };
}
