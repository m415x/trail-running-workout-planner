# Race catalog → TrainingGoal boundary

## Purpose

Allow an athlete-owned race `TrainingGoal` to select a concrete catalog `RaceCourse` without turning the goal into a race registration and without making historical goal data depend on mutable catalog state.

## Existing TrainingGoal snapshot

The current `training_goals` model already owns race-goal snapshot fields:

```text
targetDate
raceName
raceDistanceKm
raceElevationGain
```

KAN-274 preserves this ownership. Selecting a catalog course fills these fields; it does not replace them with live joins.

## Selection pipeline

```text
RaceEvent (active)
  ↓
RaceEdition (published)
  ↓
RaceCourse (published + known distance)
  ↓ selectRaceCourseForTrainingGoal
RaceCourseTrainingGoalSelection
  ├─ RaceCourseReference
  └─ RaceCourseTrainingGoalPatch
```

The shared `validateRaceCourseSelection` policy is used by both planning (`CompetitionEntry`) and athlete goals so new selections cannot drift on ancestry/availability requirements.

## Snapshot mapping

The selected course produces:

```text
RaceCourseTrainingGoalPatch
- targetDate
- raceName
- raceDistanceKm
- raceElevationGain
```

Mapping:

- `targetDate`: concrete course scheduled date when known, otherwise edition start date;
- `raceName`: event name + concrete course label;
- `raceDistanceKm`: course distance;
- `raceElevationGain`: course D+ and may remain `null`.

Known distance is required because the current race-goal workflow requires a positive race distance. Unknown D+ remains unknown rather than becoming zero.

## Catalog reference

The selection also returns:

```text
RaceCourseReference
- raceEventId
- raceEditionId
- raceCourseId
```

Persisting this optional reference is deferred to KAN-276 together with the catalog schema/migration.

Legacy/manual race goals without a catalog reference remain valid. No migration may infer a catalog course from race name/date/distance similarity.

## Goal is not registration

Selecting a `RaceCourse` as an athlete goal means only:

> this is the competitive context the athlete wants to prepare for.

It does **not** mean:

- the athlete is registered/entered;
- a bib/entry exists;
- payment/qualification was completed;
- participation is confirmed;
- a `RaceRegistration` record should be created.

KAN-275 defines the future registration reference boundary separately.

## Independence rules

- Editing/deleting/archiving a `TrainingGoal` never edits `RaceEvent`, `RaceEdition` or `RaceCourse`.
- Editing catalog data after selection never silently rewrites the goal snapshot.
- Archiving/cancelling a source catalog entity prevents new selection where appropriate but does not invalidate a historical goal snapshot.
- Goal lifecycle remains athlete-owned and independent from catalog lifecycle.
- Catalog selection does not change athlete group/cohort membership or planning automatically.

## Relationship to CompetitionEntry

A `TrainingGoal` and `CompetitionEntry` may point to the same `RaceCourse`, but they answer different questions:

```text
TrainingGoal
  What is this athlete preparing for?

CompetitionEntry
  What competition context is this group/cohort plan treating and with what A/B/C priority?

Future RaceRegistration
  What concrete course is this athlete actually entered in?
```

No one of these facts should be inferred automatically from another.

## Persistence boundary

KAN-274 introduces no database column. KAN-276 must preserve:

1. optional `raceCourseId` linkage for goals selected from catalog;
2. existing snapshot fields as historical truth;
3. legacy/manual goals with `raceCourseId = null`;
4. no cascade from catalog deletion/archive into goal deletion;
5. no automatic `RaceRegistration` side effect.
