# KAN-260 — Adherencia sobre evidencia confiable

## Alcance entregado

KAN-260 deriva una proyección explicable de adherencia a partir de `AthletePlanRealComparison` (KAN-259). No relee ni reinterpreta logs crudos y no modifica planificación ni evidencia realizada.

La capa pública es `AthleteAdherence` y declara siempre:

- ventana evaluada (`week` o `month`),
- regla aplicada (`ruleId` + `version`),
- cobertura de evidencia,
- denominador confirmado,
- adherencia por frecuencia cuando los datos son suficientes,
- dimensiones comparables independientes,
- limitaciones heredadas de resolución de planificación.

## Semántica de frecuencia

Estados de KAN-259:

- `matched` y `deviation` => sesión confirmada como realizada;
- `known_not_completed` => sesión confirmada como no realizada;
- `unknown` => no entra al denominador y reduce cobertura;
- `unplanned_realized` => se informa aparte y no aumenta adherencia al plan.

Fórmulas:

```text
confirmedCompleted = matched + deviation
confirmedOutcomes = matched + deviation + known_not_completed
frequencyAdherence = confirmedCompleted / confirmedOutcomes
coverage = confirmedOutcomes / eligiblePlannedSessions
```

La regla v1 publica adherencia sólo con:

- al menos 2 resultados confirmados;
- cobertura >= 60%;
- ninguna limitación de resolución de planificación en la ventana.

Si no se cumplen estos requisitos, `adherencePercent` es `null` y el estado es `insufficient_data`; nunca se fabrica `0%` por ausencia de evidencia.

## Dimensiones

`distanceKm`, `durationMin`, `elevationGainM` e `intensity` se evalúan de forma independiente. Cada dimensión usa únicamente comparaciones `matched`/`deviation` y requiere al menos 2 muestras comparables en regla v1.

No existe un score agregado de dimensiones.

## Tendencia

La tendencia usa cuatro ventanas semanales y considera únicamente semanas cuyo resultado de frecuencia sea publicable. Regla v1 requiere al menos 3 semanas comparables.

- cambio absoluto < 5 puntos porcentuales => `stable`;
- >= +5 pp => `improving`;
- <= -5 pp => `declining`.

Semanas insuficientes permanecen como puntos `null` y no mueven la tendencia.

## Versionado y reproducibilidad

Las reglas viven en `ADHERENCE_RULES` y la versión 1 debe conservarse cuando se introduzcan versiones futuras. Un cambio que altere elegibilidad, denominador, cobertura, umbrales o interpretación requiere una nueva versión.

### Decisión de persistencia

KAN-260 v1 **no persiste snapshots de adherencia**.

Motivo: el resultado es reproducible desde la comparación durable de KAN-259 más una definición de regla conservada por versión. Persistir un segundo estado derivado agregaría riesgo de divergencia sin aportar una necesidad de auditoría adicional en esta historia.

Revisar esta decisión si aparece alguno de estos requisitos:

- cierre regulatorio de períodos,
- necesidad de conservar resultados aun cuando se corrija evidencia histórica,
- reglas externas que no puedan mantenerse de forma determinista por versión,
- coste de recomputación que vuelva inviable la derivación on-demand.

## Límites con historias siguientes

- **KAN-261** calcula carga exclusivamente desde realized confiable. No debe usar el porcentaje de adherencia como carga ni fitness.
- **KAN-262** puede reutilizar comparación/adherencia para contexto, pero sus alertas de exceso sistemático requieren reglas propias. KAN-260 no produce alertas ni cambia planificación.
- Adherencia no equivale a preparación competitiva, calidad de sesión ni readiness.

## Archivos principales

- `types/training/adherence.types.ts`
- `lib/adherence/athlete-adherence.ts`
- `lib/adherence/adherence-trend.ts`
- `app/actions/adherence-actions.ts`
- `features/athletes/components/AdherenceSummary.tsx`
- `app/[locale]/dashboard/athletes/[athleteId]/training/page.tsx`
- `tests/adherence/athlete-adherence.test.ts`
- `tests/adherence/adherence-trend.test.ts`

## Gate de cierre

Ejecutar al finalizar la historia:

```bash
pn test
pn lint
pn tsc
pn build
```

Walkthrough manual mínimo:

1. atleta con evidencia suficiente muestra adherencia + cobertura + denominador;
2. ventana dominada por `unknown` muestra evidencia insuficiente, no `0%`;
3. entrenamiento libre aparece en conteo separado y no altera denominador;
4. cambio de semana/mes mantiene la ventana declarada;
5. tendencia sólo aparece con suficientes semanas comparables.
