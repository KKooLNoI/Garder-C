import "server-only";
import type { Difficulty, Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export interface ProblemFilters {
  q?: string;
  lesson?: string;
  difficulty?: Difficulty;
  status?: "solved" | "unsolved";
}

export async function listProblems(userId: string, f: ProblemFilters) {
  const where: Prisma.ProblemWhereInput = { isPublished: true };
  if (f.q) where.title = { contains: f.q, mode: "insensitive" };
  if (f.lesson) where.lesson = { slug: f.lesson };
  if (f.difficulty) where.difficulty = f.difficulty;
  if (f.status === "solved") where.progress = { some: { userId, solved: true } };
  if (f.status === "unsolved") where.progress = { none: { userId, solved: true } };

  const problems = await db.problem.findMany({
    where,
    orderBy: { number: "asc" },
    include: { lesson: { select: { title: true } }, progress: { where: { userId } } },
  });
  return problems.map((p) => ({
    id: p.id,
    number: p.number,
    slug: p.slug,
    title: p.title,
    lesson: p.lesson.title,
    difficulty: p.difficulty,
    score: p.score,
    state: p.progress[0]?.solved ? ("solved" as const) : p.progress[0]?.attempts ? ("attempted" as const) : ("todo" as const),
  }));
}

/**
 * Loads a problem for display. Only sample test cases are selected; hidden test
 * inputs/outputs never leave the database layer through this query.
 */
export async function getProblemForDisplay(slug: string) {
  return db.problem.findFirst({
    where: { slug, isPublished: true },
    include: {
      lesson: { select: { title: true, slug: true } },
      testCases: { where: { isSample: true }, orderBy: { orderIndex: "asc" }, select: { id: true, inputData: true, expectedOutput: true } },
    },
  });
}
