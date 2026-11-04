import { notFound } from "next/navigation";
import { CodeWorkspace } from "@/components/editor/code-workspace";
import { SplitPane } from "@/components/layout/split-pane";
import { Badge, DifficultyBadge } from "@/components/ui/primitives";
import { db } from "@/lib/db";
import { requireUser } from "@/modules/auth/session";
import { getProblemForDisplay } from "@/modules/problems/queries";

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mt-5">
    <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">{title}</h3>
    <div className="whitespace-pre-wrap text-sm leading-relaxed">{children}</div>
  </section>
);

const Code = ({ children }: { children: string }) => (
  <pre className="overflow-x-auto rounded-md border bg-surface p-3 font-mono text-xs">{children || "(empty)"}</pre>
);

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const user = await requireUser();
  const { slug } = await params;
  const problem = await getProblemForDisplay(slug);
  if (!problem) notFound();

  const draft = await db.codeDraft.findUnique({
    where: { userId_problemId: { userId: user.id, problemId: problem.id } },
    select: { code: true },
  });

  const statement = (
    <div className="p-6">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">
          {problem.number}. {problem.title}
        </h1>
        <DifficultyBadge value={problem.difficulty} />
        <Badge>{problem.score} pts</Badge>
      </div>
      <div className="mt-1 text-xs text-muted">
        {problem.lesson.title} · {problem.timeLimitMs} ms · {problem.memoryLimitMb} MB
      </div>
      <Section title="Description">{problem.statement}</Section>
      <Section title="Input format">{problem.inputFormat}</Section>
      <Section title="Output format">{problem.outputFormat}</Section>
      <Section title="Constraints">{problem.constraints}</Section>
      {problem.testCases.map((t, i) => (
        <div key={t.id} className="mt-5 grid gap-3 sm:grid-cols-2">
          <div>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Sample input {i + 1}</h3>
            <Code>{t.inputData}</Code>
          </div>
          <div>
            <h3 className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted">Sample output {i + 1}</h3>
            <Code>{t.expectedOutput}</Code>
          </div>
        </div>
      ))}
      {problem.hints.length > 0 && (
        <Section title="Hints">
          {problem.hints.map((h, i) => (
            <details key={i} className="mb-1">
              <summary className="cursor-pointer text-muted">Hint {i + 1}</summary>
              <div className="mt-1">{h}</div>
            </details>
          ))}
        </Section>
      )}
    </div>
  );

  return (
    <SplitPane
      left={statement}
      right={
        <CodeWorkspace
          // Remount per problem so editor state never leaks between problems.
          key={problem.id}
          slug={problem.slug}
          starterCode={problem.starterCode}
          initialCode={draft?.code ?? problem.starterCode}
          sampleInput={problem.testCases[0]?.inputData ?? ""}
        />
      }
    />
  );
}
