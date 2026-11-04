// Local-only Postgres for machines without Docker. Production uses docker-compose.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const dataDir = ".pgdata";
const pg = new EmbeddedPostgres({
  databaseDir: dataDir,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

async function main() {
  if (!existsSync(`${dataDir}/PG_VERSION`)) await pg.initialise();
  await pg.start();
  try {
    await pg.createDatabase("cpractice");
  } catch {
    /* already exists */
  }
  console.log("dev-db ready on postgresql://postgres:postgres@localhost:5433/cpractice");
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main();
