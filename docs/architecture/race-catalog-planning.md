# Race catalog → planning boundary

## Purpose

Define how one live catalog `RaceCourse` becomes plan-owned competitive context without making `CompetitionEntry` depend on mutable catalog state.

This boundary extends Epic 2 H9/H10; it does not replace `CompetitionEntry` or `CompetitionContext`.

## Selection pipeline

```text
RaceEvent (active)
  ↓
RaceEdition (published)
  ↓
RaceCourse (published + known distance)
  ↓ selectRaceCourseForCompetition
RaceCourseCompetitionSelection
  ├─ RaceCourseReference
  ├─ RaceCoursePlanningSnapshot
  └─ CompetitionEntryDraft
```

The event/edition/course ancestry is validated by IDs, never labels.

## New-selection requirements

A catalog course can be selected into planning only when:

- the `RaceEvent` is active and not deleted;
- the `RaceEdition` is published and not deleted;
- the `RaceCourse` is published and not deleted;
- `RaceEdition.raceEventId` matches the selected event;
- `RaceCourse.raceEditionId` matches the selected edition;
- course distance is known, because H9 `CompetitionEntry.distanceKm` remains mandatory.

Unknown D+ is allowed and remains `null`.

This policy applies to **new catalog selection**. It does not invalidate an existing historical `CompetitionEntry` merely because its source event/edition/course is later archived, completed, cancelled or removed from active selection.

## Snapshot semantics

Selection copies catalog values at the moment the plan accepts them:

```text
CompetitionEntryDraft
- groupTrainingPlanId
- name              // event + course display snapshot
- date              // course scheduled date, else edition start date
- distanceKm
- elevationGainM
- priority
- status
- description
```

Additional catalog context is copied into `RaceCoursePlanningSnapshot`:

```text
raceEventName
raceEditionLabel
raceCourseLabel
date
distanceKm
elevationGainM
modality
classifications[]
```

Nested modality/classification values are cloned. Updating the live `RaceCourse` later therefore cannot mutate an already-created in-memory selection/snapshot.

## Stable catalog reference

The selection also carries:

```text
RaceCourseReference
- raceEventId
- raceEditionId
- raceCourseId
```

This reference provides traceability back to the catalog. Persisting the reference belongs to KAN-276 because it requires schema/migration work.

The reference does **not** make live catalog data authoritative over the snapshot.

## Legacy CompetitionEntry

Existing Epic 2 entries have no catalog link. They remain valid first-class planning records.

The persistence model introduced later must therefore make catalog linkage optional/null. No migration may fabricate `RaceCourse` identity from competition name/date/distance similarity.

## Catalog changes after selection

If a catalog course is later corrected or cancelled:

- the existing `CompetitionEntry` snapshot stays unchanged;
- planning continues to consume the snapshot through `CompetitionContext`;
- UI may show that a linked catalog source changed or became unavailable;
- refreshing/replacing the planning snapshot must require an explicit coach action/review, not implicit synchronization.

This preserves Epic 2's accepted-snapshot principle.

## Compatibility with CompetitionContext

`CompetitionContext` continues to consume only plan-owned fields (`name`, `date`, `distanceKm`, D+, priority). It does not query the catalog.

Therefore H9/H10 planning remains deterministic if:

- catalog data changes;
- catalog data is temporarily unavailable;
- a catalog entity is archived;
- a legacy `CompetitionEntry` has no catalog reference.

## Persistence boundary

KAN-273 intentionally introduces no database column. KAN-276 will decide how the optional `RaceCourse` reference and any additional snapshot metadata are stored after the catalog tables themselves exist.

The persistence design must maintain:

1. optional linkage for legacy/manual entries;
2. historical snapshot independence;
3. no cascade that deletes `CompetitionEntry` when a catalog entity is removed/archived;
4. reproducible planning without a live catalog join.
