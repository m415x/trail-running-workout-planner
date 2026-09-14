# Auditoría del flujo de entrenamiento realizado

Historia: KAN-258 — Registrar entrenamiento realizado de forma durable  
Task: KAN-284 — Auditar flujo legacy de registro  
Rama: `h-23-realized-training`

## Objetivo

Identificar qué partes del flujo actual de registro de entrenamiento pueden reutilizarse y cuáles deben reemplazarse para que la evidencia realizada sea durable y compatible con el boundary H12/readiness.

## Flujo actual

El flujo visible parte de `WorkoutCard` y abre `LogWorkoutDialog` para una sesión del calendario. El diálogo delega estado y serialización en `useLogWorkoutDialog`.

En el estado actual:

1. `LogWorkoutDialog` captura distancia, duración, autoevaluación/RPE y notas sobre una sesión planificada.
2. `useLogWorkoutDialog` inicializa varios valores desde el workout prescrito.
3. `handleSave()` convierte inputs vacíos en `0` mediante `parseFloat(...) || 0`, `parseInt(...) || 0` y defaults equivalentes.
4. El payload resultante usa el contrato legacy `LoggedWorkoutPayload`.
5. `WorkoutCard` entrega ese payload a `useWorkoutCard.handleSaveSession()`.
6. `handleSaveSession()` sólo ejecuta `setIsLogged(true)`; no existe server action ni escritura durable en este camino.
7. Al recargar o reiniciar, el estado de “registrado” se pierde.

Por lo tanto, hoy el flujo de producto simula localmente que una sesión fue registrada, pero no completa el boundary persistente `workout_logs` + `workout_log_evidence`.

## Contrato legacy vs H12

### `LoggedWorkoutPayload`

El contrato legacy exige o materializa como número:

- `distanceKm`
- `durationMin`
- `elevationGain`
- `rpe`

Esto impide distinguir de forma fiable:

- dato conocido igual a cero;
- dato no registrado/unknown;
- default derivado del formulario;
- valor prescrito copiado como valor inicial pero no confirmado por el atleta.

### Boundary H12/readiness

H12 ya dispone de:

- `RealizedMetric` con estados `known` / `unknown`;
- `RealizedMetricName` para distancia, duración, D+, FC media y RPE;
- `RawRealizedTrainingRecord` / `RealizedTrainingRecord`;
- provenance (`source`, `sourceActivityId`, `loggedAt`, linkage explícito a `Session`);
- semántica legacy `legacy_zero_ambiguous`;
- deduplicación sólo por identidad estable;
- quality/limitations para datos parciales o ambiguos.

`workout_log_evidence` ya funciona como sidecar de `workout_logs` con `source`, `sourceActivityId` y `knownMetricFields`.

## Qué se reutiliza

### UI y composición

Se reutilizan como base:

- `WorkoutCard` como punto de entrada desde una sesión planificada;
- `LogWorkoutDialog` como patrón visual/modal;
- `SelfAssessment`, `RpeSelector` y controles existentes;
- `ConfirmActionDialog` para acciones destructivas/correcciones cuando corresponda.

La UI debe adaptarse al nuevo contrato, no descartarse por completo.

### Persistencia y dominio

Se reutilizan:

- `workout_logs` como entidad durable de entrenamiento realizado;
- `workout_log_evidence` como evidencia/provenance y known-ness por métrica;
- normalización H12 en `lib/readiness/realized-training.ts`;
- `sessionId` como único linkage autoritativo con una sesión planificada;
- semántica H12 para legacy/unknown/deduplicación.

No se crea una segunda tabla/modelo paralelo de realized training.

## Qué debe reemplazarse o modificarse

### 1. Persistencia sólo-local

`useWorkoutCard.isLogged` no puede ser la fuente de verdad. Debe derivarse del registro durable existente y actualizarse después de una operación persistente exitosa.

### 2. Serialización `empty -> 0`

Debe eliminarse la conversión automática de input vacío a cero. El contrato de captura debe transportar explícitamente known/unknown o una representación equivalente que permita construir `knownMetricFields` sin ambigüedad.

### 3. Valores prescritos como supuesta evidencia

Distancia, duración o D+ planificados pueden usarse como sugerencia visual, pero no deben convertirse en “realizados” sólo por estar precargados. La persistencia debe reflejar valores confirmados por el atleta.

### 4. Linkage implícito

Abrir el diálogo desde una `Session` puede proporcionar un `sessionId` explícito. Para registros libres, `sessionId = null`. No se inferirá asociación por fecha, workout, título o similitud de métricas.

### 5. Contrato `LoggedWorkoutPayload`

Debe dejar de ser el contrato autoritativo de persistencia. Puede deprecarse o convertirse en un adapter temporal, pero el flujo nuevo debe usar un input durable alineado con H12.

### 6. Delete/reset legacy

“Restablecer registro” actualmente sólo modifica estado local. La historia debe definir edición/corrección durable y trazable antes de exponer una eliminación física como comportamiento normal.

## Riesgos detectados

- Prellenar métricas planificadas puede producir falsa evidencia si se guardan sin confirmación.
- El uso de `|| 0` destruye la distinción unknown/zero exigida por H12.
- `isLogged` local puede mostrar una sesión como registrada sin que exista evidencia persistida.
- `workoutId` identifica una plantilla/workout, no sustituye `sessionId` como linkage plan-real.
- Deduplicar por fecha o métricas impediría dos entrenamientos reales el mismo día.

## Decisiones para las siguientes tasks

1. El nuevo flujo persistirá siempre `workout_logs` + `workout_log_evidence` de forma coherente/atómica.
2. `source = manual` para la captura de esta historia.
3. `sourceActivityId = null` para captura manual salvo que exista en el futuro una identidad estable externa.
4. `knownMetricFields` será la fuente explícita de known-ness para nuevos registros.
5. Un cero confirmado se guarda como valor `0` y el campo correspondiente se incluye en `knownMetricFields`.
6. Un campo unknown no debe entrar en `knownMetricFields`; su representación persistente no se reinterpretará como cero conocido.
7. El vínculo a planificación será exclusivamente `sessionId` explícito.
8. Los registros libres son válidos con `sessionId = null`.
9. Readiness seguirá consumiendo el boundary H12 existente; la historia debe alimentar ese boundary en lugar de duplicarlo.

## Secuencia recomendada

- KAN-285: contrato durable de captura known/unknown/zero.
- KAN-286: persistencia SQLite/Supabase y atomicidad log + evidence.
- KAN-287: repositorio/servicio durable.
- KAN-288/KAN-289: linkage explícito y registros libres.
- KAN-290: adaptar `LogWorkoutDialog` al contrato durable.

Esta auditoría no modifica todavía comportamiento de producto.