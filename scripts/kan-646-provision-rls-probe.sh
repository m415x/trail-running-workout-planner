#!/usr/bin/env bash
set -euo pipefail
# PG-6 only; never provision roles in acceptance or historical databases.
name=kan646-biometric-pg
database=kan646_biometric_disposable
actual="$(docker exec "$name" psql -X -U biometric -d "$database" -Atqc 'SELECT current_database()')"
if [[ "$actual" != "$database" ]]; then echo 'BLOCKED: wrong PG database' >&2; exit 1; fi
docker exec -i "$name" psql -X -v ON_ERROR_STOP=1 -U biometric -d "$database" <<'SQL'
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kan646_rls_probe') THEN
    CREATE ROLE kan646_rls_probe NOLOGIN NOSUPERUSER NOBYPASSRLS NOINHERIT;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'kan646_rls_probe' AND (rolsuper OR rolbypassrls)) THEN
    RAISE EXCEPTION 'BLOCKED: PG-6 probe role has privileged attributes';
  END IF;
END $$;
GRANT USAGE ON SCHEMA public TO kan646_rls_probe;
GRANT SELECT, INSERT ON public.athlete_biometric_observations TO kan646_rls_probe;
SQL
echo 'PG-6 ephemeral nonprivileged probe role provisioned only in KAN-646 database.'
