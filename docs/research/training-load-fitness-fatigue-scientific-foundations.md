# Fundamentos científicos para carga de entrenamiento y fitness-fatigue

> Investigación de apoyo para KAN-261 y para la presentación del MVP al coach.
>
> Fecha de revisión: 2026-09-14.
>
> Alcance: síntesis orientada a decisiones de producto. No es una revisión sistemática formal ni sustituye evaluación médica o fisiológica individual.

## 1. Resumen ejecutivo

La evidencia disponible respalda el seguimiento longitudinal de la carga de entrenamiento, pero obliga a distinguir con cuidado entre **trabajo externo**, **respuesta interna** y **modelos matemáticos derivados**.

Para el MVP, la base más defendible es:

1. calcular carga únicamente desde **entrenamiento realizado confiable**;
2. utilizar **session-RPE × duración** como métrica primaria de carga interna cuando ambas variables están disponibles;
3. expresar esa carga en **unidades arbitrarias (AU)** y no como TSS salvo que se implemente explícitamente una metodología TSS/rTSS/hrTSS reconocible;
4. no imputar una carga fisiológica cuando falta RPE, FC u otra evidencia de intensidad;
5. mantener distancia, duración, desnivel positivo y, cuando exista, desnivel negativo como dimensiones externas separadas;
6. tratar cualquier serie tipo CTL/ATL/TSB como una **estimación matemática de carga acumulada**, no como una medición directa de fitness, fatiga, recuperación, readiness ni riesgo de lesión;
7. versionar fórmula, constantes, inicialización y reglas de suficiencia de datos;
8. exponer gaps de evidencia y warm-up histórico en la interfaz.

La conclusión central es que el MVP puede ofrecer una herramienta útil al coach si se presenta como **monitorización de carga y tendencias**, no como un diagnóstico fisiológico.

---

## 2. Conceptos que conviene separar

### 2.1 Carga externa

Describe el trabajo ejecutado: duración, distancia, velocidad, desnivel, potencia, impactos, etc. Es el estímulo físico observable.

### 2.2 Carga interna

Describe la respuesta individual al trabajo externo. Puede cuantificarse mediante frecuencia cardíaca, lactato, consumo de oxígeno o herramientas perceptuales como RPE/session-RPE.

La literatura de monitorización insiste en que carga externa e interna no son intercambiables: dos atletas pueden realizar un trabajo externo similar y presentar respuestas internas distintas.

### 2.3 Estado derivado

CTL, ATL, TSB y los modelos fitness-fatigue no son sensores ni biomarcadores. Son transformaciones matemáticas de una serie de carga previa. Su interpretación depende fuertemente de la métrica de entrada, las constantes elegidas, la inicialización y la calidad de los datos.

**Implicación para EPT:** el dominio debería conservar por separado `observed load`, `data sufficiency` y `derived load state`.

---

## 3. session-RPE como candidato principal para el MVP

Foster et al. propusieron el método session-RPE para cuantificar sesiones de distinta naturaleza. La carga se obtiene, en su forma habitual, como:

```text
session load (AU) = session RPE × duration (min)
```

El trabajo original encontró una relación consistente entre session-RPE y métodos basados en frecuencia cardíaca tanto en ejercicio continuo como interválico. Revisiones posteriores encontraron buena validez y fiabilidad en múltiples deportes y niveles competitivos.

En corredores de larga distancia se han reportado correlaciones relevantes entre session-RPE y TRIMP individualizado, y trabajos posteriores recomiendan combinar una medida interna como sRPE con volumen/duración para monitorizar cambios semanales.

### Ventajas para el MVP

- bajo costo y baja fricción;
- funciona aun sin pulsómetro;
- incorpora de manera individual la dificultad percibida de terreno, calor, fatiga acumulada, sueño, etc.;
- es comprensible para atleta y coach;
- encaja con los datos que EPT ya puede capturar: duración + RPE.

### Limitaciones

- es subjetiva y depende del protocolo de recolección;
- un mismo valor no significa exactamente la misma respuesta fisiológica entre atletas;
- no debe mezclarse sin calibración con TRIMP, hrTSS u otras unidades arbitrarias como si fueran equivalentes;
- si RPE falta, **no existe base científica para inventarlo desde el entrenamiento planificado**.

### Decisión recomendada

Para KAN-261 v1:

```text
method = "session_rpe"
loadAu = durationMin × rpe
```

Sólo cuando ambos valores sean conocidos y el entrenamiento sea evidencia realizada válida.

Si uno falta:

```text
load.state = "unknown"
reason = "missing_duration" | "missing_rpe" | ...
```

No usar cero.

---

## 4. Frecuencia cardíaca y TRIMP: útil, pero no como reemplazo transparente

TRIMP y sus variantes combinan duración e intensidad derivada de frecuencia cardíaca. La literatura muestra utilidad para seguimiento de endurance, especialmente cuando los parámetros son individualizados.

Un estudio en corredores de larga distancia encontró que un TRIMP individualizado basado en perfiles personales de FC/lactato se relacionaba mejor con cambios de fitness y rendimiento que versiones basadas en valores promedio de grupo.

Esto es importante para el diseño: **una FC media aislada no basta para asumir una carga precisa**. Se necesitan datos fisiológicos de referencia válidos (por ejemplo FC de reposo, máxima/umbral o zonas individualizadas, según el método).

### Recomendación

No usar una jerarquía del tipo:

```text
si hay FC -> calcular "la misma carga"
si no hay FC -> usar RPE
```

porque session-RPE y TRIMP son métodos diferentes y sus unidades arbitrarias no son directamente intercambiables.

Si en el futuro EPT agrega TRIMP:

- mantener `method = session_rpe | trimp_hr | ...`;
- versionar cada fórmula;
- no unir métodos diferentes en una misma serie longitudinal sin una estrategia explícita de calibración.

---

## 5. Por qué el cálculo actual no debería llamarse TSS

El código histórico de EPT calcula actualmente algo denominado TSS desde duración, RPE y un multiplicador de desnivel.

Eso no corresponde al TSS basado en potencia popularizado por TrainingPeaks/Coggan, cuya formulación usa potencia normalizada, factor de intensidad y umbral funcional. TrainingPeaks además distingue explícitamente TSS, rTSS, hrTSS y tTSS como métodos distintos.

Por lo tanto, llamar `TSS` al cálculo local puede inducir a pensar que es compatible o comparable con esas métricas cuando no lo es.

### Decisión recomendada

Renombrar conceptualmente el valor del MVP como:

- `sessionLoadAu`,
- `internalLoadAu`, o
- `sRpeLoadAu`.

Evitar `TSS` salvo que se implemente una metodología concreta y documentada bajo ese nombre.

---

## 6. Desnivel y especificidad de trail running

Trail running no es simplemente running plano con kilómetros adicionales.

La evidencia muestra diferencias marcadas entre subida, llano y bajada:

- la subida incrementa el costo metabólico y cardiovascular;
- la bajada puede tener menor costo metabólico pero mayor componente excéntrico y daño/estrés neuromuscular;
- terreno técnico, pendiente y experiencia individual modifican la respuesta;
- revisiones recientes de trail muestran que la carga excéntrica asociada a descensos es un componente importante de fatiga y daño muscular agudo.

Esto vuelve científicamente débil una regla fija del tipo:

```text
cada X metros de D+ = Y % más de carga fisiológica
```

sin una validación específica.

### Implicaciones para EPT

1. No multiplicar automáticamente sRPE por un factor de D+ en v1. Parte del costo del terreno ya se expresa en la percepción global de esfuerzo, y agregar otro multiplicador puede duplicar el efecto sin evidencia de calibración.
2. Mantener D+ como **carga externa contextual**.
3. Incorporar D- cuando la fuente de datos lo permita; D+ solo no describe la carga excéntrica de bajada.
4. A futuro, una métrica trail-específica debería validarse con datos reales antes de incorporarse al score interno.

---

## 7. Modelo fitness-fatigue: qué está respaldado y qué no

Los modelos impulse-response de Banister representan cada dosis de entrenamiento como generadora de dos respuestas matemáticas de distinto tiempo de decaimiento, tradicionalmente denominadas `fitness` y `fatigue`. La combinación intenta explicar cambios posteriores de rendimiento.

El modelo es útil como abstracción histórica, pero la literatura contemporánea pide cautela:

- sus parámetros dependen de la métrica de carga utilizada;
- son sensibles a valores iniciales y al método de ajuste;
- usar constantes generales ignora diferencias interindividuales;
- su capacidad predictiva del rendimiento futuro puede ser limitada aun cuando ajuste bien datos históricos;
- la fisiología real es multivariada y no queda representada por dos estados univariados.

Un comentario de 2022 recomienda usar estos modelos para trabajar **data-informed**, no `data-driven`, y evitar interpretar sus parámetros de manera fisiológica literal.

### Consecuencia para CTL / ATL / TSB

Si EPT conserva la estructura de medias exponenciales de 42 y 7 días, la presentación debería ser semánticamente neutral:

| Nombre familiar | Nombre recomendado en EPT |
|---|---|
| CTL / Fitness | Carga estimada de largo plazo |
| ATL / Fatigue | Carga estimada de corto plazo |
| TSB / Form | Balance de carga estimado |

Los nombres históricos pueden aparecer en documentación avanzada como referencia, pero no como equivalencias fisiológicas.

---

## 8. Constantes 42/7: heurística versionada, no verdad biológica

El código actual usa constantes de 42 días para CTL y 7 días para ATL.

Esas ventanas son familiares en herramientas comerciales y prácticas de endurance, pero no hay fundamento para tratarlas como constantes fisiológicas universales. La literatura sobre fitness-fatigue advierte específicamente contra aplicar constantes generales sin considerar diferencias entre individuos y métodos de carga.

### Recomendación de producto

Para un MVP es razonable conservarlas **como configuración explícita y versionada**, por ejemplo:

```text
ruleId = "estimated-load-state"
version = 1
shortTimeConstantDays = 7
longTimeConstantDays = 42
inputMethod = "session_rpe"
```

pero la UI/documentación debe indicar que son parámetros operativos del modelo, no tiempos fisiológicos medidos del atleta.

A futuro podrían calibrarse por atleta si existe suficiente historia + una variable de rendimiento independiente adecuada.

---

## 9. Warm-up e inicialización

Una EMA o un modelo impulse-response necesita un estado inicial. Cuando se dispone sólo de pocos días, el resultado depende fuertemente de esa inicialización.

Por eso EPT no debería mostrar un valor recién calculado como igualmente confiable que una serie con meses de evidencia.

### Recomendación

Modelar estados explícitos:

```text
insufficient_data
warming_up
available
```

La política exacta de warm-up debe ser versionada. Para v1 se puede exigir, como mínimo, historia suficiente en relación con la constante larga y además cobertura mínima de evidencia. No se recomienda presentar un umbral como fisiológicamente validado; es una regla operacional de calidad de datos.

También debe conservarse la estrategia de inicialización (`zero`, `first_known_load`, media inicial, etc.) dentro de la versión del modelo porque cambia la serie resultante.

---

## 10. Días sin entrenamiento: cero no siempre significa cero

Este punto es crucial.

Hay tres situaciones distintas:

### A. Descanso confirmado

Existe evidencia de que no hubo sesión/carga ese día.

```text
dailyLoad = 0
confidence = confirmed
```

### B. Sesión realizada con carga desconocida

Existe entrenamiento realizado pero faltan RPE/duración u otros inputs necesarios.

```text
dailyLoad = unknown
```

### C. No existe registro suficiente

No se sabe si fue descanso o falta de captura.

```text
dailyLoad = unknown
```

Convertir B o C en cero hace que la serie parezca artificialmente más liviana y puede crear una falsa sensación de recuperación.

Esto es coherente con la regla general de KAN-259/260: **ausencia de evidencia no equivale a evidencia de ausencia**.

---

## 11. Carga y riesgo de lesión: qué NO debe prometer el MVP

Existe literatura que relaciona carga de entrenamiento con lesiones en ciertos contextos, pero la evidencia no justifica transformar un score de carga en un predictor individual simple de lesión.

La controversia alrededor del Acute:Chronic Workload Ratio (ACWR) es especialmente instructiva. Revisiones y análisis metodológicos han señalado problemas de causalidad, ratios, confusión, categorización y heterogeneidad. Algunos autores concluyen que no hay evidencia suficiente para usar ACWR como regla causal para reducir lesiones.

### Texto recomendado para producto/presentación

> La carga estimada ayuda a contextualizar cuánto trabajo viene acumulando el atleta. No diagnostica fatiga clínica, sobreentrenamiento ni riesgo de lesión y debe interpretarse junto con síntomas, recuperación, contexto y criterio profesional.

### Evitar

- "riesgo de lesión alto" derivado únicamente de carga;
- "fatiga = 72";
- zonas universales de TSB como diagnóstico;
- alertas clínicas desde CTL/ATL/TSB.

---

## 12. Qué mostrar al coach en el MVP

Una presentación científicamente defendible podría mostrar:

### Sesión

- duración realizada;
- RPE;
- carga interna `RPE × min` en AU;
- distancia / D+ / D- si existen;
- método y calidad de evidencia.

### Serie longitudinal

- carga diaria interna conocida;
- gaps visibles;
- carga de corto plazo estimada;
- carga de largo plazo estimada;
- balance estimado;
- estado de warm-up / cobertura;
- versión del modelo.

### Mensaje de interpretación

> Estas curvas son filtros matemáticos de la carga registrada. Ayudan a ver tendencias y cambios de exposición, pero no miden directamente fitness, fatiga fisiológica ni readiness.

Esto preserva la utilidad práctica del concepto CTL/ATL sin sobreprometer precisión científica.

---

## 13. Decisiones recomendadas para KAN-261

### Mantener

- cálculo exclusivamente desde realized confiable;
- serie diaria reproducible;
- estados de corto/largo plazo;
- fórmula y versión visibles;
- gaps y cobertura explícitos;
- separación entre dominio y UI.

### Cambiar respecto del código legacy

1. `calculateDailyTss()` no debería seguir llamándose TSS si usa RPE + duración + D+.
2. Eliminar el multiplicador fijo de D+ del score interno hasta contar con validación propia.
3. Usar `sRPE × duración` como primera metodología formal de carga interna.
4. No etiquetar CTL como "forma", ATL como "fatiga" ni TSB como "frescura" en el contrato principal.
5. No redondear internamente cada paso de la EMA; redondear sólo para presentación para evitar acumulación de error numérico.
6. Tratar 7/42 como parámetros versionados, no constantes fisiológicas.
7. Introducir `unknown`, `confirmed_rest`, `warming_up` y cobertura de evidencia.
8. No mezclar métodos de carga diferentes dentro de la misma serie sin calibración explícita.
9. No inferir riesgo de lesión desde la carga.

---

## 14. Propuesta de modelo conceptual v1

```text
RealizedTrainingRecord
        │
        ├── duration known?
        ├── RPE known?
        └── evidence quality acceptable?
                │
                ▼
        Session internal load
        method: session_rpe
        unit: AU
        value = durationMin × RPE
                │
                ▼
        Daily load state
        ├── known load
        ├── confirmed rest = 0
        └── unknown/gap
                │
                ▼
        Versioned longitudinal model
        ├── short-term estimated load
        ├── long-term estimated load
        ├── estimated load balance
        └── sufficiency/warm-up
```

D+ / D- / distancia permanecen como dimensiones externas paralelas y explicativas.

---

## 15. Nivel de confianza de las principales decisiones

| Decisión | Confianza para MVP | Fundamentación |
|---|---:|---|
| sRPE × duración como carga interna | Alta | Método ampliamente estudiado y aplicable a múltiples deportes/endurance |
| Mantener carga externa separada | Alta | Marco ampliamente aceptado de carga interna vs externa |
| No tratar gaps como cero | Alta | Requisito lógico de calidad de evidencia; evita sesgo sistemático |
| No llamar TSS a fórmula propia | Alta | TSS/rTSS/hrTSS tienen definiciones específicas distintas |
| No añadir multiplicador fijo de D+ a sRPE | Moderada-alta | Trail tiene demandas multidimensionales; no se encontró validación para la regla legacy |
| EWMA 7/42 como tendencia operativa | Moderada | Convención útil, pero parámetros no universales |
| Interpretar CTL/ATL/TSB como fisiología | Baja / no recomendado | Modelos simplificados, sensibles a parámetros e inputs |
| Usar carga para predecir lesión individual | Baja / no recomendado | Evidencia heterogénea y problemas causales/metodológicos |

---

## 16. Fuentes principales

1. Foster C, Florhaug JA, Franklin J, et al. **A new approach to monitoring exercise training.** J Strength Cond Res. 2001;15(1):109-115. PMID 11708692. https://pubmed.ncbi.nlm.nih.gov/11708692/
2. Haddad M, Stylianides G, Djaoui L, Dellal A, Chamari K. **Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors.** Front Neurosci. 2017;11:612. https://pubmed.ncbi.nlm.nih.gov/29163016/
3. Borresen J, Lambert MI. **Quantifying training load: a comparison of subjective and objective methods.** Int J Sports Physiol Perform. 2008. https://pubmed.ncbi.nlm.nih.gov/19193951/
4. Manzi V, Iellamo F, Impellizzeri F, D'Ottavio S, Castagna C. **Relation between individualized training impulses and performance in distance runners.** Med Sci Sports Exerc. 2009;41(11):2090-2096. https://pubmed.ncbi.nlm.nih.gov/19812506/
5. Foster et al. evidence synthesis / current state of subjective monitoring: https://pubmed.ncbi.nlm.nih.gov/35426569/
6. Morton RH, Fitz-Clarke JR, Banister EW. **Modeling human performance in running.** J Appl Physiol. 1990;69(3):1171-1177. https://pubmed.ncbi.nlm.nih.gov/2246166/
7. **The Fitness-Fatigue Model: What's in the Numbers?** Int J Sports Physiol Perform. 2022. PMID 35320776. https://pubmed.ncbi.nlm.nih.gov/35320776/
8. **The Use of Fitness-Fatigue Models for Sport Performance Modelling: Conceptual Issues and Contributions from Machine-Learning.** 2022. https://pubmed.ncbi.nlm.nih.gov/35239054/
9. **Validity and Accuracy of Impulse-Response Models for Modeling and Predicting Training Effects on Performance of Swimmers.** Med Sci Sports Exerc. 2023. https://pubmed.ncbi.nlm.nih.gov/36791017/
10. de Waal SJ, Gomez-Ezeiza J, Venter RE, Lamberts RP. **Physiological Indicators of Trail Running Performance: A Systematic Review.** 2021. https://pubmed.ncbi.nlm.nih.gov/33508776/
11. **Downhill Running: What Are The Effects and How Can We Adapt? A Narrative Review.** Sports Med. 2020. https://pubmed.ncbi.nlm.nih.gov/33037592/
12. **A review of uphill and downhill running: biomechanics, physiology and modulating factors.** 2025. https://pubmed.ncbi.nlm.nih.gov/41209300/
13. **Muscle, Neuromuscular, and Cardiac Damage in Trail Running: A Systematic Review.** 2026. https://pubmed.ncbi.nlm.nih.gov/41718076/
14. **Session Rating of Perceived Exertion Combined With Training Volume for Estimating Training Responses in Runners.** 2020. https://pubmed.ncbi.nlm.nih.gov/33064812/
15. Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. **Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls.** Int J Sports Physiol Perform. 2020. https://pubmed.ncbi.nlm.nih.gov/32502973/
16. Shrier I, et al. **Analyzing Activity and Injury: Lessons Learned from the Acute:Chronic Workload Ratio.** Sports Med. 2020. https://pubmed.ncbi.nlm.nih.gov/32125672/
17. **The Relationship Between Training Load and Injury in Athletes: A Systematic Review.** Sports Med. 2018. https://pubmed.ncbi.nlm.nih.gov/29943231/
18. TrainingPeaks. **Training Stress Scores (TSS) Explained.** Definiciones comerciales de TSS/rTSS/hrTSS/tTSS usadas aquí sólo para distinguir nomenclatura, no como evidencia clínica. https://help.trainingpeaks.com/hc/en-us/articles/204071944-Training-Stress-Scores-TSS-Explained
19. TrainingPeaks. **Low rTSS and Trail Running.** Nota práctica sobre limitaciones del pace-based stress en trail técnico. https://help.trainingpeaks.com/hc/en-us/articles/205229730-Low-rTSS-and-Trail-Running

---

## 17. Nota para la presentación del MVP

Una formulación apropiada frente al coach sería:

> EPT no intenta medir directamente la fatiga fisiológica. Toma la evidencia realizada del atleta y construye una estimación reproducible de carga interna y de su tendencia a corto y largo plazo. La herramienta explicita cuándo faltan datos, qué fórmula se utilizó y qué versión del modelo produjo el resultado. El objetivo es mejorar la conversación entrenador-atleta, no reemplazar el criterio del entrenador ni realizar diagnóstico médico.

Esta formulación es consistente con el estado de la evidencia y preserva utilidad práctica sin atribuir al modelo una precisión que la literatura no sostiene.
