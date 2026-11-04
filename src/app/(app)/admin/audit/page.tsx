import { Card, PageHeader } from "@/components/ui/primitives";
import { db } from "@/lib/db";

export default async function AuditPage() {
  const logs = await db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200, include: { actor: { select: { username: true } } } });
  return (
    <>
      <PageHeader title="Audit log" description="The 200 most recent administrative actions." />
      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface text-xs text-muted">
            <tr>{["When (UTC)", "Admin", "Action", "Entity", "Details"].map((h) => <th key={h} className="px-4 py-2 font-medium">{h}</th>)}</tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No administrative actions recorded yet.</td></tr>}
            {logs.map((l) => (
              <tr key={l.id}>
                <td className="whitespace-nowrap px-4 py-2 text-muted">{l.createdAt.toISOString().replace("T", " ").slice(0, 19)}</td>
                <td className="px-4 py-2">{l.actor?.username ?? "(deleted)"}</td>
                <td className="px-4 py-2 font-mono text-xs">{l.action}</td>
                <td className="px-4 py-2 text-xs text-muted">{l.entityType} {l.entityId?.slice(0, 8)}</td>
                <td className="max-w-xs truncate px-4 py-2 font-mono text-xs text-muted">{l.metadata ? JSON.stringify(l.metadata) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  );
}
