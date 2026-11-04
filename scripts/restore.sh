#!/usr/bin/env bash
# Restores a dump made by backup.sh. DESTRUCTIVE: existing objects in the target database are dropped.
#
#   CONFIRM_RESTORE=yes DATABASE_URL=postgresql://... scripts/restore.sh backups/cpractice-<stamp>.dump
#
# Restore into a scratch database first to check a backup; stop the web app and worker before restoring
# into production.
set -euo pipefail

dump="${1:?usage: restore.sh <dump-file>}"
: "${DATABASE_URL:?DATABASE_URL (the TARGET database) is required}"

if [ ! -s "$dump" ]; then
  echo "dump file not found or empty: $dump" >&2
  exit 2
fi
if [ "${CONFIRM_RESTORE:-}" != "yes" ]; then
  echo "Refusing to restore: this drops existing objects in the target database." >&2
  echo "Re-run with CONFIRM_RESTORE=yes to proceed." >&2
  exit 2
fi

pg_restore --list "$dump" >/dev/null # fail early on a corrupt archive
pg_restore --clean --if-exists --no-owner --exit-on-error --dbname="$DATABASE_URL" "$dump"
echo "restore complete from $dump"
