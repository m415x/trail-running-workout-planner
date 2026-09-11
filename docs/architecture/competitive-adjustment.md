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

## CompetitionAdjustmentPolicy

Priority expresses planning importance, not physiological cost. H10 centralizes priority guardrails in `getCompetitionAdjustmentPolicy()` rather than scattering them through generators.

| Priority | Default strategy | Formal taper days | Overall volume-reduction guardrail | No formal taper allowed | Race as training stimulus | Post-race planning protection |
| --- | --- | ---: | ---: | --- | --- | --- |
| A | `full_taper` | 4–21 | 30–60% | no | no | `protected` |
| B | `proportional_adjustment` | 0–7 | 0–40% | yes | no | `contextual` |
| C | `specific_stimulus` | 0–3 | 0–20% | yes | yes | `minimal_interference` |

These values are policy guardrails, not a direct prescription. Later H10 decisions refine duration and magnitude from course demand and reached load. Task-specific reduction curves belong to taper/reduction policies, not to generators.

All priorities preserve the option for brief intensity stimuli while training volume is reduced.

Post-competition planning protection must not be mistaken for physiological recovery duration. Recovery demand is assessed separately from priority; a high-demand C event remains physiologically demanding even when its role in the plan is secondary.

Course demand constrains the plausible adjustment range; reached pre-competition load selects/refines the proposal within that range. Priority modifies planning treatment. Recovery need remains driven primarily by physiological/event demand.

## Course demand v1 and future enrichment

H10 v1 can assess course demand from the data currently available:

```text
courseEffortKm = distanceKm + elevationGainM / 100
```

This is a course-demand baseline, not a direct taper-duration formula and not a training-load formula.

Future GPX/FIT ingestion may enrich an upstream `CourseProfile` with D-, gradients, climbs/descents, altitude, technicality signals, and expected duration. Track parsing remains upstream; competitive-adjustment policies consume assessed domain data only.

## Pre-competition load

Do not use configured `maximumWeeklyVolumeKm` as a proxy for fatigue/load reached. H10 derives context from generated/persisted progression. A single peak is insufficient: recent average, peak, trend, reference window, and relative load remain representable for both volume and elevation as separate dimensions.

The H10 contract uses `achievedPeakElevationGainM`; legacy generator-local names remain transitional until that generator is replaced.

## Taper duration

`determineTaperDuration()` returns a formal taper duration in calendar days plus rationale. Priority supplies hard guardrails, competition demand narrows the plausible section of that range, and reached recent load positions the proposal inside that section. Unknown/low-confidence course demand requires coach review rather than being interpreted as flat terrain.

The old `0 | 2 | 3`-week generator remains compatibility-only while H10 policies are integrated.

## Progressive volume reduction

`calculateTaperVolumeReductionCurve()` produces a monotonic day-based reduction curve from the **recent reached average weekly volume**, not from configured maximum volume or race distance.

The final reduction is derived from the priority guardrail and where the chosen taper duration sits within that priority's allowed duration range. H10 v1 uses a transparent linear progression from the start of the taper to the final pre-race reduction. Curve shape is isolated so it can be replaced later without changing callers.

The curve returns `targetWeeklyEquivalentVolumeKm` for each taper day. This is a planning-equivalent value used by later impact-window/microcycle reconciliation; it is **not** a prescribed daily running distance. Competition distance is excluded from these targets.

A zero-day B/C adjustment returns no taper-volume curve instead of fabricating a formal taper.

## Race-week accounting

Training load and competition load are structurally distinct in `CompetitionWeekLoad`.

- `training.volumeKm` / `training.elevationGainM` represent only prescribed training in the competition week;
- `competition.distanceKm` / `competition.elevationGainM` represent the event itself;
- `totalExposure` is derived for reporting/analysis only and must never be written back as the training target;
- if either training or competition D+ is unknown, derived total D+ remains `null` instead of assuming zero;
- zero pre-race training remains a valid prescription while competition exposure is still represented explicitly.

`buildCompetitionWeekLoad()` enforces this boundary. The legacy race microcycle note already said the race was excluded; H10 now makes that rule a domain contract rather than relying on free text.

## Full taper proposal for priority A

`buildFullCompetitionATaperProposal()` is the first composition boundary for the new H10 model. It accepts one A-priority competition, a normalized `CourseProfile`, reached pre-competition load, and the existing weekly intensity target. It then composes demand assessment, day-based taper duration, progressive volume/D+ reduction, brief-intensity preservation and separated race-week load.

The resulting `FullCompetitionATaperProposal` is pure and reviewable. It does not write to the database, mutate microcycles, or bypass ownership/provenance rules. Short A races can resolve to fewer than 14 taper days, while high-demand marathon/ultra events can resolve to longer windows within the centralized 4–21 day A guardrail.

## Proportional adjustment for priority B

`buildCompetitionBAdjustmentProposal()` applies the same pure demand/load-aware building blocks under the B guardrails (0–7 formal taper days and 0–40% volume reduction), without promoting the event to a primary peak.

The caller supplies the existing competition-week role and planned training target. A B race inside a development week may receive a mini-taper, but the taper target acts only as a ceiling over the already planned week. A B race near/in a recovery week therefore cannot increase volume or known D+ merely to satisfy a competition-specific target. If the B duration policy resolves to zero days, the existing training target is retained unchanged and the race exposure remains structurally separate.

This is still a proposal boundary: no microcycle is persisted or rewritten here. Later impact-window reconciliation will decide how accepted changes interact with provenance, manual protection and neighboring competitions.

## Ownership and reconciliation

Reuse the Epic 2 ownership rule: generated state may be regenerated while explicit coach-owned/manual state is preserved. Protected values inside an impact window must surface conflicts instead of being silently overwritten.

Competition changes should produce a new local proposal. They must not trigger whole-macrocycle regeneration by default.

## Planned versus realized impact

A competition can be rescheduled, reprioritized, or cancelled after an adjustment was accepted. H10 must distinguish planned changes from effects already realized. Cancelling before race day must not create post-race recovery as if the event occurred, while already-realized taper changes must not be silently erased.

## Test migration strategy

Existing tests that assert 2/3-week tapers and fixed factors remain regression coverage while compatibility exists. New H10 tests target pure policies first. Integration should be migrated only after policy contracts are stable, then legacy assertions can be retired deliberately rather than rewritten opportunistically.
