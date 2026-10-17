# KAN-646/T5 — contrato físico regional Team IANA (2026-10-17)

## Decisión y alcance
Se aprobó zona IANA **por Team activo**, exclusivamente desde persistencia server-side. No admitir zona, Team, User ni AthleteProfile del cliente; no fallback a UTC/host/navegador/Open-Meteo. Falla cerrada ante zona nula, ausente, inválida o Team no resuelto de forma unívoca. `recorded_at` permanece instante UTC server-side; `observed_on` fecha civil YYYY-MM-DD calculada/validada conforme a la zona del Team vigente cuando se escribe.

## Modificación física mínima y paridad
1. `teams.time_zone TEXT NULL` en SQLite y PostgreSQL, sin DEFAULT y sin backfill. El nombre IANA se valida con `Intl.DateTimeFormat` server-side antes de usarlo. No restringir mediante CHECK de listado estático de TZDB: su conjunto puede actualizarse. El campo nullable es indispensable para no asignar zona implícita a instalaciones actuales.
2. `athlete_biometric_observations.observed_time_zone TEXT NULL` en ambas bases, copia **inmutable** de la zona IANA validada de Team al momento del CREATE o correction. Sin DEFAULT/backfill: datos históricos anteriores conservan NULL, no se reconstruye una zona que nunca se registró. Incorporar en los nuevos writes autorizados, junto a `recorded_at` y `observed_on`, dentro de la misma transacción. Los tests legacy existentes que insertan directo pueden dejar NULL, pero ningún nuevo writer público lo puede hacer.
3. Migraciones append-only: SQLite siguiente `0028` después de `0027_oval_venus`; PostgreSQL siguiente `0042` después de `0041_glossy_starjammers`. Generar y reconciliar snapshots Drizzle `drizzle/sqlite/meta` y `drizzle/supabase/meta`; no regenerar/editar retroactivamente 0027/0041 ni crear colisiones. Verificar journal y estado HEAD antes de generar. No aplicar migraciones PostgreSQL salvo al contenedor dedicado con guard `KAN646_PG_URL`.
4. No agregar UI, permissions, ni nuevos endpoints administrativos.

## Provisioning explícito de Teams existentes
- Todos los Teams existentes quedan con `time_zone=NULL` después de la migración; operación biométrica fail-closed.
- Responsable operativo autorizado configura la zona por **Team ID explícito** mediante mecanismo de provisioning administrativo separado y acotado (script SQL/mantenimiento manual auditado según política operacional). Antes de provisionar: verificación explícita del ID, zona IANA y ámbito; nunca inferir región desde sede, atletas, clima, IP, host, locale o país. No actualizar conjuntos de Teams en bloque ni configurar zona por default.
- Actualizaciones: registrar operativamente quién/cuándo/antes/después y aplicar únicamente al Team elegido, con transacción y control de concurrencia de configuración; no introducir capacidades UI/permisos sin contrato distinto.
- Cuando se implemente ejecución de producción, el resolver de zona no debe usar valores enviados por el cliente ni cacheos que permitan utilizar una zona distinta de la persistida/autorizada.

## Cambio de zona y semántica histórica
- Cambio de Team.time_zone afecta **sólo las operaciones posteriores**. Un registro existente conserva `observed_on`, `recorded_at` y `observed_time_zone` del instante de escritura. No recalcular fechas históricas, ni UPDATE masivo de observaciones; correcciones append-only crean nueva observación con zona vigente de ese momento, sin mutar antecesor.
- `observed_on` es la fecha civil declarada de medición y `recorded_at` el instante UTC de persistencia; no inferir el instante exacto de medición a partir del par `observed_on` / `observed_time_zone`. Si el producto en el futuro requiere timestamp exacto de medición, deberá tener contrato específico.
- Registros existentes con `observed_time_zone=NULL` son explícitamente de procedencia regional desconocida; nunca reinterpretarlos utilizando zona actual del Team.

## Boundary y cortes RED/GREEN
- RED físico: columnas presentes/nullable y sin fallback en schemas y migraciones canónicas, paridad SQLite/PostgreSQL, snapshots.
- GREEN de región: lectura Team server-side tras H2/H3 SELF; validación IANA, no-write en missing/invalid; sellar zona en observación mediante repositorio transaccional, incluso replay con reauth.
- RED/GREEN composición privada Next: reutilizar `resolveBiometricSelfAuthority('manage')`; el cliente sólo aporta allowlist; DB reauth del sujeto y zona Team en una misma transacción para evitar TOCTOU.
- Negativos: Team cambiado/revocado, perfil ajeno/no activo/ambiguo, zona ausente o inválida, replay luego de revocación, payload inválido y no-write durable.
- Fault injection tras primer INSERT válido **dentro de repositorio PG autorizado**, no solo `client.begin` genérico.
- Superusuario de PG lab no acredita policy RLS productiva; mantener rol ordinario/probes separados. PG0..6 cerrados; no reabrir sin regresión.
- No publicar Server Actions ni finalizar KAN-646/T5 antes de gates Harness v2.
