# KAN-646/T5 PostgreSQL — discovery de aislamiento y primer gate (2026-10-17)

## Baseline y evidencia revisada
- SQLite GREEN aceptado: `33832c59fa4e2345ed4c3e762f4c5661580080c9`, Jira `13433`.
- PostgreSQL `0041_glossy_starjammers.sql` declara tabla biométrica, CHECK/FK/índices y `ENABLE ROW LEVEL SECURITY`; **no** acredita la aplicación de la migración, políticas RLS efectivas ni pruebas de ejecución.
- Patrón PG aprobado: `postgres` (postgres.js), `client.begin(async tx => ...)`, `postgres.TransactionSql`, control de concurrencia con bloqueos y múltiples clientes `max:1`. Ver `lib/session-generation/review-snapshot-postgres-repository.ts`, `docs/research/kan-790-t54-postgres-parity-discovery.md` y tests `kan-789-review-snapshot-postgres-{allocation,concurrency}.test.ts`.
- `scripts/test-runner.ts`: `assertSafePostgresRegressionTarget` exige **tres** URLs `KAN789_PG_URL`, `SUPABASE_DATABASE_URL`, `SUPABASE_DIRECT_URL` en `127.0.0.1:55439/kan791_regression_disposable`; `scripts/tdd.ts` llama este guard ANTES de hacer git pull y ejecutar tests PG. El clasificador de fuentes tampoco reconoce `KAN646_PG_URL`. Es un impedimento material de aislamiento, **no** una razón para apuntar KAN-646 al laboratorio de KAN-791.
- El runner global serializa ciertos archivos PG compartidos con `--test-concurrency=1`; hay que extender la lane específicamente para el fixture KAN-646, evitando conflictos de scripts de aceptación ajenos.

## Laboratorio nuevo propuesto, sujeto a verificación física
- Docker/PostgreSQL local **independiente** exclusivo para KAN-646, base `kan646_biometric_disposable`, host literal `127.0.0.1`, puerto dedicado `55446`.
- Variable separada `KAN646_PG_URL`; prohibidos `KAN789_PG_URL` y el triple de variables KAN-791 como fuente de este test. URL completa con usuario/password, sin query/hash; rechazo absoluto de targets distintos.
- Provisión en contenedor temporal exclusivo `kan646-biometric-pg`, sin volúmenes históricos ni docker-compose de aceptación; migraciones canónicas en orden hacia un esquema nuevo; comprobación explícita `current_database()`, `inet_server_port()`, permisos y `pg_class.relrowsecurity` + `pg_policies`.
- Esquema de tests: prefijos exclusivos/UUID, transactions + cleanup limitado a esos IDs, y no `DROP DATABASE` sobre recursos ajenos. No confiar en cleanup como sustituto de la separación de base.
- Estado de acreditación: **DISEÑO inspeccionado, infraestructura NO ejecutada ni laboratorio físico acreditado**. No atribuir GREEN hasta tener fingerprint del servidor/base/rol, migraciones aplicadas y test real.

## Secuencia de gates
1. RED/ GREEN de harness que reconozca `KAN646_PG_URL`, valide exclusivamente la base nueva y preserve sin alteración guard KAN-791; aislar/serializar el lane de pruebas KAN-646.
2. Provisión/validación del contenedor independiente, migración 0041 aplicada; negar si falla el preflight.
3. RED transaccional PostgreSQL CREATE/correction/replay/conflict/no-write DENY con relectura de membership y SELF **dentro** de `tx`. H2 y active Team de sesión siguen siendo precondiciones server-side independientes: no llamar H2 a una consulta SQL de membership.
4. GREEN PG, constraints físicos y distinción RLS habilitado/políticas/rol versus autorización server-side. Luego prueba concurrente de múltiples conexiones y rollback.
5. No Server Actions públicas, no cierre T5 ni merge sin gates Harness v2.
