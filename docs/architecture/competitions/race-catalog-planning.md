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

## Stable catalog reference and persistence

The selection carries:

```text
RaceCourseReference
- raceEventId
- raceEditionId
- raceCourseId
```

Persistence stores the optional catalog link in:

```text
competition_entry_race_courses
- competition_entry_id PK/FK
- race_course_id FK
```

Only `race_course_id` is persisted. Event/edition ancestry is resolved through `RaceCourse → RaceEdition → RaceEvent`; duplicating all three IDs in the sidecar would create a second ancestry invariant.

The FK from the sidecar to `RaceCourse` uses `ON DELETE RESTRICT`, while deleting a `CompetitionEntry` cascades only its sidecar row. Catalog soft-delete/archive is therefore the normal lifecycle mechanism and never deletes planning history.

The reference provides traceability back to the catalog. It does **not** make live catalog data authoritative over the snapshot.

## Legacy CompetitionEntry

Existing Epic 2 entries have no catalog link. They remain valid first-class planning records.

Catalog linkage is optional. No migration fabricates `RaceCourse` identity from competition name/date/distance similarity.

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

## Interpretation limits

A selected catalog course describes competitive context; it does not prove that an athlete is prepared or registered.

- Category-distance compatibility remains H8 advisory context.
- Taper/recovery treatment remains H10 planning policy.
- Individual preparation/readiness remains H12 and depends on realized athlete evidence.
- `RaceCourseReference` does not imply athlete registration, payment, qualification, participation or result.
- Catalog distance, D+, modality, density, kilometer-effort and external classifications are descriptive inputs; none is a medical or readiness certification.

## Invariants

1. Catalog selection requires valid live ancestry and enough data for a new `CompetitionEntry`.
2. `CompetitionEntry` owns the accepted planning snapshot.
3. Catalog linkage is optional and traceability-only.
4. Later catalog edits do not silently rewrite planning history.
5. Legacy/manual entries remain valid without a catalog reference.
6. Planning remains reproducible without a live catalog join.
7. Selecting a course never creates an athlete registration or readiness result.


## KAN-504 planning-impact projection

KAN-504 adds a read-only inverse projection from one `RaceCourse` to the
planning snapshots that explicitly reference it:

```text
RaceCourse
  ← competition_entry_race_courses
  ← CompetitionEntry
  → GroupTrainingPlan
  → AthleteGroup
  → optional PlanningCohort
```

The projection is based only on the persisted sidecar relation. It never groups
or infers entries by matching race name, date, distance or D+. Manual and legacy
`CompetitionEntry` rows without a sidecar remain valid and simply do not appear
in this projection.

The query is isolated by team and excludes deleted planning records. The UI
shows each linked plan independently, including Base-plan/Variant kind, Sporting
group, optional Planning subgroup, competition priority/status and operational
links back to planning. It is strictly read-only: the competitive catalog does
not create, derive, activate or mutate planning.

A single `RaceCourse` may therefore appear in independent variants belonging
to different Sporting groups. Sharing the race identity never creates a
cross-group Planning subgroup. If a projected variant/subgroup relationship is
cross-group, the projection rejects it rather than presenting a silently
inconsistent audience.

This inverse view does not change the authority model defined above:
`CompetitionEntry` remains the plan-owned snapshot and the catalog sidecar
remains optional traceability.
