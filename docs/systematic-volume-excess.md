# KAN-262 — Exceso sistemático de volumen realizado

## Propósito

KAN-262 detecta cuándo el volumen externo realizado por un atleta supera de forma persistente el volumen prescripto en microciclos consecutivos. La señal sirve para priorizar revisión humana; no diagnostica fatiga, lesión, sobreentrenamiento ni riesgo médico.

La regla v1 trabaja por separado con `distanceKm`, `durationMin` y `elevationGainM`. No mezcla dimensiones ni construye un score fisiológico sintético.

## Fuente de verdad y flujo

La comparación Plan–Real de KAN-259 es la fuente autoritativa para sesiones planificadas, sesiones realizadas vinculadas, actividades realizadas no planificadas y limitaciones de resolución del plan.

Flujo:

```text
KAN-259 Plan–Real
        |
        v
agregación por microciclo y dimensión
        |
        +-- planned
        +-- realized vinculado
        +-- unplanned_realized (suma sólo a realized)
        |
        v
evidencia longitudinal
        |
        v
within_plan | isolated_excess | systematic_excess | insufficient_data
        |
        +--> detalle explicable
        +--> resumen compacto para futuro dashboard
```

Una actividad `unplanned_realized` aporta volumen externo realmente ejecutado, pero nunca incrementa el volumen planificado. Los `recordId` realizados se deduplican defensivamente para evitar doble conteo.

## Regla v1

`SYSTEMATIC_VOLUME_RULE_VERSION = systematic-volume-v1`.

La persistencia se evalúa por microciclo. Dos microciclos evaluables consecutivos con exceso constituyen `systematic_excess`. Un único microciclo con exceso constituye `isolated_excess`. Un microciclo no evaluable rompe la continuidad: la implementación no atraviesa un período `unknown` para fabricar persistencia.

Los estados de atención son:

- `none`: sin señal que requiera atención.
- `info`: exceso aislado; contexto informativo.
- `review`: exceso sistemático; requiere revisión del coach.
- `priority`: reservado para una futura composición multi-señal. KAN-262 por sí sola no lo emite.

Estos niveles son prioridad operativa de revisión, no niveles de riesgo médico.

## Magnitud y umbrales

La evidencia conserva `planned`, `realized`, `absoluteDelta` y `relativeDeltaPercent`. La magnitud explica cuánto difirió el volumen; no debe interpretarse como probabilidad de lesión ni como umbral fisiológico universal.

La decisión v1 de persistencia de dos microciclos es una heurística operacional del MVP, explícitamente versionada. No se presenta como un umbral clínico o fisiológico validado. Cambios futuros de la regla deben incrementar/versionar el contrato para mantener trazabilidad.

## Cobertura y unknown

La evaluación conserva cobertura: sesiones planificadas, comparables, desconocidas, actividades realizadas no planificadas y `coverageRatio`.

`unknown` no equivale a cero y tampoco equivale a `within_plan`. Si falta un valor planificado/realizado, existen unidades incompatibles, cobertura insuficiente o una limitación de resolución de planificación, la evidencia se degrada a `insufficient_data` según corresponda.

Esto evita generar tranquilidad falsa a partir de datos ausentes.

## Contexto de planificación y competencia

Cada evidencia conserva contexto del microciclo (`type`, `loadFocus`) y, cuando existe, fases de impacto competitivo (`pre`, `race`, `post`), competencias involucradas y `requiresCoachReview`.

El contexto nunca modifica el valor observado. Por ejemplo, +20 % de distancia durante taper sigue siendo +20 %. `tapering/recovery` explica el entorno en el que ocurrió la desviación; no reescribe la medición para hacerla encajar con el plan.

## Persistencia

### Señal calculada

La señal de exceso sistemático permanece **derivada**, no persistida como snapshot de dominio. Se reconstruye desde las fuentes autoritativas para evitar señales almacenadas que queden obsoletas después de corregir un entrenamiento o resolver una vinculación Plan–Real.

### Reconocimiento humano

El acto del coach sí tiene semántica de auditoría y puede persistirse cuando se conecte la UI. El contrato `SystematicVolumeSignalReview` identifica el snapshot revisado mediante atleta, dimensión, microciclo, `ruleVersion` y `patternAtReview`, además de `acknowledgedBy`, `acknowledgedAt` y nota opcional.

Reconocer una señal no la resuelve, no borra evidencia, no modifica entrenamientos y no modifica el plan. Si los datos cambian posteriormente, la señal actual se recalcula mientras el reconocimiento histórico conserva qué observó el coach en ese momento.

## Presentación

El dominio expone dos proyecciones:

1. **Compacta**: `ok | info | review | unknown`, atención, patrón, dimensión primaria y magnitud. Está pensada para el futuro resumen/dashboard del coach y no depende exclusivamente del color.
2. **Detalle**: evidencia de la dimensión, magnitud, fechas, cobertura, actividades no planificadas, contexto, razones de insuficiencia, microciclos contribuyentes y versión de regla.

La UI es responsable de traducir esos códigos a texto/iconografía accesible. El dominio no contiene copy visual ni semántica de colores.

## Relación con otras historias

- **KAN-259**: fuente Plan–Real autoritativa.
- **KAN-260**: adherencia al plan; dominio independiente.
- **KAN-261**: carga interna estimada mediante session-RPE × duración; dominio independiente.
- **KAN-262**: exceso longitudinal de volumen externo.
- **KAN-342**: investigación futura de RPE/Feeling y respuesta subjetiva longitudinal.

Una futura capa de triage podrá componer estas señales independientes. Por ejemplo, exceso externo persistente + carga interna desfavorable + deterioro subjetivo podría elevar la prioridad de revisión. Esa composición no pertenece a KAN-262 y no debe convertir correlaciones en diagnósticos.

## Walkthrough funcional

### Caso A — exceso aislado

```text
Microciclo 1: 10 km plan / 10 km realizado
Microciclo 2: 10 km plan / 12 km realizado

Resultado distanceKm:
pattern   = isolated_excess
attention = info
```

El coach recibe contexto informativo, no una señal sistemática.

### Caso B — exceso persistente

```text
Microciclo 1: 10 km plan / 12 km realizado
Microciclo 2: 10 km plan / 13 km realizado

Resultado distanceKm:
pattern   = systematic_excess
attention = review
microcycles = [mc-1, mc-2]
```

El resumen compacto puede mostrar conceptualmente `Revisar · Distancia +30 %` para el microciclo actual, mientras el detalle conserva ambos microciclos y su evidencia.

### Caso C — actividad libre

```text
Plan:                  10 km
Realizado vinculado:   11 km
Actividad no planif.:   2 km
----------------------------
Realizado total:       13 km
Plan total:            10 km
```

Los 2 km libres aumentan `realized`, quedan identificados como `unplanned_realized` y nunca aumentan `planned`.

### Caso D — evidencia incompleta

```text
Microciclo 1: exceso conocido
Microciclo 2: realizado desconocido
Microciclo 3: exceso conocido
```

No se infiere exceso sistemático entre microciclos 1 y 3. El microciclo desconocido rompe continuidad y se conserva como evidencia insuficiente.

### Caso E — dimensiones divergentes

```text
distanceKm      systematic_excess
durationMin     within_plan
elevationGainM  insufficient_data
```

No se mezclan las dimensiones para producir una conclusión global falsa. La dimensión con mayor atención puede proyectarse como primaria para triage, conservando el resto en detalle.

### Caso F — taper

```text
microcycle.type      = tapering
loadFocus            = recovery
plan distance        = 10 km
realized distance    = 12 km
delta                = +2 km / +20 %
```

El cálculo continúa siendo +20 %. El contexto taper/recovery acompaña la evidencia para interpretación humana.

### Caso G — reconocimiento del coach

```text
systematic_excess (+18 %)
        |
        v
coach acknowledges
        |
        +--> evidencia actual permanece intacta
        +--> se conserva quién/cuándo/qué snapshot revisó
```

Una corrección posterior puede cambiar la señal derivada sin reescribir el acto histórico de revisión.

## Límites explícitos

KAN-262 no:

- diagnostica fatiga, lesión, overreaching u overtraining;
- estima probabilidad de lesión;
- modifica automáticamente el plan;
- interpreta RPE o Feeling como parte del exceso de volumen externo;
- mezcla distancia, duración y desnivel en un score único;
- considera ausencia de datos como estado normal;
- usa `priority` como severidad clínica.

## Gate de cierre

El cierre requiere TypeScript sin errores y suite completa en verde. Los tests específicos cubren persistencia, exceso aislado, discontinuidad por unknown, dimensiones divergentes, integración Plan–Real, actividad no planificada, evidencia insuficiente y preservación del contexto taper.
