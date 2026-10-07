#!/bin/sh
# Run manually; writes sensitive dumps outside Git, never creates a paid service.
set -eu
umask 077
if [ "$#" -ne 2 ]; then
  echo "Usage: sh scripts/backup-database.sh PROJECT_REF /absolute/private/backup-directory" >&2
  exit 1
fi
ref="$1"
output="$2"
case "$ref" in *[!a-z0-9]*|'') echo "Invalid project ref" >&2; exit 1;; esac
case "$output" in /*) ;; *) echo "Use an absolute private backup directory" >&2; exit 1;; esac
[ ! -e "$output" ] || { echo "Backup destination must be new" >&2; exit 1; }
repo=$(git rev-parse --show-toplevel)
# Resolve the parent first so symlinks cannot route sensitive backups into Git.
parent=$(cd "$(dirname "$output")" && pwd -P)
case "$parent/$(basename "$output")" in "$repo"|"$repo"/*) echo "Keep backups outside the repository" >&2; exit 1;; esac
mkdir "$output"
chmod 700 "$output"
supabase db dump --project-ref "$ref" --role-only --file "$output/roles.sql"
supabase db dump --project-ref "$ref" --file "$output/schema.sql"
supabase db dump --project-ref "$ref" --data-only --use-copy --file "$output/data.sql"
for file in roles schema data; do [ -s "$output/$file.sql" ] || { echo "Incomplete backup; retain files for investigation" >&2; exit 1; }; done
(cd "$output" && shasum -a 256 roles.sql schema.sql data.sql > SHA256SUMS)
echo "Database dump complete. Storage binaries and external configuration require separate backup."
