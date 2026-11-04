import Link from "next/link";
import { Badge, Card, DifficultyBadge, PageHeader } from "@/components/ui/primitives";
import { db } from "@/lib/db";

export default async function AdminProblemsPage() {
  const problems = await db.problem.findMany({
    orderBy: { number: "asc" },
    include: { lesson: { select: { title: true } }, testCases: { select: { isSample: true } } },
  });
  return (
    <>
      <div className="flex items-start justify-between">
        <PageHeader title="Problems" description="Open a problem to edit its statement, limits and test cases." />
        <Link href="/admin/problems/new" className="inline-flex h-9 items-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground">New problem</Link>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface text-xs text-muted">
            <tr>{["#", "Title", "Lesson", "Difficulty", "Tests (sample / hidden)", "Version", "Status"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {problems.map((p) => (
              <tr key={p.id} className="hover:bg-surface">
                <td className="px-4 py-2.5 tabular-nums text-muted">{p.number}</td>
                <td className="px-4 py-2.5"><Link href={`/admin/problems/${p.id}`} className="font-medium hover:underline">{p.title}</Link></td>
                <td className="px-4 py-2.5 text-muted">{p.lesson.title}</td>
                <td className="px-4 py-2.5"><DifficultyBadge value={p.difficulty} /></td>
                <td className="px-4 py-2.5 tabular-nums">{p.testCases.filter((t) => t.isSample).length} / {p.testCases.filter((t) => !t.isSample).length}</td>
                <td className="px-4 py-2.5 tabular-nums">v{p.version}</td>
                <td className="px-4 py-2.5"><Badge tone={p.isPublished ? "success" : "neutral"}>{p.isPublished ? "published" : "draft"}</Badge></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
