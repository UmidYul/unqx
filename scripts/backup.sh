#!/bin/bash
set -euo pipefail

if [[ -z "${BACKUP_DIR:-}" ]]; then
  echo "BACKUP_DIR is not set"
  exit 1
fi

mkdir -p "$BACKUP_DIR"
FILE="${BACKUP_DIR}/unqplus_$(date +%Y%m%d_%H%M%S).sql.gz"
pg_dump "$DATABASE_URL" | gzip > "$FILE"
find "$BACKUP_DIR" -name "*.sql.gz" -mtime +30 -delete
