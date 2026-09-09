# Handoff — Epic 2 / History 7 in progress

## Repository state

- Story branch: `h-16-planning-cohorts`.
- Base branch: `dashboard` at merge commit `df90c44` when H7 started.
- H7 is complete through T5 after committing the current task.
- No cohort schema, migration, server action, or user interface exists yet.

## Story objective

Allow athletes from the same sporting group to share a temporary planning
variant without changing their sporting classification or the base plan used by
the rest of the group.

Read [the planning cohort architecture](../architecture/planning-cohorts.md)
before continuing. It is the durable source for terminology and invariants.

## Completed tasks

### H7/T1 — Define sporting group, cohort, and membership rules

Commit: `95771d0 docs: define planning cohort boundaries`

- `AthleteGroup` remains the stable sporting classification.
- `PlanningCohort` is a temporary subdivision of one group.
- `TrainingGoal` remains individual and never silently changes a shared plan.
- Planning resolves by dated cohort membership, with group plan fallback.
- Individual overrides remain outside this story.

### H7/T2 — Design PlanningCohort

Commit: `352b134 feat: define planning cohort model`

The TypeScript contract contains required `teamId`, parent `groupId`, `name`,
`purpose`, nullable `description`, and lifecycle `active | archived`.

The cohort has no date range: membership dates and plan horizons are the
respective sources of temporal truth.

### H7/T3 — Design temporary cohort memberships

Commit: `41c3646 feat: define dated cohort memberships`

`PlanningCohortMembership` references `athleteProfileId`, not `User` and not the
existing fee/payment `memberships` model. It stores inclusive `startDate` and
nullable `endDate`, plus assignment and closure audit context.

Membership status is derived: null `endDate` means open; a date means closed.
History is preserved by creating later records instead of reopening old ones.

### H7/T4 — Define membership and group-change restrictions

Commit: `0078763 feat: validate cohort membership rules`

Pure policy and tests live under `lib/planning-cohorts/` and
`tests/planning-cohorts/`.

Rules cover identity, same team/group, active entities, strict ISO dates,
inclusive interval overlap, edit exclusion, and closure before a sporting-group
change becomes effective. Group changes and cohort closures must eventually be
atomic.

### H7/T5 — Associate a planning variant with a cohort

Current task to be included in the next commit.

`GroupTrainingPlan.groupId` remains required. Two nullable references distinguish
the plan kind:

```text
Group base plan
  planningCohortId = null
  sourceGroupTrainingPlanId = null

Cohort variant
  planningCohortId = receiving cohort
  sourceGroupTrainingPlanId = direct group base plan
```

Associations must be complete. Cohort, variant, and source share a sporting
group. Self-reference and variant chains are rejected. New variants cannot be
associated with archived cohorts.

## Validation status

Before T5 handoff:

- Membership policy focused tests: 9 passed.
- Plan association focused tests: 6 passed.
- Focused ESLint: passed.
- TypeScript `--noEmit`: passed.
- The complete pre-commit gate must be run before committing this handoff.

The repository baseline before H7 had 220 tests and 11 known lint warnings. T4
increased the suite to 229 tests; T5 adds another 6.

## Next task

H7/T6 — Define how a cohort variant is derived from the group base plan.

Recommended scope:

1. Define a pure snapshot/copy operation from a base `GroupTrainingPlan`.
2. Decide which child data is copied: load strategy, intensity strategy,
   macrocycles, mesocycles, microcycles, and session-generation preferences.
3. Generate new identities for every persisted child; never share mutable child
   rows with the source plan.
4. Retain only `sourceGroupTrainingPlanId` as lineage.
5. Preserve manual/generated provenance in the copied planning values without
   making later source edits propagate automatically.
6. Do not copy persisted `Session` or `GroupSessionPrescription` records in T6.
7. Keep the operation pure; database persistence belongs to later tasks.
8. Add focused tests for independence, lineage, and nested identity mapping.

## Remaining proposed H7 tasks

6. Define how a planning variant is derived from the base plan.
7. Create cohort list and detail screens.
8. Create and edit cohorts.
9. Assign and remove athletes from a cohort.
10. Show members and membership history.
11. Resolve which plan applies to an athlete on a date.
12. Prepare SQLite and PostgreSQL migrations.
13. Add isolation tests across group, cohort, and athlete.

Review scope before each task. Persistence sequencing may require moving the
schema/migration task earlier than UI work; if so, document the adjustment rather
than introducing temporary mock persistence.

## Important constraints

- SQLite remains the local runtime and Supabase/PostgreSQL remains the parallel
  target.
- Do not reuse the table name `memberships`; it already represents fees.
- Do not remove `AthleteProfile.groupId` or derive category/level from cohorts.
- Do not link a cohort directly as owner of an individual `TrainingGoal`.
- Do not introduce competition calendar entities yet; those belong to H8.
- Do not extend cohort-targeted session prescriptions until their dedicated task.
- Preserve H6 ownership, stable-key, idempotency, and manual-edit guarantees.
- Use one task per commit after user approval.
- Run focused tests during development and the full test/lint/typecheck/build gate
  before every commit. Provide manual app checks whenever UI changes.
