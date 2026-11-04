import "server-only";
import { db } from "@/lib/db";
import { computeStreak } from "./streak";

const DAY_MS = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function getDashboardData(userId: string) {
  const since = new Date(Date.now() - 14 * DAY_MS);
  const [progress, totalProblems, submissions, recent, lessons] = await Promise.all([
    db.userProgress.findMany({ where: { userId }, include: { problem: true } }),
    db.problem.count({ where: { isPublished: true } }),
    db.submission.findMany({ where: { userId }, select: { createdAt: true, status: true } }),
    db.submission.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 5,
      include: { problem: { select: { title: true, slug: true } } },
    }),
    db.lesson.findMany({
      where: { isPublished: true },
      orderBy: { orderIndex: "asc" },
      include: { problems: { where: { isPublished: true }, orderBy: { number: "asc" } } },
    }),
  ]);

  const solvedIds = new Set(progress.filter((p) => p.solved).map((p) => p.problemId));
  const accepted = submissions.filter((s) => s.status === "ACCEPTED").length;

  const activity = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(since.getTime() + (i + 1) * DAY_MS);
    const key = dayKey(day);
    return { day: key, count: submissions.filter((s) => dayKey(s.createdAt) === key).length };
  });

  const continueLesson = lessons.find((l) => l.problems.some((p) => !solvedIds.has(p.id))) ?? null;
  const recommended = lessons
    .flatMap((l) => l.problems)
    .filter((p) => !solvedIds.has(p.id))
    .slice(0, 4);

  return {
    solved: solvedIds.size,
    totalProblems,
    totalScore: progress.reduce((sum, p) => sum + p.bestScore, 0),
    streak: computeStreak(submissions.map((s) => s.createdAt)),
    acceptanceRate: submissions.length ? Math.round((accepted / submissions.length) * 100) : null,
    overallPercent: totalProblems ? Math.round((solvedIds.size / totalProblems) * 100) : 0,
    continueLesson: continueLesson && {
      title: continueLesson.title,
      slug: continueLesson.slug,
      next: continueLesson.problems.find((p) => !solvedIds.has(p.id))!,
    },
    recommended,
    recent,
    activity,
  };
}

export async function getLessonsWithProgress(userId: string) {
  const [lessons, progress] = await Promise.all([
    db.lesson.findMany({
      where: { isPublished: true },
      orderBy: { orderIndex: "asc" },
      include: { problems: { where: { isPublished: true }, orderBy: { number: "asc" } } },
    }),
    db.userProgress.findMany({ where: { userId, solved: true }, select: { problemId: true } }),
  ]);
  const solved = new Set(progress.map((p) => p.problemId));
  return lessons.map((l) => {
    const done = l.problems.filter((p) => solved.has(p.id)).length;
    return {
      ...l,
      solvedIds: solved,
      done,
      percent: l.problems.length ? Math.round((done / l.problems.length) * 100) : 0,
    };
  });
}
