# Epic 2 / H10 — Competitive adjustment history

H10 (`KAN-204`) evolved the competition handling introduced in H9 from a coarse taper heuristic into a local competitive-adjustment domain.

## Starting point

Before H10, competitive planning still depended on legacy taper behavior:

- taper duration was effectively limited to `0 | 2 | 3` weeks;
- distance, configured maximum weekly volume, and group prefixes had too much authority;
- volume and D+ were reduced with the same factors;
- B/C competitions, post-race recovery, overlap resolution, protected planning, coach review and local reconciliation were not modeled as first-class concepts.

H9 had already established the correct source-of-truth boundary: `CompetitionEntry` owns the live plan-scoped calendar, `CompetitionContext` is the pure planning input, and `Macrocycle.targetRace*` remains historical snapshot metadata.

## Research-led domain decisions

The story was redesigned after reviewing taper and trail-running evidence. H10 therefore adopted these rules:

- taper duration is modeled in calendar days, not a closed week union;
- course demand is separated from training load;
- `courseEffortKm = distanceKm + elevationGainM / 100` is only a baseline course-demand signal, never a generic training-load formula;
- volume and elevation remain separate training dimensions;
- taper duration is influenced by event demand, competition priority and load actually reached before the race;
- A/B/C expresses planning importance, not physiological cost;
- recovery is derived from event demand and eccentric/downhill information when available, then priority changes how strongly that recovery is protected in planning;
- future GPX/FIT analysis may enrich `CourseProfile` with D−, gradients, altitude, major climbs/descents, technicality and expected duration without coupling track parsing to taper/recovery policies.

## Resulting H10 pipeline

H10 introduced a pure, reviewable pipeline:

```text
CourseProfile
    -> CompetitionDemandAssessment
PreCompetitionLoadContext
    -> TaperDecision
    -> volume / elevation reduction curves
    -> intensity preservation
    -> priority-specific A/B/C proposal
    -> RecoveryDecision
    -> CompetitionImpactWindow
    -> CompetitionAdjustmentProposal
    -> protected-state reconciliation
    -> coach review
    -> local reconciliation / audit write set
```

The legacy macrocycle taper remains only as compatibility while the new policies are integrated incrementally. New competitive rules must not be added back into the legacy `determineTaperingWeeksCount()` / `generateCompetitiveMesocycle()` path.

## Priority behavior

The domain policy centralizes initial guardrails:

- **A** — full taper, primary peak, race-week treatment and protected post-race planning; formal taper range 4–21 days.
- **B** — proportional/local adjustment, including a possible 0-day formal taper; it must not increase an already lighter recovery week.
- **C** — minimal interference and optional use as a specific/quality stimulus; a demanding C remains physiologically demanding and can still require meaningful recovery.

Short intensity stimuli are preserved by reducing quantity rather than automatically weakening the prescribed HR-zone or `% PAM` magnitude.

## Competition week and recovery

Race-week training is structurally distinct from competition exposure. Derived total exposure is reporting/analysis data and is not written back as the training target.

Post-competition recovery is represented independently from taper and can include acute recovery, recovery training and progressive re-entry. Known high D− may conservatively increase recovery demand; unknown D− is not interpreted as zero.

## Overlaps and local scope

`CompetitionImpactWindow` joins pre/race/post ranges. Overlap resolution uses priority for incompatible planning adjustments while never discarding unresolved physiological recovery. A race occurring during pending recovery can require explicit coach review.

All downstream changes remain local to the accepted impact window. A competition date, priority or lifecycle change must create a fresh local proposal rather than regenerate the whole macrocycle by default.

## Coach ownership and auditability

H10 preserved the Epic 2 ownership rule:

- generated state may be regenerated;
- explicit coach-owned/manual state must not be silently overwritten.

`preserveProtectedCompetitionPlanning()` keeps manual targets and protected microcycles/objectives/sessions intact while surfacing visible conflicts. `reviewCompetitionAdjustmentProposal()` records whether the coach accepted the generated proposal or changed individual fields. Accepted generated values retain `generated` provenance; explicitly edited values become `coach` provenance.

`reconcileReviewedCompetitionAdjustment()` then emits only the local persistence patches plus audit records for fields that actually changed. Audit records carry plan, competition, microcycle, field, previous/new value, actor and provenance. Unchanged values do not create modification records.

## Units and naming

H10 reinforced explicit units in touched contracts, including `distanceKm`, `elevationGainM`, `elevationLossM`, duration fields in days/minutes, and `achievedPeakElevationGainM`.

## Regression coverage

The story contains focused coverage for:

- planning with no A competition;
- short A and marathon/ultra-scale A taper behavior;
- high-D+ specificity;
- B in development and recovery contexts;
- C as a quality/specific stimulus;
- nearby and overlapping competitions, including A precedence and recovery preservation;
- race-week training versus competition exposure;
- cancelled competitions being excluded from active `CompetitionContext` without deleting history;
- protected/manual values;
- coach review and provenance;
- local reconciliation and audit records;
- date changes shifting the impact window;
- B -> A promotion rebuilding the priority-specific window.

## Closure

H10 completed its full local story gate successfully: automated tests, lint, TypeScript type checking, production build and Supabase schema validation were green after the final regression fixes. `KAN-223` and `KAN-204` were transitioned to `Finalizada` in Jira.

The story branch `h-19-competitive-adjustment` was merged into `dashboard` in commit `6ea77fc` (`Merge H10 competitive adjustment into dashboard`). H10 is therefore closed; future work should consume the durable competitive-adjustment contracts rather than treating this history as an active implementation checklist.
