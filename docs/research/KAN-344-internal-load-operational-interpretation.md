# KAN-344 — Interpretación operacional de carga interna para triage

Fecha de revisión: 2026-09-14

## Pregunta

¿Qué significado puede aportar responsablemente KAN-261 a KAN-263 a partir de la serie sRPE × duración, sus EWMAs de corto/largo plazo y `loadBalanceAu`, sin transformar esa información en ACWR, diagnóstico de fatiga ni predictor de lesión?

## Qué calcula realmente KAN-261 hoy

KAN-261 calcula carga diaria como session-RPE × duración en unidades arbitrarias (AU). Sobre la serie diaria aplica dos EWMAs con constantes temporales de 7 y 42 días:

```text
alpha = 1 - exp(-1 / tau)
EWMA_t = EWMA_(t-1) + alpha * (load_t - EWMA_(t-1))
```

Luego define:

```text
loadBalanceAu = longTermLoadAu - shortTermLoadAu
```

Por lo tanto:

- `loadBalanceAu < 0`: la carga suavizada de corto plazo está por encima de la de largo plazo;
- `loadBalanceAu > 0`: la carga suavizada de corto plazo está por debajo de la de largo plazo;
- `loadBalanceAu ≈ 0`: ambas escalas son similares.

Este balance es una **diferencia en AU**, no un ratio y no es ACWR. Su magnitud depende del nivel absoluto de carga del atleta: `-100 AU` no tiene necesariamente el mismo significado relativo para dos atletas con historiales muy distintos.

El contrato exige 42 días de warm-up y reinicia ambas EWMAs ante evidencia diaria desconocida. Esto evita interpolar una tendencia a través de huecos que podrían contener carga no observada.

## Hallazgos de la literatura

### 1. EWMA es útil como técnica de suavizado, no como diagnóstico

Las EWMAs ponderan más los datos recientes y permiten representar cambios de carga sin dar el mismo peso a todas las observaciones de una ventana. Se han utilizado en investigación de training load y en modelos de carga aguda/crónica.

Sin embargo, los períodos de corto/largo plazo no son constantes fisiológicas universales. Revisiones prácticas de monitorización señalan que los decay rates de fitness/fatigue pueden variar entre atletas y deportes, y que ventanas comunes como 7/28 o 7/42 días pueden ser arbitrarias para un individuo determinado.

**Implicación:** mantener 7/42 como parámetros versionados del modelo MVP, no presentarlos como tiempos fisiológicos individuales validados.

### 2. No convertir la diferencia EWMA en ACWR

La literatura histórica utilizó ratios entre carga aguda y crónica, incluyendo variantes EWMA, y algunos estudios encontraron asociaciones con lesión en poblaciones específicas. Sin embargo, críticas metodológicas posteriores señalan problemas conceptuales y estadísticos importantes del ACWR y concluyen que no existe evidencia para usarlo como herramienta causal de gestión destinada a reducir lesiones.

**Implicación:** KAN-344 no debe crear `short/long`, `acute/chronic` ni bandas de “sweet spot”. El balance diferencial existente es preferible como descriptor de dirección de la carga reciente, pero tampoco debe interpretarse causalmente.

### 3. El contexto running refuerza la cautela

La evidencia en corredores no sostiene un umbral semanal universal de progresión. Un gran estudio prospectivo reciente de corredores encontró asociación entre aumentos de distancia en una sesión individual y lesión, mientras que ACWR semanal y cambios week-to-week no mostraron la asociación esperada.

**Implicación:** una tendencia de carga interna suavizada puede contribuir al triage, pero no debe producir mensajes como “riesgo de lesión” ni prescripciones automáticas de reducción de carga.

### 4. Session-RPE sigue siendo una entrada defendible

sRPE × duración es una medida práctica y ampliamente utilizada de carga interna. La limitación está en la interpretación posterior: una carga interna elevada puede reflejar entrenamiento deliberadamente exigente, competición, cambio de fase, estrés no deportivo u otros factores. Una tendencia no determina por sí sola una respuesta patológica.

**Implicación:** KAN-344 debe describir **dirección/cambio de carga interna reciente**, no “fatiga” ni “sobrecarga”.

## Problema con usar `loadBalanceAu` absoluto como threshold

Una regla como:

```text
loadBalanceAu < -100 => review
```

sería difícil de defender porque el valor está en AU absolutos y escala con la carga habitual del atleta. Introducir un threshold global generaría comparaciones inter-atleta poco interpretables.

Tampoco se recomienda normalizarlo mediante `shortTerm / longTerm`, porque eso recrearía conceptualmente un ACWR.

## Recomendación para KAN-344

### Semántica

Crear una señal de **dirección de carga interna** y no una señal de riesgo:

```text
insufficient_data
stable_or_lower
recent_load_above_baseline
```

`recent_load_above_baseline` significa exclusivamente:

> La carga interna suavizada de corto plazo se encuentra por encima de la carga suavizada de largo plazo con evidencia suficiente.

No significa fatiga, sobrecarga, lesión ni mala adaptación.

### Regla v1 propuesta

No utilizar un threshold AU global. Para la primera versión, interpretar únicamente el **signo** del balance una vez que la serie está `available`:

```text
latest.status != available
  => insufficient_data

loadBalanceAu === null
  => insufficient_data

loadBalanceAu < 0
  => recent_load_above_baseline

loadBalanceAu >= 0
  => stable_or_lower
```

El signo es matemáticamente equivalente a preguntar si `shortTermLoadAu > longTermLoadAu`, sin convertir las magnitudes a ratio.

### Por qué no elevar directamente a `review`

Un balance negativo aislado puede ser completamente intencional durante una semana de carga. Por eso esta señal no debería tener por sí misma semántica `review`. Debe funcionar como **contributor contextual de carga interna** para KAN-263.

Ejemplo:

```text
KAN-261 semantic signal:
recent_load_above_baseline

por sí sola
=> información descriptiva

+ KAN-262 systematic_excess contemporáneo
=> KAN-263 puede considerar convergencia para elevar prioridad de revisión
```

La elevación pertenece a la matriz KAN-345, no a KAN-344.

## Magnitud explicable

Aunque la clasificación v1 use sólo dirección, conservar:

- `shortTermLoadAu`;
- `longTermLoadAu`;
- `loadBalanceAu`;
- ventana de evidencia;
- cobertura;
- ruleVersion de KAN-261;
- ruleVersion de interpretación KAN-344.

Esto permite al coach inspeccionar magnitud sin que el producto afirme que existe un cutoff clínico.

## Unknown, warm-up y discontinuidad

La semántica debe heredar las protecciones actuales:

- `warming_up` => `insufficient_data`;
- `insufficient_data` => `insufficient_data`;
- `latest === null` => `insufficient_data`;
- `loadBalanceAu === null` => `insufficient_data`;
- hueco con carga desconocida => las EWMAs se reinician y requieren nuevo warm-up antes de volver a ser interpretables.

No se debe etiquetar como `stable_or_lower` una serie que simplemente carece de evidencia.

## Versionado recomendado

Separar la versión de cálculo de KAN-261 de la versión semántica de KAN-344:

```text
sourceRuleVersion = srpe-duration-v1
interpretationRuleVersion = internal-load-direction-v1
```

Así puede evolucionar la interpretación sin reescribir la evidencia histórica ni fingir que cambió el cálculo original.

## Decisiones descartadas

- ACWR o EWMA ratio.
- “sweet spot” de carga.
- threshold absoluto global en AU.
- percentiles poblacionales sin dataset validado.
- `recent_load_above_baseline = fatigue`.
- `recent_load_above_baseline = injury risk`.
- usar una señal durante warm-up o tras discontinuidad unknown.
- modificar automáticamente el plan.

## Consecuencia para KAN-345

La matriz de convergencia debería consumir una entrada semántica como:

```text
internalLoad.direction = recent_load_above_baseline
internalLoad.status = available
```

junto con evidencia explicable, en lugar de leer directamente `loadBalanceAu` y aplicar thresholds ocultos.

Esto mantiene KAN-263 como compositor de dominios y evita que duplique o contamine la lógica de KAN-261.

## Referencias

- Foster C, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109-115. PMID 11708692.
- Haddad M, et al. Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors. Front Neurosci. 2017. PMCID PMC5673663.
- Williams S, et al. Better way to determine the acute:chronic workload ratio? Br J Sports Med. 2017. Trabajo que popularizó ponderación EWMA en este contexto.
- Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. Int J Sports Physiol Perform. 2020;15(6):907-913. PMID 32502973. DOI 10.1123/ijspp.2019-0864.
- Bourdon PC, et al. Monitoring Athlete Training Loads: Consensus Statement. Int J Sports Physiol Perform. 2017.
- Coyne JOC, et al. The Current State of Subjective Training Load Monitoring—a Practical Perspective and Call to Action. Sports Med Open / related review literature on load modelling and individual decay assumptions.
- Nielsen/colleagues et al. How much running is too much? Identifying high-risk running sessions in a 5200-person cohort study. Br J Sports Med. 2025;59:1203ff. DOI 10.1136/bjsports-2024-109380.

## Decisión recomendada

Adoptar `internal-load-direction-v1` como una **interpretación descriptiva y versionada de dirección de carga interna**, basada sólo en una serie KAN-261 disponible. Usar `recent_load_above_baseline` como contributor de convergencia, nunca como diagnóstico ni como alerta clínica independiente.
