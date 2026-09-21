# Trail Running Workout Planner

Full-stack application for trail-running group management, periodized planning, competitive context and individual tracking. The coach stays in control: automation proposes, explains and persists reviewed decisions without replacing human judgment.

## Quick index

- [`AGENTS.md`](AGENTS.md) — repository operating rules, stack, commands, invariants and delivery workflow.
- [`AGENTS_TEMPLATE.md`](AGENTS_TEMPLATE.md) — reusable engineering policy template for future projects.
- [`docs/README.md`](docs/README.md) — architecture, history and handoff index.
- [`docs/architecture/`](docs/architecture/) — current contracts and invariants.
- [`docs/history/epic-1.md`](docs/history/epic-1.md) — consolidated Epic 1 evolution.
- [`docs/history/epic-2.md`](docs/history/epic-2.md) — consolidated Epic 2 / Planning Automation evolution.
- [`docs/history/epic-3.md`](docs/history/epic-3.md) — realized training, monitoring, Athlete Stats, competitive catalog and action safety.
- [`docs/history/epic-4.md`](docs/history/epic-4.md) — field-performance evidence, RunningReference, execution guidance and safe physiology integration.
- [`docs/handoffs/`](docs/handoffs/) — temporary operational context for active/recent work; not a history archive.

## Product status

Epics 1–4 are complete. The current `dev` baseline includes group-first periodized planning, durable realized-training evidence, evidence-qualified monitoring and Athlete Stats, competitive catalog/registration and action safety, plus canonical 1000 m field-performance evidence with temporal RunningReference, safe execution guidance, factual evolution and Coach/Athlete integration.

The 1000 m field test is observed performance evidence, not a direct measurement of PAM/MAS, VO2max, threshold or heart-rate physiology. Missing evidence remains unknown; monitoring/readiness and physiology remain separate domains; automation does not silently replace coach-owned planning.

Durable current contracts live in `docs/architecture/`; completed evolution is consolidated in `docs/history/`; Jira owns scope and execution traceability. Known legacy/debt work is evaluated from the current `dev` baseline rather than treated as retroactive acceptance failure for completed epics.

## Stack

- Next.js 16 / React 19 / TypeScript
- Tailwind CSS + Shadcn UI
- `next-intl` (ES/EN)
- Drizzle ORM
- SQLite for the current local runtime
- PostgreSQL/Supabase as a parallel, verified target
- pnpm

Check exact versions and rules in `package.json`, the lockfile and `AGENTS.md` rather than assuming them.

## Main commands

```bash
pn dev
pn test
pn lint
pn tsc
pn build
```

Database:

```bash
pn db:push
pn db:seed
pn db:generate:supabase
pn db:check:supabase
pn db:migrate:supabase
pn db:verify:supabase
```

Always review generated SQL before applying a migration. `db:check:supabase` validates the migration chain; `db:verify:supabase` checks the actual table/RLS state of the connected project.

## Database and secrets

SQLite remains the local development database. The PostgreSQL schema and Supabase migrations live in `db/supabase/` and `drizzle/supabase/`.

- `SUPABASE_DIRECT_URL` is used for migrations and direct verification.
- `SUPABASE_DATABASE_URL` is reserved for the serverless runtime/transaction pooler.
- These are server-only secrets: never use `NEXT_PUBLIC_` or commit `.env.local`.

The Supabase Data API may be disabled; the current migration/verification workflow does not depend on PostgREST.

## Workflow

The project works **remote-first**. During a story, prefer remote inspection and focused validation; local execution is requested when needed to unblock persistence/infrastructure or perform the final gate. Before closing a story, run tests, lint, TypeScript, build, required data verification and a functional/manual walkthrough.

All repository documentation must be written and maintained in English.

For complete rules on branches, evidence, migrations, warnings, documentation and security, see [`AGENTS.md`](AGENTS.md).
