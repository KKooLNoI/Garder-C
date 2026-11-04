import Link from "next/link";
import { Card, DifficultyBadge, PageHeader, ProgressBar } from "@/components/ui/primitives";
import { requireUser } from "@/modules/auth/session";
import { getLessonsWithProgress } from "@/modules/progress/stats";

export default async function LearnPage() {
  const user = await requireUser();
  const lessons = await getLessonsWithProgress(user.id);

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader title="Learning path" description="Work through the chapters in order." />
      <div className="space-y-3">
        {lessons.map((l, i) => (
          <Card key={l.id}>
            <div className="flex items-center justify-between gap-4 px-4 py-3">
              <div>
                <div className="font-medium">
                  {i + 1}. {l.title}
                </div>
                <div className="text-xs text-muted">{l.description}</div>
              </div>
              <div className="w-40 shrink-0">
                <div className="mb-1 text-right text-xs text-muted">
                  {l.done} / {l.problems.length} solved
                </div>
                <ProgressBar value={l.percent} />
              </div>
            </div>
            <ul className="divide-y border-t">
              {l.problems.map((p) => (
                <li key={p.id} className="flex items-center justify-between px-4 py-2">
                  <Link href={`/problems/${p.slug}`} className="hover:underline">
                    {p.number}. {p.title}
                  </Link>
                  <span className="flex items-center gap-3">
                    <DifficultyBadge value={p.difficulty} />
                    <span className={l.solvedIds.has(p.id) ? "text-xs text-success" : "text-xs text-muted"}>
                      {l.solvedIds.has(p.id) ? "Solved" : "Unsolved"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
