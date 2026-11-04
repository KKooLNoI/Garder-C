import Link from "next/link";
import { Card, CardHeader, DifficultyBadge, PageHeader, ProgressBar, Stat, StatusBadge } from "@/components/ui/primitives";
import { requireUser } from "@/modules/auth/session";
import { getDashboardData } from "@/modules/progress/stats";

export default async function DashboardPage() {
  const user = await requireUser();
  const d = await getDashboardData(user.id);
  const maxActivity = Math.max(1, ...d.activity.map((a) => a.count));

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title={`Welcome back, ${user.username}`} description="Here is where you left off." />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Problems solved" value={`${d.solved} / ${d.totalProblems}`} />
        <Stat label="Total score" value={d.totalScore} />
        <Stat label="Learning streak" value={`${d.streak} day${d.streak === 1 ? "" : "s"}`} />
        <Stat label="Acceptance rate" value={d.acceptanceRate === null ? "—" : `${d.acceptanceRate}%`} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Overall progress" />
          <div className="space-y-4 p-4">
            <div>
              <div className="mb-1.5 flex justify-between text-xs text-muted">
                <span>Course completion</span>
                <span>{d.overallPercent}%</span>
              </div>
              <ProgressBar value={d.overallPercent} />
            </div>
            <div>
              <div className="mb-2 text-xs text-muted">Submissions, last 14 days</div>
              <div className="flex h-24 items-end gap-1" aria-label="Learning activity chart">
                {d.activity.map((a) => (
                  <div key={a.day} className="flex-1" title={`${a.day}: ${a.count}`}>
                    <div
                      className="w-full rounded-sm bg-primary"
                      style={{ height: `${a.count ? Math.max(6, (a.count / maxActivity) * 96) : 2}px`, opacity: a.count ? 1 : 0.2 }}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="Continue learning" />
          <div className="p-4 text-sm">
            {d.continueLesson ? (
              <>
                <div className="font-medium">{d.continueLesson.title}</div>
                <div className="mt-1 text-muted">Next: {d.continueLesson.next.title}</div>
                <Link href={`/problems/${d.continueLesson.next.slug}`} className="mt-3 inline-block text-sm underline">
                  Open problem
                </Link>
              </>
            ) : (
              <span className="text-muted">You have solved every available problem.</span>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Recommended problems" />
          <ul className="divide-y">
            {d.recommended.length === 0 && <li className="p-4 text-sm text-muted">Nothing left to recommend.</li>}
            {d.recommended.map((p) => (
              <li key={p.id} className="flex items-center justify-between px-4 py-2.5">
                <Link href={`/problems/${p.slug}`} className="hover:underline">
                  {p.number}. {p.title}
                </Link>
                <DifficultyBadge value={p.difficulty} />
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardHeader title="Recent submissions" action={<Link href="/submissions" className="text-xs text-muted hover:underline">View all</Link>} />
          <ul className="divide-y">
            {d.recent.length === 0 && <li className="p-4 text-sm text-muted">No submissions yet.</li>}
            {d.recent.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-2.5">
                <Link href={`/problems/${s.problem.slug}`} className="hover:underline">
                  {s.problem.title}
                </Link>
                <StatusBadge status={s.status} />
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </div>
  );
}
