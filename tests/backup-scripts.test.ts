// Tests the MECHANICS of scripts/backup.sh and scripts/restore.sh using stand-in pg_dump/pg_restore
// binaries (tests/stubs/bin). They do NOT prove that real pg_dump output restores correctly.
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(__dirname, "..");
const stubBin = join(root, "tests", "stubs", "bin");
// Git-Bash friendly path forms are handled by bash itself; pass native paths and let PATH carry the stubs.
const run = (script: string, args: string[], env: Record<string, string>) =>
  spawnSync("bash", [join(root, "scripts", script), ...args], {
    encoding: "utf8",
    env: { ...process.env, PATH: stubBin + delimiter + process.env.PATH, ...env },
  });

const tmp = () => mkdtempSync(join(tmpdir(), "bk-"));
const dumps = (d: string) => readdirSync(d).filter((f) => f.endsWith(".dump"));

describe("backup.sh", () => {
  it("writes a validated dump atomically and leaves no partial file", () => {
    const dir = tmp();
    const r = run("backup.sh", [], { DATABASE_URL: "postgresql://u:p@h/db", BACKUP_DIR: dir });
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("backup ok");
    expect(dumps(dir)).toHaveLength(1);
    expect(readdirSync(dir).some((f) => f.endsWith(".partial"))).toBe(false);
  });

  it("fails loudly and keeps nothing when pg_dump fails", () => {
    const dir = tmp();
    const r = run("backup.sh", [], { DATABASE_URL: "x", BACKUP_DIR: dir, FAKE_PGDUMP_FAIL: "1" });
    expect(r.status).not.toBe(0);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("rejects an empty dump", () => {
    const dir = tmp();
    const r = run("backup.sh", [], { DATABASE_URL: "x", BACKUP_DIR: dir, FAKE_PGDUMP_EMPTY: "1" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain("empty");
    expect(readdirSync(dir)).toEqual([]);
  });

  it("requires DATABASE_URL and a numeric retention", () => {
    expect(run("backup.sh", [], { DATABASE_URL: "", BACKUP_DIR: tmp() }).status).not.toBe(0);
    expect(run("backup.sh", [], { DATABASE_URL: "x", BACKUP_DIR: tmp(), BACKUP_RETENTION_DAYS: "abc" }).status).toBe(2);
  });

  it("prunes only old backups after a successful run, never unrelated files", () => {
    const dir = tmp();
    const old = join(dir, "cpractice-20200101T000000Z.dump");
    const recent = join(dir, "cpractice-20991231T000000Z.dump");
    const other = join(dir, "notes.txt");
    for (const f of [old, recent, other]) writeFileSync(f, "x");
    const longAgo = new Date(Date.now() - 40 * 86_400_000);
    utimesSync(old, longAgo, longAgo);
    utimesSync(other, longAgo, longAgo);
    const r = run("backup.sh", [], { DATABASE_URL: "x", BACKUP_DIR: dir, BACKUP_RETENTION_DAYS: "14" });
    expect(r.status).toBe(0);
    expect(existsSync(old)).toBe(false);
    expect(existsSync(recent)).toBe(true);
    expect(existsSync(other)).toBe(true);
  });

  it("does not prune when the backup itself fails", () => {
    const dir = tmp();
    const old = join(dir, "cpractice-20200101T000000Z.dump");
    writeFileSync(old, "x");
    const longAgo = new Date(Date.now() - 40 * 86_400_000);
    utimesSync(old, longAgo, longAgo);
    run("backup.sh", [], { DATABASE_URL: "x", BACKUP_DIR: dir, FAKE_PGDUMP_FAIL: "1" });
    expect(existsSync(old)).toBe(true);
  });

  it.skipIf(process.platform === "win32")("creates owner-only files", () => {
    const dir = tmp();
    run("backup.sh", [], { DATABASE_URL: "x", BACKUP_DIR: dir });
    expect(statSync(join(dir, dumps(dir)[0])).mode & 0o077).toBe(0);
  });
});

describe("restore.sh", () => {
  const makeDump = () => {
    const dir = tmp();
    run("backup.sh", [], { DATABASE_URL: "x", BACKUP_DIR: dir });
    return join(dir, dumps(dir)[0]);
  };

  it("refuses to run without explicit confirmation", () => {
    const log = join(tmp(), "log");
    const r = run("restore.sh", [makeDump()], { DATABASE_URL: "x", FAKE_RESTORE_LOG: log });
    expect(r.status).toBe(2);
    expect(existsSync(log)).toBe(false);
  });

  it("restores a valid dump when confirmed", () => {
    const log = join(tmp(), "log");
    const dump = makeDump();
    const r = run("restore.sh", [dump], { DATABASE_URL: "x", CONFIRM_RESTORE: "yes", FAKE_RESTORE_LOG: log });
    expect(r.status).toBe(0);
    expect(readFileSync(log, "utf8")).toContain("restored");
  });

  it("rejects missing and corrupt dumps before touching the database", () => {
    const log = join(tmp(), "log");
    expect(run("restore.sh", ["/nonexistent.dump"], { DATABASE_URL: "x", CONFIRM_RESTORE: "yes", FAKE_RESTORE_LOG: log }).status).toBe(2);
    const bad = join(tmp(), "bad.dump");
    writeFileSync(bad, "garbage");
    expect(run("restore.sh", [bad], { DATABASE_URL: "x", CONFIRM_RESTORE: "yes", FAKE_RESTORE_LOG: log }).status).not.toBe(0);
    expect(existsSync(log)).toBe(false);
  });
});
