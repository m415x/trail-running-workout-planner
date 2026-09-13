# Race catalog

## Purpose

Define the domain contract for a reusable competitive catalog without duplicating one event per distance and without replacing the planning-specific `CompetitionEntry` model introduced in Epic 2.

The hierarchy is:

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

## Identity and lifecycle

All three catalog entities use opaque immutable technical IDs (`BaseEntity.id`). Names, labels/years, nominal distance and URL slugs are not stable identity.

### RaceEvent

`RaceEvent` is the stable identity/brand across editions.

```text
RaceEvent
- id
- name
- websiteUrl?
- description?
- status: active | archived
```

Archiving removes the event from normal active selection without erasing historical editions/courses or references.

### RaceEdition

`RaceEdition` is one temporal occurrence of an event.

```text
RaceEdition
- id
- raceEventId
- label
- startDate
- endDate?
- organizerName?
- location?
- websiteUrl?
- notes?
- status: draft | published | completed | cancelled
```

Edition lifecycle:

- `draft`: incomplete/not selectable;
- `published`: available for catalog selection;
- `completed`: historical edition retained for reference;
- `cancelled`: historically retained but not an active target.

### RaceCourse

`RaceCourse` is one concrete competitive course offered by an edition and is the selectable competitive identity for planning/future athlete registration.

```text
RaceCourse
- id
- raceEditionId
- label
- scheduledStartAt?
- startLocationLabel?
- notes?
- status: draft | published | cancelled
```

Course lifecycle intentionally has no `completed`: completion belongs to participation/result history, not to the reusable catalog course.

## Metadata ownership matrix

The ownership rule is based on the **smallest domain level at which a value can legitimately vary**.

| Data | Owner | Rationale |
| --- | --- | --- |
| Stable public event name | `RaceEvent` | Brand/identity survives editions. |
| Stable event homepage | `RaceEvent` | Canonical event-level link; edition may override with its own page. |
| Stable catalog description | `RaceEvent` | Describes the event generally, not one year/course. |
| Edition label/year | `RaceEdition` | Temporal presentation, not event identity. |
| Edition start/end dates | `RaceEdition` | Can change every edition. |
| Organizer | `RaceEdition` | Organizer/responsible entity may change over time. |
| Host locality/region/country | `RaceEdition` | Venue can change between editions and must not rewrite event history. |
| Edition-specific website/info/registration URL | `RaceEdition` | A yearly edition may have a dedicated page. |
| Edition-wide notes | `RaceEdition` | Applies to all courses of that edition. |
| Course/prueba label | `RaceCourse` | Distinguishes concrete offerings within an edition. |
| Course scheduled start date/time | `RaceCourse` | Different distances may race on different days/times. |
| Course-specific start location | `RaceCourse` | Courses in one edition may start from different places. |
| Course notes/instructions | `RaceCourse` | Applies only to that route/prueba. |
| Distance and D+ | `RaceCourse` | Sporting profile differs per course; introduced by KAN-267. |
| Modality | `RaceCourse` | One edition may contain different modalities; introduced by KAN-268. |
| Derived density/km-effort | `RaceCourse` derivation | Derived from course originals; introduced by KAN-269. |
| Classification | `RaceCourse` assessment/reference | Classification applies to a concrete profile and is versioned; KAN-270/271. |

### Why organizer/location live on RaceEdition

Treating organizer or location as stable `RaceEvent` data would make historical editions appear to have changed when the event moves venue or organization changes. They therefore belong to the edition snapshot.

`RaceEvent.websiteUrl` is allowed only for a canonical stable homepage. `RaceEdition.websiteUrl` carries an edition-specific page when one exists.

### Why scheduling can exist at both edition and course level

An edition owns its overall date range (`startDate`/`endDate`). A concrete course may additionally own `scheduledStartAt` because multi-distance events often schedule different distances on different days or times.

The course schedule must fall within the edition range once validation is implemented; KAN-266 establishes ownership, not that policy implementation.

## Location representation

Edition host location is a structured value:

```text
RaceEditionLocation
- locality?
- region?
- countryCode?  // ISO 3166-1 alpha-2 when known
```

Unknown components stay absent/null; they are never synthesized. A course may additionally have `startLocationLabel` when its start differs from the edition-wide host location. Precise geospatial coordinates are not introduced by this task.

## Identity/reference rules

Parent-child ancestry is explicit:

```text
RaceEdition.raceEventId
RaceCourse.raceEditionId
```

Application boundaries that carry a course selection may use:

```text
RaceCourseReference
- raceEventId
- raceEditionId
- raceCourseId
```

The parent IDs are scope evidence, not alternate ownership. They allow callers to reject mismatched event/edition/course combinations without inferring ancestry from labels.

Re-parenting an existing edition/course is not ordinary editing because ancestry is part of domain identity.

## Reference boundary with Epic 2

The catalog does not replace `CompetitionEntry`:

```text
RaceEvent
  └── RaceEdition
       └── RaceCourse
              |
              | selected by planning
              v
       CompetitionEntry
```

`RaceCourse` is the catalog source identity. `CompetitionEntry` remains plan-owned competitive context with A/B/C priority, planning lifecycle and a historical snapshot.

The exact reference/snapshot fields are deferred to KAN-273, but this invariant is fixed:

> Updating event/edition/course metadata later must never silently rewrite an accepted planning snapshot.

## Future athlete registration boundary

Future registration targets the concrete course:

```text
Athlete
  |
  `-- RaceRegistration --> RaceCourse
```

Neither `RaceEvent` nor `RaceEdition` alone says which route/distance the athlete will run. KAN-275 prepares this boundary without implementing registration.

## Cardinality and deletion semantics

- One `RaceEvent` has zero or more editions.
- One `RaceEdition` belongs to exactly one event and has zero or more courses.
- One `RaceCourse` belongs to exactly one edition.
- Historical referenced entities should be archived/cancelled rather than physically deleted.
- Persistence-level FK/cascade/restrict behavior is deferred to KAN-276.

## Deliberately deferred after KAN-266

The identity and metadata ownership are now defined, but these remain separate tasks:

- distance/D+ originals — KAN-267;
- modality — KAN-268;
- elevation density and kilometer-effort — KAN-269;
- official classification research/model — KAN-270/271;
- profile coherence policies — KAN-272;
- `CompetitionEntry` integration — KAN-273;
- `TrainingGoal` integration — KAN-274;
- future registration boundary — KAN-275;
- persistence/CRUD/search — KAN-276.

## Core invariants

1. An event is not duplicated for each course/distance.
2. Mutable/historical metadata lives at the narrowest level where it can vary.
3. Event branding does not overwrite historical edition metadata.
4. Different courses in the same edition may have different schedule/start location and later different sporting profiles/modalities.
5. Names, years, labels and nominal distances are not technical identity.
6. Planning/future registration reference `RaceCourse`, not the event globally.
7. Catalog edits never imply silent mutation of planning snapshots.
8. Missing metadata remains unknown rather than being invented or inherited implicitly.
