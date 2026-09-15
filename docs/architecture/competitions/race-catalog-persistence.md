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

Soft-deleting a parent does not cascade-delete children. Search and selection exclude soft-deleted ancestry; historical records and FKs remain intact.

## Search and selection

`searchRaceCourses` can search event/edition/course labels and filter by event/date. Normal catalog browsing may include draft/incomplete records. `selectableOnly` additionally requires:

- active event;
- published edition;
- published course;
- known distance;
- no soft-deleted ancestor.

That query is a discovery filter, not a replacement for `validateRaceCourseSelection`. Planning and TrainingGoal boundaries still run the domain selection policy before accepting a course.

## Migration evidence

The PostgreSQL delta is versioned as:

```text
drizzle/supabase/0013_bent_jackal.sql
```

It creates only the five KAN-276 tables:

```text
race_events
race_editions
race_courses
competition_entry_race_courses
training_goal_race_courses
```

No H1–H12 table is dropped or destructively rewritten. The migration was generated with Drizzle, inspected before application, applied successfully to Supabase and followed by the real schema/security verifier.

Post-migration evidence:

```text
Tablas de aplicación: 34/34
Tablas con RLS: 34/34
```

The verifier inventory includes all application tables, including the race catalog and sidecars. PostgreSQL notices about existing Drizzle metadata schema/table and truncation of long generated constraint names are informational only.

## Security boundary

All five new tables have RLS enabled in the deployed Supabase schema. RLS enablement is verified as infrastructure state; this does not by itself invent a tenant ownership model for the global catalog.

The core catalog remains shared product data. Team/athlete isolation continues to live on consumers (`CompetitionEntry`, `TrainingGoal`, future `RaceRegistration`) and their existing ownership boundaries. If future policies allow direct client-side catalog writes, explicit RLS policies/roles must be reviewed for that access pattern rather than inferred from `ENABLE ROW LEVEL SECURITY` alone.

## Migration rule

For future changes use the repository sequence:

```text
schema change
→ drizzle generate
→ inspect SQL + metadata
→ db:check
→ version generated artifacts
→ apply migration
→ db:verify:supabase
```

Generated migration snapshots/journal are never handwritten. `db:check:supabase` proves migration-chain consistency; it does not prove that the remote database has applied the delta. Only the post-migrate verifier provides that evidence.

## Product maintenance (KAN-280)

Dashboard > Competitions exposes event search and the hierarchy under
`/[locale]/dashboard/competitions`. Event listing does not depend on a course
join: an empty event or edition remains discoverable while being built.

The optional catch-all page recognizes only the event/edition/course detail,
new, edit and archive routes. It validates the complete ancestry on reads.
Server actions repeat those checks, validate form data and compare the submitted
record revision before mutating in a SQLite transaction. Event archival uses
`status = archived`; edition/course archival uses the existing logical deletion
flag. No child or consumer is physically deleted. An archived event can be
reactivated through its status editor; logically deleted children are historical.

Maintenance edits original metadata, lifecycle and course profile. Existing
classification records and external provenance are preserved, and versioned
classifications are displayed on course detail. Derived descriptors use the
existing pure profile helper. Blank metrics remain null; explicit D+ zero remains
known. Editing an unchanged scheduled start preserves its original seconds/offset.

The catalog remains shared product data under the existing application access
baseline; this change does not introduce authentication, catalog roles or a
fictional team owner. Consumer actions retain the existing team/athlete checks.

The course picker searches published/selectable records and shows the concrete
event/edition/course context before acceptance. Both consumer actions re-read
the selected hierarchy and reject stale revisions or unavailable courses.
Snapshot creation and sidecar insertion use one SQLite transaction; catalog
maintenance never writes to consumer tables or accepted macrocycle snapshots.
