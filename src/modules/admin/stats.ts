import { db } from "@/lib/db";

const DAY_MS = 86_400_000;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);

export async function getAdminStats(now = new Date()) {
  const since = new Date(now.getTime() - 14 * DAY_MS);
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const [users, lessons, problems, submissions, byStatus, recent, perProblem, activeUsers, queued] = await Promise.all([
    db.user.count(),
    db.lesson.count(),
    db.problem.count(),
    db.submission.count(),
    db.submission.groupBy({ by: ["status"], _count: { _all: true } }),
    db.submission.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
    db.submission.groupBy({ by: ["problemId", "status"], _count: { _all: true } }),
    db.submission.findMany({ where: { createdAt: { gte: weekAgo } }, select: { userId: true }, distinct: ["userId"] }),
    db.submission.count({ where: { status: { in: ["PENDING", "RUNNING"] } } }),
  ]);

  const activity = Array.from({ length: 14 }, (_, i) => {
    const key = dayKey(new Date(since.getTime() + (i + 1) * DAY_MS));
    return { day: key, count: recent.filter((s) => dayKey(s.createdAt) === key).length };
  });

  const tally = new Map<string, { total: number; accepted: number }>();
  for (const row of perProblem) {
    const t = tally.get(row.problemId) ?? { total: 0, accepted: 0 };
    t.total += row._count._all;
    if (row.status === "ACCEPTED") t.accepted += row._count._all;
    tally.set(row.problemId, t);
  }
  const titles = new Map((await db.problem.findMany({ select: { id: true, title: true, number: true } })).map((p) => [p.id, p]));
  const problemStats = [...tally.entries()]
    .map(([id, t]) => ({ id, number: titles.get(id)?.number ?? 0, title: titles.get(id)?.title ?? "?", ...t, rate: Math.round((t.accepted / t.total) * 100) }))
    .sort((a, b) => a.number - b.number);

  return { users, lessons, problems, submissions, byStatus, activity, activeUsers: activeUsers.length, queued, problemStats };
}
