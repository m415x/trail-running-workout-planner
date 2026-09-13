# Project documentation

Este directorio contiene el contexto durable del proyecto. `README.md` es el índice de entrada del repositorio y `AGENTS.md` define las reglas operativas; aquí se separan arquitectura vigente, evolución histórica y handoff operacional.

## Architecture — fuente de verdad de dominio

- [Automatic session generation](architecture/session-generation.md)
- [Planning cohorts](architecture/planning-cohorts.md)
- [Category and competitive distance](architecture/category-race-distance.md)
- [Planning intent and competition context](architecture/planning-intent-and-competition-context.md)
- [Competition calendar](architecture/competition-calendar.md)
- [Competitive adjustment](architecture/competitive-adjustment.md)
- [Integral planning review and safe persistence](architecture/planning-review-persistence.md)
- [Individual readiness assessment](architecture/readiness-assessment.md)
- [Product help and domain glossary](architecture/product-help-and-domain-glossary.md)
- [Progressive internationalization policy](architecture/internationalization-policy.md)

Usa arquitectura cuando una tarea dependa de cómo funciona el sistema **ahora**. No reconstruyas contratos vigentes desde history o conversaciones antiguas.

## History — evolución consolidada

- [Epic 1 — Planning Core](history/epic-1.md)
- [Epic 2 — Planning Automation](history/epic-2.md)

Cada épica mantiene un único documento histórico consolidado. Los antiguos fragmentos `epic-2-h*.md` se eliminan una vez incorporados a `epic-2.md`.

No leas history por defecto al iniciar una tarea. Consúltalo para entender razones históricas, decisiones reemplazadas, incompatibilidades aparentes o el origen de una regla.

## Handoffs — continuidad operativa

- [Epic 2 — closure handoff](handoffs/epic-2.md)

Un handoff es breve y temporal: resume baseline, estado verificable, restricciones y siguiente punto de trabajo. No duplica arquitectura ni history y no conserva transcripciones. Al comenzar una nueva épica puede reemplazarse por el handoff operativo de esa épica.

## Maintenance rule

- Cambios de contrato durable → actualizar `architecture/` en la misma historia.
- Evolución significativa/cierre de épica → consolidar `history/<epic>.md`.
- Estado de ejecución y criterios → Jira.
- Continuidad inmediata → un único handoff relevante.
- Índices/rutas → mantener sincronizados `README.md`, este archivo y `AGENTS.md`.
