# Handoff — Epic 2 / History 7 completed

## Repository state

- Story branch: `h-16-planning-cohorts`.
- T7 commit: `e8d01d5 feat: add planning cohort views`.
- Persistence prerequisite commit: `689ed1e feat: persist planning cohorts`.
- H7 is complete through T13.
- Cohort persistence, management, dated memberships, planning resolution, and
  isolation coverage are implemented.

## Story objective

Allow athletes from the same sporting group to share a temporary planning
variant without changing their sporting classification or the base plan used by
the rest of the group.

Read [the planning cohort architecture](../architecture/planning-cohorts.md)
before continuing. It is the durable source for terminology and invariants.

## Completed tasks

### T1 / KAN-164 — Define group, cohort, and membership rules

Commit: `95771d0 docs: define planning cohort boundaries`

- `AthleteGroup` remains the stable sporting classification.
- `PlanningCohort` is a temporary subdivision of one group.
- `TrainingGoal` remains individual and never silently changes a shared plan.
- Planning resolves by dated cohort membership, with group plan fallback.
- Individual overrides remain outside this story.

### T2 / KAN-165 — Design PlanningCohort

Commit: `352b134 feat: define planning cohort model`

The contract contains required `teamId`, parent `groupId`, `name`, `purpose`,
nullable `description`, and lifecycle `active | archived`. The cohort has no
date range: membership dates and plan horizons remain the temporal sources of
truth.

### T3 / KAN-166 — Design temporary cohort memberships

Commit: `41c3646 feat: define dated cohort memberships`

`PlanningCohortMembership` references `athleteProfileId`, not `User` and not the
existing fee/payment `memberships` model. It stores inclusive `startDate` and
nullable `endDate`, plus assignment and closure audit context. Null `endDate`
means open; closed records remain immutable history.

### T4 / KAN-167 — Define membership and group-change restrictions

Commit: `0078763 feat: validate cohort membership rules`

Pure rules cover identity, same team/group, active entities, strict ISO dates,
inclusive interval overlap, edit exclusion, and closure before a sporting-group
change becomes effective. The future persistence operation must close cohort
memberships and change sporting group atomically.

### T5 / KAN-168 — Associate a planning variant with a cohort

Commit: `d0ad574 feat: associate cohort planning variants`

`GroupTrainingPlan.groupId` remains required. A base plan has null
`planningCohortId` and `sourceGroupTrainingPlanId`; a cohort variant has both.
Cohort, variant, and direct source share a sporting group. Self-reference,
partial associations, and variant chains are rejected.

### T6 / KAN-169 — Derive a variant from the base plan

Commit: `a79c8a9e4626e92443b799eb1c131e8cbc7c2296`
(`feat: derive cohort planning variants`).

Derivation is a pure operation:

```text
base GroupTrainingPlan
          ↓ snapshot and identity remapping
draft cohort variant
```

Consolidated rules:

- only a base `GroupTrainingPlan` may be the source;
- `planningCohortId` identifies the destination cohort;
- `sourceGroupTrainingPlanId` points directly to the base plan;
- variant chains are forbidden;
- every derived variant starts with `status = 'draft'`;
- derivation and coach activation are separate decisions;
- every copied persisted child receives a new ID;
- no mutable state or ID is shared with the source;
- copied aggregates are `LoadStrategy`, `IntensityStrategy`,
  `SessionGenerationPreferences`, `Macrocycle`, `Mesocycle`, `Microcycle`, and
  `MicrocycleIntensityTarget`;
- manual/generated and suggested/manual provenance is preserved;
- `MicrocycleIntensityTarget.microcycleId` is explicitly remapped;
- duplicate derived IDs and reused source IDs are rejected;
- `Session` and `GroupSessionPrescription` are not copied;
- derivation performs no database writes.

These decisions must not be reverted by persistence or UI work.

## Auxiliary seed refresh

Commit: `d50e87ca21edfae6913f6beeeddabe825c3ce48f`
(`chore: refresh sqlite planning seed`).

Current main fixtures:

- M1: Trail Marathon 42K, 12-week base plan, load and intensity strategies,
  generation preferences, and microcycle intensity targets.
- S2: Short Trail 12K, 8-week base plan with the same planning aggregates.
- B3: available sporting group without a competitive plan.

The seed exposed a separate rule: competitive category distance is not weekly
training volume. Do not implement that rule in H7. It belongs to Epic 2 / H8,
KAN-177, “Validate compatibility between category and target distance”. The
former competitive-calendar story consequently moves to H9.

### T12 / KAN-175 — Prepare SQLite and PostgreSQL migrations

Implemented after T6 as the technical prerequisite for T7.

- Added `planning_cohorts` and `planning_cohort_memberships` consistently to
  the SQLite and PostgreSQL schemas.
- Added nullable `planningCohortId` and `sourceGroupTrainingPlanId` relations
  to `GroupTrainingPlan`.
- Added foreign keys, query indexes, lifecycle/date/association checks, and one
  planning variant per cohort.
- Added an idempotent local SQLite migration that preserves existing plans as
  base plans without deleting `sqlite.db`.
- Generated reviewed Supabase migration `0009_thin_bushwacker.sql` and enabled
  RLS for both new tables.
- Updated remote verification to expect the new tables.
- Added focused migration and constraint tests.
- The Supabase migration is prepared but was not applied remotely in this task.

### T7 / KAN-170 — Create cohort list and detail screens

Implemented against the real SQLite cohort persistence introduced by T12.

- Added a coach sidebar entry and the localized routes
  `/dashboard/cohorts` and `/dashboard/cohorts/[cohortId]`.
- The list shows lifecycle, parent sporting group, purpose, current membership
  count, and associated planning variant.
- The detail shows cohort context, planning lineage when available, and dated
  current/historical memberships linked to athlete profiles.
- Soft-deleted cohorts, memberships, and planning variants are excluded.
- Queries remain isolated to the current development team without spreading its
  fixed ID into domain helpers.
- Seed fixtures include an active S2 cohort with current and historical
  memberships plus an archived empty M1 cohort.
- T7 remains read-only: create/edit and athlete assignment belong to T8/T9.

### T8 / KAN-171 — Create and edit cohorts

- Added creation restricted to active sporting groups in the current team.
- Added editing of name, shared purpose, and description from cohort detail.
- The parent sporting group remains immutable after creation.
- Duplicate visible names are rejected within the same sporting group; the same
  name remains valid in another group.
- Form values survive server-side validation failures.
- Active cohorts can be archived as a terminal operation. Archived cohorts
  remain visible as read-only history and cannot be reactivated or edited.
- Creation starts with no memberships and no derived plan; those remain separate
  operations.
- Coach-managed cohorts are the initial entry point. The documented target
  evolution is a race-calendar flow where athlete race/distance intent plus the
  current sporting group proposes a compatible cohort for coach confirmation.
  Manual creation remains an alternative, and T8 adds no premature race fields.

### T9 / KAN-172 — Assign and remove athletes from a cohort

- Added explicit manual assignment from an active cohort to active athletes in
  its parent sporting group.
- Each assignment creates a new dated membership with an inclusive start date
  and optional coach reason; it never changes `AthleteProfile.groupId`.
- The persistence action revalidates team, group, athlete, cohort lifecycle, and
  overlapping periods inside one transaction.
- Removing an athlete closes the open membership with an inclusive final date
  and optional reason. It never deletes or rewrites the historical period.
- Invalid dates, repeated closure, cross-group assignment, archived cohorts,
  and same-group period overlaps are rejected.
- Added focused closure-policy tests and coach-facing forms that preserve input
  after server-side validation errors.
- The coach completed assignment, overlap, closure, history, archived-cohort,
  and console checks without finding errors.

### T10 / KAN-173 — Show members and membership history

- Replaced the mixed membership table with separate sections for athletes whose
  period is current, scheduled to begin in the future, or already historical.
- Temporal classification retains inclusive start and end boundaries and hides
  soft-deleted records.
- Each row shows the athlete, nickname, complete period, assignment reason, and
  closure reason when available.
- Current and scheduled open memberships retain the closure action; historical
  periods remain read-only while preserving access to the athlete profile.
- Added focused tests for current, scheduled, historical, and soft-deleted
  presentation states.
- The coach completed the status separation, dates, reasons, actions, empty
  states, and console walkthrough without finding errors.

### T11 / KAN-174 — Resolve the plan applicable to an athlete on a date

- Added a pure dated resolver that prioritizes an applicable cohort variant and
  falls back to the base sporting-group plan.
- Plan applicability requires a visible active or completed plan with a visible
  macrocycle covering the requested date; drafts and cancelled plans do not
  apply.
- Historical sporting group is reconstructed from dated group-change records
  rather than assuming the athlete's current `groupId` for every date.
- Overlapping cohort memberships, ambiguous group history, invalid cohort-plan
  associations, and multiple base plans covering the same date return explicit
  conflicts instead of choosing silently.
- The athlete detail now shows the plan resolved for today, its cohort/group
  origin, and a direct planning link without changing session prescriptions.
- The athlete list combines group and current cohort in one compact column. It
  omits fallback wording when no cohort exists and links the cohort name only
  when a dated membership is current.
- Added seven focused tests covering precedence, fallback, plan horizon and
  lifecycle, conflicts, and historical group reconstruction.
- The coach completed list, cohort link, fallback, plan detail, empty-state, and
  console checks without finding errors.

## Validation known at this handoff

- T4 membership policy: 9 focused tests.
- T5 plan association: 6 focused tests.
- T6 plan derivation: 10 focused tests, rerun successfully on
  `d50e87ca21edfae6913f6beeeddabe825c3ce48f` while preparing this handoff.
- T12 migration policy: 3 focused tests.
- T7 membership presentation: 3 focused tests.
- Full suite after T7: 251 passed, 0 failed.
- TypeScript and production build passed.
- Supabase migration journal check passed.
- Lint: 0 errors and the same 11 known baseline warnings.
- T8 reused the 251-test suite successfully; type checking and production build
  passed, and lint remained at 0 errors with the same 11 warnings.
- The coach completed the T8 create, edit, duplicate-name, validation,
  immutable-group, and archival walkthrough successfully.
- T9 full gate: 253 tests passed, type checking and production build passed,
  and lint remained at 0 errors with the same 11 known warnings.
- T10 full gate: 254 tests passed, type checking and production build passed,
  and lint remained at 0 errors with the same 11 known warnings.
- T11 final gate: 261 tests passed, type checking and production build passed,
  and lint remained at 0 errors with the same 11 known warnings.
- T13 final gate: 267 tests passed, type checking and production build passed,
  and lint remained at 0 errors with the same 11 known warnings.
- The coach completed the T13 regression walkthrough successfully. The only
  console noise observed was missing static avatar files (HTTP 404), which is
  unrelated to cohort isolation and remains separate data/static-asset debt.

## Story status

H7 is complete through T13 / KAN-176.

The final isolation coverage verifies team, group, cohort, membership, plan,
and athlete boundaries, including deleted records and overlapping membership
conflicts. The athlete list query is also fixed to the current team boundary.

## Confirmed execution sequence

T12 / KAN-175 was advanced before T7:

```text
T12 persistence foundation
  ↓
T7 list and detail using real queries
  ↓
T8 create and edit
  ↓
T9 assign and remove athletes
  ↓
T10 members and membership history
  ↓
T11 resolve the applicable dated plan
  ↓
T13 isolation tests
```

T12 is now implemented. Cross-table rules such as same-team/same-group
membership and historical date overlap still require transactional application
validation; a simple foreign key cannot enforce them.

## Remaining H7 tasks

None. Run the story-level final gate again only if code changes before merge.

## Consolidated constraints

- `AthleteGroup` remains the sporting classification and owns category/level.
- `AthleteProfile.groupId` remains the current sporting-group relationship.
- A cohort belongs to one team and parent group and has no own date range.
- Cohort membership is dated, references `AthleteProfile`, preserves history,
  and cannot overlap within the same parent group.
- An archived cohort is terminal in the current model.
- `TrainingGoal` remains individual and is not owned by a cohort.
- Applicable planning will resolve cohort variant first and group base fallback
  second; it never invents an individual override.
- `Session` remains a shared event. Do not change cohort prescription targeting
  before its dedicated scope.
- Preserve H6 `generationOwnership`, `generationKey`, `sharedEventKey`,
  idempotency, and manual/generated/generated-modified guarantees.
- Do not introduce competition calendars, category-distance policy, individual
  overrides, authentication work, or financial-membership changes in H7.

## Known debt and risks

- SQLite uses a dedicated idempotent cohort migration because it has no general
  reviewed migration journal equivalent to Supabase.
- The prepared Supabase migration has not yet been applied remotely.
- Supabase tables use RLS but production policies/authentication remain future
  work. New tables must enable RLS consistently without broadening Data API
  exposure.
- Date-overlap and cross-aggregate invariants need transaction-level tests.
- The fixed `team_1` development context must not spread into pure domain code
  or schema design.

## Working policy

- One task per commit, after user approval.
- Focused tests during implementation.
- Use focused checks during implementation. Run the full gate before manual
  handoff for structural changes, and repeat it after manual testing only when
  the validated code changes. Always run the full gate before the story merge.
- Add progressive JSDoc to new or substantially changed contracts.
- Keep durable rules in `docs/architecture/`; keep operational continuation
  state in this handoff.
