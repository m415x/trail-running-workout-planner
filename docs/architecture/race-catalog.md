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
- distanceKm: number | null
- elevationGainM: number | null
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
| Distance and D+ | `RaceCourse` | Original editable sporting profile differs per course. |
| Modality | `RaceCourse` | One edition may contain different modalities; introduced by KAN-268. |
| Derived density/km-effort | `RaceCourse` derivation | Derived from course originals; introduced by KAN-269. |
| Classification | `RaceCourse` assessment/reference | Classification applies to a concrete profile and is versioned; KAN-270/271. |

### Why organizer/location live on RaceEdition

Treating organizer or location as stable `RaceEvent` data would make historical editions appear to have changed when the event moves venue or organization changes. They therefore belong to the edition snapshot.

`RaceEvent.websiteUrl` is allowed only for a canonical stable homepage. `RaceEdition.websiteUrl` carries an edition-specific page when one exists.

### Why scheduling can exist at both edition and course level

An edition owns its overall date range (`startDate`/`endDate`). A concrete course may additionally own `scheduledStartAt` because multi-distance events often schedule different distances on different days or times.

The course schedule must fall within the edition range once validation is implemented; KAN-266 establishes ownership, not that policy implementation.

## Original course profile metrics

`distanceKm` and `elevationGainM` are original/editable measurements of `RaceCourse`. Neither is derived from the other.

```text
RaceCourseOriginalProfile
- distanceKm: number | null
- elevationGainM: number | null
```

### Distance

- unit: kilometers;
- finite numeric value when known;
- must be strictly greater than zero;
- decimal values are valid because an official/measured route does not need to be an integer number of kilometers;
- `null` means unknown/unpublished and is valid for incomplete catalog data;
- zero is never a valid substitute for unknown distance.

### Positive elevation gain

- unit: meters of positive elevation (`m+`);
- finite non-negative numeric value when known;
- `0` is a legitimate **known** value for a flat course;
- `null` means unknown/unpublished and must not be converted to zero;
- D+ is not inferred from distance, modality or a sibling course.

The base validator `validateRaceCourseOriginalProfile` checks only these per-field invariants. It deliberately accepts both metrics as `null` because draft catalog records may exist before official measurements are published.

Requirements such as "a published/selectable course must have enough sporting information" belong to a later publication/application policy, not to the primitive measurement validator.

### Precision

The domain keeps both values as JavaScript/TypeScript `number` without applying implicit rounding. Presentation may format them, but the catalog must preserve the supplied measurement. Persistence precision/storage type is decided with the schema in KAN-276.

### Same nominal distance does not identify a course

Two courses may both report `21` km while having different D+, modality, route or start location. Distance is therefore profile data, never an identity key or uniqueness constraint.

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

## Deliberately deferred after KAN-267

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
4. Different courses in the same edition may have different schedule/start location/profile.
5. Distance and D+ are original measurements, not identities and not derived from each other.
6. `null` means unknown; explicit zero D+ means known flat elevation gain.
7. Planning/future registration reference `RaceCourse`, not the event globally.
8. Catalog edits never imply silent mutation of planning snapshots.
9. Missing metadata remains unknown rather than being invented or inherited implicitly.
