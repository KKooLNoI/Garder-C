import { Card, PageHeader } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { judge0ConfigFromEnv } from "@/modules/judge/judge0";

/** Read-only operational status. Never prints URLs, tokens or other environment values. */
export default async function SystemPage() {
  const configured = judge0ConfigFromEnv() !== null;
  let dbOk = true;
  let pending = 0;
  let running = 0;
  let oldestPendingSec: number | null = null;
  try {
    const [p, r, oldest] = await Promise.all([
      db.submission.count({ where: { status: "PENDING" } }),
      db.submission.count({ where: { status: "RUNNING" } }),
      db.submission.findFirst({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" }, select: { createdAt: true } }),
    ]);
    pending = p;
    running = r;
    oldestPendingSec = oldest ? Math.round((Date.now() - oldest.createdAt.getTime()) / 1000) : null;
  } catch {
    dbOk = false;
  }
  const rows: [string, string, boolean | null][] = [
    ["Database", dbOk ? "reachable" : "unreachable", dbOk],
    ["Judge (JUDGE0_URL)", configured ? "configured" : "not configured: Run and Submit are disabled", configured],
    ["Queue", `${pending} pending, ${running} running`, null],
    ["Oldest pending submission", oldestPendingSec === null ? "none" : `${oldestPendingSec}s old${pending > 0 && oldestPendingSec > 60 ? " (is the worker running?)" : ""}`, oldestPendingSec === null || oldestPendingSec <= 60],
    ["Session lifetime", `${process.env.SESSION_TTL_DAYS ?? 14} days`, null],
  ];
  return (
    <>
      <PageHeader title="System" description="Status only. Configuration is changed through environment variables." />
      <Card className="divide-y">
        {rows.map(([k, v, ok]) => (
          <div key={k} className="flex justify-between px-4 py-3 text-sm">
            <span className="text-muted">{k}</span>
            <span className={ok === null ? "" : ok ? "text-success" : "text-danger"}>{v}</span>
          </div>
        ))}
      </Card>
    </>
  );
}
