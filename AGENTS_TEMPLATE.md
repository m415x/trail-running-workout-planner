# [Nombre del proyecto]

[Una o dos frases: qué es el proyecto, para quién existe y cuál es su objetivo principal. Lenguaje claro, sin detalles de implementación innecesarios.]

## Stack

- Lenguaje: [lenguaje y nivel/versión relevante]
- Framework / runtime: [framework, runtime y versiones relevantes]
- Base de datos / storage: [motor, ORM/driver si aplica]
- Tests: [runner y estrategia principal]
- Package/build tooling: [gestor, compilador, task runner]

No asumas APIs, versiones o convenciones por memoria cuando el repositorio, lockfile o documentación instalada puedan confirmarlas.

## Comandos

- `[comando dev]` — arranca el entorno local
- `[comando test]` — ejecuta la suite automatizada
- `[comando lint]` — ejecuta análisis estático/estilo
- `[comando typecheck]` — valida tipos/compilación estática, si aplica
- `[comando build]` — genera el artefacto de producción
- `[comando db check]` — valida schema/migraciones, si aplica
- `[comando db verify]` — verifica el entorno de datos real, si aplica

Mantén aquí los comandos canónicos del proyecto. No inventes variantes si ya existe un script equivalente.

## Estructura del proyecto

- `[carpeta]/` — [qué contiene y qué responsabilidad tiene]
- `[carpeta]/` — [qué contiene y qué responsabilidad tiene]
- `[carpeta]/` — [qué contiene y qué responsabilidad tiene]

Respeta los boundaries existentes. No crees una segunda arquitectura para resolver un problema que ya tiene un contrato establecido.

## Fuentes de verdad

- Código y schema vigentes son la fuente de verdad de comportamiento actual.
- La documentación de arquitectura describe decisiones durables e invariantes.
- Jira/issues describen alcance, estado y criterios de aceptación; no sustituyen al código.
- `history/` conserva evolución y razones históricas; no debe usarse como especificación vigente cuando contradice arquitectura/código actual.
- `handoffs/` contiene contexto operacional breve para reanudar trabajo; no es archivo histórico.
- Lockfiles y migraciones versionadas son parte del estado reproducible del proyecto.
- No reconstruyas decisiones desde chats antiguos cuando existe una fuente durable más reciente.

## Convenciones

- [Estilo de nombres y organización.]
- [Ubicación y convención de tests.]
- [Manejo de errores y tipos de dominio.]
- [Validación de entradas y boundaries externos.]
- [Convenciones de documentación/JSDoc/docstrings.]
- Usa nombres con unidades explícitas cuando una magnitud pueda ser ambigua (`distanceKm`, `durationMinutes`, etc.).
- Modela estados semánticamente distintos como estados distintos: `unknown` no es `0`, ausencia no es `false`, planificado no es realizado.
- Conserva provenance/ownership cuando el sistema combine valores generados, importados y editados manualmente.
- Mantén resultados automáticos separados de decisiones humanas cuando ambos existan.

## Políticas de dominio y datos

- No inventes información faltante para completar un cálculo. Propaga `unknown`, `insufficient_data` o el estado equivalente cuando corresponda.
- No conviertas una heurística configurable en una verdad universal. Versiona reglas cuando sus resultados deban ser reproducibles/auditables.
- Si una decisión depende del estado histórico, persiste o conserva snapshots suficientes para explicar el resultado original.
- Cuando exista multi-tenancy/scope, valida aislamiento en lectura, dominio y persistencia. No dependas sólo de filtros de UI.
- Cuando la base lo soporte y el modelo de seguridad lo requiera, verifica las políticas de aislamiento/RLS en el entorno real.
- Las operaciones reintentables deben diseñarse para idempotencia cuando duplicarlas produciría corrupción o efectos dobles.
- Las operaciones multi-write que deban ser atómicas deben compartir una transacción real.
- Para concurrencia, define explícitamente qué ocurre con double-submit, replay equivalente y estado stale; no aceptes `last write wins` accidental.

## Base de datos y migraciones

- Schema, migraciones y metadata generada deben permanecer sincronizados.
- Genera migraciones con la herramienta oficial del proyecto; no escribas snapshots/journals generados a mano.
- Revisa el SQL generado antes de aplicarlo a un entorno compartido o remoto.
- No crees una migración para un delta que ya existe en la cadena y simplemente está pendiente de aplicar.
- No cambies datos históricos destructivamente para resolver ambigüedad semántica si puede usarse una migración compatible o un boundary de normalización.
- Tras una migración, ejecuta los verificadores de schema/constraints/security que correspondan.
- No confundas `schema check` con evidencia de que una migración fue aplicada al entorno remoto.

## Testing y evidencia

- Prueba lógica de dominio con tests pequeños y deterministas.
- Agrega tests de integración en los boundaries donde interactúan componentes que ya tienen unit tests.
- Usa E2E/walkthrough para probar el flujo real, no para reemplazar cobertura de dominio.
- Incluye casos negativos: datos insuficientes, aislamiento, duplicados, rollback, stale state y entradas inválidas cuando sean relevantes.
- No cambies un test sólo para ponerlo verde: confirma primero si el test o la implementación contradicen el contrato de dominio.
- Nunca declares una validación como aprobada si no fue ejecutada. Diferencia claramente evidencia remota, local, CI y manual.
- Si existe un baseline conocido de warnings, no lo multipliques: cero errores y cero warnings nuevos salvo aprobación explícita.

## No hagas

- No instales, elimines o actualices dependencias sin comprobar primero si el repo/lockfile ya contiene lo necesario y sin justificar el cambio.
- No subas `.env*`, tokens, claves, credenciales, dumps con datos sensibles ni secretos al repositorio.
- No imprimas secretos en logs, tests, documentación o respuestas.
- No edites archivos generados manualmente cuando exista un generador canónico.
- No uses tipos inseguros, casts o supresiones para ocultar un error de contrato sin justificarlo.
- No dupliques políticas de dominio existentes en otra capa.
- No mezcles refactors no relacionados con una historia salvo que sean necesarios para desbloquearla.
- No implementes trabajo de una historia/épica futura incidentalmente; registra el gap y respeta el scope.
- No inventes IDs, actores autenticados, permisos, datos externos o estados de infraestructura que no estén disponibles.
- No hagas cambios destructivos o irreversibles en entornos compartidos sin revisión explícita.

## Flujo de trabajo

- El modo de trabajo preferido es **remote-first** cuando el proyecto dispone de repositorio/Jira/CI remotos: inspecciona y versiona primero allí; usa ejecución local cuando sea necesaria para desbloquear el trabajo o para el gate final.
- Antes de una tarea no trivial, identifica alcance, invariantes, dependencias y plan. Si el usuario ya aprobó una historia/flujo, no vuelvas a pedir aprobación para cada subtarea compatible.
- Trabaja una historia coherente por rama. Mantén commits pequeños, descriptivos y alineados con la task actual.
- Usa validaciones enfocadas durante implementación. No repitas el gate completo tras cada cambio salvo que sea necesario para avanzar.
- Antes de cerrar/mergear una historia, ejecuta el gate completo definido por el proyecto: tests, lint, typecheck/compile, build y verificaciones de datos necesarias.
- Al final de una historia ejecuta un walkthrough/prueba manual del flujo afectado cuando exista comportamiento observable.
- Si una prueba real depende de credenciales, hardware, servicio externo o entorno del usuario, prepara el harness y pide sólo la ejecución necesaria; no falsifiques el resultado.
- Registra en Jira/issues evidencia útil y estado real. No cierres una task porque el código "parece" correcto si su criterio exige evidencia pendiente.
- Al cerrar una historia, consolida decisiones durables en arquitectura/history y reemplaza/elimina handoffs obsoletos.
- Antes de mergear, confirma que la rama parte del baseline correcto y que no arrastra trabajo obsoleto de otra historia.

## Decisiones y aclaraciones

- Si una decisión puede cambiar el modelo de dominio, seguridad, persistencia, compatibilidad o alcance, investiga primero las fuentes de verdad.
- Si después de investigar sigue existiendo ambigüedad material, pregunta antes de elegir arbitrariamente.
- No uses un porcentaje rígido de confianza como sustituto del criterio: pregunta cuando las alternativas tengan consecuencias distintas y no haya evidencia suficiente para escoger.
- Para detalles reversibles y locales, elige la opción consistente con las convenciones existentes y documenta la decisión si no es obvia.

## Documentación

- `[docs/README.md]` — índice documental, si existe.
- `[docs/architecture/]` — contratos e invariantes vigentes.
- `[docs/history/]` — evolución consolidada por épica/release.
- `[docs/handoffs/]` — único handoff operativo actual/relevante.
- `[enlace a Jira/issues/especificación]` — alcance y trazabilidad.

Mantén la documentación sincronizada en la misma historia cuando cambie un contrato documentado. Evita copiar conversaciones o convertir history en un log de commits.

## Criterio de cierre

Una historia sólo está cerrada cuando:

1. sus criterios de aceptación están satisfechos;
2. las pruebas requeridas tienen evidencia real;
3. no introduce errores ni warnings nuevos respecto del baseline aprobado;
4. las migraciones/verificaciones necesarias están completas;
5. la documentación durable está actualizada;
6. el walkthrough manual requerido fue realizado o se documentó explícitamente por qué no aplica;
7. Jira/issues y repositorio reflejan el mismo estado.
