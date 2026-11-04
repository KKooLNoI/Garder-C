import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge, Card, DifficultyBadge } from "@/components/ui/primitives";
import { db } from "@/lib/db";

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-4">
    <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
    <div className="whitespace-pre-wrap text-sm leading-relaxed">{children}</div>
  </section>
);

/** Admin-only preview, including unpublished problems. Shows what students will see. */
export default async function PreviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const p = await db.problem.findUnique({
    where: { id },
    include: { lesson: { select: { title: true } }, testCases: { where: { isSample: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (!p) notFound();
  return (
    <>
      <div className="mb-3 flex items-center justify-between text-sm">
        <Badge>Preview — {p.isPublished ? "published" : "draft, not visible to students"}</Badge>
        <Link href={`/admin/problems/${id}`} className="underline">Back to editor</Link>
      </div>
      <Card className="p-6">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold tracking-tight">{p.number}. {p.title}</h1>
          <DifficultyBadge value={p.difficulty} />
          <Badge>{p.score} pts</Badge>
        </div>
        <div className="mt-1 text-xs text-muted">{p.lesson.title} · {p.timeLimitMs} ms · {p.memoryLimitMb} MB</div>
        <Block title="Description">{p.statement}</Block>
        <Block title="Input format">{p.inputFormat}</Block>
        <Block title="Output format">{p.outputFormat}</Block>
        <Block title="Constraints">{p.constraints}</Block>
        {p.testCases.map((t, i) => (
          <div key={t.id} className="mt-4 grid gap-3 sm:grid-cols-2">
            <Block title={`Sample input ${i + 1}`}><pre className="rounded-md border bg-surface p-3 font-mono text-xs">{t.inputData || "(empty)"}</pre></Block>
            <Block title={`Sample output ${i + 1}`}><pre className="rounded-md border bg-surface p-3 font-mono text-xs">{t.expectedOutput}</pre></Block>
          </div>
        ))}
        <Block title="Starter code"><pre className="rounded-md border bg-surface p-3 font-mono text-xs">{p.starterCode}</pre></Block>
      </Card>
    </>
  );
}
