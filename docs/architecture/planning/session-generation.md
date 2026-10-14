# Automatic session generation

## Purpose

Generate a reviewable weekly session proposal from persisted group planning,
then save or regenerate it without duplicating records or overwriting coach work.

## Data flow

```text
GroupTrainingPlan
  + LoadStrategy
  + IntensityStrategy
  + Microcycle targets
  + SessionGenerationPreferences
  + Workout templates
          ↓
generateWeeklySessionProposals()
          ↓
groupSharedSessionEvents()
          ↓
SessionGenerationPreview
          ↓
reconcileSessionGeneration()
          ↓
Session + GroupSessionPrescription
```

## Domain decisions

- Planning owns load and intensity. Templates contribute reusable structure and
  defaults but do not override the resolved weekly plan.
- The weekly pattern is a preference, not a rigid calendar.
- A session represents an event. Group-specific load, intensity, microcycle, and
  notes belong to `GroupSessionPrescription`.
- Compatible planning scopes may share one `Session` while retaining
  independent prescriptions. This includes Base and Variant scopes of the same
  Sporting group as well as scopes from different groups.
- Persisted prescription uniqueness is `Session + microcycleId`. `groupId`
  remains descriptive/isolation data, not the audience identity.
- `generationKey` identifies one planning-scope prescription across
  regenerations.
- `sharedEventKey` identifies a reusable shared event.
- Regeneration updates stable generated records in place and removes generated
  records that are no longer proposed.

## Ownership

| State | Regeneration behavior |
| --- | --- |
| `generated` | May be updated or removed automatically. |
| `generated_modified` | Preserved because the coach edited it. |
| `manual` | Preserved because it was created by the coach. |

Event ownership and prescription ownership are independent. Editing one group
prescription does not automatically protect every prescription sharing the event.

## Race week and taper

- Race week is the final taper week.
- Its weekly volume and elevation represent pre-race training only.
- Race distance and elevation remain in the competition prescription.
- The race uses its real date and counts as one of the weekly sessions.
- Initial taper factors are `60% → 30%` for two weeks and
  `75% → 55% → 30%` for three weeks, calculated from planned peak load.
- Two versus three weeks considers race distance, planned peak volume, and group.
  These are generated defaults that the coach may refine.

## Persistence and audit

- SQLite is the local runtime; PostgreSQL/Supabase has parallel schema migrations.
- Saving the same proposal repeatedly is idempotent.
- Shared events are removed only when no active prescription from any planning
  scope remains.
- Generated creation, update, removal, and manual edits are recorded in
  `session_generation_modification_records` with before/after snapshots.
- Re-saving an unchanged proposal does not create an audit entry.


## Planning-scope convergence

Session generation remains plan-first. Each `GroupTrainingPlan` is generated
independently, but proposals converge through `sharedEventKey`:

```text
Base S2 ───────┐
Variant S2 ────┼─→ same Session ─→ independent prescriptions by microcycleId
M1 ────────────┘
```

`groupSharedSessionEvents()` rejects duplicate planning scopes, not duplicate
groups. Therefore Base and Variant from S2 may coexist on one shared Session as
long as their `microcycleId` values differ.

Persistence scopes existing prescriptions to the active plan lineage before
`reconcileSessionGeneration()`. Regenerating one plan cannot obsolete a sibling
plan's prescription that shares the same Session. Manual and
`generated_modified` prescriptions remain protected. Manual Session editing
uses the same `Session + microcycleId` identity and conflict target as generated
persistence.

Athlete resolution is downstream of generation: the applicable dated Base or
Variant plan is resolved first, then the prescription whose microcycle lineage
belongs to that plan is selected. Variant selection is complete authority for the
date; there is no sparse per-Session fallback to Base.


## Explainability and historical provenance

KAN-505 adds explainability around the existing generator without creating a
second planning engine or changing weekly-generation authority.

`GenerationExplanation` is structured evidence attached to one generated
planning-scope prescription. Its causal stage order is fixed:

```text
weekly_budget
  → frequency
  → slots
  → stimulus_template
  → fixed_load
  → remaining_budget
  → flexible_allocation
  → intensity
  → coordination_reconciliation
```

The explanation is built from the same `SessionGenerationInput`, weekly result,
shared-event result and existing generator rules that produced the proposal.
It must not infer reasons that the generator did not actually use.

The weekly pattern remains a flexible preference. Explainability may show that
habitual days were kept, omitted or replaced and may expose material influences
such as recovery spacing, race placement, microcycle context, frequency,
template compatibility, fixed circuit load and intensity constraints. This
does not promote the pattern to a hard scheduling constraint.

### Planning scope and shared Sessions

Explainability belongs to the prescription planning scope, not to the shared
`Session`.

- Base snapshots carry Base plan + Sporting group + microcycle scope.
- Variant snapshots additionally carry the Planning subgroup.
- One shared `Session` may therefore expose multiple independent explanations,
  one per active prescription/generation key.
- `sharedEventKey` and `generationKey` remain reconciliation identities, not
  causal provenance by themselves.

### Persistence

Historical explainability is stored only in
`session_generation_modification_records.generation_explanation`.

- SQLite stores the JSON payload in text; Supabase stores `jsonb`.
- The column is nullable and has no default so legacy audit rows remain valid.
- Generated create/update audit rows may store a snapshot.
- Removal audit rows do not invent a new explanation.
- `Session` and `GroupSessionPrescription` do not store one mutable current
  explanation.
- Localized prose is presentation-only. Historical snapshots persist structured
  codes/facts and strip generator `source_warning` strings before persistence.

Session detail reads the latest persisted non-null explanation for each active
prescription. It does not rerun the generator to reconstruct history.
Current `generationOwnership` and `generationKey` are displayed separately
from historical generated origin.

### Downstream boundary

Explainability ends at the audience prescription.

`AthleteSessionAdjustment` remains Coach-owned downstream planning state keyed
by `athleteId + sourcePrescriptionId`. It may change the effective athlete
prescription but never becomes generator provenance and is never folded into
`GenerationExplanation`.

`WorkoutLog` remains realized-only evidence and is excluded from generation
provenance. Historical generation reasons must never be reconstructed from
performed-training state.

### Presentation

Coach preview and Session detail reuse the same structured explanation renderer.
The UI localizes stable fact/warning codes into human ES/EN labels and
operational messages while preserving the underlying structured snapshot.
Unknown presentation codes fall back to a readable label rather than exposing
raw implementation syntax as the primary Coach explanation.


## KAN-789/T4 — Temporary SQL review snapshots (implementation baseline)

T4 provides **server-only repository primitives**, not production CREATE/GET/confirm
routes. The opaque snapshot ID is a lookup key, **never authorization**. The
H2/H3/H4A identity and Coach permissions, Team/Plan/Base–Variant authority,
source-manifest freshness, reconciliation validation and final one-transaction
generation persistence remain T5/T6 work. Do not send snapshot JSON in a
Server Action payload; the intent is to address the HTTP 413 review submission.

- SQLite: `db/session-generation-review-snapshot-schema.ts`,
  `drizzle/sqlite/0026_session_generation_review_snapshots.sql`,
  `lib/session-generation/review-snapshot-sqlite-repository.ts`.
- PostgreSQL: `db/supabase/session-generation-review-snapshot-schema.ts`,
  `drizzle/supabase/0039_session_generation_review_snapshots.sql`,
  `lib/session-generation/review-snapshot-postgres-repository.ts`.
  PostgreSQL snapshot relation has RLS enabled **without policies**; this is
  not proof of authorization for a privileged server database connection.
- Repository lifecycle: create, read ACTIVE without mutation, consume with
  callback using the **same transaction**, invalidate ACTIVE, explicit oldest
  ACTIVE replacement (caller supplies `replaceSnapshotId`), and **separate**
  terminal-state purge. Neither GET nor rendering creates or purges snapshots.
- Create enforces a 30-minute TTL and at most two ACTIVE reviews per
  `userId/teamId/groupTrainingPlanId`. SQLite uses an IMMEDIATE transaction;
  PostgreSQL serializes allocation with an advisory transaction lock by scope.
  Consumed snapshots and nonempty result references are not replaceable or
  purgeable. Purge requires an **explicit user/team/plan scope** in both engines,
  a canonical ISO retention cutoff, terminal `expired`/`invalidated`
  status and absent consumption evidence.
- The envelope validator caps serialized UTF-8 payload at 4 MiB,
  `sessionCount` at 500 and `microcycleCount` at 60. It also currently caps
  aggregate `proposal.events[].prescriptions` at 500, stages per explanation
  at nine, and aggregate facts per explanation stage at 256. **The numeric
  prescription and fact limits are approved for the measured representative
  53-week Base/Variant per-Plan capacity scenarios, **not a universal product
  maximum proven for all possible Coach proposals**. T5 must derive counts
  from server-owned proposal data and enforce complete schema/causal
  validation; caller-provided metadata is not authoritative.

### Acceptance evidence and remaining gate

KAN-789/T4 focal SQLite tests cover lifecycle, replacement, expiry and
scope-limited purge. PostgreSQL tests run only with the explicitly guarded
**disposable** `KAN789_PG_URL` target; missing env means **SKIP**, not proof
of PostgreSQL behavior. The operator confirmed a joint GREEN of six PostgreSQL
tests (allocation, consumption, invalidation, concurrency, replacement, purge)
and a subsequent `pn verify --db` PASS at feature checkpoint
`90655bbfe84d429a5760aafd444fd5ee7e2088a5`.
The last SQLite purge isolation tests also returned GREEN.

The motivating historical 53-week/239-session Coach review measured proposal
202,945 B, explanations 1,574,495 B, and multipart estimate 1,778,414 B.
Its original input configuration was not recovered, and that evidence does not
establish historical prescription or causal fact cardinality.

The **pure-input deterministic production-generator** instrument
`scripts/measure-kan-789-annual-snapshot.ts` instead measures a reproducible
representative scenario (not the original Coach review):
- Annual Base-only: 53 microcycles, 212 events/prescriptions/explanations,
  9 stages each, maximum 17 causal facts per stage including warning facts;
  envelope 1,492,651 B at checkpoint
  `42410c841ff3729f22ae8816029ca11b65d34c9d` (Jira 12874).
- Base/Variant aggregate: 53 calendar weeks, **106 distinct microcycles**
  across two independently generated Plans, 212 events carrying 424
  prescriptions and 424 explanations, combined envelope 2,954,355 B.
  This is a **diagnostic consolidation**, not a persistable SQL snapshot
  (Jira 12882).
- Canonical one-Plan snapshots at checkpoint
  `b826929695a93be3c2e3c7fdc57ad62b1840b204`:
  Base has 53 distinct microcycles, 212 events/prescriptions/explanations,
  1,492,759 B envelope (SHA256
  `e57a2d4a7efc36a3562c7b5b06d0afac524f9f768d9eddba08f5fbe14872bb20`);
  Variant has 53 distinct microcycles, 212 events/prescriptions/explanations,
  1,527,378 B envelope (SHA256
  `2620f5d28243c1e4d26c58a4507e6525c1f7de4e4bbac63215fd1d8114dbd6fb`).
  Both preserve 9 stages, maximum 17 causal facts/stage, and pass all
  Plan-scoped 4 MiB/500 sessions/500 prescriptions/60 microcycles/9 stages/
  256 facts bounds (Jira 12886). No limit increase is justified.

The operator subsequently confirmed **`pn verify --db` PASS 6/6** on that
same feature HEAD: Tests, TypeScript, ESLint, Build, i18n, and SQLite.
The earlier six disposable PostgreSQL integration tests were GREEN on
the previously documented code baseline; no PostgreSQL run on the final
documentation HEAD is claimed. T4 validates SQL primitives and capacity,
**not** product integration.

Remaining T5/T6 obligations: enforce Plan/Team/Group/Cohort membership and
embedded payload ownership; derive microcycle/session counts server-side;
H2/H3/H4A authorization, source freshness, sibling Base/Variant event
reconciliation, concurrent writes, audit and CAS consume in the same
transaction. The synthetic generator probe is not evidence of successful
Coach HTTP persistence or historical 239-session acceptance.

### KAN-789/T4 — Base/Variant unit and reconciliation risks

The canonical SQL review snapshot unit is **one `groupTrainingPlanId`**.
Both SQLite and PostgreSQL schemas have a single non-null Plan FK plus
`teamId`, `groupId` and nullable `planningCohortId`. Repository allocation,
lookup, invalidation, consumption and purge use scoped User/Team/Plan
identities. The schema itself does not prove that the declared Group/Cohort
belongs to that Plan, and repositories do not validate that every embedded
prescription, `generationKey`, explanation and `sourceManifest` belongs to
the same Plan. Those are fail-closed T5 authorization/source-validation
requirements, not accomplished T4 assurances.

A Base and a derived Variant may independently generate same
`sharedEventKey` but distinct `generationKey` and microcycle lineage.
They are **two snapshots**, not one combined SQL snapshot. The combined
Base/Variant output of the capacity probe is **diagnostic-only**.
Use `node --import tsx scripts/measure-kan-789-annual-snapshot.ts --scenario=base-variant`
to report both Plan-scoped envelopes and the aggregate separately.
`calendarWeeks=53` is not the same as `distinctMicrocycleIds=106`
across the aggregate; each Plan-scoped envelope should contain 53
distinct microcycle IDs and be assessed individually against the 60 cap.
Any requirement to save/confirm multiple Plans as one indivisible transaction
is a **new product contract** and must stop for explicit architectural approval.

#### KAN-790/T5 and KAN-791/T6 verification matrix

| Scenario | Required acceptance (not yet implemented/proved) |
| --- | --- |
| Base then Variant confirmation, same `sharedEventKey` | Reuse one existing Session event, insert second Plan-scoped prescription by distinct `microcycleId`; no duplicate Session |
| Variant then Base confirmation | Same result independent of order, preserving each Plan's `generationKey` and historical explanation |
| Regenerate Base after Variant exists | Scope obsolete-prescription detection to Base lineage; never delete/update Variant prescription or shared event still referenced by Variant |
| Regenerate Variant after Base exists | Symmetric isolation; independently preserve Base prescription and audit |
| Two confirmations concurrently | Serialize/race-proof same `sharedEventKey` creation, uniqueness, reconciliation read-set and full transaction; no duplicate/orphaned records |
| `generated_modified` or `manual` session/prescription | Fail on protected collision or preserve ownership; never overwrite Coach changes in sibling scope |
| Stale source, changed calendar/template/microcycle or revoked permission | Revalidate H2/H3/H4A, Team/Plan/Base–Variant relationship, generation input versions before any durable mutation |
| Conflict, rollback, retry and consumed snapshot | Atomic Session + both relevant prescription consequences + audit per confirmation, CAS consume with result reference, deterministic retry and no partial writes |

Current `reconcileSessionGeneration` is **pure** and assumes that
`existingEvents` and `existingPrescriptions` have already been correctly
scoped. It cannot by itself guarantee safe concurrent database writes or
protection of sibling shared events. These guarantees require T5/T6
repository read/write boundary and integration tests.
