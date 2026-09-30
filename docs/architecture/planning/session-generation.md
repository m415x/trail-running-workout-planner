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
