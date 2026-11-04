import { Card, CardHeader, PageHeader, ProgressBar, Stat } from "@/components/ui/primitives";
import { requireUser } from "@/modules/auth/session";
import { getDashboardData, getLessonsWithProgress } from "@/modules/progress/stats";

export default async function ProgressPage() {
  const user = await requireUser();
  const [d, lessons] = await Promise.all([getDashboardData(user.id), getLessonsWithProgress(user.id)]);
  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader title="Progress" />
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Solved" value={`${d.solved} / ${d.totalProblems}`} />
        <Stat label="Total score" value={d.totalScore} />
        <Stat label="Completion" value={`${d.overallPercent}%`} />
      </div>
      <Card className="mt-3">
        <CardHeader title="By chapter" />
        <div className="space-y-4 p-4">
          {lessons.map((l) => (
            <div key={l.id}>
              <div className="mb-1.5 flex justify-between text-sm">
                <span>{l.title}</span>
                <span className="text-muted">{l.done} / {l.problems.length}</span>
              </div>
              <ProgressBar value={l.percent} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
