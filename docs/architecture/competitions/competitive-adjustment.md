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

New and touched domain contracts must make units explicit: `distanceKm`, `elevationGainM`, optional `elevationLossM`, `durationDays` / `durationMinutes`, and `achievedPeakElevationGainM`.

## CompetitionAdjustmentPolicy

Priority expresses planning importance, not physiological cost. H10 centralizes priority guardrails in `getCompetitionAdjustmentPolicy()` rather than scattering them through generators.

| Priority | Default strategy | Formal taper days | Overall volume-reduction guardrail | No formal taper allowed | Race as training stimulus | Post-race planning protection |
| --- | --- | ---: | ---: | --- | --- | --- |
| A | `full_taper` | 4–21 | 30–60% | no | no | `protected` |
| B | `proportional_adjustment` | 0–7 | 0–40% | yes | no | `contextual` |
| C | `specific_stimulus` | 0–3 | 0–20% | yes | yes | `minimal_interference` |

Priority modifies planning treatment; physiological recovery remains driven by event demand.

## Course demand and future enrichment

H10 v1 uses `courseEffortKm = distanceKm + elevationGainM / 100` as a course-demand baseline, not as a direct taper or training-load formula. Future GPX/FIT ingestion may enrich `CourseProfile` with D−, gradients, altitude, technicality and expected duration without coupling track parsing to competitive-adjustment policies.

## Pre-competition load and taper

H10 uses load actually reached rather than configured maximum volume. `determineTaperDuration()` returns calendar days inside priority guardrails; `calculateTaperVolumeReductionCurve()` and the elevation curve produce progressive planning-equivalent ceilings. A zero-day B/C adjustment produces no artificial formal taper.

## Race-week accounting

`CompetitionWeekLoad` keeps prescribed training structurally separate from event exposure. Derived total exposure is reporting/analysis data and is never written back as the training target.

## Priority-specific proposals

`buildFullCompetitionATaperProposal()` composes the full A taper. `buildCompetitionBAdjustmentProposal()` applies proportional B adjustment without raising an already lighter recovery week. `buildCompetitionCAdjustmentProposal()` can treat low/moderate C events as specific quality stimuli while preserving their physiological demand; high-demand C events are never misclassified as trivial training.

## Post-competition recovery

`decidePostCompetitionRecovery()` maps physiological demand to `acute_recovery`, `recovery` and `progressive_reentry`. A/B/C only changes planning protection. Known large D− can conservatively raise recovery demand; missing D− is not assumed to be zero. Unknown D+ requires coach review.

## Competition impact window and overlap

`CompetitionImpactWindow` joins pre/race/post calendar ranges. B/C with zero taper omit `pre`. Overlap resolution uses A > B > C for incompatible pre/race planning, but physiological recovery is never discarded. A race scheduled during active recovery requires coach review.

## Local adjustment proposal

`buildCompetitionAdjustmentProposal()` previews only microcycles intersecting the impact window. It exposes current/proposed type, volume, D+, intensity allowance, rationale and overlap conflicts before persistence. Race-week training remains separate from competition exposure and recovery applies conservative ceilings.

## Ownership and protected planning reconciliation

Reuse the Epic 2 ownership rule: generated state may be regenerated while explicit coach-owned/manual state is preserved.

`preserveProtectedCompetitionPlanning()` is a second pure reconciliation layer over `CompetitionAdjustmentProposal`. The caller supplies persisted ownership/protection metadata for affected microcycles. Existing `targetVolumeSource` / `targetElevationSource` semantics identify manual target values; structural flags identify protected microcycles/objectives and protected session IDs.

When the competitive proposal would change a manual target or protected microcycle type, the current value is retained in the proposal. Objectives and sessions are not rewritten by this layer; their protection is surfaced explicitly. Every preservation emits a `protected_planning_preserved` conflict and forces coach review. Generated targets remain adjustable.

## Coach review boundary

`reviewCompetitionAdjustmentProposal()` is the explicit approval boundary after protection reconciliation and before persistence. The coach can either accept the protected proposal unchanged or submit explicit edits for affected microcycles. Accepted values retain `generated` provenance; only fields explicitly edited during review become `coach` owned in the resulting review artifact.

Review cannot overwrite fields preserved by KAN-220, cannot target microcycles outside the local proposal, and validates numeric target edits before producing an accepted artifact. An `accepted` decision cannot contain edits and an `adjusted` decision must contain at least one edit. The result is still pure and non-persistent; later reconciliation/persistence consumes this reviewed artifact.

## Local reconciliation and audit boundary

`reconcileReviewedCompetitionAdjustment()` converts only the microcycles present in the reviewed competitive proposal into persistence-ready patches. It never expands the scope to the rest of the macrocycle, so state outside the accepted impact window is not part of the write set.

For every value that actually changes, reconciliation also emits an audit record with plan, competition, microcycle, field, previous/new value, actor and provenance. Fields accepted from the generator remain `generated`; fields explicitly changed at the coach-review boundary remain `coach`. Unchanged values do not create modification records.

The function remains pure. A database adapter must apply the returned patches and audit records transactionally; it must not regenerate the whole macrocycle. Existing `planning_modification_records` can carry the field/value/actor portion of this audit trail, while the reconciliation artifact preserves competition/provenance context until persistence storage is finalized.

This separation is intentional: KAN-219 answers “what would the competitive policy change?”, KAN-220 answers “which proposed changes are coach-owned and therefore must not be silently applied?”, KAN-221 answers “what did the coach explicitly accept or adjust?”, and KAN-222 answers “what exact local write set and audit trail may persistence apply?”.

Competition changes should produce a new local proposal. They must not trigger whole-macrocycle regeneration by default.

## Planned versus realized impact

A competition can be rescheduled, reprioritized, or cancelled after an adjustment was accepted. H10 must distinguish planned changes from effects already realized. Cancelling before race day must not create post-race recovery as if the event occurred, while already-realized taper changes must not be silently erased.

## Test migration strategy

Existing legacy taper tests remain regression coverage while compatibility exists. New H10 tests target pure policies first. Integration should be migrated only after policy contracts are stable, then legacy assertions can be retired deliberately rather than rewritten opportunistically.
