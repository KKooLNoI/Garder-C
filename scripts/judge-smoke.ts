// Conformance check for a deployed Judge0: does it behave the way this platform assumes?
//
//   npx tsx --env-file=.env scripts/judge-smoke.ts                    # safe checks
//   npx tsx --env-file=.env scripts/judge-smoke.ts --include-hostile  # + memory/fork/network checks
//
// WARNING: --include-hostile runs programs that allocate lots of memory, spawn processes and open sockets.
// Only use it against a REAL sandboxed Judge0, never a stand-in that executes code directly on a host.
import { Judge0Client } from "../src/modules/judge/judge0";
import type { RunOutcome, RunStatus } from "../src/modules/judge/types";

interface Check {
  name: string;
  hostile?: boolean;
  source: string;
  stdin?: string;
  limits?: { timeLimitMs: number; memoryLimitMb: number };
  expect: (o: RunOutcome) => string | null; // null = pass, otherwise a failure reason
}

const is = (...statuses: RunStatus[]) => (o: RunOutcome) =>
  statuses.includes(o.status) ? null : `expected ${statuses.join(" or ")}, got ${o.status}`;
const stdoutIs = (s: string) => (o: RunOutcome) =>
  o.status !== "OK" ? `expected OK, got ${o.status}` : o.stdout.trim() === s ? null : `stdout was ${JSON.stringify(o.stdout)}`;

const checks: Check[] = [
  {
    name: "compiles and runs; reads stdin",
    source: `#include <stdio.h>\nint main(void){long long a,b;scanf("%lld %lld",&a,&b);printf("%lld\\n",a+b);return 0;}`,
    stdin: "40 2\n",
    expect: stdoutIs("42"),
  },
  {
    name: "compiles as C17",
    source: `#include <stdio.h>\nint main(void){printf("%ld\\n",(long)__STDC_VERSION__);return 0;}`,
    expect: stdoutIs("201710"),
  },
  {
    name: "links the math library (-lm)",
    source: `#include <stdio.h>\n#include <math.h>\nint main(void){printf("%.1f\\n",sqrt(16.0));return 0;}`,
    expect: stdoutIs("4.0"),
  },
  {
    name: "reports compilation errors",
    source: `int main(void){ return 0 }`,
    expect: (o) => (o.status !== "COMPILATION_ERROR" ? `expected COMPILATION_ERROR, got ${o.status}` : o.compileOutput ? null : "no compiler output returned"),
  },
  {
    name: "reports runtime errors (null dereference)",
    source: `int main(void){ volatile int *p = 0; *p = 1; return 0; }`,
    expect: is("RUNTIME_ERROR"),
  },
  {
    name: "reports runtime errors (non-zero exit)",
    source: `int main(void){ return 3; }`,
    expect: is("RUNTIME_ERROR"),
  },
  {
    name: "enforces the time limit (infinite loop)",
    source: `int main(void){ for(;;){} }`,
    expect: is("TIME_LIMIT_EXCEEDED"),
  },
  {
    name: "reports time and memory usage",
    source: `#include <stdio.h>\nint main(void){puts("x");return 0;}`,
    expect: (o) => (o.status === "OK" && o.timeMs !== null && o.memoryKb !== null && o.memoryKb > 0 ? null : `time=${o.timeMs} memory=${o.memoryKb} status=${o.status}`),
  },
  // ---- hostile: need a real sandbox ----
  {
    name: "enforces the memory limit (tries to touch 512 MB, limit 64 MB)",
    hostile: true,
    source: `#include <stdlib.h>\n#include <string.h>\nint main(void){size_t n=512u*1024*1024;char*p=malloc(n);if(!p)return 1;memset(p,1,n);return p[n-1]==1?0:2;}`,
    expect: is("MEMORY_LIMIT_EXCEEDED", "RUNTIME_ERROR"),
  },
  {
    name: "limits process creation (tries to hold 200 children)",
    hostile: true,
    source: `#include <stdio.h>\n#include <unistd.h>\n#include <sys/wait.h>\nint main(void){int ok=0;for(int i=0;i<200;i++){pid_t p=fork();if(p==0){sleep(1);_exit(0);}if(p>0)ok++;}printf("%d\\n",ok);while(wait(0)>0);return 0;}`,
    expect: (o) => {
      const n = Number(o.stdout.trim());
      return Number.isFinite(n) && n > 0 && n < 100 ? null : `forked ${o.stdout.trim() || "?"} children (status ${o.status}); process limit not enforced`;
    },
  },
  {
    name: "blocks network access (connect to 1.1.1.1:53)",
    hostile: true,
    source: `#include <stdio.h>\n#include <sys/socket.h>\n#include <netinet/in.h>\n#include <arpa/inet.h>\n#include <unistd.h>\nint main(void){int s=socket(AF_INET,SOCK_STREAM,0);struct sockaddr_in a={0};a.sin_family=AF_INET;a.sin_port=htons(53);inet_pton(AF_INET,"1.1.1.1",&a.sin_addr);puts(connect(s,(struct sockaddr*)&a,sizeof a)==0?"OPEN":"BLOCKED");return 0;}`,
    expect: (o) => (o.stdout.includes("OPEN") ? "NETWORK IS REACHABLE from the sandbox" : o.stdout.includes("BLOCKED") || o.status !== "OK" ? null : `unexpected: ${o.status} ${o.stdout}`),
  },
];

async function main() {
  const includeHostile = process.argv.includes("--include-hostile");
  const judge = new Judge0Client();
  const selected = checks.filter((c) => includeHostile || !c.hostile);
  console.log(`Running ${selected.length} check(s)${includeHostile ? " including hostile ones" : " (hostile checks skipped)"}\n`);

  let failed = 0;
  for (const c of selected) {
    let verdict: string | null;
    try {
      const outcome = await judge.run(c.source, c.stdin ?? "", c.limits ?? { timeLimitMs: 1000, memoryLimitMb: 64 });
      verdict = c.expect(outcome);
    } catch (e) {
      verdict = `error talking to the judge: ${(e as Error).message}`;
    }
    if (verdict) failed++;
    console.log(`${verdict ? "FAIL" : "PASS"}  ${c.name}${verdict ? `\n      -> ${verdict}` : ""}`);
  }
  console.log(`\n${selected.length - failed}/${selected.length} passed`);
  process.exit(failed ? 1 : 0);
}

main();
