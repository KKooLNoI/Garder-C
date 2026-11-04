import { Check, Field, Select, TextArea, TextInput } from "./fields";

export interface ProblemDefaults {
  lessonId?: string;
  title?: string;
  slug?: string;
  statement?: string;
  inputFormat?: string;
  outputFormat?: string;
  constraints?: string;
  difficulty?: string;
  score?: number;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  starterCode?: string;
  explanation?: string;
  hints?: string[];
  normalizeWhitespace?: boolean;
  floatTolerance?: number | null;
}

export function ProblemFields({ lessons, d = {} }: { lessons: { id: string; title: string }[]; d?: ProblemDefaults }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <Field label="Title"><TextInput name="title" required defaultValue={d.title} /></Field>
      <Field label="Slug (optional)"><TextInput name="slug" defaultValue={d.slug} /></Field>
      <Field label="Lesson">
        <Select name="lessonId" required defaultValue={d.lessonId ?? ""}>
          <option value="" disabled>Choose…</option>
          {lessons.map((l) => <option key={l.id} value={l.id}>{l.title}</option>)}
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Difficulty">
          <Select name="difficulty" defaultValue={d.difficulty ?? "EASY"}>
            <option value="EASY">Easy</option><option value="MEDIUM">Medium</option><option value="HARD">Hard</option>
          </Select>
        </Field>
        <Field label="Score"><TextInput name="score" type="number" min={1} max={1000} defaultValue={d.score ?? 10} /></Field>
      </div>
      <Field label="Statement" className="sm:col-span-2"><TextArea name="statement" rows={5} required defaultValue={d.statement} /></Field>
      <Field label="Input format"><TextArea name="inputFormat" rows={2} required defaultValue={d.inputFormat} /></Field>
      <Field label="Output format"><TextArea name="outputFormat" rows={2} required defaultValue={d.outputFormat} /></Field>
      <Field label="Constraints" className="sm:col-span-2"><TextArea name="constraints" rows={2} required defaultValue={d.constraints} /></Field>
      <Field label="Time limit (ms)"><TextInput name="timeLimitMs" type="number" min={100} max={10000} defaultValue={d.timeLimitMs ?? 1000} /></Field>
      <Field label="Memory limit (MB)"><TextInput name="memoryLimitMb" type="number" min={16} max={512} defaultValue={d.memoryLimitMb ?? 64} /></Field>
      <Field label="Starter code" className="sm:col-span-2"><TextArea name="starterCode" rows={6} mono defaultValue={d.starterCode} /></Field>
      <Field label="Hints (one per line)"><TextArea name="hints" rows={3} defaultValue={(d.hints ?? []).join("\n")} /></Field>
      <Field label="Explanation"><TextArea name="explanation" rows={3} defaultValue={d.explanation} /></Field>
      <div className="space-y-2">
        <Check name="normalizeWhitespace" label="Ignore trailing whitespace when comparing output" defaultChecked={d.normalizeWhitespace ?? true} />
        <Field label="Float tolerance (empty = exact text)" hint="e.g. 0.000001 compares numbers approximately.">
          <TextInput name="floatTolerance" defaultValue={d.floatTolerance ?? ""} />
        </Field>
      </div>
    </div>
  );
}
