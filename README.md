# C Practice

Private online judge and learning platform for C (GCC, C17). Next.js 15 + Prisma + PostgreSQL; code execution through Judge0 CE.

## Status

Verified = actually run and checked on the authoring machine (Windows, Node 22, embedded PostgreSQL, no Docker).

| Area | State |
|---|---|
| Auth (Argon2id, hashed DB sessions, RBAC, login rate limit) | Verified (tests + browser) |
| Schema, migrations, 20-problem seed (expected outputs cross-checked against C reference solutions) | Verified |
| Learning pages, problem library, dashboard, progress, submission history | Verified in browser |
| Editor (self-hosted Monaco), auto-save/restore, custom input, resizable panes | Verified in browser, under the strict CSP |
| Submit → Postgres queue → worker → grading → transactional progress | Verified end to end with a **throwaway unsandboxed stand-in for Judge0** and with a fake judge in integration tests |
| Admin: lessons, problems, test cases, publish/preview, versioning, users, audit log, statistics, system status | Verified (integration tests + browser) |
| Security headers/CSP, env validation, `/api/health`, startup refusal on weak config | Verified |
| `scripts/backup.sh`, `scripts/restore.sh` | Script mechanics tested with stand-in `pg_dump`/`pg_restore`. **A real dump and restore has NOT been run.** |
| Real Judge0: C17, time/memory/process limits, network isolation | **NOT verified.** Run `npm run judge:smoke` against your deployment (below) |
| `Dockerfile`, `docker-compose.yml`, `judge0.conf.example` | YAML structure checked; **never built or run** (no Docker on the authoring machine) |

## Local development

```bash
npm install
cp .env.example .env         # edit
npm run db:dev               # embedded Postgres on :5433 (only if you have no Postgres/Docker)
npm run db:deploy            # apply migrations (db:migrate while developing the schema)
npm run db:seed              # 4 lessons, 20 problems, admin if SEED_ADMIN_PASSWORD is set
npm run dev
npm run worker               # separate terminal; needs JUDGE0_URL
```

More users: `npx tsx --env-file=.env scripts/create-user.ts <user> <email> <password> [ADMIN|STUDENT]`, or use Admin → Users.

Scripts: `npm run typecheck`, `npm run lint`, `npm test`, `npm run judge:smoke`, `npm run backup`.

## Production deployment (Docker Compose, UNVERIFIED)

1. `cp .env.example .env` and `cp judge0.conf.example judge0.conf`. Replace **every** placeholder with long random values. `JUDGE0_AUTH_TOKEN` (.env) must equal `AUTHN_TOKEN` (judge0.conf); `REDIS_PASSWORD` must match in both. URL-encode special characters in `POSTGRES_PASSWORD`.
2. `docker compose up -d db redis judge0-db` then `docker compose --profile tools run --rm migrate`.
3. Seed once: run `npm run db:seed` against the production database (set `SEED_ADMIN_PASSWORD`; change it after first login, then remove the variable).
4. `docker compose up -d`.
5. Put a TLS-terminating reverse proxy in front of port 3000. Cookies are `Secure` in production, so HTTPS is required for login to work.
6. **Run `npm run judge:smoke` against the deployed Judge0**, then `npm run judge:smoke -- --include-hostile` (real sandbox only). Do not go live until every check passes.

The app refuses to start in production with a missing `DATABASE_URL`, an invalid `JUDGE0_URL`, or a default database password.

### Judge0 and privileged containers

Judge0's `isolate` sandbox needs `privileged: true` (and cgroup v1 on the host for 1.13.x). That conflicts with a strict "no privileged containers" policy. Mitigations in the compose file: the worker containers that execute submissions sit on an `internal: true` network (no route out), no Judge0 port is published, an auth token is required, memory and PID limits apply, and the web app/worker run unprivileged with `cap_drop: ALL`. Accepting that residual risk is a deployment decision; the alternative is a different sandbox, which this project does not provide.

### Backups

`scripts/backup.sh` writes `cpractice-<UTC stamp>.dump` (pg_dump custom format, owner-only, validated before being renamed into place, old files pruned after a *successful* run). The compose `backup` service runs it daily into the `backups` volume. **Copy backups off the host**; a backup on the same disk does not survive disk loss.

```bash
# restore (destructive; stop app and worker first; test on a scratch database before trusting a backup)
CONFIRM_RESTORE=yes DATABASE_URL=postgresql://... scripts/restore.sh backups/cpractice-<stamp>.dump
```

Rehearse a full restore before relying on this. `pg_dump` receives the connection string as an argument, which is visible in the process list inside the backup container.

## Environment variables

See `.env.example`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string (required) |
| `SESSION_TTL_DAYS` | Session lifetime, 1-90 (default 14) |
| `JUDGE0_URL`, `JUDGE0_AUTH_TOKEN`, `JUDGE0_C_LANGUAGE_ID` | Judge0 endpoint, token, and the id of a C/GCC language in your image (default 50). Without `JUDGE0_URL`, Run and Submit report the judge is not configured |
| `SEED_ADMIN_*` | Used only by `npm run db:seed` |
| `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `BACKUP_RETENTION_DAYS` | Docker Compose only |
| `ALLOW_WEAK_CONFIG=true` | Lets a production-mode server start with a weak DB password. Local testing only |

## Architecture notes

- Modular monolith under `src/modules/*` (auth, editor, grading, judge, admin, problems, progress); route handlers and pages are thin.
- Submissions are queued in Postgres (`PENDING`), claimed with `FOR UPDATE SKIP LOCKED` by `npm run worker`, graded against all tests, then results and progress are written in one transaction. Submissions stuck `RUNNING` for 3+ minutes are failed as `SYSTEM_ERROR`.
- Hidden test cases are only selected by the grading service and the admin pages; student-facing queries select samples only.
- Problem edits that change judging bump `Problem.version` and store a snapshot in `ProblemVersion`; submissions record the version they ran against.

## Security notes

- Sessions: random 256-bit tokens, stored only as SHA-256 hashes; httpOnly, SameSite=Lax, Secure in production. Server actions use Next.js's origin check for CSRF.
- Headers: strict CSP (`script-src 'self' 'unsafe-inline'`; Next.js needs inline bootstrap scripts, nonce-based CSP is a possible follow-up), `X-Frame-Options: DENY`, `nosniff`, HSTS, etc. Monaco is self-hosted from `/monaco`.
- Rate limits are in-memory (single node). Use a shared store if you run several app instances.
- Student code only ever runs inside Judge0. Never point `JUDGE0_URL` at anything that executes code directly on a host.

## Known gaps and accepted risks

- **Dependency audit (`npm audit --omit=dev`): 7 findings remain** that need major upgrades or upstream releases: `next`/`postcss` (needs Next 16), `prisma`/`@prisma/config`/`deepmerge-ts` (needs Prisma 7; build/CLI-time, not request handling), `dompurify`/`monaco-editor` (bundled in Monaco 0.57.0; the editor only renders the user's own code). Re-run `npm audit` and upgrade when practical.
- No automated browser end-to-end suite; browser checks were performed manually.
- Admin server actions are covered by the page guards, `requireAdmin()` and service tests, but not by direct action-level tests.
- No email, password self-service (admins reset passwords), or SSO.
- The in-memory rate limiter resets on restart.
