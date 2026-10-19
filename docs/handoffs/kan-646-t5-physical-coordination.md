# KAN-646 / T5 — Freeze físico y coordinación de migraciones (2026-10-15)

Estado: **preparación contractual, T5 NO habilitado para RED/schema/writers**.

## HEADs verificados
- dev: `4ca470c99af0f83720b5b7887b617d0cbc443255`; SQLite `0025_h7a_test_event_author_retention`; Supabase/PG `0038_h7a_test_event_author_retention`.
- KAN-646: `564ed61538da7ba65ee7087f9e4a30f77f87ae35`; mismos heads que dev.
- KAN-790 `feat/KAN-789-authorized-snapshot-sql`: `ea3901775cc0b3164efb26e2c8e361c835cbca57`; SQLite `0026_session_generation_review_snapshots`; PG `0039_session_generation_review_snapshots` y `0040_session_generation_preferences`.
- Numeración KAN-646 **no reservada**. Si KAN-790 se integra sin otras migraciones, las candidatas posteriores serían SQLite 0027 y PG 0041, sujetas a reconfirmación de HEAD al ejecutar.

## Alcance y unidades congelados
weight: kg 20.0–350.0 décimas (valueScaled int 200..3500); height: cm 100.0–250.0 décimas (1000..2500); max_hr: bpm 60..240 entero; rest_hr: bpm 25..150 entero. No redondeo implícito, NaN, infinito, unidades intercambiables ni modificación de evidencias clínicas o profesionales.

## Temporalidad y selección T4 conservadas
`observedOn` día civil ISO YYYY-MM-DD efectivo, `recordedAt` instante UTC ISO emitido por servidor. Una lectura tiene `effectiveOn` y `knownAt`; sólo selecciona datos con observedOn <= effectiveOn y recordedAt <= knownAt. Las correcciones son nuevas filas con supersedesObservationId, originales inmutables; las hojas de cadena conocidas sustituyen antecedentes y no los reviven por consulta retrospectiva. Orden observedOn DESC, recordedAt DESC, id ASC. Query histórica reproducible por ambos cortes. Date de corrección puede rectificar valor y observedOn.

**Política propuesta no ratificada**: se permite escribir observedOn entre el día civil actual menos 30 días (inclusive) y hoy (inclusive); se rechaza observedOn futuro. La fecha actual se calcula una sola vez desde contexto regional operativo explícito, no timezone del cliente. Esta política requiere confirmación expresa antes del writer; no se impone sobre lectura retrospectiva de datos ya persistidos.

## FC
Regla propuesta, todavía por ratificar: comparabilidad exclusivamente entre `max_hr` y `rest_hr` de fuente athlete_declared, ambas hojas vigentes al mismo effectiveOn y conocida antes de knownAt, y diferencia absoluta de observedOn <= 30 días civiles. Si son comparables se exige restHr < maxHr; si una falta o no es comparable, no se fabrica ni se convierte en medición la ausente. El sistema debe definir si medición incompatible se muestra con indicador o rechazo (no inventar bloqueo global).

## Esquema físico propuesto
`athlete_biometric_observations`: `id` PK; `team_id` FK RESTRICT; `athlete_profile_id` FK RESTRICT; `kind` CHECK weight/height/max_hr/rest_hr; `value_scaled` INTEGER NOT NULL con CHECK discriminado por kind; `unit` CHECK relación kind/unit (kg,cm,bpm); `observed_on` texto ISO civil con validación estricta en aplicación; `recorded_at` UTC server; `recorded_by_user_id` FK RESTRICT; `source` CHECK 'athlete_declared'; `supersedes_observation_id` FK propia RESTRICT nullable; `correction_reason` nullable con reglas explícitas; `operation_key` texto opaco NOT NULL; `request_digest` hash SHA256 hex de payload canónico. No updates/deletes ordinarios. CHECK no self supersede, UNIQUE supersedes no null, UNIQUE (team_id, athlete_profile_id, recorded_by_user_id, operation_key). FK por separado no prueba igualdad del Team, AthleteProfile, kind o cadena: validar en misma transacción y reautorizar sujeto al escribir. Una corrección sólo puede superar hoja actual, no un ancestro; UNIQUE supersedes evita bifurcación. Revisiones monotónicas en recordedAt, sin ciclos.

Índices: `(team_id, athlete_profile_id, kind, observed_on DESC, recorded_at DESC, id)`; `(team_id, athlete_profile_id, recorded_at)`; `(supersedes_observation_id)` UNIQUE no null; `(team_id,athlete_profile_id,recorded_by_user_id,operation_key)` UNIQUE. Probar equivalencia SQLite y PG, incluyendo CHECK/UNIQUE/FK/rollback y tolerancia a timestamps. Conservar snapshots Drizzle y control de historial de migraciones.

## Transacción e idempotencia
Read/auth H2→active Team H3→effective membership→SELF AthleteProfile, revalidar también en replay. Validar allowlist/campo/unidad/rango y observedOn. Clave idempotente cliente opaca para un intento; subject scoping resuelto por servidor. Canonical payload versionado con operación, kind, valueScaled, observedOn, supersedesObservationId esperado y reason normalizado; digest SHA256. Misma clave+payload tras nueva autorización devuelve registro previo sin mutar; misma clave+payload diferente => conflict y cero escrituras. Insert y guardas bajo transacción; conflictos UNIQUE son conflict recuperable, no retry silencioso con otro ID. Concurrencia: optimistic leaf compare y unique supersedes, exactamente una corrección gana, la otra conflict/no mutation. Probar revocación, Team-switch, repetición, diferencias payload, rollbacks y filas no modificadas.

## H3 boundaries futuros — no cambiar catálogo todavía
`physiology.biometric.self.read` y `physiology.biometric.self.manage` separados, SELF no delegable, presets athlete/assistant/coach/admin únicamente para el sujeto propio en Team activo. Ninguna ampliación de H5B `physiology.self.read` ni de `physiology.read` Coach. DENY en anon/unlinked, Team ambiguo/revocado, membership vencida/duplicada, Profile inactivo/eliminado/ambiguo, cross-Team, client athleteId inyectado o payload desconocido; no operaciones DB de mutación antes del guard, ni mutación sobre DENY. Tests focales por boundary y snapshot antes/después de deny.

## Integración y propiedad
No alterar rama/containers/bases PostgreSQL KAN-790. Antes del primer RED físico: (1) acordar ventana retrospectiva y FC; (2) reconciliar latest HEAD de dev y KAN-790; (3) decidir si integrar primero KAN-790 o rebase controlado; (4) reservar numeración post-integración; (5) coordinar drizzle snapshots, SQLite y PG y owners de tablas; (6) aprobar física y test matrices. Una rama con numeraciones elegidas sobre viejos heads constituye conflicto no autorizado.

## Prohibiciones
No writes/migrations/schema/H3 ahora, ni replanificación, alteración de field_performance_tests, physiology_records, AthleteProfile JSON, HR Coach references, RunningReference o session snapshots. T4 pure selection GREEN does not certify production disclosure.
