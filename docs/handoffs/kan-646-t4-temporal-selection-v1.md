# KAN-646 / T4 — Contrato de selección temporal v1 (sin persistencia productiva)

Baseline de rama: `1af5008b645a5fb79993fe8ad07ffd1e4eb6c925`. Decisiones de producto del 15/10/2026. Este archivo describe **selección pura y pruebas con fixtures sintéticos**, no una proyección productiva autorizada ni un GREEN de lectura persistida.

## Dominio
Sólo peso (20.0–350.0 kg, décimas), altura (100.0–250.0 cm, décimas), FC máxima (60–240 bpm, enteros), FC reposo (25–150 bpm, enteros). Valores enteros canónicos: décimas de kg/cm; bpm íntegros. Rechazar exceso de precisión, redondeos implícitos, NaN, infinitos, unidades incorrectas y parámetros fuera de allowlist. Estos rangos son operativos, no clínicos.

Capacidades propuestas: `physiology.biometric.self.read` y `physiology.biometric.self.manage`, SELF obligatoria, no delegables, base presets athlete/assistant/coach/admin; en cada caso únicamente el propio AthleteProfile único y activo dentro del Team activo, con H2 y membership H3 vigentes. **No incorporarlas al catálogo durante T4 documental/puro.** `physiology.self.read` H5B no autoriza estos valores, ni escritura.

## Temporalidad y consultas
- `observedAt` es fecha efectiva *civil* ISO `YYYY-MM-DD` de la observación; `recordedAt` es instante UTC ISO registrado por servidor. Ambas son inmutables por registro físico. Una corrección aporta nueva fila y puede rectificar `observedAt`.
- `effectiveOn` (civil ISO) limita hechos observados; `knownAt` (instante UTC ISO) limita **qué filas existían** en el sistema para reconstrucción histórica. Un hecho es candidato sólo si `observedAt <= effectiveOn` y `recordedAt <= knownAt`.
- Revisiones: `supersedesObservationId` apunta a la versión anterior dentro del mismo Team/Profile/kind/cadena; una versión sólo se considera sustituida si su sucesora ya estaba registrada antes de `knownAt`. Elegir una **hoja visible** por cadena. Una corrección futura en fecha efectiva no invalida la selección de un antecesor para otro corte retrospectivo: si la hoja visible aún no es efectiva, la cadena no aporta valor para ese corte (no revivir datos rectificados).
- Entre hojas visibles elegibles de cadenas distintas del mismo parámetro: `observedAt` descendente, luego `recordedAt` descendente, por último `id` ascendente. No mezclar fuentes Coach, campos JSON legacy, pruebas oficiales ni métricas derivadas.
- La lectura vigente usa `effectiveOn =` fecha civil actual y `knownAt =` instante actual. La reconstrucción exige ambos cortes; consultar sólo por `observedAt` puede revelar correcciones que entonces todavía no existían.
- La política de aceptación de una fecha en escrituras nuevas es **pendiente de confirmación expresa**: máximo 30 días retrospectivos y prohibición de fechas futuras. No se aplica como límite de lectura histórica ni a observaciones legacy.

## FC y ausencias
Para comparación de FC, no combinar parámetros de distintas fuentes. En SELF, **compatibilidad temporal** propuesta = ambos vigentes en la misma fecha de corte y fechas `observedAt` separadas por no más de 30 días. Si ambos valores existen y son compatibles, `restHr < maxHr` es una validación de coherencia, no una medición nueva ni un cálculo de zona. Si falta una, mostrar `unknown` para esa medición, nunca completarla automáticamente. No bloquear una observación aislada por ausencia de la otra. El rango de 30 días de compatibilidad FC es propuesta específica a ratificar, distinta de la ventana de backdating.

## T5: restricciones y concurrencia (NO implementar todavía)
Tabla conceptual `athlete_biometric_observations`: PK observación; FK no-cascada a Team, AthleteProfile, User EPT; kind/unit/source CHECK; valor entero escalado por kind con rangos CHECK; `observed_on` fecha civil ISO; `recorded_at` UTC autoritativo; `recorded_by_user_id`; `supersedes_observation_id` FK propia; motivo de corrección; clave y digest de operación. UNIQUE de `supersedes_observation_id` no nulo; UNIQUE de `team_id,athlete_profile_id,recorded_by_user_id,operation_key`; CHECK de estructura corrección/nueva. Índices por `team_id,athlete_profile_id,kind,observed_on DESC,recorded_at DESC,id` y por `recorded_at`. La igualdad de Team/Profile/kind/chain entre versión previa y sucesora debe verificarse transaccionalmente (FK sola insuficiente).

Un request idempotente tiene clave opaca estable generada para el intento y digest SHA-256 de representación canónica versionada de `operation kind, parameter, canonical scaled value, observedOn, expectedPriorId, correctionReason` más sujeto resuelto. La repetición idéntica, **tras revalidar H2/Team/H3**, devuelve la operación original sin mutación. Reutilizar clave con payload distinto => conflicto sin mutación. Corrección concurrente: serializar/compare-and-insert con expectedPriorId, UNIQUE supersedes y rollback; una sola rama gana; la otra recibe conflicto, sin sobrescribir.

SQLite y PostgreSQL deben tener migraciones separadas coordinadas con HEADs actuales de `dev` y KAN-790, snapshots Drizzle, transacciones y pruebas de paridad. **No reservar numeración ni crear migraciones en T4.** No cambiar fuentes de RunningReference, planificación, sesiones, evaluaciones 1000m ni fisiología JSON.

## Alcance del test puro T4
Prueba sin DB y sin sesión: cortes efectivos/de conocimiento, revisión y correcciones en fecha, desempates deterministas, exclusión de observaciones futuras y diferenciación de fuentes, sin fabricar valores; tests negativos de identidad/Team/H3 son posteriores cuando exista boundary productivo autorizado. Test puro GREEN **no** implica disclosure de datos de usuarios.
