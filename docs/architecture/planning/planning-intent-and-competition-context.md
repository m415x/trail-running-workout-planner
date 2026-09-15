# Planning intent and competition context

## Purpose

Separate three concepts that were previously represented through overlapping
uses of `TrainingGoalType` and race data:

1. an athlete's individual objective;
2. the general training intent of a group plan; and
3. the competitive events that condition a subset of that group's planning.

This correction is introduced progressively during H9. Existing race-oriented
plans must remain readable while planning authority moves away from
`goalType === 'race'`.

## Problem discovered before H9

The current implementation reuses `TrainingGoalType` in group planning.
`LoadStrategyContext`, `IntensityStrategyContext`, generation inputs, persistence,
and the coach planning form all use the same values as an athlete's individual
`TrainingGoal`:

```text
race | performance | base | maintenance | custom
```

For `race`, group-plan creation also requires concrete race data and stores it on
`Macrocycle.targetRace*`. The macrocycle generator uses that race context to
produce competitive phases and taper behavior.

That means a base plan such as `S2` can semantically become "the plan for Race
X" even when only some S2 athletes intend to participate. H7 introduced planning
cohorts specifically so a temporary subset of one sporting group can receive an
independent planning variant. Keeping a concrete race as the objective of the
base group plan would therefore duplicate and blur responsibilities.

## Corrected vocabulary

### TrainingGoal

`TrainingGoal` remains individual and belongs to `AthleteProfile`.

It answers:

> What does this athlete personally want to achieve?

A race remains a valid individual goal type. H9 does not remove
`TrainingGoalType.race` from the athlete domain.

Individual goals may inform a coach's decision to create or assign a planning
cohort, but they do not directly own or silently mutate group planning.

### PlanningIntent

`PlanningIntent` is the general purpose of a group plan independent from a
specific competition.

It answers:

> What training direction should this plan pursue for its audience?

H9 introduces a dedicated planning-domain type instead of reusing
`TrainingGoalType`:

```text
development | base | maintenance
```

- `development` means the plan seeks progressive development or improvement of
  the audience's training capabilities. It is the normal/default intent for a
  base group plan.
- `base` means the plan prioritizes building or rebuilding general aerobic
  capacity with a more conservative progression.
- `maintenance` means the plan seeks to preserve current capacity without
  significant progression.

`race` is deliberately excluded because a competition is planning context, not a
general plan intent. `custom` is also excluded because manual coach adaptation is
already represented by strategy values and their provenance; it is not itself a
planning direction. Recovery remains represented at lower planning layers such
as transition periods, deload microcycles, and recovery intensity emphasis.

Legacy group-planning values map during H9 as follows:

```text
race        -> development
performance -> development
base        -> base
maintenance -> maintenance
custom      -> development
```

For a legacy `race` plan, concrete `targetRace*` data is not discarded. The
planning intent maps to `development`, while race data must migrate separately to
competition context in later H9 tasks.

A base group plan must be valid without any competitive context.

### CompetitionEntry

`CompetitionEntry` represents an actual competitive event relevant to one
planning audience.

It answers:

> Which competition may condition this plan, and when?

The persistence owner is `GroupTrainingPlan`, not `PlanningCohort` or
`TrainingGoal`. For the MVP, competition-specific planning is expected primarily
on cohort variants because only the athletes in that cohort require the
adaptation.

A cohort may share several competitions; one cohort is not equivalent to one
race.

### CompetitionContext

`CompetitionContext` is the pure planning boundary derived from competition
entries.

It answers:

> Which competitive information should the planning engine consider now?

Planning and generation code should consume this domain context instead of
querying persistence directly or inferring competition from
`goalType === 'race'`.

### Macrocycle target-race snapshot

`Macrocycle.targetRace*` remains during H9 as a historical and operational
snapshot of the primary competition used when a macrocycle was generated or
reviewed.

It is not the conceptual owner of the competition.

Changing, rescheduling, or cancelling a live `CompetitionEntry` must not
silently rewrite an already persisted macrocycle snapshot. Snapshot evolution,
including whether race date must also be preserved, is handled explicitly later
in H9.

## Corrected model

```text
AthleteProfile
    |
    `-- TrainingGoal
        individual objective

AthleteGroup
    |
    `-- GroupTrainingPlan base
        |
        |-- PlanningIntent
        |-- LoadStrategy
        |-- IntensityStrategy
        `-- Macrocycle
            general group progression

PlanningCohort
    |
    `-- GroupTrainingPlan variant
        |
        |-- PlanningIntent
        |-- CompetitionEntry *
        |       |
        |       `-- A / B / C
        |
        |-- CompetitionContext
        `-- Macrocycle
            adapted planning
            + targetRace* historical snapshot
```

## Planning authority

The target planning input becomes:

```text
PlanningIntent
      +
Load / intensity strategies
      +
CompetitionContext?
      |
      v
planning generation
```

instead of:

```text
TrainingGoalType
      |
      `-- goalType === race -> competitive behavior
```

The current taper and competitive-generation rules are not discarded merely
because their source changes. H9 first moves the source of that behavior to an
explicit primary competition context. Revising the sporting taper policy itself
is a separate concern.

## Base-plan rule

A base `GroupTrainingPlan` represents the normal progression shared by its
`AthleteGroup`.

It must be possible to create, persist, generate, and use the base plan with no
competition at all. A competition that concerns only a subset of the sporting
group must not redefine the base plan for everyone.

When a subset needs competition-specific adaptation, that audience is expressed
through a `PlanningCohort` and its detached `GroupTrainingPlan` variant.

## Cohort rule

H7 remains authoritative for cohort identity, dated membership, sporting-group
classification, and detached variant semantics.

H9 extends that model rather than replacing it:

```text
same sporting group
+ different competitive context
= possible planning cohort
```

A variant remains an independent snapshot after derivation. Competition-calendar
selection and copying must therefore also preserve independent identities and
must never create a live synchronization relationship between base and variant
plans.

## H8 compatibility

The category-distance policy remains valid and independent from weekly training
load.

During H9 its primary live input evolves from only a macrocycle race snapshot
toward `CompetitionEntry.distanceKm`, always using the parent
`AthleteGroup.categoryCode`. The result remains derived and advisory. It does
not automatically change group assignment, cohort membership, individual goals,
load strategy, or persisted planning.

Legacy macrocycle snapshots remain evaluable while old plans are supported.

## Current coupling inventory

The H9 audit identified these existing dependencies that must be migrated
progressively:

- `TrainingGoalType` defines both athlete goals and group-planning criteria.
- `LoadStrategyContext.goalType` stores `TrainingGoalType` as planning context.
- `GOAL_LOAD_PROFILES` selects load defaults by `TrainingGoalType`; `race` and
  `performance` currently share the same load profile.
- `IntensityStrategyContext.goalType`, default intensity-method recommendations,
  intensity limits, and the intensity rule matrix are keyed by
  `TrainingGoalType`.
- the new-plan UI defaults to `race`, labels it "Preparar una carrera", and
  conditionally asks for concrete group race data.
- group-plan creation validates `goalType`, obtains both load and intensity
  recommendations from it, resolves required race data when the value is
  `race`, and persists the same value on load and intensity strategies.
- `TargetRaceSnapshot` and `Macrocycle.targetRace*` preserve the concrete race
  context used by existing group planning.
- macrocycle generation currently requires race data when `goalType === 'race'`
  and rejects race data for other goal types.
- taper duration is currently selected from concrete race demand, planned peak
  weekly load, and sporting group after the race branch has been selected.
- progression persistence can reconstruct a race input from
  `Macrocycle.targetRace*`.
- H8 compatibility is derived from the macrocycle race distance on generated
  previews and persisted-plan reads.
- H7 cohort derivation currently copies load/intensity strategy `goalType` and
  macrocycle target-race snapshots into an independent variant.

These are migration points, not instructions to replace everything at once.
H9 must preserve working legacy plans until the new boundaries are established.

## Progressive migration contract

H9 follows this order:

```text
TrainingGoalType used by planning
        |
        v
introduce PlanningIntent
        |
        v
separate optional CompetitionContext
        |
        v
make base plans competition-neutral
        |
        v
introduce CompetitionEntry and calendar ownership
        |
        v
derive CompetitionContext from the calendar
        |
        v
move competitive/taper behavior to CompetitionContext
        |
        v
keep a legacy adapter for existing targetRace* plans
        |
        v
remove goalType='race' from planning authority
```

At no point should a migration step silently alter accepted coach planning.

## Non-goals for the correction

This architectural correction does not by itself:

- remove `race` from individual `TrainingGoalType`;
- change an athlete's sporting group;
- automatically create or assign planning cohorts;
- define a public race catalogue or external race search;
- define athlete race registration;
- create cohort-specific session prescriptions;
- introduce new taper, peak, recovery, or race-proximity physiology rules;
- allow calendar edits to regenerate accepted planning automatically.

Those behaviors require their own explicit domain rules.