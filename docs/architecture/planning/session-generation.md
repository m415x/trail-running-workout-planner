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
- Compatible groups may share one `Session` while retaining independent
  prescriptions.
- `generationKey` identifies a group prescription across regenerations.
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
- Shared events are removed only when no active group prescription remains.
- Generated creation, update, removal, and manual edits are recorded in
  `session_generation_modification_records` with before/after snapshots.
- Re-saving an unchanged proposal does not create an audit entry.
