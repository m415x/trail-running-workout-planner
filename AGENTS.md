<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Trail Running Workout Planner — agent rules

## Project overview

Full-stack trail-running group management and planning application. The coach remains the decision owner: automation generates/reviews evidence and proposals but must not silently replace deliberate coach state.

## Technology baseline

- Next.js 16 App Router, React 19, TypeScript, pnpm.
- Tailwind CSS 4 + Shadcn UI; `next-intl` ES/EN.
- Drizzle ORM; SQLite is the current local runtime DB; PostgreSQL/Supabase is the parallel verified target.
- Node test runner through `tsx`.

Confirm exact versions from `package.json`/lockfile and installed docs before relying on remembered APIs.

## Commands

- `pn dev` — local development
- `pn test` — automated suite
- `pn lint` — ESLint
- `pn exec tsc --noEmit` — typecheck
- `pn build` — production build
- `pn db:push` / `pn db:seed` — local SQLite
- `pn db:generate:supabase` — generate PostgreSQL migration
- `pn db:check:supabase` — validate migration journal
- `pn db:migrate:supabase` — apply pending migrations
- `pn db:verify:supabase` — verify remote application tables + RLS
- `pn db:verify:h11:supabase` — H11 transaction semantics probe

## Source-of-truth order

1. Current code/schema/types and tests for actual behavior.
2. `docs/architecture/` for durable domain contracts/invariants.
3. Jira for scope, acceptance criteria and execution state.
4. `docs/handoffs/epic-2.md` for immediate closure/resumption context.
5. `docs/history/` only for historical rationale/evolution.

Start at `README.md` → `docs/README.md`; do not reconstruct completed work from old chats. Handoffs are temporary; history is consolidated per epic.

## Architecture and directory map

- `app/[locale]/` — localized routes and shells
- `app/actions/` — server actions
- `features/` — feature modules/components/hooks
- `lib/` — pure/core domain logic
- `types/` — shared domain/application types
- `db/schema.ts` — SQLite schema
- `db/supabase/` — PostgreSQL schema/connections/verifiers
- `drizzle/supabase/` — reviewed generated migrations + metadata
- `tests/` — domain/integration regressions
- `docs/architecture/` — current contracts
- `docs/history/` — consolidated epic evolution
- `docs/handoffs/` — single operational handoff

## Epic 2 durable domain invariants

- Planning is group-first; planning cohorts temporarily subdivide a sporting group without changing category/level.
- Athlete resolution is cohort-variant first for the applicable interval, then group-base fallback.
- `CompetitionEntry` is live plan-scoped competitive data; `CompetitionContext` is the pure periodization boundary. `Macrocycle.targetRace*` is an accepted historical snapshot, not live authority.
- H8 category-distance compatibility is advisory and distinct from H10 competitive treatment and H12 individual readiness.
- H10 course demand, pre-competition load, taper and recovery are separate concepts. Volume and D+ remain separate dimensions; course-effort math is not a generic training-load formula.
- Generated planning is proposal/reconciliation driven. Manual/protected coach state must never be silently overwritten.
- H6 stable generation keys (`sharedEventKey` / `generationKey`) are logical reconciliation identities. Replacing an already-persisted generated UUID under the same key is a conflict.
- H11 composes hierarchy/sessions/prescriptions/competitions/provenance into one scoped review. Every accepted write carries exact team/group/plan/cohort/lineage scope.
- H11 PostgreSQL semantics include idempotent replay, atomic rollback, revision locking and stale rejection; do not degrade to accidental last-write-wins.

## H12 readiness invariants

- Planned training is never realized training by itself.
- No realized row means `unknown`, not zero exposure and not a missed workout.
- Numeric zero is known only with explicit evidence; legacy/default zero may remain ambiguous.
- Realized-training deduplication requires stable identity (persisted ID or explicit source + source activity ID); same date/metrics are insufficient.
- Plan-versus-real comparison requires authoritative session linkage; do not infer it from date/title/workout similarity.
- `RecentPreparationSummary` keeps volume, duration, D+, frequency, intensity evidence, long run and continuity as explicit dimensions with coverage/units.
- `ReadinessPolicy` is versioned/configurable product policy, not medical truth or a universal readiness formula.
- `insufficient_data` is a first-class result. Zero alerts means only that evaluated rules found no mismatch; it is not certification of readiness/fitness to compete.
- H12 reuses H10 competition impact phases so deliberate taper/recovery reductions are not automatically interpreted as insufficient preparation.
- Automatic assessment and coach review/acknowledgement are separate persisted facts.
- H12 does not automatically mutate planning or enter H11's write-set.
- H12 persistence uses `workout_log_evidence`, `readiness_evaluations`, `readiness_reviews`; Supabase verification inventory is 28 application tables and must verify RLS for all 28.

## Data, security and persistence

- Every athlete/readiness boundary is isolated by team + athlete. Do not rely only on UI filters.
- `workout_logs` has athlete scope; team ownership must be validated through the athlete relationship/repository boundary.
- Generate Drizzle migrations; never hand-edit generated snapshot/journal metadata.
- Review generated SQL before applying it. `db:check:supabase` does not prove the remote migration was applied; use the remote verifier.
- Supabase Data API is currently disabled. The app's migration/verification flow uses direct PostgreSQL; do not enable PostgREST merely to silence `pg_pgrst_no_exposed_schemas` log noise.
- `SUPABASE_DIRECT_URL` and `SUPABASE_DATABASE_URL` are server-only secrets. Never commit/print them or prefix with `NEXT_PUBLIC_`.
- Do not spread fixed development identities (`team_1`, `profile_user_1`) or invent an authenticated coach actor before authentication/tenant resolution exists.

## Product and code conventions

- New user-visible copy must be ES/EN in the same change.
- Units must be explicit in touched domain contracts (`distanceKm`, `elevationGainM`, `durationMinutes`, etc.).
- Preserve `unknown != 0`, absence != negative assertion, generated != manual.
- Apply JSDoc incrementally to exported/non-obvious domain contracts and side effects; document intent/invariants, not trivial implementation.
- Do not implement future-epic work as incidental refactoring. Record the gap instead.
- Do not introduce a second policy/model where a durable boundary already exists.

## Remote-first delivery workflow

- Work in a story branch; keep commits aligned with the active Jira task.
- Default to **remote-first** inspection/versioning and focused validation during implementation.
- Use local execution before story end only when required to unblock progress or prove an environment-specific boundary (for example Drizzle migration generation/application or real Supabase verification).
- Do not repeat the full gate after every task. Use focused tests/type/lint/build evidence appropriate to the changed boundary.
- Never claim a command/test/CI/manual check passed unless it actually ran; distinguish local, remote, CI and manual evidence.
- Existing lint baseline is 0 errors / 11 warnings entering H12. New warnings are regressions unless explicitly accepted.
- Before story merge/closure run the complete gate: `pn test`, `pn lint`, `pn exec tsc --noEmit`, `pn build`, plus relevant DB verifiers.
- Perform the functional/manual walkthrough at story end unless earlier manual validation is required to continue.
- For schema changes: generate → inspect SQL → version migration/metadata → apply → verify real schema/security. Never create a duplicate migration merely because the remote was behind.
- Keep Jira synchronized with real evidence. A task requiring environment evidence stays open until that evidence exists.
- At story/epic closure consolidate durable decisions into architecture/history, remove superseded handoffs, and update README/docs indexes.

## Documentation policy

- `README.md` is the repository entry/index.
- `docs/README.md` indexes durable documentation.
- `docs/architecture/` describes current truth.
- `docs/history/epic-N.md` consolidates meaningful evolution; do not maintain per-story history fragments after epic consolidation.
- `docs/handoffs/` should contain only the current/recent operational handoff; do not use it as archive.
- Jira owns task status/acceptance evidence.
- Do not copy chat transcripts into repository docs.

## Current closure context

Epic 2 H12 (`KAN-242`) is the final story of Planning Automation. Supabase H12 migration is applied and verified at 28/28 tables + 28/28 RLS. Finish KAN-255/KAN-256, run the final local story gate and H12 walkthrough, then close/merge H12 and Epic 2. After that, review the originally proposed Epic 3 against the H6–H12 architecture before implementation.
