# KAN-440 — Reference percentage compatibility matrix

Status: **proposed; requires explicit coach/product approval before KAN-443 SQLite and KAN-444 Supabase migrations**. This matrix documents current legacy contracts; it does not authorize automatic rewriting of historical records.

## Canonical contract and scale

- Execution identifier: `reference_percentage`; value field: `referencePercentage`; persisted target field to be agreed in the migration tasks.
- Human-readable percentage scale: `90` means 90% of the applicable temporal 1000 m `RunningReference`, not a decimal multiplier `0.9`.
- Z1–Z5 remain independent; they must not be converted to percentages or BPM.
- Workout type `PAM` remains unchanged. Its name is not evidence that a 1000 m test measures physiological PAM/MAS.
- Legacy `pam_percentage` / `pamPercentage` are not canonical synonyms until their historical provenance and scale are established.

## Existing storage and compatibility boundaries

| Boundary | Existing identifier and value | Current read/write path | Scale evidence and treatment |
| --- | --- | --- | --- |
| Workout catalogue | `workouts.intensity_method`, `workouts.pam_percentage` | `app/actions/workout-template-actions.ts`: `resolveIntensity` reads; `draftFromFormData` and `persistenceValues` write | Numeric scale is not encoded in the column. Preserve original values and method; do not infer scale from magnitude. |
| Session prescription | `session_prescriptions.intensity_method`, `session_prescriptions.pam_percentage` | Session form and session actions; workout-template snapshot can supply defaults | Same provenance rule. A template-derived value must not silently acquire canonical semantics. |
| Microcycle intensity target | `pamPercentageTarget` / `pam_percentage_target` | Intensity strategy/periodization domain; Supabase schema includes the target | Planning intent is distinct from an athlete-specific execution reference. Do not rewrite as a RunningReference-derived prescription without an explicit domain decision. |
| Intensity strategy/rules | `suggestedPamPercentage`, `PamPercentage`, `defaultMethod` | `types/training/intensity.types.ts` and planning consumers | Legacy planning semantics. Preserve independently until KAN-441 defines their canonical mapping. |
| Legacy pace/zone helper | `lib/physiology/pam.ts`, `ZONE_PAM_PERCENTAGES` | Legacy calculation consumers | Do not equate zone percentage bands with the 1000 m reference. KAN-446 owns retirement or isolation. |
| Execution guidance | `ExecutionIntensity` `reference_percentage` / `referencePercentage` | `lib/physiology/execution-guidance.ts` | Explicit canonical value uses the human percentage scale. Legacy `pam_percentage` remains distinguishable. |
| SQLite | `db/schema.ts` workout and session prescription columns | Local Drizzle storage | No migration until this matrix is approved; retain original values for audit. |
| Supabase | `db/supabase/schema.ts` workout, session prescription and microcycle target columns | PostgreSQL Drizzle storage | Apply the same classification rules as SQLite; no unilateral remote reinterpretation. |

## Classification rules for historical values

| Legacy value | Provenance | Classification | Permitted action |
| --- | --- | --- | --- |
| `90` | Explicitly documented human percent | Resolved as `referencePercentage: 90` **only if** the value is also documented as a percentage of the applicable 1000 m reference | Convert through an explicit reviewed mapping. |
| `0.9` | Explicitly documented fractional multiplier of the applicable 1000 m reference | Resolved as `referencePercentage: 90` | Convert through an explicit reviewed mapping. |
| `90` or `0.9` | Unknown scale or reference basis | Ambiguous | Preserve legacy identifier and original value; flag for review. Do not infer from numeric range. |
| Any value | Known percentage scale but unknown physiological/reference basis | Reference basis unresolved | Preserve as legacy until reference basis is verified; numeric normalization alone does not establish canonical meaning. |
| Null | No prescribed percentage | Absent | Keep null; never substitute zero. |

`classifyLegacyPercentage` is a narrow scale classifier, not a migration authorization or proof of reference basis. Callers must establish the reference basis separately.

## Migration entry gate

1. Explicit approval of this matrix and of the target column/identifier mapping for both databases.
2. Inventory existing values and their provenance; document how ambiguous rows remain accessible without silent reinterpretation.
3. Define identical SQLite/Supabase transformations and rollback/audit behavior before generating migrations.
4. Preserve Z1–Z5, manual coach prescriptions, workout type `PAM`, and temporal RunningReference semantics.
5. Verify focused read/write tests and actual database state independently; do not claim a remote migration from generated SQL alone.
