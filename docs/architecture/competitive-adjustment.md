# Competitive adjustment architecture

## Status

H10 (`KAN-204`) evolves the legacy taper implementation into local competitive adjustment. This document records the migration boundary established by `KAN-205` and the policy direction that subsequent H10 tasks must preserve.

## Legacy implementation being replaced

The current macrocycle generators still own taper mechanics:

- `determineTaperingWeeksCount()` returns only `0 | 2 | 3` weeks;
- duration is selected from race distance, configured `maximumWeeklyVolumeKm`, and E/U group prefixes;
- `generateCompetitiveMesocycle()` accepts only `2 | 3` weeks;
- volume factors are hard-coded as `[0.6, 0.3]` or `[0.75, 0.55, 0.3]`;
- the same factor is applied to volume and D+;
- the final taper week is the race microcycle;
- `GeneratedMacrocycleDraft` / `Macrocycle` still expose `taperingWeeksCount` as legacy persisted metadata.

These contracts form a migration safety net; they are not the target H10 architecture.

## Migration boundary

### Keep temporarily as compatibility

Until the H10 policies are integrated end to end, the existing macrocycle generator may continue to emit legacy competitive mesocycles and `taperingWeeksCount`. Existing persisted plans must remain readable.

Compatibility code must not become the home of new A/B/C policy. Do not add new percentages, priority branches, recovery rules, overlap handling, or GPX-aware logic to `determineTaperingWeeksCount()` or `generateCompetitiveMesocycle()`.

### Move into pure H10 domain policies

New competitive behavior belongs outside the legacy macrocycle generator:

1. `CompetitionDemandAssessment` — assesses course demand from explicit-unit course inputs.
2. `PreCompetitionLoadContext` — describes load actually reached before the affected window.
3. `CompetitionAdjustmentPolicy` — maps priority and assessed context to planning behavior.
4. `TaperDecision` — duration in days and reduction strategy for the pre-competition phase.
5. `RecoveryDecision` — post-competition recovery need/strategy; not the inverse of taper.
6. `CompetitionImpactWindow` — pre / competition / post dates and decisions.
7. `CompetitionAdjustmentProposal` — reviewable local changes and conflicts before persistence.
8. local reconciliation — applies accepted changes only to the affected window while preserving coach-owned state.

The new policies must be pure: no database access, no UI copy, and no knowledge of GPX/FIT file formats.

## Source-of-truth boundaries

H9 boundaries remain authoritative:

- `CompetitionEntry` is the live calendar entity.
- `CompetitionContext` is the persistence-free competitive input to planning.
- `Macrocycle.targetRace*` is historical snapshot data only.
- `PlanningIntent` does not contain a race intent.
- H10 must not infer competition ownership from legacy `goalType`.

## Units

New and touched domain contracts must make units explicit:

- `distanceKm`
- `elevationGainM`
- `elevationLossM` when available in the future
- `durationDays` / `durationMinutes`
- `achievedPeakElevationGainM`

The existing `CompetitionContextEntry.elevationGain` and legacy generator fields are transitional. Rename them only through scoped migrations with tests; do not create parallel ambiguous fields casually.

## CompetitionAdjustmentPolicy direction

Priority expresses planning importance, not physiological cost.

| Priority | Initial planning strategy |
| --- | --- |
| A | full taper, principal peak, race week, protected recovery |
| B | proportional/local adjustment, possible mini-taper, contextual recovery |
| C | minimal/no formal taper when appropriate; may act as a specific quality stimulus |

Policy values must be centralized and replaceable. Do not scatter percentages or duration thresholds through generators.

Course demand constrains the plausible adjustment range; reached pre-competition load selects/refines the proposal within that range. Priority modifies planning treatment. Recovery need remains driven primarily by physiological/event demand.

## Course demand v1 and future enrichment

H10 v1 can assess course demand from the data currently available:

```text
courseEffortKm = distanceKm + elevationGainM / 100
```

This is a course-demand baseline, not a direct taper-duration formula and not a training-load formula.

Future GPX/FIT ingestion may enrich an upstream `CourseProfile` with D-, gradients, climbs/descents, altitude, technicality signals, and expected duration. Track parsing remains upstream; competitive-adjustment policies consume assessed domain data only.

## Pre-competition load

Do not use configured `maximumWeeklyVolumeKm` as a proxy for fatigue/load reached. H10 must derive context from generated/persisted progression. A single peak is also insufficient: recent average, peak, trend, reference window, and relative load should remain representable for both volume and elevation as separate dimensions.

When the existing elevation peak contract is touched, migrate `achievedPeakElevationGain` to `achievedPeakElevationGainM`.

## Race-week accounting

Training load and competition load are distinct. The legacy generator already notes that the race is excluded from the race-week training target; H10 must make this separation structural rather than relying on notes.

## Ownership and reconciliation

Reuse the Epic 2 ownership rule: generated state may be regenerated while explicit coach-owned/manual state is preserved. Protected values inside an impact window must surface conflicts instead of being silently overwritten.

Competition changes should produce a new local proposal. They must not trigger whole-macrocycle regeneration by default.

## Planned versus realized impact

A competition can be rescheduled, reprioritized, or cancelled after an adjustment was accepted. H10 must distinguish planned changes from effects already realized. Cancelling before race day must not create post-race recovery as if the event occurred, while already-realized taper changes must not be silently erased.

## Test migration strategy

Existing tests that assert 2/3-week tapers and fixed factors remain regression coverage while compatibility exists. New H10 tests should target pure policies first. Integration should be migrated only after policy contracts are stable, then legacy assertions can be retired deliberately rather than rewritten opportunistically.
