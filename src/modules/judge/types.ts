export type RunStatus =
  | "OK"
  | "COMPILATION_ERROR"
  | "RUNTIME_ERROR"
  | "TIME_LIMIT_EXCEEDED"
  | "MEMORY_LIMIT_EXCEEDED"
  | "SYSTEM_ERROR";

export interface RunLimits {
  timeLimitMs: number;
  memoryLimitMb: number;
}

export interface RunOutcome {
  status: RunStatus;
  stdout: string;
  stderr: string;
  compileOutput: string;
  timeMs: number | null;
  memoryKb: number | null;
}

/** Abstraction over the sandboxed execution service. */
export interface JudgeClient {
  run(sourceCode: string, stdin: string, limits: RunLimits): Promise<RunOutcome>;
}

export class JudgeNotConfiguredError extends Error {
  constructor() {
    super("The judge service is not configured (JUDGE0_URL is unset).");
  }
}
