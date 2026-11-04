import Link from "next/link";
import { Card, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";

export default async function SubmissionsPage() {
  const user = await requireUser();
  const submissions = await db.submission.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { problem: { select: { title: true, slug: true } } },
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Submissions" description="Your 100 most recent submissions." />
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface text-xs text-muted">
            <tr>
              {["Problem", "Submitted", "Status", "Score", "Time", "Memory", "Source"].map((h) => (
                <th key={h} className="px-4 py-2 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {submissions.length === 0 && (
              <tr><td colSpan={7}className="px-4 py-6 text-center text-muted">No submissions yet.</td></tr>
            )}
            {submissions.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-2.5"><Link href={`/problems/${s.problem.slug}`} className="hover:underline">{s.problem.title}</Link></td>
                <td className="px-4 py-2.5 text-muted">{s.createdAt.toISOString().replace("T", " ").slice(0, 16)}</td>
                <td className="px-4 py-2.5"><StatusBadge status={s.status} /></td>
                <td className="px-4 py-2.5 tabular-nums">{s.score}</td>
                <td className="px-4 py-2.5 tabular-nums">{s.executionTimeMs === null ? "—" : `${s.executionTimeMs} ms`}</td>
                <td className="px-4 py-2.5 tabular-nums">{s.memoryUsedKb === null ? "—" : `${s.memoryUsedKb} KB`}</td>
                <td className="px-4 py-2.5"><Link href={`/submissions/${s.id}`} className="underline">View</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
