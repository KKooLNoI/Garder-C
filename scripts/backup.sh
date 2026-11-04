#!/usr/bin/env bash
# Logical backup of the application database using pg_dump's custom format.
#
#   DATABASE_URL            required, e.g. postgresql://user:pass@host:5432/db
#   BACKUP_DIR              default ./backups
#   BACKUP_RETENTION_DAYS   default 14 (older cpractice-*.dump files are deleted after a successful backup)
#
# The dump is written to a temp file, validated with `pg_restore --list`, and only then renamed into place,
# so a crash or a bad dump never leaves a file that looks like a good backup.
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
case "$RETENTION_DAYS" in '' | *[!0-9]*) echo "BACKUP_RETENTION_DAYS must be a number" >&2; exit 2 ;; esac

umask 077 # backups contain password hashes and source code: owner-only
mkdir -p "$BACKUP_DIR"

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
final="$BACKUP_DIR/cpractice-$stamp.dump"
partial="$final.partial"
trap 'rm -f "$partial"' EXIT

pg_dump --format=custom --no-owner --dbname="$DATABASE_URL" --file="$partial"

if [ ! -s "$partial" ]; then
  echo "backup failed: dump is empty" >&2
  exit 1
fi
if ! pg_restore --list "$partial" >/dev/null; then
  echo "backup failed: dump is not a readable archive" >&2
  exit 1
fi

mv "$partial" "$final"
find "$BACKUP_DIR" -maxdepth 1 -name 'cpractice-*.dump' -type f -mtime "+$RETENTION_DAYS" -delete
echo "backup ok: $final ($(wc -c <"$final" | tr -d ' ') bytes)"
