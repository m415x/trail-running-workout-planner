# Handoff — Epic 2 / History 7 in progress

## Repository state

- Story branch: `h-16-planning-cohorts`.
- Confirmed local and remote HEAD before this update:
  `d50e87ca21edfae6913f6beeeddabe825c3ce48f`.
- HEAD commit: `d50e87c chore: refresh sqlite planning seed`.
- Previous feature commit: `a79c8a9 feat: derive cohort planning variants`.
- H7 is complete through T6 plus the advanced persistence prerequisite T12.
- The tree was clean after `git fetch --prune` and before this handoff update.
- Cohort persistence and migrations exist; CRUD server actions and cohort UI do
  not exist yet.

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

## Validation known at this handoff

- T4 membership policy: 9 focused tests.
- T5 plan association: 6 focused tests.
- T6 plan derivation: 10 focused tests, rerun successfully on
  `d50e87ca21edfae6913f6beeeddabe825c3ce48f` while preparing this handoff.
- T12 migration policy: 3 focused tests.
- Full suite after T12: 248 passed, 0 failed.
- TypeScript and production build passed.
- Supabase migration journal check passed.
- Lint: 0 errors and the same 11 known baseline warnings.

## Next functional task

T7 / KAN-170 — Create cohort list and detail screens.

Implement T7 against the real cohort persistence introduced by T12. Do not add
mock persistence or temporary data contracts.

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

1. T7 / KAN-170 — Create cohort list and detail screens.
2. T8 / KAN-171 — Create and edit cohorts.
3. T9 / KAN-172 — Assign and remove athletes from a cohort.
4. T10 / KAN-173 — Show members and membership history.
5. T11 / KAN-174 — Resolve which plan applies to an athlete on a date.
6. T13 / KAN-176 — Add isolation tests across group, cohort, and athlete.

Verify Jira identifiers after KAN-170 if the remote tracker differs; later IDs
are recorded here from the current sequential plan.

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
- Before every implementation commit: full tests, lint, typecheck, build,
  `git diff --check`, and a manual walkthrough when UI changes.
- Add progressive JSDoc to new or substantially changed contracts.
- Keep durable rules in `docs/architecture/`; keep operational continuation
  state in this handoff.
