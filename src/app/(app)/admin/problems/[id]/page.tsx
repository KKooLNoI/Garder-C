import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ActionForm } from "@/components/ui/action-form";
import { Check, Field, SubmitButton, TextArea, TextInput } from "@/components/admin/fields";
import { ProblemFields } from "@/components/admin/problem-fields";
import { db } from "@/lib/db";
import {
  createTestCaseAction,
  deleteTestCaseAction,
  problemPublishAction,
  updateProblemAction,
  updateTestCaseAction,
} from "@/modules/admin/actions";

export default async function EditProblemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const [problem, lessons] = await Promise.all([
    db.problem.findUnique({
      where: { id },
      include: {
        testCases: { orderBy: { orderIndex: "asc" } },
        versions: { orderBy: { version: "desc" }, select: { version: true, createdAt: true } },
        _count: { select: { submissions: true } },
      },
    }),
    db.lesson.findMany({ orderBy: { orderIndex: "asc" }, select: { id: true, title: true } }),
  ]);
  if (!problem) notFound();

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader title={`${problem.number}. ${problem.title}`} description={`Version ${problem.version} · ${problem._count.submissions} submission(s)`} />
        <div className="flex items-center gap-2">
          <Badge tone={problem.isPublished ? "success" : "neutral"}>{problem.isPublished ? "published" : "draft"}</Badge>
          <Link href={`/admin/problems/${id}/preview`} className="inline-flex h-8 items-center rounded-md border px-3 text-sm hover:bg-surface">Preview</Link>
          <ActionForm action={problemPublishAction}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="publish" value={String(!problem.isPublished)} />
            <SubmitButton tone={problem.isPublished ? "outline" : "primary"}>{problem.isPublished ? "Unpublish" : "Publish"}</SubmitButton>
          </ActionForm>
        </div>
      </div>

      <Card className="mb-4 p-4">
        <ActionForm action={updateProblemAction}>
          <input type="hidden" name="id" value={id} />
          <ProblemFields lessons={lessons} d={problem} />
          <p className="mt-3 text-xs text-muted">Changing the statement, limits or comparison rules creates a new version; earlier versions stay in the history.</p>
          <div className="mt-3"><SubmitButton>Save problem</SubmitButton></div>
        </ActionForm>
      </Card>

      <Card className="mb-4">
        <CardHeader title={`Test cases (${problem.testCases.length})`} />
        <div className="divide-y">
          {problem.testCases.map((t, i) => (
            <details key={t.id} className="group">
              <summary className="flex cursor-pointer items-center justify-between px-4 py-2.5 text-sm">
                <span>#{i + 1} <Badge tone={t.isSample ? "success" : "neutral"}>{t.isSample ? "sample" : "hidden"}</Badge> <span className="text-muted">{t.points} pt · {JSON.stringify(t.inputData).slice(0, 40)}</span></span>
                <span className="text-xs text-muted">Edit</span>
              </summary>
              <div className="space-y-3 border-t bg-surface p-4">
                <ActionForm action={updateTestCaseAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Input"><TextArea name="inputData" rows={3} mono defaultValue={t.inputData} /></Field>
                    <Field label="Expected output"><TextArea name="expectedOutput" rows={3} mono defaultValue={t.expectedOutput} /></Field>
                    <Field label="Points"><TextInput name="points" type="number" min={1} max={100} defaultValue={t.points} /></Field>
                    <Field label="Order"><TextInput name="orderIndex" type="number" min={0} defaultValue={t.orderIndex} /></Field>
                  </div>
                  <div className="mt-3 flex items-center gap-4">
                    <Check name="isSample" label="Visible sample" defaultChecked={t.isSample} />
                    <SubmitButton>Save</SubmitButton>
                  </div>
                </ActionForm>
                <ActionForm action={deleteTestCaseAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <SubmitButton tone="danger">Delete test case</SubmitButton>
                </ActionForm>
              </div>
            </details>
          ))}
        </div>
        <details className="border-t" open={problem.testCases.length === 0}>
          <summary className="cursor-pointer px-4 py-2.5 text-sm font-medium">Add test case</summary>
          <ActionForm action={createTestCaseAction} className="p-4">
            <input type="hidden" name="problemId" value={id} />
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Input"><TextArea name="inputData" rows={3} mono /></Field>
              <Field label="Expected output" hint="Verify this value independently before saving."><TextArea name="expectedOutput" rows={3} mono /></Field>
              <Field label="Points"><TextInput name="points" type="number" min={1} max={100} defaultValue={1} /></Field>
              <Field label="Order (empty = last)"><TextInput name="orderIndex" type="number" min={0} /></Field>
            </div>
            <div className="mt-3 flex items-center gap-4">
              <Check name="isSample" label="Visible sample (otherwise hidden)" />
              <SubmitButton>Add</SubmitButton>
            </div>
          </ActionForm>
        </details>
      </Card>

      <Card>
        <CardHeader title="Version history" />
        <ul className="divide-y text-sm">
          {problem.versions.map((v) => (
            <li key={v.version} className="flex justify-between px-4 py-2">
              <span>v{v.version}{v.version === problem.version && " (current)"}</span>
              <span className="text-muted">{v.createdAt.toISOString().replace("T", " ").slice(0, 16)} UTC</span>
            </li>
          ))}
        </ul>
      </Card>
    </>
  );
}
