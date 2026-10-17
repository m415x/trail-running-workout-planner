#!/usr/bin/env bash
set -euo pipefail
# KAN-646-only disposable PostgreSQL: never touch KAN-791 containers/volumes.
name=kan646-biometric-pg
if ! command -v docker >/dev/null 2>&1; then echo 'BLOCKED: Docker required' >&2; exit 1; fi
if docker container inspect "$name" >/dev/null 2>&1; then
  echo "BLOCKED: container $name already exists; inspect manually, never reuse or delete implicitly" >&2
  exit 1
fi
if docker ps --format '{{.Ports}}' | grep -q '0.0.0.0:55446->\|127.0.0.1:55446->'; then
  echo 'BLOCKED: dedicated port 55446 already in use' >&2
  exit 1
fi
: "${KAN646_PG_PASSWORD:?BLOCKED: set KAN646_PG_PASSWORD for disposable local database}"
docker run --detach --name "$name" --pull=missing \
  --publish 127.0.0.1:55446:5432 \
  --env POSTGRES_USER=biometric \
  --env POSTGRES_DB=kan646_biometric_disposable \
  --env POSTGRES_PASSWORD="$KAN646_PG_PASSWORD" \
  --tmpfs /var/lib/postgresql/data:rw,size=512m \
  postgres:16-alpine
echo 'CREATED: isolated ephemeral PostgreSQL. Verify readiness and run canonical migrations before tests.'
echo 'Do not reuse KAN-791 databases or acceptance fixtures.'
