import { Card, PageHeader } from "@/components/ui/primitives";
import { requireUser } from "@/modules/auth/session";

export default async function SettingsPage() {
  const user = await requireUser();
  const rows = [
    ["Username", user.username],
    ["Email", user.email],
    ["Role", user.role.toLowerCase()],
  ];
  return (
    <div className="mx-auto max-w-2xl p-6">
      <PageHeader title="Settings" description="Account details. Password changes are handled by an administrator." />
      <Card className="divide-y">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">{k}</span>
            <span>{v}</span>
          </div>
        ))}
      </Card>
    </div>
  );
}
