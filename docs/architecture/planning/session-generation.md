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
