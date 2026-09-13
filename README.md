# Trail Running Workout Planner

Aplicación full-stack para gestión de grupos de trail running, planificación periodizada, contexto competitivo y seguimiento individual. El profesor conserva el control: la automatización propone, explica y persiste decisiones revisadas sin sustituir el criterio humano.

## Índice rápido

- [`AGENTS.md`](AGENTS.md) — reglas operativas, stack, comandos, invariantes y flujo de entrega del repositorio.
- [`AGENTS_TEMPLATE.md`](AGENTS_TEMPLATE.md) — plantilla reutilizable de políticas de ingeniería para futuros proyectos.
- [`docs/README.md`](docs/README.md) — índice de arquitectura, historia y handoff.
- [`docs/architecture/`](docs/architecture/) — contratos e invariantes vigentes.
- [`docs/history/epic-1.md`](docs/history/epic-1.md) — evolución consolidada de Épica 1.
- [`docs/history/epic-2.md`](docs/history/epic-2.md) — evolución consolidada de Épica 2 / Planning Automation.
- [`docs/handoffs/`](docs/handoffs/) — contexto operativo mínimo para retomar el estado reciente.

## Estado del producto

Épica 2 completa el dominio de automatización de planificación desde generación y ownership hasta cohortes, contexto competitivo, taper/recuperación, revisión/persistencia integral y evaluación individual de desajustes de preparación. Las decisiones durables se documentan en `docs/architecture/`; Jira conserva alcance y trazabilidad de ejecución.

La evaluación individual de preparación es advisory: una evaluación sin alertas no certifica aptitud para competir, y datos insuficientes nunca se interpretan como preparación suficiente.

## Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS + Shadcn UI
- `next-intl` (ES/EN)
- Drizzle ORM
- SQLite para runtime local actual
- PostgreSQL/Supabase como target paralelo y verificado
- pnpm

Consulta versiones y reglas exactas en `package.json`, lockfile y `AGENTS.md` en lugar de asumirlas.

## Comandos principales

```bash
pn dev
pn test
pn lint
pn exec tsc --noEmit
pn build
```

Base de datos:

```bash
pn db:push
pn db:seed
pn db:generate:supabase
pn db:check:supabase
pn db:migrate:supabase
pn db:verify:supabase
```

Revisa siempre el SQL generado antes de aplicar una migración. `db:check:supabase` valida la cadena de migraciones; `db:verify:supabase` comprueba el estado real de tablas/RLS del proyecto conectado.

## Base de datos y secretos

SQLite continúa siendo la base local de desarrollo. El esquema PostgreSQL y las migraciones de Supabase viven en `db/supabase/` y `drizzle/supabase/`.

- `SUPABASE_DIRECT_URL` se usa para migraciones/verificación directa.
- `SUPABASE_DATABASE_URL` se reserva para runtime serverless/transaction pooler.
- Son secretos de servidor: nunca usar `NEXT_PUBLIC_` ni versionar `.env.local`.

La Data API de Supabase puede estar deshabilitada; el runtime actual no depende de PostgREST para el flujo de migraciones/verificación.

## Flujo de trabajo

El proyecto trabaja **remote-first**. Durante una historia se prefieren inspección remota y validaciones enfocadas; las ejecuciones locales se solicitan cuando son necesarias para desbloquear persistencia/infraestructura o para el gate final. Antes de cerrar una historia se ejecutan tests, lint, TypeScript, build, verificaciones de datos necesarias y walkthrough funcional/manual.

Para reglas completas de ramas, evidencia, migraciones, warnings, documentación y seguridad, consulta [`AGENTS.md`](AGENTS.md).
