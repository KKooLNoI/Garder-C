import Link from "next/link";
import type { Difficulty } from "@prisma/client";
import { Button, Card, DifficultyBadge, Input, PageHeader } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";
import { listProblems } from "@/modules/problems/queries";

const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;
const STATE_LABEL = { solved: "Solved", attempted: "Attempted", todo: "Unsolved" } as const;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser();
  const sp = await searchParams;
  const difficulty = DIFFICULTIES.find((d) => d === first(sp.difficulty)) as Difficulty | undefined;
  const status = first(sp.status) === "solved" || first(sp.status) === "unsolved" ? (first(sp.status) as "solved" | "unsolved") : undefined;
  const filters = { q: first(sp.q), lesson: first(sp.lesson), difficulty, status };

  const [problems, lessons] = await Promise.all([
    listProblems(user.id, filters),
    db.lesson.findMany({ where: { isPublished: true }, orderBy: { orderIndex: "asc" }, select: { slug: true, title: true } }),
  ]);

  const select = "h-9 rounded-md border bg-background px-2 text-sm";
  return (
    <div className="mx-auto max-w-6xl p-6">
      <PageHeader title="Problems" description={`${problems.length} problem${problems.length === 1 ? "" : "s"}`} />
      <form className="mb-4 flex flex-wrap items-center gap-2">
        <Input name="q" defaultValue={filters.q} placeholder="Search problems" className="w-56" />
        <select name="lesson" defaultValue={filters.lesson ?? ""} className={select}>
          <option value="">All lessons</option>
          {lessons.map((l) => (
            <option key={l.slug} value={l.slug}>{l.title}</option>
          ))}
        </select>
        <select name="difficulty" defaultValue={difficulty ?? ""} className={select}>
          <option value="">Any difficulty</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{d.charAt(0) + d.slice(1).toLowerCase()}</option>
          ))}
        </select>
        <select name="status" defaultValue={status ?? ""} className={select}>
          <option value="">Any status</option>
          <option value="solved">Solved</option>
          <option value="unsolved">Unsolved</option>
        </select>
        <Button type="submit" variant="outline">Filter</Button>
        <Link href="/problems" className="text-sm text-muted hover:underline">Reset</Link>
      </form>

      <Card className="overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-surface text-xs text-muted">
            <tr>
              <th className="w-16 px-4 py-2 font-medium">#</th>
              <th className="px-4 py-2 font-medium">Title</th>
              <th className="px-4 py-2 font-medium">Difficulty</th>
              <th className="px-4 py-2 font-medium">Score</th>
              <th className="px-4 py-2 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {problems.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-muted">No problems match your filters.</td></tr>
            )}
            {problems.map((p) => (
              <tr key={p.id} className="hover:bg-surface">
                <td className="px-4 py-2.5 tabular-nums text-muted">{p.number}</td>
                <td className="px-4 py-2.5">
                  <Link href={`/problems/${p.slug}`} className="font-medium hover:underline">{p.title}</Link>
                  <div className="text-xs text-muted">{p.lesson}</div>
                </td>
                <td className="px-4 py-2.5"><DifficultyBadge value={p.difficulty} /></td>
                <td className="px-4 py-2.5 tabular-nums">{p.score}</td>
                <td className={p.state === "solved" ? "px-4 py-2.5 text-success" : "px-4 py-2.5 text-muted"}>{STATE_LABEL[p.state]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
