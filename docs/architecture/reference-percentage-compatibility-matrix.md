# KAN-440 — Reference percentage contract and clean migration decision

Status: **approved by the product owner on 2026-09-23**. The application is pre-production and contains no real data. The previous proposal to preserve ambiguous legacy rows and maintain parallel legacy columns is superseded.

## Approved canonical contract

- Method: `reference_percentage`; value: `referencePercentage`; persistence identifiers: `reference_percentage` for the numeric column and `reference_percentage` as the intensity method value.
- Human percentage scale: `90` means 90% of the applicable temporal 1000 m `RunningReference`; `0.9` is not a valid representation of 90%.
- Z1–Z5 remain independent; no implicit percentage or BPM conversion.
- Workout type `PAM` remains unchanged. A 1000 m test does not directly measure physiological PAM/MAS.
- The coach remains the owner of the prescribed intensity. Migration must not introduce automatic sporting decisions.

## Clean replacement inventory

| Boundary | Legacy contract to replace | Canonical outcome |
| --- | --- | --- |
| Workout catalogue | `workouts.intensity_method = pam_percentage`, `workouts.pam_percentage` | `reference_percentage` method and `reference_percentage` numeric column |
| Session prescriptions | `session_prescriptions.intensity_method = pam_percentage`, `session_prescriptions.pam_percentage` | Same canonical method and numeric column |
| Microcycle intensity targets | `pamPercentageTarget` / `pam_percentage_target` | Rename to `referencePercentageTarget` / `reference_percentage_target` as a planning target; do not invent an athlete-specific pace before a RunningReference is available |
| Planning strategy and rules | `PamPercentage`, `suggestedPamPercentage`, legacy default method | Canonical reference-percentage naming and explicit human percentage scale |
| Template and session forms/actions | `pamPercentage`, `pam_percentage` payloads and UI | Canonical payloads, validation and ES/EN “% de referencia” presentation |
| Legacy pace/zone helper | `lib/physiology/pam.ts` and `ZONE_PAM_PERCENTAGES` | Replace or isolate legacy calculations; never infer the 1000 m reference from Z1–Z5 |
| Execution guidance | Temporary `ExecutionIntensity` alongside legacy `TrainingIntensity` | Converge on one canonical `TrainingIntensity` union after consumers are migrated |
| SQLite and Supabase | Legacy Drizzle columns and historical migration assumptions | Equivalent canonical schemas and verified migration state |

## Migration rules

1. There are no production records or real athlete data to preserve. Legacy test data may be discarded and reseeded. Do not implement historical scale heuristics, review queues, dual-write, or indefinite compatibility columns.
2. Migrate application consumers and schema as bounded tasks; keep the branch type-safe at each integration boundary. Both databases must end with the same identifiers and semantics.
3. For SQLite, follow the project's migration workflow and reset only the local test database as needed. For Supabase, inspect generated SQL and apply/verify against the intended test environment; do not assume generated SQL proves remote application.
4. Preserve independently meaningful concepts: Z1–Z5, the `PAM` workout type, temporal RunningReference, and explicit coach prescriptions.
5. Remove temporary legacy compatibility code and tests that no longer describe the final contract. The scale classifier added during KAN-440 is temporary and must not survive KAN-446 unless a concrete non-legacy use is demonstrated.

## Approval gate

The product owner explicitly approved clean replacement of the legacy fields on 2026-09-23, with no additional product questions. KAN-443 and KAN-444 may proceed after their upstream implementation dependencies, using this approved matrix; they do not require a second historical-data approval.
