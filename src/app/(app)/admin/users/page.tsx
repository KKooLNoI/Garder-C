import { Badge, Card, CardHeader, PageHeader } from "@/components/ui/primitives";
import { ActionForm } from "@/components/ui/action-form";
import { Field, Select, SubmitButton, TextInput } from "@/components/admin/fields";
import { db } from "@/lib/db";
import { createUserAction, resetPasswordAction, userActiveAction, userRoleAction } from "@/modules/admin/actions";
import { requireAdmin } from "@/modules/auth/session";

export default async function AdminUsersPage() {
  const me = await requireAdmin();
  const users = await db.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { submissions: true } }, progress: { where: { solved: true }, select: { id: true } } },
  });
  return (
    <>
      <PageHeader title="Users" description="Accounts are created by administrators; there is no public sign-up." />
      <Card className="mb-4">
        <CardHeader title="Create user" />
        <ActionForm action={createUserAction} className="grid gap-3 p-4 sm:grid-cols-5">
          <Field label="Username"><TextInput name="username" required autoComplete="off" /></Field>
          <Field label="Email"><TextInput name="email" type="email" required autoComplete="off" /></Field>
          <Field label="Initial password (min 10)"><TextInput name="password" type="password" required minLength={10} autoComplete="new-password" /></Field>
          <Field label="Role"><Select name="role" defaultValue="STUDENT"><option value="STUDENT">Student</option><option value="ADMIN">Admin</option></Select></Field>
          <div className="flex items-end"><SubmitButton>Create</SubmitButton></div>
        </ActionForm>
      </Card>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface text-xs text-muted">
            <tr>{["User", "Role", "Solved", "Submissions", "Status", "Actions"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y align-top">
            {users.map((u) => {
              const self = u.id === me.id;
              return (
                <tr key={u.id}>
                  <td className="px-4 py-2.5"><div className="font-medium">{u.username}{self && " (you)"}</div><div className="text-xs text-muted">{u.email}</div></td>
                  <td className="px-4 py-2.5">{u.role.toLowerCase()}</td>
                  <td className="px-4 py-2.5 tabular-nums">{u.progress.length}</td>
                  <td className="px-4 py-2.5 tabular-nums">{u._count.submissions}</td>
                  <td className="px-4 py-2.5"><Badge tone={u.isActive ? "success" : "danger"}>{u.isActive ? "active" : "disabled"}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="flex flex-wrap gap-2">
                      {!self && (
                        <>
                          <ActionForm action={userActiveAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="active" value={String(!u.isActive)} />
                            <SubmitButton tone="outline">{u.isActive ? "Deactivate" : "Activate"}</SubmitButton>
                          </ActionForm>
                          <ActionForm action={userRoleAction}>
                            <input type="hidden" name="id" value={u.id} />
                            <input type="hidden" name="role" value={u.role === "ADMIN" ? "STUDENT" : "ADMIN"} />
                            <SubmitButton tone="outline">{u.role === "ADMIN" ? "Make student" : "Make admin"}</SubmitButton>
                          </ActionForm>
                        </>
                      )}
                      <details>
                        <summary className="inline-flex h-8 cursor-pointer items-center rounded-md border px-3 text-sm hover:bg-surface">Reset password</summary>
                        <ActionForm action={resetPasswordAction} className="mt-2 flex gap-2">
                          <input type="hidden" name="id" value={u.id} />
                          <TextInput name="password" type="password" required minLength={10} placeholder="New password" autoComplete="new-password" />
                          <SubmitButton>Set</SubmitButton>
                        </ActionForm>
                      </details>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </>
  );
}
