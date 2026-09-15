# Glosario de dominio — Español

Este glosario define la terminología de producto/dominio utilizada en código, investigación y documentación técnica. Debe mantenerse sincronizado con `docs/glossary.en.md` cuando se agregue un término o cambie su semántica.

| Término | Definición |
| --- | --- |
| Adherencia | Grado en que los resultados confirmados del entrenamiento corresponden con el plan prescrito. La evidencia faltante/desconocida no es automáticamente un incumplimiento. |
| Carga externa | Trabajo realizado por el atleta descrito mediante cantidades observables externamente, como distancia, duración y desnivel positivo. |
| Carga interna | Respuesta interna del atleta al entrenamiento. En el MVP actual se estima como session-RPE × duración y se expresa en unidades arbitrarias (AU). |
| session-RPE (sRPE) | Percepción subjetiva del esfuerzo de la sesión. En el modelo actual de carga, el RPE se multiplica por la duración de la sesión para estimar la carga interna. |
| Carga de corto plazo | Carga interna suavizada mediante EWMA usando la constante temporal de corto plazo actual (7 días en `srpe-duration-v1`). Es un parámetro del modelo, no una constante fisiológica universal. |
| Carga de largo plazo | Carga interna suavizada mediante EWMA usando la constante temporal de largo plazo actual (42 días en `srpe-duration-v1`). Es un parámetro del modelo, no una constante fisiológica universal. |
| Balance de carga | Diferencia `longTermLoadAu - shortTermLoadAu`. Se expresa en AU, no es un cociente y no debe denominarse ACWR. |
| Carga reciente por encima de la línea de base | Estado operacional de KAN-344 que indica que la carga interna suavizada de corto plazo disponible es mayor que la carga suavizada de largo plazo. Es descriptivo y no significa fatiga, sobrecarga ni riesgo de lesión. |
| Carga interna estable o menor | Estado operacional de KAN-344 que indica que la carga interna suavizada de corto plazo disponible es menor o igual que la carga suavizada de largo plazo. No demuestra recuperación ni ausencia de riesgo. |
| Exceso sistemático de volumen | Patrón de KAN-262 en el que el volumen externo realizado supera al planificado durante los microciclos evaluables consecutivos requeridos para una dimensión. Es una señal de revisión, no un diagnóstico. |
| Exceso aislado de volumen | El volumen externo realizado supera al planificado en un microciclo evaluable sin satisfacer la regla de persistencia del exceso sistemático. |
| Revisión de respuesta al entrenamiento | Dominio de triage no diagnóstico que compone señales independientes y temporalmente compatibles para ayudar a ordenar la revisión del coach. |
| Convergencia | Combinación explícita y versionada de señales independientes compatibles. No es una suma de unidades heterogéneas ni implica causalidad. |
| Señal contribuyente | Señal de un dominio fuente que participa activamente en una clasificación de triage y permanece trazable hasta su evidencia. |
| Prioridad de revisión | Orden operacional para la atención del coach (`none`, `info`, `review`, `priority`). No representa severidad clínica ni probabilidad de lesión. |
| Desconocido / datos insuficientes | Estado que indica ausencia o insuficiencia de evidencia para la inferencia correspondiente. Nunca debe tratarse como cero, normal ni evidencia negativa. |
| Cobertura | Descripción de cuánto de la ventana de evidencia solicitada está respaldado por observaciones utilizables. La cobertura califica la interpretación; no reemplaza evidencia faltante. |
| Versión de regla | Identificador de una regla de cálculo o interpretación que permite evolucionar la semántica sin reescribir silenciosamente el significado de resultados históricos. |
| ACWR | Acute:Chronic Workload Ratio (relación de carga aguda:crónica). No se utiliza en el diseño actual del triage MVP; `loadBalanceAu` es una diferencia, no ACWR. |
| Sobrecarga (overload) | Estímulo de entrenamiento superior a la demanda habitual o previa que puede formar parte de la adaptación normal. El producto no debe utilizar este término como diagnóstico de mala adaptación. |
| Overreaching / síndrome de sobreentrenamiento | Conceptos fisiológicos/clínicos que no pueden diagnosticarse mediante las señales actuales del MVP. Están fuera del alcance inferencial de KAN-263. |
