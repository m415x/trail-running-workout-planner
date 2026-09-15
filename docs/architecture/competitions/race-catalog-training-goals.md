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

## Catalog reference and persistence

The selection also returns:

```text
RaceCourseReference
- raceEventId
- raceEditionId
- raceCourseId
```

Persistence stores the optional link in:

```text
training_goal_race_courses
- training_goal_id PK/FK
- race_course_id FK
```

Only `race_course_id` is persisted. Event/edition ancestry is resolved from the catalog hierarchy. Deleting a `TrainingGoal` cascades only its sidecar link; the catalog reference uses `ON DELETE RESTRICT` so a referenced course cannot be physically removed accidentally.

Legacy/manual race goals without a catalog reference remain valid. No migration infers a catalog course from race name/date/distance similarity.

## Goal is not registration

Selecting a `RaceCourse` as an athlete goal means only:

> this is the competitive context the athlete wants to prepare for.

It does **not** mean:

- the athlete is registered/entered;
- a bib/entry exists;
- payment/qualification was completed;
- participation is confirmed;
- a `RaceRegistration` record should be created.

The future registration boundary is modeled separately in `race-registration-boundary.md`.

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

## Interpretation limits

A race goal is not evidence that the athlete can safely complete the event. The catalog profile contributes competitive context only.

- H8 category-distance compatibility remains advisory and separate.
- H12 readiness requires realized athlete training evidence and can still return `insufficient_data`.
- Absence of a catalog reference does not invalidate a manually entered goal.
- A catalog classification or kilometer-effort value does not authorize competition or diagnose fitness.

## Invariants

1. Goal snapshots remain athlete-owned historical facts.
2. Catalog linkage is optional and traceability-only.
3. Later catalog edits do not silently rewrite accepted goal data.
4. A `TrainingGoal` never implies `RaceRegistration`.
5. Unknown D+ remains `null`, not zero.
6. Catalog selection never mutates group/cohort/planning membership automatically.

## Product selection (KAN-280)

The new-goal form supports either manual race data or an explicit catalog course.
When a course is selected, the server resolves its ancestry and calls
`selectRaceCourseForTrainingGoal`; client-supplied race measurements are not the
authority for that selection. The goal and optional sidecar are written
atomically after the existing team/athlete access check. Unknown D+ and fractional
measurements are preserved. Catalog revision changes require a fresh selection.

The plan detail page also exposes an explicit add-from-catalog form. It calls
`selectRaceCourseForCompetition` and the existing competition calendar service,
including its audience, date and priority rules, then persists the sidecar in the
same transaction. It creates a planned CompetitionEntry; it does not refresh
an existing historical plan target or create a registration.
