# Future RaceRegistration boundary

## Purpose

Reserve the minimum stable contract required by a future individual race-registration story without implementing registration lifecycle, persistence or side effects in KAN-257.

## Minimum target

A future registration must bind exactly two things:

```text
athlete scope
  teamId
  athleteProfileId

concrete competitive identity
  RaceCourseReference
    raceEventId
    raceEditionId
    raceCourseId
```

The type-level extension point is:

```text
FutureRaceRegistrationTarget
- scope: FutureRaceRegistrationScope
- course: RaceCourseReference
```

`RaceCourse` is the minimum precise competitive identity. `RaceEvent` alone is insufficient because one event has multiple editions/courses; `RaceEdition` alone is insufficient because one edition has multiple concrete routes/distances.

## Explicit team/athlete scope

`teamId` and `athleteProfileId` are both carried at the future boundary.

This follows the isolation rules established in Epic 2: individual persistence must not rely only on UI filtering or infer tenancy indirectly after the fact. A future repository/action must verify that the athlete belongs to the supplied team before writing an entry.

KAN-257 does not create that repository or table.

## Independent facts

These concepts must remain independent:

```text
TrainingGoal
  athlete intends/prepares for RaceCourse

CompetitionEntry
  group/cohort plan treats RaceCourse with A/B/C priority

RaceRegistration
  athlete actually has an individual entry/registration for RaceCourse
```

Therefore:

- selecting a catalog course in `TrainingGoal` does not create a registration;
- selecting a catalog course in `CompetitionEntry` does not create a registration;
- a future registration must be created/confirmed explicitly by its own workflow;
- deleting/archiving a goal or planning entry must not silently delete a registration;
- deleting/cancelling a registration must not silently rewrite the athlete goal or group plan.

## Deliberately not designed yet

KAN-275 does not decide:

- registration lifecycle/status names;
- source (manual, organizer, import, integration);
- payment state;
- bib/start number;
- qualification/lottery/waitlist;
- registration timestamps/deadlines;
- result/DNF/DNS semantics;
- external provider IDs;
- snapshot fields to persist alongside the course reference;
- duplicate-entry policy;
- cancellation/refund behavior.

Those belong to the future individual-registration story and must be based on its actual product requirements/integration sources.

## Historical/catalog changes

The future model will need to distinguish live catalog identity from historical registration facts. Archiving an event/edition/course cannot erase an already-recorded registration. Conversely, a registration should not make a cancelled course selectable for new goals/planning.

The exact FK/on-delete strategy is deferred to persistence design, but physical catalog deletion must not destroy historical individual evidence.

## Invariants reserved now

1. Registration targets `RaceCourse`, never only event/edition.
2. Individual scope includes team + athlete explicitly.
3. Goal, planning context and registration are independent facts.
4. No automatic registration side effect from KAN-257 selection workflows.
5. Future lifecycle/integration fields remain intentionally undesigned until their story exists.
