#!/bin/sh
# Nightly backup of the Directus database (SQLite) to Cloudflare R2.
# Runs in the "backup" container of the Coolify service zindabaagh-cms, which shares the
# database volume with Directus at /data. Each backup is a consistent SQLite copy,
# integrity-checked, gzipped and encrypted with BACKUP_PASSPHRASE before upload.
#
# Env: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET, R2_ENDPOINT, BACKUP_PASSPHRASE,
#      KEEP_DAYS (default 30)
set -eu

ts=$(date +%Y-%m-%d_%H%M)
name="directus-$ts.db.gz.enc"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT

export AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" AWS_DEFAULT_REGION=auto
# R2 does not accept the newer default checksums of aws-cli; only send them when required.
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
s3() { aws s3 "$@" --endpoint-url "$R2_ENDPOINT" --only-show-errors; }

# Consistent copy while Directus keeps running (SQLite online backup API).
sqlite3 /data/data.db ".backup '$work/data.db'"
check=$(sqlite3 "$work/data.db" "PRAGMA integrity_check;")
[ "$check" = "ok" ] || { echo "backup FAILED: integrity check says: $check"; exit 1; }

gzip -9 "$work/data.db"
openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE \
  -in "$work/data.db.gz" -out "$work/$name"

s3 cp "$work/$name" "s3://$R2_BUCKET/backups/$name"
echo "backup ok: backups/$name ($(wc -c < "$work/$name") bytes)"

# Delete backups older than KEEP_DAYS (file names start with the date).
cutoff=$(date -d "@$(( $(date +%s) - ${KEEP_DAYS:-30} * 86400 ))" +%Y%m%d)
aws s3 ls "s3://$R2_BUCKET/backups/" --endpoint-url "$R2_ENDPOINT" | awk '{print $4}' | while read -r f; do
  d=$(echo "$f" | sed -n 's/^directus-\([0-9]\{4\}\)-\([0-9]\{2\}\)-\([0-9]\{2\}\)_.*/\1\2\3/p')
  if [ -n "$d" ] && [ "$d" -lt "$cutoff" ]; then s3 rm "s3://$R2_BUCKET/backups/$f" && echo "deleted old backup: $f"; fi
done
