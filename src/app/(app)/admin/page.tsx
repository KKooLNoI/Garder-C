import { Card, CardHeader, PageHeader, Stat, StatusBadge } from "@/components/ui/primitives";
import { getAdminStats } from "@/modules/admin/stats";

export default async function AdminPage() {
  const s = await getAdminStats();
  const max = Math.max(1, ...s.activity.map((a) => a.count));
  return (
    <>
      <PageHeader title="Admin dashboard" description="Platform activity and submission statistics." />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Stat label="Users" value={s.users} hint={`${s.activeUsers} active this week`} />
        <Stat label="Lessons" value={s.lessons} />
        <Stat label="Problems" value={s.problems} />
        <Stat label="Submissions" value={s.submissions} />
        <Stat label="In queue" value={s.queued} />
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader title="Submissions, last 14 days" />
          <div className="flex h-28 items-end gap-1 p-4" aria-label="Submissions per day">
            {s.activity.map((a) => (
              <div key={a.day} className="flex-1" title={`${a.day}: ${a.count}`}>
                <div className="w-full rounded-sm bg-primary" style={{ height: `${a.count ? Math.max(6, (a.count / max) * 88) : 2}px`, opacity: a.count ? 1 : 0.2 }} />
              </div>
            ))}
          </div>
        </Card>
        <Card>
          <CardHeader title="Submissions by status" />
          <ul className="divide-y">
            {s.byStatus.length === 0 && <li className="p-4 text-sm text-muted">No submissions yet.</li>}
            {s.byStatus.map((r) => (
              <li key={r.status} className="flex justify-between px-4 py-2">
                <StatusBadge status={r.status} />
                <span className="tabular-nums">{r._count._all}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mt-3 overflow-hidden">
        <CardHeader title="Per-problem acceptance" />
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface text-xs text-muted">
            <tr>
              {["#", "Problem", "Submissions", "Accepted", "Rate"].map((h) => (
                <th key={h} className="px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {s.problemStats.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No submissions yet.</td></tr>}
            {s.problemStats.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-2 tabular-nums text-muted">{p.number}</td>
                <td className="px-4 py-2">{p.title}</td>
                <td className="px-4 py-2 tabular-nums">{p.total}</td>
                <td className="px-4 py-2 tabular-nums">{p.accepted}</td>
                <td className="px-4 py-2 tabular-nums">{p.rate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
