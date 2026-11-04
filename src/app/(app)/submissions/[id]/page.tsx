import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, CardHeader, PageHeader, StatusBadge } from "@/components/ui/primitives";
import { requireUser } from "@/modules/auth/session";
import { getSubmissionView } from "@/modules/grading/service";

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  // Returns null for missing and for other users' submissions alike.
  const s = await getSubmissionView(user.id, user.role, id);
  if (!s) notFound();

  return (
    <div className="mx-auto max-w-4xl p-6">
      <PageHeader title={s.problemTitle} description={`Submitted ${s.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC`} />
      <div className="mb-3 flex flex-wrap items-center gap-4 text-sm">
        <StatusBadge status={s.status} />
        <span>Score {s.score}/{s.maxScore}</span>
        {s.executionTimeMs !== null && <span className="text-muted">{s.executionTimeMs} ms</span>}
        {s.memoryUsedKb !== null && <span className="text-muted">{s.memoryUsedKb} KB</span>}
        <Link href={`/problems/${s.problemSlug}`} className="ml-auto underline">Open problem</Link>
      </div>

      {s.compilerMessage && (
        <Card className="mb-3">
          <CardHeader title="Compiler output" />
          <pre className="overflow-x-auto whitespace-pre-wrap p-4 font-mono text-xs text-danger">{s.compilerMessage}</pre>
        </Card>
      )}

      <Card className="mb-3">
        <CardHeader title="Source code" />
        <pre className="overflow-x-auto p-4 font-mono text-xs">{s.sourceCode}</pre>
      </Card>

      <Card>
        <CardHeader title="Test results" />
        <ul className="divide-y text-sm">
          {s.results.length === 0 && <li className="p-4 text-muted">No per-test results.</li>}
          {s.results.map((r) => (
            <li key={r.n} className="flex items-center justify-between px-4 py-2">
              <span>Test {r.n} <span className="text-muted">({r.isSample ? "sample" : "hidden"})</span></span>
              <span className="flex items-center gap-3 text-muted">
                {r.timeMs !== null && `${r.timeMs} ms`}
                {r.memoryKb !== null && `${r.memoryKb} KB`}
                <StatusBadge status={r.status} />
              </span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
