# Competition calendar

## Purpose

Define the durable domain contract for competitions that can condition a
`GroupTrainingPlan` without turning a race into the objective of the whole
sporting group.

The competition calendar is introduced progressively during H9. This document
captures the entity boundary established by KAN-189; persistence, CRUD,
priority behavior and lifecycle transitions are implemented in later tasks.

## Ownership

A `CompetitionEntry` belongs technically to one `GroupTrainingPlan`.

```text
GroupTrainingPlan
    1
    |
    `-- * CompetitionEntry
```

For the MVP, competition-specific planning is expected primarily on
`cohort_variant` plans. The ownership nevertheless remains on
`GroupTrainingPlan` so the model can support a future whole-group competitive
context without changing the entity boundary.

A competition does not belong to `TrainingGoal`, `PlanningCohort` or
`Macrocycle`.

## CompetitionEntry contract

```text
CompetitionEntry
- id
- groupTrainingPlanId
- name
- date
- distanceKm
- elevationGainM?
- priority: A | B | C
- status: scheduled | cancelled
- description?
- createdAt / updatedAt metadata
```

### Required distance

`distanceKm` is mandatory, finite and strictly greater than zero.

A competition entry represents a concrete competitive modality, not merely the
knowledge that an event exists. Without the modality distance there is not
enough competitive information to build the plan that prepares its audience.

An event may therefore be known externally before its distance is decided, but
it does not become a planning `CompetitionEntry` until the relevant modality is
known.

Competitive distance is distinct from weekly training volume and from athlete
level. H8 category-distance compatibility remains advisory and will later read
this field as its live calendar input.

### Elevation gain

`elevationGainM` is optional because a plan may be started before official D+
is available. When present it is expressed in meters of positive elevation gain
and must be finite and greater than or equal to zero. Zero is valid for a flat
course.

The explicit `M` suffix keeps the unit visible at the entity boundary.

### Date

`date` is required and represents the actual competition calendar date in
`YYYY-MM-DD` format. It belongs to the competition rather than to the
macrocycle snapshot.

The date will later participate in deriving `CompetitionContext`; KAN-189 does
not yet define primary-competition selection or proximity behavior.

### Priority

The initial vocabulary is `A | B | C`.

Priority belongs to the individual calendar entry. A single plan may therefore
contain several competitions with different priorities. A planning cohort does
not map one-to-one to a race.

KAN-192 defines the sporting meaning, ordering and primary-competition rules.
KAN-189 only establishes the field and accepted vocabulary.

### Status

The minimum initial vocabulary is `scheduled | cancelled`.

Cancellation remains explicit so an event can stop participating in the active
calendar without deleting its historical identity. Detailed state transitions,
possible future statuses and edit semantics belong to KAN-193.

## Validation boundary

The domain validator established in KAN-189 checks only invariants required for
a structurally valid competition entry:

- non-empty `groupTrainingPlanId`;
- non-empty competition name;
- real `YYYY-MM-DD` calendar date;
- positive finite competitive distance;
- optional non-negative finite elevation gain;
- known A/B/C priority;
- known scheduled/cancelled status.

Validation returns locale-neutral error codes. User-facing text must be
translated by the presentation/server boundary according to the progressive
i18n policy.

## Independence from other domain concepts

`CompetitionEntry` deliberately does not contain:

- athlete ownership or athlete registration;
- `TrainingGoal` ownership;
- `PlanningCohort` ownership;
- `Macrocycle` ownership;
- automatic load or intensity changes;
- result or finish-time data;
- external race-catalog identity;
- organizer, detailed venue or external URL requirements.

Those concerns must not be inferred merely from the existence or modification
of a competition entry.

## Snapshot rule

`Macrocycle.targetRace*` remains transitional historical/operational data.
A live `CompetitionEntry` is not a mutable pointer into an accepted macrocycle.
Editing, rescheduling or cancelling the live calendar must not silently rewrite
persisted planning.

Snapshot evolution is handled later in H9.

## Not defined by KAN-189

This contract intentionally does not yet decide:

- whether base and variant plans may create competitions under every workflow;
- A/B/C sporting semantics and primary selection;
- status transition rules;
- persistence schemas or migrations;
- CRUD permissions and validation at action/UI boundaries;
- cohort-derivation copying behavior;
- `CompetitionContext` derivation;
- taper or other competitive-generation behavior.

Those responsibilities remain isolated in their corresponding H9 tasks.
