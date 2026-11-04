import { JudgeNotConfiguredError, type JudgeClient, type RunLimits, type RunOutcome, type RunStatus } from "./types";

// Judge0 status ids: 3 Accepted, 5 TLE, 6 Compilation Error, 7-12 runtime errors, 13/14 internal errors.
const RUNTIME_ERROR_IDS = new Set([7, 8, 9, 10, 11, 12]);

interface Judge0Response {
  stdout?: string | null;
  stderr?: string | null;
  compile_output?: string | null;
  message?: string | null;
  status?: { id: number };
  time?: string | null;
  memory?: number | null;
}

const decode = (b64?: string | null) => (b64 ? Buffer.from(b64, "base64").toString("utf8") : "");

export function mapJudge0Response(r: Judge0Response, limits: RunLimits): RunOutcome {
  const id = r.status?.id ?? 13;
  const memoryKb = r.memory ?? null;
  let status: RunStatus;
  if (id === 3 || id === 4) status = "OK";
  else if (id === 5) status = "TIME_LIMIT_EXCEEDED";
  else if (id === 6) status = "COMPILATION_ERROR";
  else if (RUNTIME_ERROR_IDS.has(id)) {
    // Judge0 reports an over-limit allocation as a signal (usually SIGSEGV), so infer it from peak memory.
    status = memoryKb !== null && memoryKb >= limits.memoryLimitMb * 1024 * 0.98 ? "MEMORY_LIMIT_EXCEEDED" : "RUNTIME_ERROR";
  } else status = "SYSTEM_ERROR";

  return {
    status,
    stdout: decode(r.stdout),
    stderr: decode(r.stderr) || decode(r.message),
    compileOutput: decode(r.compile_output),
    timeMs: r.time ? Math.round(Number(r.time) * 1000) : null,
    memoryKb,
  };
}

export interface Judge0Config {
  url: string;
  authToken?: string;
  /** Judge0 language id for C. 50 = GCC 9.2 on stock Judge0 CE; adjust to the deployed image. */
  languageId: number;
  timeoutMs?: number;
}

export function judge0ConfigFromEnv(env: Record<string, string | undefined> = process.env): Judge0Config | null {
  if (!env.JUDGE0_URL) return null;
  return {
    url: env.JUDGE0_URL.replace(/\/$/, ""),
    authToken: env.JUDGE0_AUTH_TOKEN || undefined,
    languageId: Number(env.JUDGE0_C_LANGUAGE_ID ?? 50),
  };
}

export class Judge0Client implements JudgeClient {
  constructor(private readonly config: Judge0Config | null = judge0ConfigFromEnv()) {}

  async run(sourceCode: string, stdin: string, limits: RunLimits): Promise<RunOutcome> {
    if (!this.config) throw new JudgeNotConfiguredError();
    const { url, authToken, languageId, timeoutMs = 20_000 } = this.config;
    const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

    const res = await fetch(`${url}/submissions?base64_encoded=true&wait=true`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { "X-Auth-Token": authToken } : {}),
      },
      body: JSON.stringify({
        language_id: languageId,
        source_code: b64(sourceCode),
        stdin: b64(stdin),
        compiler_options: "-std=c17 -O2 -lm",
        cpu_time_limit: limits.timeLimitMs / 1000,
        wall_time_limit: (limits.timeLimitMs / 1000) * 2 + 1,
        memory_limit: limits.memoryLimitMb * 1024,
        max_processes_and_or_threads: 20,
        max_file_size: 1024,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) throw new Error(`Judge0 responded with HTTP ${res.status}`);
    return mapJudge0Response((await res.json()) as Judge0Response, limits);
  }
}
