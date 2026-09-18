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

## Story bootstrap and context discipline

For every new story, reconstruct state from durable sources before proposing tasks or code. Memory and prior chats may help navigation but are never project authority.

1. Read this file and any nested `AGENTS.md` that applies to the files likely to be touched.
2. Read `docs/README.md`, the current epic handoff, the previous completed-story handoff when relevant, and only the architecture/glossary/research documents required by the story domain.
3. Inspect current code/tests selectively to verify that documentation still matches implementation.
4. Read the complete Jira story: description, acceptance criteria, comments, relations, dependencies and existing subtasks.
5. Reconcile Jira, docs and code. Surface discrepancies instead of silently choosing one source.
6. Present the real scope, reusable infrastructure, already-delivered work, risks and unresolved decisions before creating tasks.
7. Do not create tasks or a branch until the human approves that analysis and the proposed task breakdown.

Use **just-in-time retrieval** after bootstrap. Prefer paths, issue keys, commit/branch refs and short findings over repeatedly loading whole documents or large tool outputs. Re-open the exact source when detail is needed rather than carrying redundant content forward.

Treat each Jira story as a natural context-compaction boundary: its final durable documentation and handoff must allow the next story to start in a fresh chat without reconstructing the completed story from conversation history.

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
- H12 persistence uses `workout_log_evidence`, `readiness_evaluations`, `readiness_reviews`; H12 closure verified 28 application tables with RLS. After KAN-281, the complete Supabase inventory is 36 application tables and must verify RLS for all 36.

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
- Before each task, inspect only the related contracts, implementation and tests needed to understand the boundary; check whether part of the task already exists before adding abstractions.
- Keep Jira synchronized with real implementation/evidence and use small coherent commits aligned with the active task.
- Use local execution before story end only when required to unblock progress or prove an environment-specific boundary (for example Drizzle migration generation/application or real Supabase verification).
- Do not repeat the full gate after every task. Use focused tests/type/lint/build evidence appropriate to the changed boundary.
- Never claim a command/test/CI/manual check passed unless it actually ran; distinguish local, remote, CI and manual evidence.
- Current lint baseline is 0 errors / 9 warnings after KAN-290. New warnings are regressions unless explicitly accepted.
- Before story merge/closure run the complete gate: `pn test`, `pn lint`, `pn exec tsc --noEmit`, `pn build`, plus relevant DB verifiers.
- Perform the functional/manual walkthrough at story end unless earlier manual validation is required to continue.
- For schema changes: generate → inspect SQL → version migration/metadata → apply → verify real schema/security. Never create a duplicate migration merely because the remote was behind.
- Keep Jira synchronized with real evidence. A task requiring environment evidence stays open until that evidence exists.
- At story/epic closure consolidate durable decisions into architecture/history, remove superseded handoffs, and update README/docs indexes.

### Tool and retry discipline

- Prefer the narrowest tool/action that can answer the current question. Do not fetch an entire tree/file when a known path, range, query or focused test is enough.
- After a tool call, retain the decision-relevant finding and stable locator; avoid re-fetching identical content without a new reason.
- A failed operation gets at most **two substantially equivalent attempts**. Diagnose after the first failure. If the second equivalent attempt fails, stop repeating it and change strategy: inspect the relevant contract/schema, use a different tool/action, or request the smallest missing evidence.
- Do not hide repeated failures by making cosmetic parameter changes. Treat same intent + same expected mechanism as the same retry budget.
- When a large tool output is no longer needed verbatim, reduce it to a short working finding and retrieve details again just in time if required.

### Verification loop

For each task use the lightweight loop **inspect → implement → statically verify → focused evidence when informative → reconcile with task scope**. Do not substitute repeated full-suite execution for reasoning.

Before marking a task complete, compare the result against the original Jira task/acceptance intent, not merely against the implementation just written. At story closure perform the complete project gate and an acceptance-criteria-by-acceptance-criteria review.

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

### Durable documentation and next-story baseline

Every story includes a final documentation/handoff task. It is part of delivery, not optional cleanup.

- Reconcile durable docs with the **implemented** contract, including deviations from the initial design.
- Update architecture, glossary, research, indexes and `AGENTS.md` only where the story changed durable knowledge; do not manufacture edits to satisfy a checklist.
- Preserve operational infrastructure and invariants unless a later explicit decision supersedes them.
- Record known limitations and deliberately deferred decisions, linking Jira follow-ups where applicable.
- Mark completed implementation plans clearly `completed` / `historical`; an old checklist must not look like pending work.
- Ensure new/significantly reorganized durable docs are reachable from the appropriate index.
- The final handoff must state: delivered behavior, current contracts/invariants, reusable infrastructure, limitations/deferred work, verified evidence, and the exact baseline the next story may assume.
- Only record verification that actually ran. Jira remains the authority for task status and acceptance evidence.

## Harness evaluation — Epic 3 closing stories

The story workflow above is **harness-eval-v1**. Keep its operational rules stable through the final two Epic 3 stories unless a rule causes a blocking/safety/correctness failure. Record observations rather than tuning the harness mid-experiment.

Evaluate observable behavior, not subjective impressions or token count alone. At each story closure record a compact evaluation covering:

- redundant/repeated tool calls or unnecessary full-file reloads;
- equivalent failed attempts and whether the retry budget stopped loops;
- context/source-of-truth mistakes or requests to repeat durable information;
- premature task/branch creation or reopened settled decisions;
- unnecessary local/full-gate requests during implementation;
- claims of verification without evidence;
- missed acceptance criteria or corrective human interventions attributable to workflow/context handling;
- durable-documentation/handoff completeness;
- any case where lower context/tool usage reduced correctness.

Do not change harness-eval-v1 merely to improve the second story's score. After both stories, compare the two traces and decide which rules to keep, remove or revise for v2.

## Current closure context

Epic 2 is complete. Epic 3 Stories 1–9 are implemented through KAN-281. The current operational handoff is `docs/handoffs/epic-3.md`; the durable registration contract is `docs/architecture/competitions/race-registration.md`.

KAN-281 establishes effective individual `RaceRegistration` with explicit team + athlete scope and concrete RaceCourse identity. Registration lifecycle (`registered | cancelled`) is separate from explicit participation evidence (`unknown | started | finished | dnf | dns`). Historical snapshots preserve event/edition/course facts; nominal distance remains distinct from actual covered distance; registration/result does not become realized training, readiness, authorization or performance interpretation.

Athlete presentation is split intentionally: Plan -> Competition contains upcoming effective registrations, while Stats -> Competition contains historical factual participation/results. This is information architecture only and does not couple registration to TrainingGoal or CompetitionEntry.

The next and final Epic 3 story is KAN-282 — Historia 10: protect sensitive actions and unsaved UI changes. Start from `docs/architecture/platform/ux-action-safety.md`; reuse `ConfirmActionDialog` and the three-level policy. KAN-366 bulk race registration is the first explicit Level 2 adoption. Keep `harness-eval-v1` unchanged through KAN-282, then compare both story evaluations before proposing v2.

KAN-281 final reported gate: 908/908 tests across 202 suites, TypeScript clean, lint 0 errors / 7 warnings, build green, Supabase migration check green and 36/36 application tables with RLS. Coach desktop and Athlete mobile functional walkthroughs passed after final runtime fixes. KAN-360, rankings/positions and purely aesthetic UI polish remain deferred.
