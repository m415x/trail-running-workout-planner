# Handoff — Epic 2 / H11: Planning review and safe persistence

## Status

- Story: `KAN-224` — H11: Revisión integral y persistencia segura del motor de planificación.
- Branch: `h-20-planning-review-persistence`.
- Base: `dashboard` after H10.
- Completed in Jira: `KAN-225` through `KAN-238`, plus `KAN-240`.
- In progress: `KAN-239` — real Supabase integration/rollback verification.
- In progress: `KAN-241` — final durable documentation and handoff consolidation.
- Delivery mode: remote-first. The complete local story gate remains mandatory before H11 closes or merges.

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

## KAN-239 — remaining real Supabase gate

The implementation is prepared but the task must not close until it runs against the connected project.

Run with `.env.local` containing the existing direct Supabase connection:

```bash
pn db:check:supabase
pn db:verify:supabase
pn db:verify:h11:supabase
```

`db:verify:h11:supabase` uses connection-local temporary PostgreSQL tables. It validates:

- required H11 planning tables and CompetitionEntry -> GroupTrainingPlan FK;
- async transaction commit;
- equivalent replay/idempotency;
- rollback after an intentional audit failure;
- team/group/cohort/plan scope rejection with zero partial writes;
- plan revision locking and stale-submission rejection.

No H11 migration has been created merely for this probe. Generate/apply a migration only if Drizzle or the approved production concurrency adapter reveals a real persistent schema delta.

## Final local story gate

After KAN-239 evidence and before closing `KAN-224`, pull the latest `h-20-planning-review-persistence` and run:

```bash
pn test
pn lint
pn exec tsc --noEmit
pn build
pn db:check:supabase
```

Expected lint baseline: 0 errors and the same 11 pre-existing warnings. New warnings are not accepted.

Then run the functional walkthrough for the affected planning flow:

1. inspect a base group plan and a cohort variant without mixed scope;
2. verify competition calendar/provenance is visible in the correct plan;
3. review a generated change and a coach-protected/manual value;
4. confirm a coherent accepted block changes only its intended range;
5. repeat the same accepted operation and confirm no duplicate planning/session/audit state;
6. verify an athlete in an applicable cohort resolves the variant and another/fallback date resolves the base plan;
7. verify no console/runtime error in the reviewed flow.

If any code changes after this gate, rerun the affected checks and then the complete gate before merge.

## Story close sequence

1. Execute and record KAN-239 real Supabase evidence.
2. Finish KAN-241 documentation review.
3. Run the complete local gate and functional walkthrough.
4. Record final evidence in Jira.
5. Close `KAN-224` only after all checks are green.
6. Validate final Vercel deployment.
7. Merge/fast-forward `h-20-planning-review-persistence` into `dashboard` using the normal delivery workflow.

Once H11 is closed and durable information is confirmed in architecture/history, replace/remove this temporary handoff when the next story starts.
