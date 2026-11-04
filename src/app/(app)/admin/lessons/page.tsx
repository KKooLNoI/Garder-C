import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ActionForm } from "@/components/ui/action-form";
import { Field, SubmitButton, TextArea, TextInput } from "@/components/admin/fields";
import { db } from "@/lib/db";
import { createLessonAction, deleteLessonAction, lessonPublishAction, updateLessonAction } from "@/modules/admin/actions";

export default async function AdminLessonsPage() {
  const lessons = await db.lesson.findMany({ orderBy: { orderIndex: "asc" }, include: { _count: { select: { problems: true } } } });
  const nextOrder = (lessons.at(-1)?.orderIndex ?? 0) + 1;

  return (
    <>
      <PageHeader title="Lessons" description="New lessons start unpublished. Archiving hides a lesson from students without deleting anything." />
      <Card className="mb-4">
        <CardHeader title="New lesson" />
        <ActionForm action={createLessonAction} className="grid gap-3 p-4 sm:grid-cols-2">
          <Field label="Title"><TextInput name="title" required maxLength={120} /></Field>
          <Field label="Slug (optional)" hint="Generated from the title if empty."><TextInput name="slug" /></Field>
          <Field label="Description" className="sm:col-span-2"><TextInput name="description" required maxLength={500} /></Field>
          <Field label="Content (shown on the lesson page)" className="sm:col-span-2"><TextArea name="content" rows={3} /></Field>
          <Field label="Order"><TextInput name="orderIndex" type="number" min={0} defaultValue={nextOrder} /></Field>
          <div className="flex items-end"><SubmitButton>Create lesson</SubmitButton></div>
        </ActionForm>
      </Card>

      <div className="space-y-3">
        {lessons.map((l) => (
          <Card key={l.id}>
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <span className="font-medium">{l.orderIndex}. {l.title}</span>{" "}
                <Badge tone={l.isPublished ? "success" : "neutral"}>{l.isPublished ? "published" : "archived / draft"}</Badge>
                <div className="text-xs text-muted">{l._count.problems} problem(s) · /{l.slug}</div>
              </div>
              <div className="flex gap-2">
                <ActionForm action={lessonPublishAction}>
                  <input type="hidden" name="id" value={l.id} />
                  <input type="hidden" name="publish" value={String(!l.isPublished)} />
                  <SubmitButton tone="outline">{l.isPublished ? "Archive" : "Publish"}</SubmitButton>
                </ActionForm>
                {l._count.problems === 0 && (
                  <ActionForm action={deleteLessonAction}>
                    <input type="hidden" name="id" value={l.id} />
                    <SubmitButton tone="danger">Delete</SubmitButton>
                  </ActionForm>
                )}
              </div>
            </div>
            <details className="border-t">
              <summary className="cursor-pointer px-4 py-2 text-xs text-muted">Edit</summary>
              <ActionForm action={updateLessonAction} className="grid gap-3 p-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={l.id} />
                <Field label="Title"><TextInput name="title" defaultValue={l.title} required /></Field>
                <Field label="Slug"><TextInput name="slug" defaultValue={l.slug} /></Field>
                <Field label="Description" className="sm:col-span-2"><TextInput name="description" defaultValue={l.description} required /></Field>
                <Field label="Content" className="sm:col-span-2"><TextArea name="content" rows={3} defaultValue={l.content} /></Field>
                <Field label="Order"><TextInput name="orderIndex" type="number" min={0} defaultValue={l.orderIndex} /></Field>
                <div className="flex items-end"><SubmitButton>Save</SubmitButton></div>
              </ActionForm>
            </details>
          </Card>
        ))}
      </div>
    </>
  );
}
