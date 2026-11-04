import { ActionForm } from "@/components/ui/action-form";
import { Card, PageHeader } from "@/components/ui/primitives";
import { SubmitButton } from "@/components/admin/fields";
import { ProblemFields } from "@/components/admin/problem-fields";
import { db } from "@/lib/db";
import { createProblemAction } from "@/modules/admin/actions";

export default async function NewProblemPage() {
  const lessons = await db.lesson.findMany({ orderBy: { orderIndex: "asc" }, select: { id: true, title: true } });
  return (
    <>
      <PageHeader title="New problem" description="Created as a draft. Add sample and hidden test cases, then publish." />
      <Card className="p-4">
        <ActionForm action={createProblemAction}>
          <ProblemFields lessons={lessons} d={{ starterCode: "#include <stdio.h>\n\nint main(void) {\n    return 0;\n}\n" }} />
          <div className="mt-4"><SubmitButton>Create problem</SubmitButton></div>
        </ActionForm>
      </Card>
    </>
  );
}
