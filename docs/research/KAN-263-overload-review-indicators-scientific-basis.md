# KAN-263 — Base científica para indicadores de carga/respuesta que requieren revisión

Fecha de revisión: 2026-09-14

## Pregunta de producto

¿Los datos actualmente disponibles permiten detectar de forma responsable una "posible sobrecarga" o conviene modelar una señal más conservadora de carga/respuesta que requiere revisión del coach?

## Conclusión ejecutiva

La evidencia respalda monitorizar carga externa, carga interna y respuestas subjetivas de forma longitudinal y contextual. No respalda convertir una métrica aislada, una regla porcentual universal o una combinación simple de cargas en un diagnóstico de fatiga, overtraining o riesgo de lesión.

Para KAN-263 se recomienda modelar **prioridad de revisión humana basada en convergencia de señales independientes**, no un clasificador de "sobrecarga" clínica. El dominio debe conservar qué señales contribuyeron, cobertura, ventana temporal, contexto de planificación y versión de regla.

## Hallazgos significativos

### 1. El overload es necesario para adaptar; overload + recuperación insuficiente puede ser problemático

El consenso conjunto ECSS/ACSM distingue functional overreaching, non-functional overreaching y overtraining syndrome (OTS). El entrenamiento exitoso requiere overload, mientras que el problema aparece cuando el estímulo excesivo se combina con recuperación insuficiente. La distinción entre NFOR y OTS es difícil y depende del resultado clínico y de diagnóstico por exclusión.

**Implicación:** una carga alta o un exceso respecto del plan no puede etiquetarse automáticamente como estado patológico. KAN-263 debe señalar evidencia para revisión, no diagnosticar OTS/NFOR.

Fuente: Meeusen et al. (2013), ECSS/ACSM joint consensus statement. PubMed PMID 23247672. DOI 10.1249/MSS.0b013e318279a10a.

### 2. Las medidas subjetivas son útiles para monitorización, pero no equivalen a diagnóstico

La revisión sistemática de Saw, Main y Gastin incluyó 56 estudios y encontró que las medidas subjetivas de bienestar respondían a cambios agudos y crónicos de carga con mayor sensibilidad y consistencia que muchas medidas objetivas comunes. El bienestar subjetivo tendía a deteriorarse al aumentar la carga y a mejorar al reducirla. Sin embargo, las medidas subjetivas y objetivas no mostraban asociación consistente.

**Implicación:** RPE/Feeling/wellness son información valiosa y complementaria. La falta de correlación con una medida objetiva no invalida automáticamente la señal subjetiva, pero tampoco autoriza a interpretar un valor aislado como lesión o fatiga clínica. Esto refuerza la futura KAN-342 y una composición multimodal posterior.

Fuente: Saw AE, Main LC, Gastin PB (2016), British Journal of Sports Medicine. PMID 26423706. PMCID PMC4789708.

### 3. session-RPE es una herramienta válida de carga interna

La revisión del método session-RPE encontró evidencia de validez, fiabilidad y consistencia interna en múltiples deportes, edades y niveles. La carga se obtiene combinando percepción de esfuerzo de la sesión y duración. También se recomienda considerar factores que pueden alterar el RPE y, según el contexto, combinarlo con otras medidas.

**Implicación:** KAN-261 constituye una señal de carga interna defendible para monitorización. En KAN-263 debe conservarse como dominio independiente; no debe reinterpretarse como probabilidad de lesión.

Fuentes: Foster et al. (2001), J Strength Cond Res, PMID 11708692; Haddad et al. (2017), Session-RPE Method for Training Load Monitoring, PMCID PMC5673663.

### 4. Carga y lesión: asociación plausible, predicción individual limitada

El consenso IOC sobre carga y riesgo de lesión sostiene que una gestión inadecuada de carga puede contribuir al riesgo, dentro de un fenómeno multifactorial. Sin embargo, esto no implica que exista un umbral universal capaz de predecir lesión en un atleta individual.

En corredores, una revisión sistemática de cambios de carga encontró evidencia muy limitada. Tres de cuatro estudios incluidos observaron alguna asociación con aumentos de carga, pero no se encontró respaldo para la conocida "regla del 10 %" y no se pudo establecer un umbral peligroso bien definido.

Una revisión posterior con 36 estudios prospectivos y 23.047 corredores concluyó que la evidencia que relaciona distancia, duración, frecuencia, intensidad o cambios recientes con lesión era conflictiva. Recomienda cautela al prescribir progresiones supuestamente óptimas y destaca la naturaleza multifactorial de las lesiones.

**Implicación:** no implementar en KAN-263 reglas del tipo `>10 % = riesgo`, `>30 % = lesión probable` ni equivalentes. Un exceso de volumen puede contribuir a una señal de revisión, pero no es un estimador clínico de lesión.

Fuentes: Soligard et al. (2016), IOC consensus, PMID 27535989; Damsted et al. (2018), PMID 30534459 / PMCID PMC6253751; Fredette et al. (2022), PMCID PMC9528699.

### 5. La respuesta individual y el contexto importan

La literatura de monitorización subraya variabilidad intra- e interindividual, además de influencias de sueño, estrés, recuperación, ambiente, hidratación y otros factores. La misma carga externa no implica necesariamente la misma respuesta interna entre atletas ni dentro del mismo atleta en momentos diferentes.

**Implicación:** cuando sea posible, las señales longitudinales deben privilegiar evolución intra-atleta y contexto sobre thresholds poblacionales rígidos. KAN-263 debe componer estados ya interpretados por sus dominios, no normalizar indiscriminadamente magnitudes heterogéneas.

### 6. Single-item wellness tiene utilidad práctica pero relaciones heterogéneas

Una revisión sistemática de medidas single-item en atletas encontró que fatiga, soreness, sueño, estrés y mood mostraban relaciones con carga desde nulas hasta grandes, predominantemente triviales a moderadas en estudios con más observaciones. Los autores piden estudiar propiedades de medición y relación con outcomes clínicamente relevantes.

**Implicación:** un `FeelingSelector` simple puede ser útil como señal longitudinal práctica, pero su semántica y escala deben investigarse antes de incorporarlo a reglas de triage. No debe añadirse apresuradamente a KAN-263; corresponde a KAN-342.

Fuente: Duignan et al. (2020), Single-Item Self-Report Measures of Team-Sport Athlete Wellbeing..., PMCID PMC7534939.

## Decisiones que la evidencia NO justifica

1. Diagnosticar fatiga, lesión, NFOR u OTS desde los datos actuales.
2. Predecir lesión individual a partir de volumen, sRPE o adherencia aislados.
3. Adoptar la regla semanal del 10 % como límite científico universal.
4. Usar un único threshold de carga para todos los atletas y fases del plan.
5. Interpretar ausencia de datos como estado normal.
6. Sumar magnitudes heterogéneas (km, minutos, D+, sRPE) en un score sin modelo validado.
7. Considerar `acknowledged` como resolución fisiológica de una señal.

## Diseño recomendado para KAN-263

### Semántica

Usar una denominación operacional como **`training_response_review` / "respuesta de entrenamiento que requiere revisión"**. La historia de Jira puede conservar su nombre histórico "posible sobrecarga", pero el contrato de dominio no debería afirmar sobrecarga clínica.

### Entradas v1

Componer únicamente dominios ya implementados y con semántica estable:

- KAN-260: adherencia;
- KAN-261: carga interna longitudinal;
- KAN-262: exceso sistemático de volumen externo;
- contexto de microciclo/competencia ya disponible.

KAN-342 (RPE/Feeling longitudinal) se incorporará sólo después de su investigación y diseño independiente.

### Salida v1

La composición debe producir prioridad operativa de revisión, por ejemplo:

- `none`: ninguna evidencia convergente que requiera revisión;
- `info`: una señal aislada/informativa;
- `review`: evidencia suficiente para que el coach revise al atleta;
- `priority`: múltiples señales independientes relevantes convergen y justifican revisar antes, sin significado clínico.

`priority` significa **orden/prioridad de trabajo del coach**, nunca severidad médica.

### Principio de convergencia

No sumar puntos arbitrarios. Conservar cada señal fuente y aplicar reglas explícitas/versionadas de convergencia. Ejemplo conceptual, sujeto a diseño y tests:

```text
systematic external-volume excess
              +
adverse internal-load trend
              |
              v
priority review candidate
```

La adherencia puede aportar contexto importante, pero debe distinguirse entre baja adherencia por sesiones omitidas y comportamiento que incrementa carga; no toda baja adherencia es sobrecarga.

### Unknown y cobertura

Si una fuente no es evaluable, debe permanecer `unknown`/insufficient y reducir la confianza/cobertura de la composición. La ausencia de una señal no puede contarse como evidencia negativa cuando en realidad faltan datos.

### Explicabilidad

Toda salida debe permitir responder:

- ¿qué señales contribuyeron?;
- ¿qué período se evaluó?;
- ¿qué datos faltaron?;
- ¿qué contexto de planificación/competencia existía?;
- ¿qué versión de regla produjo la prioridad?;
- ¿qué revisó/reconoció el coach?

## Opciones arquitectónicas a discutir

### A. Score numérico compuesto

Asignar puntos a adherencia, carga interna y exceso externo y producir thresholds.

**Ventaja:** fácil de ordenar y mostrar.

**Problema:** los pesos y thresholds serían difíciles de defender científicamente con los datos actuales; oculta heterogeneidad y puede generar falsa precisión.

**Recomendación:** no usar para v1.

### B. Reglas explícitas de convergencia — recomendada

Cada dominio conserva su señal. Una capa de triage evalúa combinaciones explícitas y versionadas y devuelve `none/info/review/priority`, junto con contributors y unknowns.

**Ventajas:** explicable, auditable, testeable, extensible a KAN-342 y evita falsa precisión.

**Costo:** requiere diseñar cuidadosamente combinaciones y precedencias.

### C. Mostrar señales sin composición

El dashboard presenta KAN-260/261/262 por separado y el coach integra mentalmente.

**Ventaja:** mínima inferencia algorítmica.

**Problema:** no resuelve el objetivo de triage rápido cuando existen muchos atletas.

**Recomendación:** útil como fallback/detalle, insuficiente como objetivo final de KAN-263.

## Referencias principales

- Meeusen R, et al. Prevention, diagnosis, and treatment of the overtraining syndrome. Med Sci Sports Exerc. 2013;45(1):186-205. PMID 23247672. DOI 10.1249/MSS.0b013e318279a10a.
- Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. Br J Sports Med. 2016. PMID 26423706. PMCID PMC4789708.
- Foster C, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109-115. PMID 11708692.
- Haddad M, et al. Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors. Front Neurosci. 2017. PMCID PMC5673663.
- Soligard T, et al. How much is too much? (Part 1) IOC consensus statement on load in sport and risk of injury. Br J Sports Med. 2016;50:1030-1041. PMID 27535989.
- Damsted C, et al. Is there evidence for an association between changes in training load and running-related injuries? Int J Sports Phys Ther. 2018;13(6):931-942. PMID 30534459. PMCID PMC6253751.
- Fredette A, et al. The Association Between Running Injuries and Training Parameters: A Systematic Review. J Athl Train. 2022;57(7):650-671. PMCID PMC9528699.
- Duignan C, et al. Single-Item Self-Report Measures of Team-Sport Athlete Wellbeing and Their Relationship With Training Load: A Systematic Review. Sports Med Open. 2020. PMCID PMC7534939.

## Estado de la decisión

La evidencia favorece **Opción B: reglas explícitas y versionadas de convergencia para priorizar revisión humana**, manteniendo las señales fuente separadas y explicables. Antes de implementar debe aprobarse el diseño de combinaciones, tratamiento de unknown y alcance exacto de KAN-263.
