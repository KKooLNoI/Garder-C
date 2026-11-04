// Judge worker: claims PENDING submissions from Postgres and grades them through Judge0.
// Run as a separate process from the web app:  npm run worker
import { failStaleSubmissions, processNext } from "../src/modules/grading/service";
import { Judge0Client, judge0ConfigFromEnv } from "../src/modules/judge/judge0";

const POLL_MS = 1000;
const REAP_EVERY_MS = 30_000;

async function main() {
  if (!judge0ConfigFromEnv()) {
    console.error("JUDGE0_URL is not set; refusing to start the worker.");
    process.exit(1);
  }
  const judge = new Judge0Client();
  let stopping = false;
  process.on("SIGINT", () => (stopping = true));
  process.on("SIGTERM", () => (stopping = true));

  let lastReap = 0;
  console.log("judge worker started");
  while (!stopping) {
    try {
      if (Date.now() - lastReap > REAP_EVERY_MS) {
        lastReap = Date.now();
        const n = await failStaleSubmissions();
        if (n) console.warn(`marked ${n} stale submission(s) as SYSTEM_ERROR`);
      }
      const worked = await processNext(judge);
      if (!worked) await new Promise((r) => setTimeout(r, POLL_MS));
    } catch (e) {
      console.error("worker loop error", e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
  console.log("judge worker stopped");
  process.exit(0);
}

main();
