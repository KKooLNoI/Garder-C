// These tests exercise OUR client code against a local fake HTTP server that imitates
// Judge0's response shape. They do not prove behaviour of a real Judge0 deployment.
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Judge0Client, judge0ConfigFromEnv, mapJudge0Response } from "../src/modules/judge/judge0";
import { JudgeNotConfiguredError } from "../src/modules/judge/types";

const limits = { timeLimitMs: 1000, memoryLimitMb: 64 };
const b64 = (s: string) => Buffer.from(s).toString("base64");

describe("mapJudge0Response", () => {
  it("maps accepted output", () => {
    const o = mapJudge0Response({ status: { id: 3 }, stdout: b64("hi\n"), time: "0.012", memory: 800 }, limits);
    expect(o).toMatchObject({ status: "OK", stdout: "hi\n", timeMs: 12, memoryKb: 800 });
  });
  it.each([
    [5, "TIME_LIMIT_EXCEEDED"],
    [6, "COMPILATION_ERROR"],
    [11, "RUNTIME_ERROR"],
    [13, "SYSTEM_ERROR"],
  ] as const)("maps status %i to %s", (id, expected) => {
    expect(mapJudge0Response({ status: { id }, memory: 100 }, limits).status).toBe(expected);
  });
  it("classifies a runtime error at the memory ceiling as MEMORY_LIMIT_EXCEEDED", () => {
    expect(mapJudge0Response({ status: { id: 11 }, memory: 64 * 1024 }, limits).status).toBe("MEMORY_LIMIT_EXCEEDED");
  });
  it("treats a missing status as a system error", () => {
    expect(mapJudge0Response({}, limits).status).toBe("SYSTEM_ERROR");
  });
});

describe("judge0ConfigFromEnv", () => {
  it("is null when JUDGE0_URL is unset", () => expect(judge0ConfigFromEnv({})).toBeNull());
  it("reads url, token and language id", () => {
    expect(judge0ConfigFromEnv({ JUDGE0_URL: "http://j:2358/", JUDGE0_AUTH_TOKEN: "t", JUDGE0_C_LANGUAGE_ID: "103" })).toEqual({
      url: "http://j:2358",
      authToken: "t",
      languageId: 103,
    });
  });
});

describe("Judge0Client", () => {
  let server: Server;
  let url: string;
  let lastRequest: { headers: Record<string, unknown>; body: Record<string, unknown>; path: string } | null = null;
  let respondWith: { status: number; json: unknown } = { status: 201, json: {} };

  beforeAll(async () => {
    server = createServer((req, res) => {
      let raw = "";
      req.on("data", (c) => (raw += c));
      req.on("end", () => {
        lastRequest = { headers: req.headers, body: JSON.parse(raw || "{}"), path: req.url ?? "" };
        res.writeHead(respondWith.status, { "Content-Type": "application/json" });
        res.end(JSON.stringify(respondWith.json));
      });
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
    url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });
  afterAll(() => new Promise<void>((r) => server.close(() => r())));

  it("throws JudgeNotConfiguredError without config", async () => {
    await expect(new Judge0Client(null).run("x", "", limits)).rejects.toBeInstanceOf(JudgeNotConfiguredError);
  });

  it("sends base64 source/stdin, limits, C17 options and the auth token", async () => {
    respondWith = { status: 201, json: { status: { id: 3 }, stdout: b64("42\n"), time: "0.01", memory: 500 } };
    const out = await new Judge0Client({ url, authToken: "secret", languageId: 50 }).run("int main(){}", "7\n", limits);
    expect(out.stdout).toBe("42\n");
    expect(lastRequest?.path).toContain("base64_encoded=true");
    expect(lastRequest?.headers["x-auth-token"]).toBe("secret");
    expect(lastRequest?.body).toMatchObject({
      language_id: 50,
      source_code: b64("int main(){}"),
      stdin: b64("7\n"),
      cpu_time_limit: 1,
      memory_limit: 64 * 1024,
    });
    expect(String(lastRequest?.body.compiler_options)).toContain("-std=c17");
  });

  it("throws on non-2xx responses", async () => {
    respondWith = { status: 500, json: {} };
    await expect(new Judge0Client({ url, languageId: 50 }).run("x", "", limits)).rejects.toThrow(/HTTP 500/);
  });
});
