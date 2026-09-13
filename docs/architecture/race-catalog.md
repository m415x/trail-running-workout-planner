# Race catalog

## Purpose

Define the domain identities for a reusable competitive catalog without duplicating one event per distance and without replacing the planning-specific `CompetitionEntry` model introduced in Epic 2.

KAN-265 establishes only identity, hierarchy, lifecycle and reference boundaries. Sporting metadata such as distance, D+, modality, derived demand and official classifications is added by later KAN-257 tasks.

## Aggregate hierarchy

```text
RaceEvent
  1
  |
  `-- * RaceEdition
          1
          |
          `-- * RaceCourse
```

Example:

```text
Patagonia Run                     RaceEvent
└── Patagonia Run 2027            RaceEdition
    ├── 12K                       RaceCourse
    ├── 21K                       RaceCourse
    ├── 42K                       RaceCourse
    └── 100K                      RaceCourse
```

The catalog must not persist `Patagonia Run 21K` and `Patagonia Run 42K` as unrelated event identities.

## RaceEvent

`RaceEvent` is the stable identity of the event across editions.

Minimal KAN-265 contract:

```text
RaceEvent
- id
- name
- status: active | archived
- entity metadata
```

`name` is user-facing metadata and is not technical identity. Renaming an event must not create a new `RaceEvent` or break references.

Archiving removes an event from normal active catalog selection without erasing historical editions/courses or references.

## RaceEdition

`RaceEdition` is one temporal occurrence of a `RaceEvent`.

```text
RaceEdition
- id
- raceEventId
- label
- status: draft | published | completed | cancelled
- entity metadata
```

An edition label such as `2027` is presentation metadata, not a globally unique identity. The model must tolerate multiple editions whose labels are not sufficient to distinguish them by themselves.

Editing an edition later does not mutate the identity of courses that were already selected elsewhere.

Lifecycle semantics:

- `draft`: incomplete/not selectable as a public catalog edition;
- `published`: available for catalog selection;
- `completed`: historical edition retained for history/reference;
- `cancelled`: edition retained historically but not an active competition target.

This task defines the states, not the complete transition policy. Transition validation belongs to the application/domain policy work that follows persistence/CRUD design.

## RaceCourse

`RaceCourse` is one concrete competitive course offered by a `RaceEdition`.

```text
RaceCourse
- id
- raceEditionId
- label
- status: draft | published | cancelled
- entity metadata
```

It is the **selectable competitive identity** for planning and the future individual registration boundary.

A course label such as `21K` is not identity and does not imply a unique sporting profile. One edition may legitimately expose two courses with similar/identical nominal distance and different profiles.

Lifecycle semantics:

- `draft`: incomplete/not selectable;
- `published`: selectable;
- `cancelled`: historically retained but not active for new selection.

A completed result belongs to participation/registration history rather than to the catalog course lifecycle itself; therefore KAN-265 does not add a `completed` course state.

## Identity rules

All three catalog entities use opaque immutable technical IDs (`BaseEntity.id`).

The following values must **not** be used as stable identity:

- event name;
- edition label/year;
- course label;
- nominal distance;
- URL slug.

These values may change or collide while the underlying entity remains the same.

Parent-child ancestry is explicit:

```text
RaceEdition.raceEventId
RaceCourse.raceEditionId
```

Application boundaries that carry a course selection may use `RaceCourseReference` with all three IDs as scope evidence:

```text
raceEventId
raceEditionId
raceCourseId
```

The redundant parent IDs are not alternate ownership; they allow callers to reject mismatched event/edition/course combinations without inferring ancestry from labels.

## Reference boundary with Epic 2

The catalog does not replace `CompetitionEntry`.

```text
RaceEvent
  └── RaceEdition
       └── RaceCourse
              |
              | selected by planning
              v
       CompetitionEntry
```

`RaceCourse` is the catalog source identity. `CompetitionEntry` remains the plan-owned competitive context with priority/lifecycle and a historical sporting snapshot.

KAN-265 defines only that planning may reference `RaceCourse`. KAN-273 will decide the exact `CompetitionEntry` reference/snapshot contract.

The important invariant is already fixed:

> Updating catalog data later must never silently rewrite an accepted planning snapshot.

`RaceEvent` and `RaceEdition` are browse/context identities and are not the concrete unit selected into planning.

## Future athlete registration boundary

Future athlete registration should also target the concrete course:

```text
Athlete
  |
  `-- RaceRegistration --> RaceCourse
```

KAN-265 intentionally does not create `RaceRegistration`. It establishes that neither `RaceEvent` nor `RaceEdition` alone is precise enough to represent what the athlete will run.

## Cardinality and deletion semantics

- One `RaceEvent` has zero or more editions.
- One `RaceEdition` belongs to exactly one event and has zero or more courses.
- One `RaceCourse` belongs to exactly one edition.
- Re-parenting an existing edition/course is not normal editing; identity ancestry is part of its domain meaning.
- Historical referenced entities should be archived/cancelled rather than physically deleted.
- Persistence-level cascade/restrict behavior is deliberately deferred until KAN-276 because it must account for snapshots and references already stored by other domains.

## Independence from sporting profile metadata

KAN-265 deliberately does not decide:

- which location/organizer/date fields belong to event versus edition;
- distance and elevation fields;
- modality;
- elevation density;
- kilometer-effort;
- official classification systems;
- structural/profile validation thresholds.

Those concerns belong to KAN-266 through KAN-272. Keeping them out of the first identity contract prevents accidental coupling of identity to mutable sporting metadata.

## Core invariants established by KAN-265

1. An event is not duplicated for each offered distance/course.
2. An edition is a temporal child of one event.
3. A course is the concrete selectable child of one edition.
4. Names, years, labels and nominal distances are not technical identity.
5. Planning/future athlete registration reference `RaceCourse`, not the event globally.
6. Catalog edits never imply silent mutation of planning snapshots.
7. Historical catalog entities remain addressable after archive/cancellation.
8. Persistence details are deferred until the domain identity contract is stable.
