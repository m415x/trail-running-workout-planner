# Competition calendar

## Purpose

Define the durable domain contract for competitions that can condition a
`GroupTrainingPlan` without turning a race into the objective of the whole
sporting group.

The competition calendar is introduced progressively during H9. This document
captures the entity, ownership and cohort-derivation boundaries established by
KAN-189 through KAN-191; persistence, CRUD, priority behavior and lifecycle
transitions are implemented in later tasks.

## Ownership

A `CompetitionEntry` belongs technically to one `GroupTrainingPlan`.

```text
GroupTrainingPlan
    1
    |
    `-- * CompetitionEntry
```

A competition does not belong to `TrainingGoal`, `PlanningCohort` or
`Macrocycle`.

### Audience-complete ownership rule

A competition attached to a plan must apply to the entire planning audience
represented by that plan.

For a base plan:

```text
GroupTrainingPlan(kind = group_base)
    audience = whole AthleteGroup
```

Therefore a base plan may own a `CompetitionEntry` only when the competition
really applies to the whole sporting group represented by that plan. This is a
legitimate but exceptional MVP case; base plans remain competition-neutral by
default.

If only some athletes from the sporting group participate, the competition must
not be attached to the base plan. That subset is represented through a
`PlanningCohort` and its detached plan variant:

```text
AthleteGroup
    |
    |-- GroupTrainingPlan base
    |      competition-neutral for the shared progression
    |
    `-- PlanningCohort
           |
           `-- GroupTrainingPlan variant
                  |
                  `-- CompetitionEntry *
```

For a cohort variant, the owning plan audience is the cohort itself. A
competition may be attached to that variant when it applies to the whole cohort
audience.

This yields one uniform invariant for both kinds of plan:

> A `CompetitionEntry` may only condition the full audience of its owning
> `GroupTrainingPlan`.

The rule prevents partial competition context from leaking into a broader plan
and avoids reintroducing the original race-as-group-objective coupling.

### Why ownership stays on GroupTrainingPlan

`CompetitionEntry.groupTrainingPlanId` remains the technical ownership boundary
for both base plans and cohort variants. The entity does not gain a separate
`planningCohortId`.

That keeps the calendar aligned with the exact planning snapshot it may later
condition and supports both legitimate cases without schema redesign:

- normal case: a cohort variant owns the competitions specific to that planning
  audience;
- exceptional case: a base plan owns a competition that genuinely concerns its
  entire AthleteGroup audience.

Moving an athlete into or out of a cohort is governed by H7 membership rules and
does not silently move or rewrite competition entries.

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

The date will later participate in deriving `CompetitionContext`; KAN-189 through
KAN-191 do not yet define primary-competition selection or proximity behavior.

### Priority

The initial vocabulary is `A | B | C`.

Priority belongs to the individual calendar entry. A single plan may therefore
contain several competitions with different priorities. A planning cohort does
not map one-to-one to a race.

KAN-192 defines the sporting meaning, ordering and primary-competition rules.
The current contract only establishes the field and accepted vocabulary.

### Status

The minimum initial vocabulary is `scheduled | cancelled`.

Cancellation remains explicit so an event can stop participating in the active
calendar without deleting its historical identity. Detailed state transitions,
possible future statuses and edit semantics belong to KAN-193.

## Validation boundaries

The structural domain validator established in KAN-189 checks only invariants
required for a structurally valid competition entry:

- non-empty `groupTrainingPlanId`;
- non-empty competition name;
- real `YYYY-MM-DD` calendar date;
- positive finite competitive distance;
- optional non-negative finite elevation gain;
- known A/B/C priority;
- known scheduled/cancelled status.

KAN-190 adds a separate ownership policy. It receives the plan kind plus whether
the competition covers the full audience represented by that plan. It accepts
both `group_base` and `cohort_variant` owners only when
`coversEntirePlanAudience` is true.

Keeping structural validation and ownership validation separate allows later
CRUD/application boundaries to resolve the actual plan and audience before
persisting a competition without coupling the pure entity validator to Drizzle.

Validation returns locale-neutral error codes. User-facing text must be
translated by the presentation/server boundary according to the progressive
i18n policy.

## Cohort-variant calendar derivation

H7 established that a cohort variant is an independent planning snapshot rather
than a live view of its source base plan. KAN-191 extends exactly that rule to
competition entries.

Source competitions are **not inherited automatically**. The derivation input
must explicitly provide the IDs of the source entries that belong to the new
cohort's planning context. Omitting the selection produces a variant with an
empty inherited competition calendar even when the base plan contains events.

For each explicitly selected source entry, derivation:

1. verifies that the entry is present in the source snapshot;
2. verifies that its owner is the source `GroupTrainingPlan`;
3. creates a new competition identity;
4. rewrites `groupTrainingPlanId` to the new variant plan;
5. copies the competition values as a snapshot; and
6. records source-to-derived identity mapping for later persistence.

Duplicate source selections are invalid. An unknown source ID or an entry owned
by another plan is also invalid. These checks prevent unrelated competition
context from being copied merely because it was supplied to the derivation
boundary.

The copied entry preserves its date, modality distance, optional elevation gain,
priority, status and description at derivation time. It does not preserve the
source entity's persistence metadata such as `createdAt`/`updatedAt`, because the
variant entry is a new persisted identity.

After derivation there is no live synchronization:

```text
source CompetitionEntry
        |
        | explicit snapshot copy
        v
variant CompetitionEntry

later source edit ----X----> variant
later variant edit ---X----> source
```

This is consistent with the rest of the H7 planning aggregate. Editing,
rescheduling or cancelling a source event later must not silently rewrite the
variant's accepted calendar or planning.

A competition that concerns only the cohort and therefore cannot legitimately
belong to the base plan is added to the variant after the variant exists through
the later competition CRUD workflow. KAN-191 does not weaken the KAN-190
full-audience ownership invariant merely to make derivation convenient.

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

## Not defined by KAN-191

This contract intentionally does not yet decide:

- A/B/C sporting semantics and primary selection;
- status transition rules;
- persistence schemas or migrations;
- CRUD permissions and validation at action/UI boundaries;
- `CompetitionContext` derivation;
- taper or other competitive-generation behavior.

Those responsibilities remain isolated in their corresponding H9 tasks.
