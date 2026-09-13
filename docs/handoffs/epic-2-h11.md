# Handoff — Epic 2 / H11: Planning review and safe persistence

## Status

- Story: `KAN-224` — H11: Revisión integral y persistencia segura del motor de planificación.
- Branch: `h-20-planning-review-persistence`.
- Base: `dashboard` after H10.
- Completed in Jira: `KAN-225` through `KAN-241`.
- Delivery mode: remote-first.
- Technical story gate: complete and green.
- Remaining before H11 closes: functional/manual walkthrough of the affected planning flow, final Jira evidence, final deployment validation, then merge into `dashboard`.

## Durable context

Read first:

- `docs/architecture/planning-review-persistence.md` — final H11 architecture and invariants.
- `docs/architecture/session-generation.md` — H6 ownership/stable generation keys.
- `docs/architecture/planning-cohorts.md` — H7 base/variant and cohort resolution.
- `docs/architecture/competitive-adjustment.md` — H10 proposal/review/provenance boundary.
- `docs/history/epic-2-h11.md` — H11 evolution and rationale when historical context is needed.

Do not reconstruct H11 from old chats. Jira owns task execution state; architecture/history own durable rules.

## Final H11 model

The integral path is:

```text
current group-base / cohort-variant aggregate
  -> IntegralPlanningReview
  -> global consistency validation
  -> stable-identity integral diff
  -> coherent block decisions
  -> exact accepted reconciliation
  -> scope + source/result revision guard
  -> atomic operations + audits + idempotency journal
  -> committed review state
  -> athlete cohort-first/group-fallback resolution
```

Key invariants:

- H11 composes H6–H10 and does not redefine their domain authority.
- generated Session/prescription identity remains H6 `sharedEventKey` / `generationKey`;
- persisted Session/prescription UUID replacement under the same H6 key is a conflict;
- hierarchy draft UUIDs are transient and matched through H11 logical identities;
- every reconciled operation carries exact team/group/plan/cohort/lineage scope;
- cross-scope writes are rejected before transaction mutation;
- only accepted coherent blocks enter the write set;
- operation and audit persistence share one transaction;
- equivalent replay creates no duplicate write or audit;
- async PostgreSQL/Supabase persistence locks a plan revision and rejects stale distinct submissions;
- equivalent concurrent submissions resolve as one commit plus one replay;
- partial failure rolls back operations, audits, journal and revision advance together.

## Regression fixed during story validation

The local gate exposed one H6 identity regression in `planning-review-diff.test.ts`: changing the persisted UUID of a generated Session while retaining the same `sharedEventKey` was classified as an ordinary update. The diff now protects persisted Session and GroupSessionPrescription IDs after matching them through H6 stable keys. Macro/meso/micro draft IDs remain transient as intended.

## Completed integration coverage

KAN-237 consolidated isolation across review, diff, reconciliation and persistence. KAN-238 added one cross-story E2E path:

```text
base plan
  -> cohort derivation
  -> detached CompetitionEntry
  -> H10 taper/recovery/proposal/protection/review
  -> explicit coach edit
  -> integral regeneration/diff/block acceptance
  -> atomic idempotent persistence
  -> athlete cohort-first resolution
```

KAN-240 adds revision-based stale and concurrency behavior. Focused async tests cover equivalent double submit, different simultaneous decisions, stale sequential submission and rollback after a partial failure.

## Supabase evidence — complete

Real PostgreSQL/Supabase validation completed successfully:

```text
pn db:check:supabase       -> OK
pn db:migrate:supabase     -> migrations applied successfully
pn db:verify:supabase      -> 25/25 application tables, 25/25 with RLS
pn db:verify:h11:supabase  -> OK
```

The H11 probe confirmed:

- commit/replay: 1 operation, 1 audit, 1 journal entry;
- stale submission rejection with no additional writes;
- intentional audit failure rolls back operations, audits and journal completely;
- cross-scope rejection leaves zero partial writes;
- plan revision advances only on successful commit.

The FK check validates the actual `competition_entries.group_training_plan_id -> group_training_plans.id` relation through PostgreSQL catalog metadata rather than relying on the generated constraint name, which PostgreSQL truncates to its identifier limit.

## Final local technical gate — complete

The final technical gate is green:

```text
pn test               -> 518/518 pass, 0 fail
pn lint               -> 0 errors, 11 known baseline warnings
pn exec tsc --noEmit  -> 0 errors
pn build              -> production build successful
```

If any code changes after this point, rerun the affected checks and then the complete gate before merge.

## Remaining functional walkthrough

Before closing `KAN-224`, run the manual walkthrough for the affected planning flow:

1. inspect a base group plan and a cohort variant without mixed scope;
2. verify competition calendar/provenance is visible in the correct plan;
3. review a generated change and a coach-protected/manual value;
4. confirm a coherent accepted block changes only its intended range;
5. repeat the same accepted operation and confirm no duplicate planning/session/audit state;
6. verify an athlete in an applicable cohort resolves the variant and another/fallback date resolves the base plan;
7. verify no console/runtime error in the reviewed flow.

Record the result in Jira. If the walkthrough reveals a code change, rerun the complete technical gate.

## Story close sequence

1. Complete the functional/manual walkthrough.
2. Record final walkthrough evidence in Jira.
3. Close `KAN-224` only after the walkthrough is green.
4. Validate final Vercel deployment when quota permits.
5. Merge/fast-forward `h-20-planning-review-persistence` into `dashboard` using the normal delivery workflow.
6. Once H11 is closed and durable information is confirmed in architecture/history, replace/remove this temporary handoff when the next story starts.
