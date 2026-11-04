"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { Play, RotateCcw, ListChecks, Send } from "lucide-react";
import { loader, type OnMount } from "@monaco-editor/react";
import { Button } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";
import {
  deleteDraftAction,
  runCodeAction,
  runSamplesAction,
  saveDraftAction,
} from "@/modules/editor/actions";
import type { SampleResult } from "@/modules/editor/service";
import { getSubmissionAction, submitCodeAction } from "@/modules/grading/actions";
import type { RunOutcome } from "@/modules/judge/types";

type SubmissionState = Extract<Awaited<ReturnType<typeof getSubmissionAction>>, { ok: true }>["submission"];
const FINAL = (s: string) => s !== "PENDING" && s !== "RUNNING";
const POLL_MS = 1000;
const POLL_MAX = 150;

// Serve Monaco from our own origin (public/monaco, copied by scripts/copy-monaco.mjs), not a CDN.
if (typeof window !== "undefined") loader.config({ paths: { vs: "/monaco/vs" } });

const Monaco = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="p-4 text-sm text-muted">Loading editor…</div>,
});

type Tab = "input" | "output" | "samples" | "submission";
type SaveState = "idle" | "saving" | "saved" | "error";
type Message = { kind: "error" | "info"; text: string } | null;

const STATUS_TEXT: Record<RunOutcome["status"], string> = {
  OK: "Finished",
  COMPILATION_ERROR: "Compilation error",
  RUNTIME_ERROR: "Runtime error",
  TIME_LIMIT_EXCEEDED: "Time limit exceeded",
  MEMORY_LIMIT_EXCEEDED: "Memory limit exceeded",
  SYSTEM_ERROR: "System error",
};

const FONT_KEY = "cp:fontSize";

export function CodeWorkspace({
  slug,
  starterCode,
  initialCode,
  sampleInput,
}: {
  slug: string;
  starterCode: string;
  initialCode: string;
  sampleInput: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [stdin, setStdin] = useState(sampleInput);
  const [tab, setTab] = useState<Tab>("input");
  const [busy, setBusy] = useState<null | "run" | "samples">(null);
  const [submission, setSubmission] = useState<SubmissionState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const [message, setMessage] = useState<Message>(null);
  const [outcome, setOutcome] = useState<RunOutcome | null>(null);
  const [samples, setSamples] = useState<SampleResult[] | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [fontSize, setFontSize] = useState(14);
  const [dark, setDark] = useState(false);

  const codeRef = useRef(code);
  const stdinRef = useRef(stdin);
  const lastSaved = useRef(initialCode);
  codeRef.current = code;
  stdinRef.current = stdin;

  useEffect(() => {
    try {
      const f = Number(localStorage.getItem(FONT_KEY));
      if (f >= 11 && f <= 24) setFontSize(f);
    } catch {
      /* storage unavailable */
    }
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const on = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);

  // Debounced auto-save to the server.
  useEffect(() => {
    if (code === lastSaved.current) return;
    setSaveState("saving");
    const t = setTimeout(async () => {
      const r = await saveDraftAction({ slug, code }).catch(() => null);
      if (r?.ok) {
        lastSaved.current = code;
        setSaveState("saved");
      } else setSaveState("error");
    }, 1000);
    return () => clearTimeout(t);
  }, [code, slug]);

  const run = useCallback(async () => {
    setBusy("run");
    setMessage(null);
    setTab("output");
    try {
      const r = await runCodeAction({ slug, sourceCode: codeRef.current, stdin: stdinRef.current });
      if (r.ok) setOutcome(r.outcome);
      else setMessage({ kind: "error", text: r.message });
    } catch {
      setMessage({ kind: "error", text: "Request failed. Check your connection." });
    } finally {
      setBusy(null);
    }
  }, [slug]);

  const runSamples = useCallback(async () => {
    setBusy("samples");
    setMessage(null);
    setTab("samples");
    try {
      const r = await runSamplesAction({ slug, sourceCode: codeRef.current });
      if (r.ok) setSamples(r.results);
      else setMessage({ kind: "error", text: r.message });
    } catch {
      setMessage({ kind: "error", text: "Request failed. Check your connection." });
    } finally {
      setBusy(null);
    }
  }, [slug]);

  const submit = useCallback(async () => {
    setSubmitting(true);
    setMessage(null);
    setSubmission(null);
    setTab("submission");
    try {
      const created = await submitCodeAction({ slug, sourceCode: codeRef.current });
      if (!created.ok) {
        setMessage({ kind: "error", text: created.message });
        return;
      }
      // Grading is asynchronous: poll until the worker reaches a final verdict.
      for (let i = 0; i < POLL_MAX && mounted.current; i++) {
        const r = await getSubmissionAction({ id: created.id });
        if (!r.ok) {
          setMessage({ kind: "error", text: r.message });
          return;
        }
        setSubmission(r.submission);
        if (FINAL(r.submission.status)) return;
        await new Promise((res) => setTimeout(res, POLL_MS));
      }
      if (mounted.current) setMessage({ kind: "info", text: "Still judging. Check the Submissions page for the result." });
    } catch {
      setMessage({ kind: "error", text: "Request failed. Check your connection." });
    } finally {
      if (mounted.current) setSubmitting(false);
    }
  }, [slug]);

  const runRef = useRef(run);
  const samplesRef = useRef(runSamples);
  runRef.current = run;
  samplesRef.current = runSamples;

  const onMount: OnMount = (editor, monaco) => {
    // Ctrl/Cmd+Enter runs with custom input; Ctrl/Cmd+Shift+Enter runs the samples.
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => void runRef.current());
    editor.addCommand(
      monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter,
      () => void samplesRef.current(),
    );
  };

  async function reset() {
    if (!window.confirm("Reset to the starter code? Your current code will be discarded.")) return;
    setCode(starterCode);
    lastSaved.current = starterCode;
    await deleteDraftAction({ slug }).catch(() => null);
    setSaveState("idle");
  }

  const tabs: [Tab, string][] = [
    ["input", "Custom input"],
    ["output", "Output"],
    ["samples", "Sample tests"],
    ["submission", "Submission"],
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button onClick={run} disabled={busy !== null} title="Ctrl+Enter">
          <Play className="h-4 w-4" />
          {busy === "run" ? "Running…" : "Run"}
        </Button>
        <Button variant="outline" onClick={runSamples} disabled={busy !== null} title="Ctrl+Shift+Enter">
          <ListChecks className="h-4 w-4" />
          {busy === "samples" ? "Testing…" : "Run samples"}
        </Button>
        <Button variant="outline" onClick={submit} disabled={busy !== null || submitting} title="Grade against all tests">
          <Send className="h-4 w-4" />
          {submitting ? "Judging…" : "Submit"}
        </Button>
        <Button variant="ghost" onClick={reset} disabled={busy !== null}>
          <RotateCcw className="h-4 w-4" />
          Reset
        </Button>
        <div className="ml-auto flex items-center gap-3 text-xs text-muted">
          <span aria-live="polite">
            {saveState === "saving" && "Saving…"}
            {saveState === "saved" && "Saved"}
            {saveState === "error" && <span className="text-danger">Save failed</span>}
          </span>
          <label className="flex items-center gap-1">
            Font
            <select
              value={fontSize}
              onChange={(e) => {
                const n = Number(e.target.value);
                setFontSize(n);
                try {
                  localStorage.setItem(FONT_KEY, String(n));
                } catch {
                  /* ignore */
                }
              }}
              className="h-7 rounded border bg-background px-1"
            >
              {[12, 14, 16, 18, 20].map((n) => (
                <option key={n} value={n}>
                  {n}px
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        <Monaco
          height="100%"
          language="c"
          theme={dark ? "vs-dark" : "light"}
          value={code}
          onChange={(v) => setCode(v ?? "")}
          onMount={onMount}
          options={{
            fontSize,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            automaticLayout: true,
            tabSize: 4,
            insertSpaces: true,
            padding: { top: 8 },
          }}
        />
      </div>

      <div className="flex h-56 shrink-0 flex-col border-t">
        <div role="tablist" className="flex border-b bg-surface text-xs">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={cn("px-3 py-2 text-muted hover:text-foreground", tab === id && "border-b-2 border-primary font-medium text-foreground")}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-3 font-mono text-xs">
          {message && (
            <p role="alert" className={cn("mb-2 font-sans text-sm", message.kind === "error" && "text-danger")}>
              {message.text}
            </p>
          )}
          {tab === "input" && (
            <textarea
              value={stdin}
              onChange={(e) => setStdin(e.target.value)}
              aria-label="Custom input"
              spellCheck={false}
              placeholder="Standard input for Run"
              className="h-full w-full resize-none bg-transparent outline-none"
            />
          )}
          {tab === "output" && <OutputView outcome={outcome} />}
          {tab === "samples" && <SamplesView results={samples} />}
          {tab === "submission" && <SubmissionView s={submission} />}
        </div>
      </div>
    </div>
  );
}

function Pre({ label, text, tone }: { label: string; text: string; tone?: "danger" }) {
  if (!text) return null;
  return (
    <div className="mb-2">
      <div className="mb-0.5 font-sans text-xs text-muted">{label}</div>
      <pre className={cn("whitespace-pre-wrap break-words", tone === "danger" && "text-danger")}>{text}</pre>
    </div>
  );
}

function Meta({ o }: { o: RunOutcome }) {
  return (
    <span className="font-sans text-muted">
      {o.timeMs !== null && `${o.timeMs} ms`}
      {o.timeMs !== null && o.memoryKb !== null && " · "}
      {o.memoryKb !== null && `${o.memoryKb} KB`}
    </span>
  );
}

function OutputView({ outcome }: { outcome: RunOutcome | null }) {
  if (!outcome) return <p className="font-sans text-sm text-muted">Run your code to see its output here.</p>;
  return (
    <div>
      <div className="mb-2 flex gap-3 font-sans text-sm">
        <strong className={outcome.status === "OK" ? "text-success" : "text-danger"}>{STATUS_TEXT[outcome.status]}</strong>
        <Meta o={outcome} />
      </div>
      <Pre label="Compiler output" text={outcome.compileOutput} tone="danger" />
      <Pre label="stdout" text={outcome.stdout} />
      <Pre label="stderr" text={outcome.stderr} tone="danger" />
    </div>
  );
}

function SamplesView({ results }: { results: SampleResult[] | null }) {
  if (!results) return <p className="font-sans text-sm text-muted">Run samples to check your code against the visible examples.</p>;
  return (
    <div className="space-y-3">
      {results.map((r) => (
        <details key={r.index} open={!r.passed}>
          <summary className="cursor-pointer font-sans text-sm">
            Sample {r.index}:{" "}
            <strong className={r.passed ? "text-success" : "text-danger"}>
              {r.passed ? "Passed" : r.outcome.status === "OK" ? "Wrong answer" : STATUS_TEXT[r.outcome.status]}
            </strong>{" "}
            <Meta o={r.outcome} />
          </summary>
          <div className="mt-2 pl-3">
            <Pre label="Input" text={r.input} />
            <Pre label="Expected" text={r.expected} />
            <Pre label="Your output" text={r.outcome.stdout} />
            <Pre label="Compiler output" text={r.outcome.compileOutput} tone="danger" />
            <Pre label="stderr" text={r.outcome.stderr} tone="danger" />
          </div>
        </details>
      ))}
    </div>
  );
}

function SubmissionView({ s }: { s: SubmissionState | null }) {
  if (!s) return <p className="font-sans text-sm text-muted">Submit to grade your code against all tests, including hidden ones.</p>;
  const pending = !FINAL(s.status);
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-3 font-sans text-sm">
        <strong className={s.status === "ACCEPTED" ? "text-success" : pending ? "text-muted" : "text-danger"}>
          {s.status.replaceAll("_", " ").toLowerCase()}
        </strong>
        {!pending && (
          <span className="text-muted">
            Score {s.score}/{s.maxScore}
            {s.executionTimeMs !== null && ` · ${s.executionTimeMs} ms`}
            {s.memoryUsedKb !== null && ` · ${s.memoryUsedKb} KB`}
          </span>
        )}
      </div>
      <Pre label="Compiler output" text={s.compilerMessage ?? ""} tone="danger" />
      {s.compilerMessage === null && s.status === "SYSTEM_ERROR" && (
        <p className="font-sans text-sm text-danger">The judge had a problem. Please try again.</p>
      )}
      <ul className="space-y-0.5">
        {s.results.map((r) => (
          <li key={r.n} className="font-sans">
            Test {r.n} {r.isSample ? "(sample)" : "(hidden)"}:{" "}
            <span className={r.status === "ACCEPTED" ? "text-success" : "text-danger"}>{r.status.replaceAll("_", " ").toLowerCase()}</span>
            <span className="text-muted">
              {r.timeMs !== null && ` · ${r.timeMs} ms`}
              {r.memoryKb !== null && ` · ${r.memoryKb} KB`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
