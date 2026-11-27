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

## Local Git worktree lifecycle

- Keep `C:/DEV/EPT-app/trail-running-workout-planner` as the canonical everyday working directory on clean, up-to-date `dev`. Do not use it for unfinished story implementation; create an additional worktree only when the approved task requires isolation.
- Start each approved story worktree from the **verified current** `dev` HEAD, not from a historical branch or remembered SHA. Example (Git Bash, from the main repository): `git worktree add -b feat/KAN-646 ../trail-running-workout-planner-kan-646 dev`. The story branch name is illustrative and must not be recreated when it already exists.
- Before changing branches, run `git worktree list --porcelain`: Git permits only one worktree to check out a given branch. Never forcibly detach or delete an active worktree simply to release `dev`.
- On story closure, check `git status --short` in the additional worktree, confirm accepted work is committed/pushed and integrated, then inspect ignored/untracked artifacts (including `.env.local`, `.tmp/`, SQLite, backups and logs) before removing it. Preserve any unique evidence outside the folder first.
- Remove clean worktrees with `git worktree remove <path>` (without `--force`). If Git unregisters the worktree but Windows leaves a directory with `Directory not empty` or `Device or resource busy`, verify `git worktree list`, inspect remaining files and only then remove that **specific** residual directory. Never use broad `git clean -fdx`, `git reset --hard` or destructive cleanup on unknown paths.
- Do not delete branches, retained commits, PostgreSQL databases, acceptance evidence or unrelated directories as part of worktree housekeeping. A story worktree is temporary; `dev` remains the canonical integrated baseline.

### Post-merge Worktree Cleanup (mandatory closure phase)

After the functional gate, ordinary merge to `dev`, post-merge verification, documentation/Jira reconciliation and handoff check, the closure owner must explicitly inventory and dispose of the **story's temporary worktree**, or document an operational blocker. Final disposition: **worktree retired or operational blocker documented**. Do not repeat functional gates solely for administrative cleanup.

- Inspect `git worktree list --porcelain` and distinguish (1) existing registered worktrees with physical directories, (2) stale **prunable** Git administrative entries whose physical worktree is absent, and (3) **local branches** retained independently of worktree registration. A branch is not a disposable directory; a prunable record is not proof that files have been preserved.
- For an existing story worktree, identify its exact path and branch, compare accepted commits with integrated `dev`, inspect `git status --short`, `git status --ignored --short`, and relevant untracked/ignored data (e.g. `.env.local`, `.tmp/`, SQLite, logs, ZIPs, backups). Preserve non-reproducible artifacts and evidence outside the worktree before **operator confirmation**. The operator alone performs `git worktree remove <path>` without `--force` when the worktree is clean and preservation is confirmed.
- For a **prunable** administrative record, confirm its path is truly absent and no linked evidence needs recovery. Inspect the proposed administrative changes with `git worktree prune --dry-run --verbose`; only after **operator authorization** may the operator run `git worktree prune --verbose`. Never infer that a prunable entry licenses deletion of another worktree.
- Inventory **local branches** separately and retain them by default; deletion, if ever justified, is a different explicit decision. Never use `git branch -D` or `git clean -fdx` as routine cleanup. Never forcibly delete or detach the main worktree or an active branch; specifically preserve active KAN-645, KAN-359 and KAN-832 worktrees.
- If Windows locks a residual directory, inspect the exact path and Git registration, retain files as needed, and document the impediment rather than forcing deletion. Record in Jira/handoff the story/worktree path, retained evidence, commands actually run, disposition and any blocker. No repeat of functional gates for cleanup alone.

## Technology baseline

- Next.js 16 App Router, React 19, TypeScript, pnpm.
- Tailwind CSS 4 + Shadcn UI; `next-intl` ES/EN.
- Drizzle ORM; SQLite is the current local runtime DB; PostgreSQL/Supabase is the parallel verified target.
- Node test runner through `tsx`.

Confirm exact versions from `package.json`/lockfile and installed docs before relying on remembered APIs.

## Shell environment

- The project's human-operated local shell is **Bash**. When asking the human to run local commands, provide Bash-compatible commands by default.
- Do not provide PowerShell/CMD syntax unless the human explicitly requests it. This avoids command failures caused by assuming the wrong shell.

## Commands

- `pn dev` — local development
- `pn test` — automated suite
- `pn verify` — complete local closure gates (`test`, `tsc`, `lint`, `build`, `i18n:check`) with compact PASS/FAIL summary and diagnostics; `pn verify -v` streams full output; `pn verify --db` adds the local SQLite scenario gate (no remote Supabase).
- `pn lint` — ESLint
- `pn tsc` — typecheck
- `pn tdd:red <test-file> [...]` — sync + focused RED-phase test run with compact output
- `pn tdd <test-file> [...]` — sync + focused tests + `pn tsc` with compact output; add `--verbose` for diagnostics
- `pn build` — production build
- `pn db:sqlite:push` / `pn db:sqlite:generate` — local SQLite schema tooling
- `pn db:sqlite:upgrade` / `pn db:sqlite:verify` / `pn db:sqlite:check` — supported local SQLite lifecycle and scenario gate
- `pn db:seed` — compose the complete local development dataset; `db:seed:*` scripts expose individual fixture layers
- `pn db:supabase:generate` / `pn db:supabase:check` / `pn db:supabase:migrate` — PostgreSQL migration lifecycle
- `pn db:supabase:verify` — verify remote application tables + RLS
- `pn db:supabase:verify:h11` — H11 transaction semantics probe

## Non-negotiable workflow invariants

These rules override generic coding-agent habits for this repository.

### Focused TDD command authority

- `pn test` is full-suite only. Never pass a test path to `pn test`; the CLI rejects positional arguments. For one **functional increment**, pass the related test files together to `pn tdd:red <test-file> [...]` for the causal RED and `pn tdd <test-file> [...]` for GREEN.
- `pn tdd:red` and `pn tdd` already perform `git pull --ff-only -q`; do not request a separate pull immediately before them. `pn tdd` runs the canonical typecheck; do not separately request `pn tsc` after it.
- Keep using these runners for operator-executed focused tests. The operator may repeat the same focused suite for ordinary diagnosis and repair; repeats are **not** new functional TDD cycles. Use verbose diagnostics only for unexpected output.
- Do not substitute raw `tsx --test`, `node --test`, or `pn test <file>` for the canonical runner except to diagnose a demonstrated runner/tooling failure. Neither a command invocation nor an individual assertion defines an increment.

### Continuous approved execution

**Normative unit: one complete, verifiable functional increment.** An increment may cross domain, database persistence, services, Server Actions, authorization, UI, and relevant regression tests when those layers jointly deliver one usable capability. Do **not** split work merely by helper, assertion, field, condition, file, or implementation layer.

- After approval of a task or its functional-increment decomposition, execute autonomously: **related causal RED (positive/DENY/invariants/regressions as needed) → complete implementation → ordinary fixes/retests → GREEN → recoverable logical checkpoint → next approved increment**. Do not seek routine approval between RED, implementation, repair, GREEN, commits, or approved increments.
- A RED may contain several related tests. Do not fabricate RED for already-working behavior. One increment can require multiple test invocations and corrections; these do **not** constitute extra functional cycles. Fix ordinary TypeScript, ESLint, fixtures, and test failures without a new authorization.
- If the operator must run tests locally, provide the canonical Git Bash command for the next required evidence and continue after receiving its result. This is a tool limitation, **not** a new approval point or an excuse to fragment the increment.
- Target functional cycles, not test files: small correction **usually 1**; medium functionality **usually 1–3**; complex vertical **usually 3–6**. These are initial planning guides, not coverage caps. **After three cycles without a usable capability, stop fragmenting and reassess the approach** before adding more cuts; keep the approved safety and test coverage.
- Create commits by **recoverable logical change**, not by assertion. Report and reconcile Jira evidence at meaningful **completed-capability checkpoints**, including exact RED/GREEN commands, observed results, SHAs, risks and acceptance limits. No routine Jira comments/transitions for every minor correction.
- Agent ownership includes remote edits, Jira, commits, PR review/merge and pre/postmerge reconciliation under the approved scope. The human operates tests and walkthroughs requiring the local environment.
- Interrupt only for a material product, safety, architecture or security decision, destructive operation, significant merge/integration conflict, external blocker, or scope change. Classify unexpected failures first: ordinary in-scope errors do not automatically require another authorization; a failed mandatory gate remains a gate and must be diagnosed.
- Approval of the closure task authorizes the normal documentation → checks/review → PR → ordinary merge to `dev` → postmerge verification → Jira/handoff sequence without repetitive confirmations, provided no material decision or failure intervenes. Do not claim gates or acceptance without actually observed evidence.

### Fresh-chat-safe closure

- A story is not operationally closed merely because code is GREEN, Jira says Finalizada, or a PR was merged. It is **fresh-chat-safe** only when the integrated `dev` state and durable documentation agree on the delivered baseline.
- The closure task must distinguish candidate/gate SHA, PR head SHA, merge SHA and any later documentation-only SHA. Never attribute a pre-merge gate to the merge commit.
- After merge, verify the remote `dev` head and complete the post-merge documentation/Jira reconciliation before declaring the story fresh-chat-safe.
- `docs/handoffs/current.md` must identify the latest integrated operational baseline; the story handoff and relevant indexes must be reachable and must not describe an older story as current.
- Run `pn docs:handoff:check` during closure documentation reconciliation. A passing structural check does not replace semantic review of the handoff and indexes.

## Source-of-truth order

1. Current code/schema/types and tests for actual behavior.
2. `docs/architecture/` for durable domain contracts/invariants.
3. Jira for scope, acceptance criteria and execution state.
4. The current epic/story handoff when one exists for immediate resumption context.
5. The latest completed `docs/history/epic-N.md` and earlier epic histories when needed for completed evolution/rationale.

Start at `README.md` → `docs/README.md`; do not reconstruct completed work from old chats. Handoffs are temporary; history is consolidated per epic.

## Fresh-chat bootstrap contract

Fresh chats must be able to resume project work from durable authority without depending on conversation history or a long bootstrap prompt.

- Treat prior chats and model memory only as navigation hints. They are never project authority and must not be used to carry forward branch heads, Jira state, approvals, blockers, test results or implementation facts without re-verification.
- Start from the current remote `dev` integration state. Verify the real remote HEAD before creating or reusing a work branch; a SHA or branch mentioned in an earlier chat or prompt is stale until checked.
- Reconstruct execution state from Jira before selecting work. Read the candidate story's description, comments, relations, dependencies, subtasks and recent durable evidence; backlog order or satisfied technical dependencies alone do not prove that a story is materially enabled.
- Reconcile Jira with the current handoff, relevant architecture/docs and current code/tests. Surface material disagreement instead of silently choosing one source.
- If the apparent next story is waiting on product discovery, an unresolved decision, an operational dependency or another demonstrated blocker, do not materialize or implement it. Preserve reusable analysis, record the blocker when appropriate, and identify another story in the same epic/roadmap that can advance safely and independently.
- Begin a fresh chat with a short baseline diagnosis: verified `dev` HEAD, current Jira state, the story actually enabled to advance, blockers/decisions that matter, and the proposed first intervention. Do not create/reuse a branch, create subtasks or implement until the story analysis/decomposition requires and receives the approval defined below.
- Keep bootstrap prompts intentionally short and idempotent. Stable workflow rules belong in this file or `docs/agent-harness.md`; story-specific facts supplied by a prompt must still be verified against durable sources.

## Story bootstrap and context discipline

For every new story, reconstruct state from durable sources before proposing tasks or code. Memory and prior chats may help navigation but are never project authority.

1. Read this file and any nested `AGENTS.md` that applies to the files likely to be touched.
2. Read `docs/README.md`, the current epic handoff, the previous completed-story handoff when relevant, and only the architecture/glossary/research documents required by the story domain.
3. Inspect current code/tests selectively to verify that documentation still matches implementation.
4. Read the complete Jira story: description, acceptance criteria, comments, relations, dependencies and existing subtasks.
5. Reconcile Jira, docs and code. Surface discrepancies instead of silently choosing one source.
6. Present the real scope, reusable infrastructure, already-delivered work, risks and unresolved decisions before creating tasks.
7. Do not create tasks or a branch until the human approves that analysis and the proposed task breakdown.
8. The final task in every proposed story breakdown must be an explicit story-closure task. Define its story-specific closure criteria during decomposition so closure can be executed correctly from a fresh chat without relying on conversation memory.

Use **just-in-time retrieval** after bootstrap. Prefer paths, issue keys, commit/branch refs and short findings over repeatedly loading whole documents or large tool outputs. Re-open the exact source when detail is needed rather than carrying redundant content forward.

Treat each Jira story as a natural context-compaction boundary: its final durable documentation and handoff must allow the next story to start in a fresh chat without reconstructing the completed story from conversation history.

### Task sizing and decomposition

Decompose by **usable functional capabilities** with a coherent acceptance outcome and related positive/negative invariants, not by separately testable helpers or repository layers. A single increment may span domain, persistence, services, authorization, actions and UI where needed to deliver that capability.

- Use the initial functional-cycle budget: small correction normally **1**, medium feature **1–3**, complex vertical **3–6**. Ranges guide planning and **never justify reducing safety, coverage or acceptance**.
- A related DENY, rollback, migration, or UI regression belongs to the same functional increment when it protects that capability; do not create standalone microtasks merely because it can fail independently. Split only for **meaningfully deliverable independent capabilities**, genuine external dependencies, or a material architecture/operations decision.
- If three functional cycles produce no usable capability, **reassess decomposition and approach** before creating more cuts. Unexpected material scope is reconciled in Jira; normal corrections and repeat test runs are not new cycles.
- Make commits recoverable per coherent logical change; consolidate Jira status/evidence and operator reports per **completed capability**, not per assertion, RED commit or helper. Keep the worktree recoverable during ongoing repair and checkpoint after a stable capability GREEN.
- A bounded task may encompass an entire small feature; large capabilities may be broken down without sacrificing acceptance. Context pressure should trigger concise durable checkpointing, not arbitrary fragmentation or repeated fresh chats.
- Maintain an explicit approved **story-closure task** with the applicable full gates, manual acceptance, AC audit, documentation/handoff/index reconciliation, deferred limitations, PR integration and postmerge evidence. The parent remains `En curso` until closure is genuinely reconciled; no circular prerequisite that the parent already be done.

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
- Review generated SQL before applying it. `db:supabase:check` does not prove the remote migration was applied; use the remote verifier.
- Supabase Data API is currently disabled. The app's migration/verification flow uses direct PostgreSQL; do not enable PostgREST merely to silence `pg_pgrst_no_exposed_schemas` log noise.
- Current environment boundary: SQLite is the development/runtime database; Supabase is reserved for production deployment. A versioned/locally checked Supabase migration is not evidence that production was migrated. Apply production migrations only as an explicit controlled deployment step, then require `pn db:supabase:verify` before claiming the remote schema is current.
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
- `GroupSessionPrescription.durationMin` is explicit coach-planned **group** duration in minutes: absent is `null`/unknown, an explicit value must be greater than zero, and it is never realized duration or an individual athlete prediction. Trail/Hills may display that planned group duration but must not derive athlete-facing pace/speed targets from it.
- Apply JSDoc incrementally to exported/non-obvious domain contracts and side effects; document intent/invariants, not trivial implementation.
- Do not implement future-epic work as incidental refactoring. Record the gap instead.
- Do not introduce a second policy/model where a durable boundary already exists.

## Remote-first delivery workflow

- Work in a story branch created from `dev`; keep commits aligned with the active Jira task.
- Merge completed story branches into `dev`, not `main` and not the legacy `dashboard` branch.
- Default to **remote-first** inspection/versioning and focused validation during implementation.
- Prefer **resolution/delivery micro-sprints** when reconciling blocked or partially delivered work: one primary objective at a time, closed scope, and an explicit exit condition.
- After a stable GREEN for a completed functional capability, create a recoverable logical commit/checkpoint before the next approved capability. An uncommitted working tree must never be the sole carrier of accepted work.
- Bind test, CI and manual-acceptance evidence to an exact commit SHA or otherwise recoverable tree. Reuse evidence only while that exact tree still exists and has not materially changed; if the tree is lost or materially changed, rerun the affected evidence.
- When blocked, record the cause, affected scope, criticality, objective unblock condition, and any independent work that remains enabled. Do not automatically promote unrelated failures or technical debt into global story blockers.
- A dependency-specific gate may close a bounded dependent correction even when the global gate fails for work outside that correction, but only when the dependency, remaining failures and explicit exception are documented.
- Micro-sprint pressure never justifies sacrificing historical integrity, isolation, security or authorization boundaries.
- Before each functional increment, inspect the relevant contracts, implementation and tests; confirm what already works before adding abstractions or fabricating RED.
- Keep Jira synchronized with real implementation/evidence and use recoverable commits plus consolidated reports per completed functional capability, not each assertion or routine fix.
- Use local execution before story end only when required to unblock progress or prove an environment-specific boundary (for example Drizzle migration generation/application or real Supabase verification).
- Do not repeat the full gate after every test, repair or increment. Use a related focused test set during the increment; run the full gate at closure or when cross-cutting impact justifies it.
- Never claim a command/test/CI/manual check passed unless it actually ran; distinguish local, remote, CI and manual evidence.
- Current lint baseline is 0 errors / 0 warnings after KAN-417. New warnings are regressions unless explicitly accepted.
- Before story merge/closure run the complete gate: `pn test`, `pn lint`, `pn tsc`, `pn build`, plus relevant DB verifiers.
- Perform the functional/manual walkthrough at story end unless earlier manual validation is required to continue.
- For schema changes: generate → inspect SQL → version migration/metadata → apply → verify real schema/security. Never create a duplicate migration merely because the remote was behind.
- Keep Jira synchronized with real evidence. A task requiring environment evidence stays open until that evidence exists.
- At story/epic closure consolidate durable decisions into architecture/history, remove superseded handoffs, and update README/docs indexes.

### Jira execution state and evidence

Jira status reflects actual execution, not intention. Activate the approved task/capability when work begins, and keep its parent story `En curso` during implementation. Do not proliferate one subtask or administrative transition per test, helper or routine correction.

- At each **completed functional capability**, reconcile the approved acceptance outcome and record one concise consolidated Jira report: related causal RED/GREEN commands and results, exact recoverable SHA/tree, security/persistence invariants actually verified, limitations and deferred work.
- Keep normal TypeScript/ESLint/fixture/test repairs inside the active capability; no Jira comment or renewed approval per correction.
- Mark the task `Finalizada` only with its required evidence. Close the parent only after approved tasks, full applicable gate, AC audit, real walkthrough where needed, durable docs/index and postmerge reconciliation are satisfied.
- A material blocker is recorded with cause, scope, exit condition and ownership; do not silently absorb unrelated debt or invent results.

### TDD and compact human-run verification

Use RED/GREEN TDD **per complete functional increment** whenever a focused automated test can establish the changed contract economically.

1. Establish a **causal RED** with a related set of tests for the capability, which may include ALLOW/positive behavior, DENY, isolation, rollback, invariants and relevant regressions. Do **not** manufacture RED for existing working behavior.
2. Implement the **whole coherent increment** and repair ordinary compile, lint, fixture and test failures autonomously.
3. Rerun the same appropriate focused suite until **GREEN**. Retesting during repair is not another functional cycle; reserve refactoring for work that preserves the contract.
4. Create a recoverable logical checkpoint for the finished capability and report RED/GREEN evidence, scope and SHA **once per meaningful completion**, not per assertion.
5. Continue the next approved increment without routine new permission. Stop only for material decisions, blockers or unapproved scope; complete gate and AC review remain mandatory at closure.

Operator-managed tests use canonical grouped commands (the tests shown are illustrative):

```bash
pn tdd:red tests/one-capability-allow.test.ts tests/one-capability-deny.test.ts
pn tdd tests/one-capability-allow.test.ts tests/one-capability-deny.test.ts
```

`pn tdd:red` performs `git pull --ff-only -q` and focused RED; `pn tdd` syncs, runs focused GREEN and canonical `pn tsc`. Both default to concise RED/GREEN; add `--verbose` only for unexpected/ambiguous failures. Do not request an extra pull before runners or `pn tsc` after GREEN. A compact result is evidence only for the tests actually run on its exact SHA/tree; never invent subtest counts or claim unrun checks. Full suite/integration gates belong at closure or materially cross-cutting changes, not every ordinary fix.

### Tool and retry discipline

- Prefer the narrowest tool/action that can answer the current question. Do not fetch an entire tree/file when a known path, range, query or focused test is enough.
- After a tool call, retain the decision-relevant finding and stable locator; avoid re-fetching identical content without a new reason.
- A failed operation gets at most **two substantially equivalent attempts**. Diagnose after the first failure. If the second equivalent attempt fails, stop repeating it and change strategy: inspect the relevant contract/schema, use a different tool/action, or request the smallest missing evidence.
- Do not hide repeated failures by making cosmetic parameter changes. Treat same intent + same expected mechanism as the same retry budget.
- When a large tool output is no longer needed verbatim, reduce it to a short working finding and retrieve details again just in time if required.

### Verification loop

For each functional increment use the lightweight loop **inspect → related causal RED → complete implementation and repairs → focused GREEN → recoverable checkpoint and one consolidated report**. Do not substitute repeated full-suite execution for reasoning.

Before marking a capability complete, compare its result against the approved Jira acceptance outcome, not merely against tests written during implementation. At story closure perform the complete project gate and an acceptance-criteria-by-acceptance-criteria review.

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

## Harness evaluation — Epic 3 closure record

The KAN-281/KAN-282 story workflow experiment used **harness-eval-v1** and is complete. Its published protocol, observations and post-experiment conclusions live in `docs/agent-harness.md`.

Preserve the source-of-truth ordering, focused verification, final full gate, manual runtime walkthrough, durable handoff and fresh-chat-capable boundaries established by that evaluation. Do not modify the published harness as incidental feature work. Potential v2 changes require an explicit workflow decision based on the recorded evidence.

## Fresh-chat bootstrap reference

The normative fresh-chat bootstrap is defined once near the top of this file under **Fresh-chat bootstrap contract**. Do not maintain a second copy here. `docs/agent-harness.md` contains the current Harness v2 execution model and historical evaluation context.

## Current completed-epic baseline

Epics 1–4 are complete. Completed evolution is consolidated under `docs/history/`; current domain authority remains current code/tests plus the relevant `docs/architecture/` contracts.

Epic 3 established durable realized training, evidence-qualified monitoring/Training Response, Athlete Stats analytics/disclosure, competitive catalog/registration and shared action safety. Epic 4 added canonical 1000 m field-performance evidence, temporal RunningReference, safe execution guidance, factual evolution, TestEvent/review lifecycle and Coach/Athlete presentation.

Preserve these boundaries in subsequent work:

- monitoring/Training Response is operational review evidence, not measured physiology or diagnosis;
- observed field performance, deterministic derivatives and physiological interpretation remain distinct facts;
- the 1000 m test does not directly measure PAM/MAS, VO2max, thresholds or heart-rate physiology;
- Z1-Z5 does not manufacture BPM; missing physiology remains unknown;
- flat-reference pace/speed is not an execution target on Trail/Hills/positive grade;
- planned, realized, registered, participated and derived analytical states remain distinct facts;
- `unknown != 0` and missing evidence is not a negative assertion;
- derived rules expose version/provenance and do not silently mutate planning;
- athlete-facing analytics use explicit disclosure projections rather than filtered coach projections;
- team/athlete isolation remains end-to-end;
- the temporary development identity is not an authentication model.

Known deferred work must be read from the latest completed epic history and current Jira. At the Epic 4 baseline this includes KAN-374, KAN-375, KAN-407 and explicitly documented session/intensity legacy debt. These are not retroactive acceptance blockers unless Jira explicitly re-scopes them.

Before starting a later epic, reconstruct its stories from current `dev`, the latest completed epic history, relevant architecture and Jira. Do not assume an old preliminary epic outline still matches the delivered system.
