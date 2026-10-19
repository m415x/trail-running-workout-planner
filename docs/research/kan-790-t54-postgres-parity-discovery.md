# KAN-790/T5.4 — Discovery de paridad PostgreSQL (2026-10-14)

## Evidencia y alcance

Baseline aprobado, **sin modificación de código productivo en este discovery**: `995237db355fb626858fde298a3b088f7735e961`, `pn verify --db` PASS 6/6 (Tests 88428 ms, TypeScript 10043 ms, ESLint 26119 ms, Build 21253 ms, i18n 287 ms, SQLite 42535 ms; total 188665 ms). Jira comentario 13040. Ese gate **no** ejecuta integración PostgreSQL.

Fuentes inspeccionadas:
- `lib/session-generation/authorized-review-snapshot-confirmation.ts`, `review-snapshot-confirm-reconciliation.ts`, `review-snapshot-reconciliation-writer.ts`.
- `lib/session-generation/review-snapshot-sqlite-repository.ts` y `review-snapshot-postgres-repository.ts`.
- `lib/session-generation/authorized-review-snapshot-next-server.ts`, `authorized-review-snapshot-affected-groups-next-server.ts`, `authorized-review-snapshot-affected-group-set.ts`.
- `lib/session-generation/session-regeneration.ts`, `generation-explanation-persistence.ts`.
- `db/schema.ts`, `db/supabase/schema.ts`, `db/supabase/session-generation-review-snapshot-schema.ts`, `drizzle/supabase/0039_session_generation_review_snapshots.sql`.
- `tests/session-generation/kan-789-review-snapshot-postgres-{consume,concurrency,allocation,replacement}.test.ts`, `db/supabase/verify-planning-review-transaction.ts`.

## Primitivas por motor

| SQLite | PostgreSQL | Estado |
| --- | --- | --- |
| `better-sqlite3` / Drizzle SQLite, operaciones síncronas | `postgres` SQL / Drizzle PG asíncrono | **No reutilizable directamente**: requiere adaptador asíncrono, conservando dominio puro |
| `sqlite.transaction(...).immediate()` y `sqlite.inTransaction` | `client.begin(async tx => ...)`, `TransactionSql`, `SELECT ... FOR UPDATE` | CAS PostgreSQL implementado; falta escribir Session+prescripción+auditoría mediante **el mismo tx** |
| `database.$client === sqlite` verifica identidad física | `persist(tx, snapshot)` recibe `TransactionSql` fijado a la conexión | PG debe prohibir consultas/escrituras de reconciliación por `supabaseDb` global o pool independiente |
| Texto JSON serializado y `TEXT` en SQLite | `jsonb`, tipos PG, mismas claves `shared_event_key`, `generation_key` y unicidad Session+microcycle | Esquema compatible conceptualmente; traducción de tipos obligatoria |
| Relectura de `sourceManifest` bajo CAS SQLite | No existe lector PG de manifest canónico ni confirmador equivalente integrado | **Sin paridad de vigencia** |
| Escritura real `sessions`, `group_session_prescriptions`, `session_generation_modification_records` | Callback genérico `persist(tx)` en CAS; ejemplos usan tabla temporal `kan789_pg_committed_generation` | **Sin paridad de reconciliación y auditoría real** |

## Matriz de paridad

Etiquetas: **D** = lógica de dominio compartida, **S** = evidencia SQLite focal, **P** = repositorio PG implementado, **PG-real parcial** = prueba PostgreSQL desechable condicionada a `KAN789_PG_URL`; **faltante** = sin implementación/evidencia suficiente para CONFIRM real.

| Invariante | SQLite | PostgreSQL | Brecha para acreditar T5.4 |
| --- | --- | --- | --- |
| H2 User EPT | Boundary Next Server y test focal | Misma lógica conceptual H2 (D) | No existe composición PG de autorización y CONFIRM real (faltante) |
| H3 Team activo / ámbito Plan→Group→Team | Validación en Next y escritor (S) | Snapshot repository filtra owner/team/plan (P) | Releer ámbito y Team dentro del tx PG; no confundir SQL scope con H3 (faltante) |
| H4A grupos actuales/propuestos | Preautorización por grupo + recheck read-set en writer (S) | Helper de autorización puro compartible (D) | Recolectar read-set con SQL PG, preautorizar y revalidar en tx (faltante) |
| Base / Variant / cohorte | Validación y pruebas positivas y negativas (S) | Columnas/FK PG disponibles | Confirmación/reconciliación PG con linaje + explicación histórica (faltante) |
| Obsolescencia `sourceManifest` | Relectura de fuente SQL dentro CAS; distinción `generation_stale` | No hay manifest PG canónico ni lector de fuentes análogo | Implementar fuente canónica y compararla en mismo tx (faltante) |
| Reconciliación de Sessions y prescripciones | `reconcileSessionGeneration` (D) + escritor SQLite (S) | Función pura reutilizable (D), escritor PG ausente | Port PG asíncrono con SQL reales; misma semántica (faltante) |
| Manual / generated_modified | Protección en dominio y escritor SQLite (S) | Columnas `generation_ownership` disponibles | Ejecución PG real de colisiones y obsolescencias (faltante) |
| Concurrencia / colisiones de sesiones compartidas | `BEGIN IMMEDIATE` serializa escrituras (S) | `FOR UPDATE` serializa **el mismo snapshot**, `pg_advisory_xact_lock` cubre **cuota CREATE** por owner/team/plan (P) | Distintos snapshots/planes pueden modificar `shared_event_key` compartido: diseñar serialización/reintentos, sin confiar solo en `FOR UPDATE` de snapshot (material) |
| CAS e idempotencia | CAS con rollback y replay (S) | CAS con `UPDATE RETURNING`, replay y `FOR UPDATE` (P; tests PG-real condicionados) | Integración del callback real no probada |
| Rollback atómico | CAS, sesiones, prescripciones, auditoría con trigger de falla (S) | Callback PG en una transacción, test de tabla temporal (PG-real parcial) | Fallo real posterior a escrituras de Session/Prescription y auditoría, verificar antes/después (faltante) |
| Auditoría histórica | Snapshot validado contra scope, filas append-only (S) | `generation_explanation jsonb` y columnas de audit (schema) | Inserciones reales, ausencia de audit por noop y protección de historia (faltante) |

## Limitaciones de evidencia

Los tests `kan-789-review-snapshot-postgres-*.test.ts` usan PostgreSQL **real desechable** únicamente cuando `KAN789_PG_URL` está configurada; en ausencia de variable son **SKIP**, por tanto un gate PASS de tests generales no prueba que corrieron. Aceptan únicamente `127.0.0.1:55439/kan789_acceptance` y verifican `current_database()`. `kan-789-review-snapshot-postgres-consume.test.ts` utiliza **tabla temporal** para el callback de persistencia: demuestra CAS + rollback + retry del repositorio, **no** persistencia de Sessions/Prescriptions/auditoría ni H2/H3/H4A. El test de concurrencia usa conexiones físicas distintas, pero sobre la **misma identidad de snapshot**; no verifica dos snapshots distintos convergentes.

PostgreSQL 0039 habilita RLS para snapshots; la migración inspeccionada no añade políticas en ese fichero. Antes de usar credenciales de runtime probar explícitamente permisos efectivos y el contexto de conexión, sin trasladar autoridad desde SQL scoped ni usar una conexión de test privilegiada como evidencia H2/H3/H4A.

## Brecha material de aislamiento y alternativas antes de codificar

**La paridad todavía no es acreditable** y no procede cerrar T5.4. El aislamiento de `client.begin` por defecto y bloqueo `FOR UPDATE` de snapshot **no** bastan como prueba para conflictos entre snapshots diferentes sobre una Session compartida, ni estabilizan por sí solos fuentes/linajes re-leídos fuera del bloqueo. La transacción PG deberá abarcar CAS, manifest SQL, reconciliación, escrituras y auditoría. No usar un nuevo mecanismo de autoridad: reutilizar H2/H3/H4A y `reconcileSessionGeneration`.

Opciones sujetas a decisión material:
- **A — `SERIALIZABLE` + retries acotados de `40001`/`40P01` de transacciones completas**, relectura del estado y fuentes dentro de cada intento, además de manejar conflictos únicos `23505` con relectura/reintento si son carreras de generación. Requiere atención a transacciones de edición concurrente y presupuesto de retries. Mantiene progreso entre grupos disjuntos.
- **B — locks transaccionales determinísticos** (p. ej., lock por Team/grupo/plan y por claves compartidas ordenadas), y relectura bajo lock + restricciones únicas. Requiere acordar la misma disciplina con otros escritores concurrentes; un lock solo del snapshot o del Plan no protege todos los eventos compartidos.

No escoger aislamiento silenciosamente, no sustituir el PG real por mocks, y no implementar medio escritor hasta resolver esta diferencia.

## Micro-sprints RED→GREEN autorizados tras decisión

1. **PG-1 infraestructura/evidencia**: verificar DB PostgreSQL desechable existente, migraciones canónicas, RLS y conexión no privilegiada; test real de concurrencia de dos snapshots distintos con mismo `shared_event_key`, inicialmente RED funcional (no import faltante o SKIP), demostrar control del aislamiento seleccionado.
2. **PG-2 fuentes y scope**: lector PG SQL de manifest efectivo, Plan Team/Group Base/Variant y recheck dentro del tx; tests reales de `generation_stale` y DENY sin escrituras.
3. **PG-3 escritor asíncrono**: port SQL PG basado en `tx` suministrado por `consumeReviewSnapshotPostgres` y reutilización de `reconcileSessionGeneration`/validación de explicaciones; prueba con Session+Prescription+auditoría reales y rollback por fallo audit.
4. **PG-4 convergencia**: multi-connection, diferentes snapshots/planes, ownership protegido, colisiones Session+microcycle, variant, reintentos idempotentes, audit append-only; comparativa de invariantes con SQLite.
5. **PG-5 cierre**: ejecutar tests PG *no SKIP* con evidencia de `current_database()`, SHAs y resultados, verificaciones aplicables y reconciliación en Jira. **Solo después** avanzar automáticamente a T5.5 (Coach CREATE→GET→CONFIRM con ID opaco, sin POST masivo). KAN-791/T6 reserva la aceptación HTTP 53 semanas/239 sesiones.

## Estado de decisión

**Discovery completado; paridad T5.4 NO acreditada.** La necesidad de estrategia de concurrencia entre distintos snapshots sobre eventos compartidos es una decisión material de aislamiento entre motores. Esperar disposición A/B antes de implementar el nuevo port PostgreSQL, sin alterar la rama productiva, sin merge a `dev` y sin cerrar KAN-790.
