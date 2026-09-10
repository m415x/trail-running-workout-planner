# Competition calendar

## Purpose

Define the durable domain contract for competitions that can condition a
`GroupTrainingPlan` without turning a race into the objective of the whole
sporting group.

The competition calendar is introduced progressively during H9. This document
captures the entity, ownership, cohort-derivation, priority and lifecycle
boundaries established by KAN-189 through KAN-193; persistence and CRUD are
implemented in later tasks.

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
`PlanningCohort` and its detached plan variant.

For a cohort variant, the owning plan audience is the cohort itself. A
competition may be attached to that variant when it applies to the whole cohort
audience.

This yields one uniform invariant for both kinds of plan:

> A `CompetitionEntry` may only condition the full audience of its owning
> `GroupTrainingPlan`.

### Why ownership stays on GroupTrainingPlan

`CompetitionEntry.groupTrainingPlanId` remains the technical ownership boundary
for both base plans and cohort variants. The entity does not gain a separate
`planningCohortId`.

That keeps the calendar aligned with the exact planning snapshot it may later
condition and supports both legitimate cases without schema redesign.

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
- status: planned | confirmed | completed | cancelled
- description?
- createdAt / updatedAt metadata
```

### Required distance

`distanceKm` is mandatory, finite and strictly greater than zero. A competition
entry represents a concrete competitive modality, not merely knowledge that an
event exists. Without the modality distance there is not enough competitive
information to build the plan that prepares its audience.

### Elevation gain

`elevationGainM` is optional because a plan may be started before official D+
is available. When present it is expressed in meters of positive elevation gain
and must be finite and greater than or equal to zero.

### Date

`date` is required and represents the actual competition calendar date in
`YYYY-MM-DD` format. It belongs to the competition rather than to the
macrocycle snapshot.

## Competitive priority

Priority describes the **planning role** of an event, not a generic importance
score and not an automatic load prescription.

- **A — primary objective candidate.** The event may become the
  `primaryCompetition` for a macrocycle and is the only priority allowed to
  occupy that role.
- **B — preparatory competition.** A relevant intermediate event that forms part
  of competitive context but does not replace A as the macrocycle objective.
- **C — secondary/control competition.** A lower-priority event that may be used
  as competitive exposure, control or secondary participation without redefining
  the primary macrocycle objective.

KAN-192 deliberately does not derive different load, intensity or taper rules
from B or C. Priority is semantic context first; later planning tasks may decide
how that context influences generation.

### Priority and primary competition are different concepts

`CompetitionEntry.priority === 'A'` means that the entry is a **candidate** to be
primary. `primaryCompetition` is the contextual result of resolving the active
calendar for one macrocycle.

Consequently, a long-lived plan may contain more than one A competition when
they belong to different macrocycle horizons. The calendar must not enforce a
global `count(A) <= 1` invariant.

Instead, after callers have scoped the calendar to one macrocycle horizon and to
entries that participate in the active calendar, priority resolution requires:

```text
A candidates in this macrocycle context <= 1
```

Exactly one A resolves to the primary candidate. Zero A entries is valid and
resolves to no primary candidate. More than one A is a conflict and returns the
locale-neutral code:

`competition_priority_multiple_primary_candidates`

B and C entries never become the primary candidate through the priority policy.

## Competition lifecycle

The MVP lifecycle distinguishes four states:

- `planned`: the competition is part of the intended calendar but participation
  is not yet confirmed;
- `confirmed`: the planning audience is confirmed to participate;
- `completed`: the competition remains as historical context after participation;
- `cancelled`: the entry remains historically visible but no longer participates
  in active planning.

The allowed transitions are deliberately conservative:

```text
planned -> confirmed
planned -> cancelled
confirmed -> completed
confirmed -> cancelled
```

`completed` and `cancelled` are terminal in the MVP. The domain does not silently
reopen historical entries. If future workflows require restoration or a richer
audit trail, that must be introduced explicitly rather than inferred.

A direct `planned -> completed` transition is not valid. Confirmation is part of
the lifecycle semantics even if a future UI chooses to make the two user actions
feel contiguous.

### Active planning context

Lifecycle and priority remain separate concerns. KAN-193 defines which statuses
participate in forward-looking planning:

```text
planned   -> active
confirmed -> active
completed -> historical / inactive
cancelled -> historical / inactive
```

This means a cancelled or completed A entry cannot remain a primary candidate for
future planning once callers compose lifecycle filtering with the KAN-192
priority resolver.

The domain must not infer `completed` only because `date < today`. Completion is
an explicit state transition because a past event may have been cancelled, not
started, or otherwise not completed by the planning audience.

### Rescheduling is not a lifecycle state

Reprogramming changes `CompetitionEntry.date` without necessarily changing its
status. The lifecycle therefore does not introduce `postponed` in the MVP.

For example, a confirmed competition may remain `confirmed` after its date moves.
The application layer may later expose an explicit reschedule operation, but the
domain keeps date changes and participation lifecycle as separate dimensions.

### Planning immutability on lifecycle changes

Confirming, completing, cancelling or rescheduling a live competition entry does
not automatically regenerate or rewrite persisted macrocycles, strategies,
intensity targets or sessions.

A persisted plan may later be identified as having been generated from stale
competitive context, but regeneration remains an explicit operation. This
preserves the snapshot semantics already established for H7 and the transitional
`Macrocycle.targetRace*` fields.

### Product-help requirement

A/B/C priorities and the competition lifecycle states are user-visible domain
concepts that require interpretation. When they reach UI, the reusable domain
glossary/help layer must provide coach/athlete content in both `es` and `en`,
following the product-help and progressive-i18n policies.

## Validation boundaries

The structural domain validator established in KAN-189 checks only invariants
required for a structurally valid competition entry: owner ID, name, real date,
positive distance, optional non-negative D+, known priority and known status.

KAN-190 adds a separate ownership policy. KAN-192 adds a separate priority
policy. KAN-193 adds a separate lifecycle policy for valid status transitions
and active-planning participation.

Keeping these policies independent allows later application boundaries to
compose structural, ownership, lifecycle and contextual validation without
coupling pure domain rules to persistence.

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

For each explicitly selected source entry, derivation verifies source ownership,
creates a new identity, rewrites `groupTrainingPlanId`, copies the sporting
values as a snapshot and records source-to-derived identity mapping.

After derivation there is no live synchronization in either direction. A
competition that concerns only the cohort and cannot legitimately belong to the
base plan is added to the variant after the variant exists through the later
competition CRUD workflow.

## Independence from other domain concepts

`CompetitionEntry` deliberately does not contain athlete registration,
`TrainingGoal` ownership, `PlanningCohort` ownership, `Macrocycle` ownership,
automatic load changes, result data or an external race-catalog identity.

## Snapshot rule

`Macrocycle.targetRace*` remains transitional historical/operational data. A
live `CompetitionEntry` is not a mutable pointer into an accepted macrocycle.
Editing, rescheduling, completing or cancelling the live calendar must not
silently rewrite persisted planning.

## Not defined by KAN-193

This contract intentionally does not yet decide:

- persistence schemas or migrations;
- CRUD permissions and application/UI validation;
- automatic macrocycle-horizon filtering;
- `CompetitionContext` derivation;
- taper or other competitive-generation behavior;
- restoration of terminal lifecycle states.

Those responsibilities remain isolated in their corresponding H9 tasks.
