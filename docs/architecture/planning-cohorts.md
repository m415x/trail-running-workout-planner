# Planning cohorts

## Purpose

Allow athletes from the same sporting group to share a temporary planning
variant without changing the sporting classification of the athlete or the base
plan used by the rest of the group.

## Domain vocabulary

### Sporting group

`AthleteGroup` is the stable operational classification of an athlete inside a
team. It owns the category and level (`S2`, `M1`, and so on), remains the source
of those derived athlete attributes, and continues to be referenced by
`AthleteProfile.groupId`.

A group answers: **which sporting group does this athlete currently belong to?**

### Planning cohort

`PlanningCohort` is a temporary subdivision of exactly one `AthleteGroup`. It
groups athletes who should share a planning variant because they have compatible
objectives or a compatible competitive horizon.

A cohort answers: **which shared planning variant applies to this athlete during
this period?**

Creating, joining, leaving, archiving, or renaming a cohort never changes the
athlete's category, level, or `AthleteProfile.groupId`.

Its initial domain contract contains:

- required `teamId` and parent `groupId` references;
- a coach-facing `name`;
- a required `purpose` explaining why the shared planning variant exists;
- an optional `description` represented as nullable text;
- a lifecycle status of `active` or `archived`.

The cohort itself has no start or end date. The applicable dates belong to its
athlete memberships, while the training horizon belongs to the associated plan
and macrocycles. This avoids competing sources of temporal truth.

Archiving is the terminal initial state. Reactivation may be introduced only as
an explicit coach operation with renewed validation; consumers must not treat an
archived cohort as active merely because it still has historical relations.

### Planning cohort membership

`PlanningCohortMembership` records the dated relationship between an
`AthleteProfile` and a `PlanningCohort`. It is different from the existing
`memberships` model, which represents fees and payments.

Membership periods use ISO calendar dates and inclusive boundaries:

- `startDate` is required;
- `endDate` is nullable while the membership is active;
- a closed membership remains as history and is not overwritten by a later
  assignment.

Its initial contract contains:

- required `planningCohortId` and `athleteProfileId` references;
- required `startDate` and nullable `endDate`;
- nullable `assignedByUserId` and `assignmentReason` audit context;
- nullable `endedByUserId` and `endReason` closure context.

Membership status is derived rather than stored: `endDate = null` means open
and a populated `endDate` means closed. This avoids contradictory combinations
such as an active status with an already-ended interval. Closing a membership
must populate the end metadata consistently; those validation rules belong to
the next task.

## Relationship to individual goals

`TrainingGoal` remains owned by one athlete. A cohort does not replace, merge,
or take ownership of individual goals. Individual goals may provide context when
the coach decides who belongs to a cohort, but they must not silently mutate a
group or cohort plan.

```text
AthleteProfile
  + current AthleteGroup
  + individual TrainingGoal(s)
  + dated PlanningCohortMembership
                    |
                    v
              PlanningCohort
                    |
                    v
          shared planning variant
```

## Competitive-calendar evolution

The initial management flow lets the coach create a cohort explicitly inside
one sporting group. This is the persistence and operational foundation, not the
intended final entry point for every cohort.

The preferred future flow begins with a race calendar and athlete intent:

```text
athlete chooses race and distance
              +
current sporting group
              +
compatible competitive horizon
              |
              v
system proposes a planning cohort
              |
              v
coach confirms or changes the proposal
```

A race may offer several distances, and athletes from different sporting
groups may choose the same distance. They must not automatically share one
planning variant: for example, an H2 athlete and an M1 athlete preparing for the
same 21 km race retain different group baselines. Cohort compatibility is
therefore expected to combine the race or distance option with the parent
sporting group and planning horizon rather than replacing `groupId`.

Manual cohort creation and assignment remain valid coach alternatives. Future
automation should propose rather than silently assign, because individual
goals, current load, availability, and intermediate competitions may make an
otherwise similar race objective incompatible. The competitive calendar, race
registration, automatic proposal rules, and race-linked cohort fields belong to
later stories; the current cohort schema must not invent them prematurely.

## Membership invariants

The initial cohort model follows these rules:

1. A cohort belongs to one team and one parent sporting group.
2. An athlete and a cohort must belong to the same team.
3. At the start of a membership, the athlete's current group must equal the
   cohort's parent group.
4. An athlete cannot have overlapping cohort memberships within the same parent
   group. Initially this means at most one applicable cohort on any date.
5. Reassigning an athlete to another cohort closes the previous membership
   before opening the next one; it does not rewrite history.
6. Moving an athlete to another sporting group closes any active cohort
   membership belonging to the previous group as part of the same operation.
7. An inactive athlete, group, or cohort cannot receive a new membership.
8. Archiving a cohort prevents new memberships but does not erase its plans,
   closed memberships, sessions, or audit history.
9. Deleting or closing an individual `TrainingGoal` does not automatically remove
   the athlete from a cohort.
10. Membership changes are explicit coach actions and must identify their
    effective date. They are not inferred automatically from similar goals.

Rules that can be represented by foreign keys or indexes should be reinforced in
the database. Cross-aggregate and date-overlap rules must also be validated by
the application transaction that changes membership.

Date intervals are inclusive. Two periods therefore overlap when one starts on
the same day the other ends. When a sporting-group change becomes effective,
every membership of the previous group must end strictly before that date. The
group change and those closures must eventually be persisted atomically.

## Planning resolution

### Base plans and cohort variants

`GroupTrainingPlan.groupId` remains required for every plan. A base group plan
has both `planningCohortId` and `sourceGroupTrainingPlanId` set to null. A cohort
variant must set both fields: the cohort identifies its audience and the source
plan identifies the baseline from which it was derived.

A variant and its source must belong to the same sporting group as the cohort.
The source must be a base plan; variant chains are not allowed. This keeps one
stable baseline for comparison and regeneration. Associating a new variant to
an archived cohort is invalid.

### Variant derivation

Derivation creates a detached draft snapshot and performs no database writes.
The variant always starts as `draft`; creating it and activating it are separate
coach decisions.

Every persisted child receives a new identity, and every internal reference is
explicitly remapped. The snapshot copies the load strategy, intensity strategy,
session-generation preferences, macrocycles, mesocycles, microcycles, and
microcycle intensity targets. It preserves manual/generated and
suggested/manual provenance while sharing no mutable state with the source.

The operation rejects duplicate derived IDs, reused source IDs, orphaned
microcycle intensity targets, archived or cross-group cohorts, and non-base
sources. Materialized `Session` and `GroupSessionPrescription` records are not
copied; they remain governed by their own generation and ownership lifecycle.

### Persistence foundation

SQLite and PostgreSQL persist cohorts in `planning_cohorts` and dated athlete
assignments in `planning_cohort_memberships`. The existing financial
`memberships` table remains unrelated.

`group_training_plans` stores nullable `planning_cohort_id` and
`source_group_training_plan_id`. Both values must be null for a base plan and
both must be populated for a cohort variant. A cohort has at most one directly
associated planning variant, and a plan cannot reference itself as its source.

The databases enforce foreign keys, lifecycle values, basic membership date
order, open-membership closure metadata, complete plan associations, and the
one-variant-per-cohort rule. Same-team and same-group consistency, membership
overlaps, source-plan group consistency, and variant-chain prevention cross
aggregate boundaries and must still be validated in the application
transaction.

The local SQLite migration is idempotent and leaves both new plan references
null for existing records. PostgreSQL introduces the same structures through
the reviewed Drizzle migration and enables RLS on both new tables; production
policies remain part of the future authentication and authorization work.

For a given athlete and calendar date, planning is resolved with this precedence:

1. use the applicable cohort planning variant when an active dated membership
   and an applicable cohort plan both exist;
2. otherwise fall back to the applicable base plan of the athlete's sporting
   group;
3. never synthesize an individual override as part of cohort resolution.

The resolution uses membership dates, not merely the athlete's current cohort.
This preserves historical calendar and workout-log behavior after an athlete
changes cohort.

If invalid legacy data would make more than one cohort applicable, resolution
must return a visible conflict instead of selecting one silently.

## Sessions and prescriptions

`Session` remains a shared event. Cohorts do not require duplicate events when
athletes train together. A later task will extend prescription targeting so that
a cohort may receive values different from its parent group while retaining the
group prescription as fallback.

This task does not change `GroupSessionPrescription`, its uniqueness rules, or
the generation keys established by automatic session generation.

## Implemented H7 boundary

H7 implements the cohort foundation end to end:

- SQLite and PostgreSQL persistence for cohorts and dated memberships;
- base-plan and cohort-variant associations;
- detached derivation of a draft variant from a base plan;
- coach list, detail, create, edit, archive, assignment, and closure flows;
- separate current, scheduled, and historical membership presentation;
- dated athlete planning resolution with cohort precedence and group fallback;
- team, group, cohort, athlete, lifecycle, deletion, and overlap isolation
  tests.

The athlete list presents the stable sporting group and adds the current cohort
only when one applies. It deliberately avoids fallback labels such as “group
plan” so the common case remains visually compact.

H7 intentionally does not introduce:

- competition calendars, race registration, or automatic cohort proposals;
- individual planning or session overrides;
- cohort-specific session-prescription targeting;
- automatic activation of a derived cohort plan;
- production authentication, authorization policies, or runtime migration from
  SQLite to PostgreSQL.

These boundaries prevent the cohort model from prematurely absorbing the
competitive-calendar and session-prescription responsibilities of later
stories.
