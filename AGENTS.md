<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Trail Running Workout Planner — agent rules

## Project overview

Full-stack trail-running group management and planning application. The coach remains the decision owner: automation generates/reviews evidence and proposals but must not silently replace deliberate coach state.

## Project services

- Jira site: `https://trail-running-workout-planning.atlassian.net/`
- Jira project key: `KAN`
- GitHub repository: `m415x/trail-running-workout-planner`

Use these canonical identifiers for remote-first project inspection and delivery. Do not duplicate credentials, tokens, or other secrets in repository documentation.

## Git branch strategy

- `main` is the stable/production branch. Story work must not target `main` unless an explicit release/integration decision says otherwise.
- `dev` is the canonical development integration branch.
- Create every new story/feature branch from the current `dev` head.
- Merge completed story/feature branches back into `dev` after the required verification and Jira closure evidence.
- Legacy branches such as `dashboard` and already-referenced historical story branches may remain for Jira/history traceability. Their continued existence does not make them valid bases for new work.
- Do not rename application routes or domain concepts containing the word `dashboard`; the Git branch migration is independent from the product dashboard route.

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
4. `docs/handoffs/epic-3.md` for immediate closure/resumption context.
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
- H12 persistence uses `workout_log_evidence`, `readiness_evaluations`, `readiness_reviews`; H12 closure verified 28 application tables with RLS. After KAN-257, the complete Supabase inventory is 34 application tables and must verify RLS for all 34.

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
- Athlete-facing product surfaces are **mobile-first**. Design from mobile portrait as the primary composition, then provide deliberate responsive behavior for tablet, mobile landscape, and desktop without creating a separate information architecture.
- Coach-facing product surfaces are **desktop-first**. Design for dense desktop workflows first, then provide deliberate responsive behavior for tablet, mobile landscape, and mobile portrait while preserving decision context and action safety.
- Responsive behavior is role-driven, not route-name-driven: shared components must support the consuming surface's athlete/coach composition rather than assuming one global breakpoint strategy.
- When touching legacy UI/code, do not only patch the new line: bring the touched surface forward incrementally by moving user-visible copy into the existing ES/EN i18n system and by documenting exported/non-obvious behavior, invariants and side effects that the change depends on.
- A touched legacy file does not require unrelated refactoring, but newly exposed hard-coded copy, stale comments or unclear contracts in the modified area should be cleaned up in the same task whenever it can be done safely.
- If full legacy cleanup would materially expand story scope, document the remaining debt in Jira/docs instead of silently leaving it untracked.
- Units must be explicit in touched domain contracts (`distanceKm`, `elevationGainM`, `durationMinutes`, etc.).
- User-facing times use the shared 24-hour formatter and the documented Argentina time-zone convention until user/team time-zone preferences exist; do not rely on runtime AM/PM defaults.
- When a row, card, or page header has three or more peer secondary actions, group them in the shared Shadcn `DropdownMenu`; keep destructive styling and required confirmation semantics.
- Preserve `unknown != 0`, absence != negative assertion, generated != manual.
- Apply JSDoc incrementally to exported/non-obvious domain contracts and side effects; document intent/invariants, not trivial implementation.
- Do not implement future-epic work as incidental refactoring. Record the gap instead.
- Do not introduce a second policy/model where a durable boundary already exists.

## Remote-first delivery workflow

- Work in a story branch created from `dev`; keep commits aligned with the active Jira task.
- Merge completed story branches into `dev`, not `main` and not the legacy `dashboard` branch.
- Default to **remote-first** inspection/versioning and focused validation during implementation.
- Use local execution before story end only when required to unblock progress or prove an environment-specific boundary (for example Drizzle migration generation/application or real Supabase verification).
- Do not repeat the full gate after every task. Use focused tests/type/lint/build evidence appropriate to the changed boundary.
- Never claim a command/test/CI/manual check passed unless it actually ran; distinguish local, remote, CI and manual evidence.
- Current lint baseline is 0 errors / 9 warnings after KAN-290. New warnings are regressions unless explicitly accepted.
- Before story merge/closure run the complete gate: `pn test`, `pn lint`, `pn exec tsc --noEmit`, `pn build`, plus relevant DB verifiers.
- Perform the functional/manual walkthrough at story end unless earlier manual validation is required to continue.
- For schema changes: generate → inspect SQL → version migration/metadata → apply → verify real schema/security. Never create a duplicate migration merely because the remote was behind.
- Keep Jira synchronized with real evidence. A task requiring environment evidence stays open until that evidence exists.
- At story/epic closure consolidate durable decisions into architecture/history, remove superseded handoffs, and update README/docs indexes.

## Documentation policy

- All repository documentation must be written and maintained in English, including README files, architecture, research, history, handoffs and agent instructions. Apply this rule to every new document and documentation update.
- Product UI localization remains ES/EN; the documentation language rule does not replace that requirement.
- When advancing stories, preserve all existing operational rules and durable invariants. Update or remove them only when a later explicit project decision supersedes them; never replace `AGENTS.md` wholesale merely to refresh the current-story context.

- `README.md` is the repository entry/index.
- `docs/README.md` indexes durable documentation.
- `docs/architecture/` describes current truth.
- `docs/history/epic-N.md` consolidates meaningful evolution; do not maintain per-story history fragments after epic consolidation.
- `docs/handoffs/` should contain only the current/recent operational handoff; do not use it as archive.
- Jira owns task status/acceptance evidence.
- Do not copy chat transcripts into repository docs.

## Current closure context

Epic 2 is complete. Epic 3 Stories 1–8 are complete through KAN-264 and integrated into `dev`. The current operational handoff is `docs/handoffs/epic-3.md`; the completed Historia 8 baseline is `docs/handoffs/kan-264-athlete-stats.md` and `docs/architecture/monitoring/athlete-stats-analytics.md`.

The next Epic 3 story is KAN-281 — Historia 9: registrar inscripciones y participación histórica en carreras. KAN-275 reserved the minimum `RaceRegistration` target in `docs/architecture/competitions/race-registration-boundary.md`; KAN-281 owns the actual lifecycle, participation/result evidence, historical snapshot, persistence and deduplication design.

Accepted KAN-281 MVP clarification: `RaceRegistration` represents an effective individual registration, not a mere intention to register. Competitive intent remains in existing goal/planning concepts. Registration lifecycle and participation/result evidence are separate concerns; being registered does not imply started, finished, DNS or DNF, and absent evidence remains unknown.

KAN-264 final reported gate: 790/790 tests across 157 suites, lint, `pn exec tsc --noEmit`, build and i18n passed; 452 ES/EN message leaves aligned; Athlete responsive walkthrough approved. KAN-282 UX action safety and the documented post-KAN-264 accessibility/navigation follow-ups remain deferred unless Jira explicitly changes scope.