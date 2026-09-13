# Race catalog persistence

## Scope

KAN-276 persists the reusable `RaceEvent -> RaceEdition -> RaceCourse` hierarchy without changing the snapshot semantics already established for planning and training goals.

The catalog is **shared product data**, not team-owned data. Core catalog tables therefore have no `team_id`. Team/athlete scope belongs to facts that reference the catalog, such as planning context and the future `RaceRegistration`. If private/team-specific catalog records are introduced later, that is a new ownership policy and must not be inferred from the current schema.

## Tables

The SQLite and Postgres schemas are mirrored in:

- `db/race-catalog-schema.ts`
- `db/supabase/race-catalog-schema.ts`

They define:

```text
race_events
  1
  `-- * race_editions
          1
          `-- * race_courses
```

All three use the existing base lifecycle columns (`id`, `is_deleted`, `created_at`, `updated_at`). Parent foreign keys use `restrict`: historical catalog identity must not disappear because a parent is physically deleted. Normal removal is soft-delete plus lifecycle status.

`RaceEdition.location`, `RaceCourse.modality` and `RaceCourse.classifications` are persisted as JSON/JSONB because they are bounded structured values owned by a single record. Distance and D+ remain scalar numeric columns so they are queryable and retain their original precision.

## Provenance

Each catalog level stores:

```text
source_origin   product | external
source_provider nullable
external_id     nullable
source_url      nullable
```

Product-maintained records default to `source_origin = product`. An external record requires both provider and external ID. `(source_provider, external_id)` is unique inside each hierarchy table, reserving an idempotent import key without coupling internal IDs to a future provider.

External provenance is metadata, never entity identity. Internal opaque IDs remain the only application identity.

## Planning and TrainingGoal references

Planning and goals keep the snapshots defined in KAN-273/KAN-274. Catalog linkage is normalized into optional sidecars:

```text
competition_entry_race_courses
- competition_entry_id PK/FK
- race_course_id FK

training_goal_race_courses
- training_goal_id PK/FK
- race_course_id FK
```

Legacy/manual rows are valid without a sidecar row. Linking a catalog course does not make live catalog fields authoritative over the existing snapshot. Later edits to a race event/edition/course therefore do not rewrite accepted planning or athlete-goal history.

Only `race_course_id` is persisted in the sidecar. Event and edition IDs are resolved through the catalog hierarchy; duplicating all three IDs would create a second ancestry invariant inside persistence. `RaceCourseReference` can still expose all three IDs at application boundaries.

## CRUD and lifecycle

`lib/race-catalog/catalog-repository.ts` owns the current application persistence operations:

- create/read/update for event, edition and course;
- soft-delete for each hierarchy level;
- explicit lifecycle status updates through normal update operations;
- provenance validation;
- catalog search;
- concrete `RaceCourseReference` resolution;
- optional linking from `CompetitionEntry` and `TrainingGoal`.

Re-parenting is intentionally absent from update inputs. `raceEventId` and `raceEditionId` are ancestry/identity boundaries, not ordinary mutable fields.

Soft-deleting a parent does not cascade-delete children. Search and selection exclude soft-deleted ancestry; the historical records and FKs remain intact.

## Search and selection

`searchRaceCourses` can search event/edition/course labels and filter by event/date. Normal catalog browsing may include draft/incomplete records. `selectableOnly` additionally requires:

- active event;
- published edition;
- published course;
- known distance;
- no soft-deleted ancestor.

That query is a discovery filter, not a replacement for `validateRaceCourseSelection`. Planning and TrainingGoal boundaries still run the domain selection policy before accepting a course.

## Migration rule

Both Drizzle configs include the new schema modules. Generated SQL, snapshots and migration journal entries must be produced by the repository's Drizzle tooling; they are not handwritten. Source/schema work is not considered migration-complete until that generation step and the normal repository gates have run.
