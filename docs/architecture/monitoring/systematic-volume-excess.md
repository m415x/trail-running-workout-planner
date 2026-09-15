# Systematic Volume Excess

## Purpose

KAN-262 detects when an athlete's realized external volume persistently exceeds prescribed volume across consecutive microcycles. The signal exists to prioritize human review; it does not diagnose fatigue, injury, overreaching, overtraining syndrome, or medical risk.

Version 1 evaluates `distanceKm`, `durationMin`, and `elevationGainM` independently. It does not combine dimensions into a synthetic physiological score.

## Source of truth and flow

The KAN-259 Plan–Real comparison is authoritative for planned sessions, linked realized sessions, unplanned realized activities, and planning-resolution limitations.

```text
KAN-259 Plan–Real
        |
        v
aggregation by microcycle and dimension
        |
        +-- planned
        +-- linked realized
        +-- unplanned_realized (realized only)
        |
        v
longitudinal evidence
        |
        v
within_plan | isolated_excess | systematic_excess | insufficient_data
        |
        +--> explainable detail
        +--> compact projection for the future dashboard
```

An `unplanned_realized` activity contributes to the external volume actually performed but never increases planned volume. Realized record IDs are defensively deduplicated to prevent double counting.

## Version 1 rule

`SYSTEMATIC_VOLUME_RULE_VERSION = systematic-volume-v1`.

Persistence is evaluated by microcycle. Two consecutive evaluable microcycles with excess produce `systematic_excess`. A single excess microcycle produces `isolated_excess`. A non-evaluable microcycle breaks continuity; the implementation does not bridge an `unknown` period to manufacture persistence.

Attention levels are operational review states:

- `none`: no signal requiring attention.
- `info`: isolated excess; informational context.
- `review`: systematic excess; coach review is warranted.
- `priority`: reserved for future multi-signal composition. KAN-262 alone does not emit it.

These levels are not medical-risk categories.

## Magnitude and thresholds

Evidence preserves `planned`, `realized`, `absoluteDelta`, and `relativeDeltaPercent`. Magnitude explains how much realized volume differed from prescription; it must not be interpreted as injury probability or a universal physiological threshold.

The v1 persistence decision of two microcycles is an explicitly versioned MVP operational heuristic. It is not presented as a validated clinical or physiological threshold. Future changes must version the contract to preserve traceability.

## Coverage and unknown

Evaluation preserves planned sessions, comparable sessions, unknown sessions, unplanned realized activities, and `coverageRatio`.

`unknown` is neither zero nor `within_plan`. Missing planned or realized values, incompatible units, insufficient coverage, or relevant planning-resolution limitations degrade evidence to `insufficient_data` where applicable. This prevents false reassurance from missing data.

## Planning and competition context

Each evidence item preserves microcycle context (`type`, `loadFocus`) and, when available, competition-impact phases (`pre`, `race`, `post`), competition IDs, and `requiresCoachReview`.

Context never rewrites the observed value. For example, +20% distance during taper remains +20%. `tapering/recovery` explains the environment in which the deviation occurred; it does not alter the measurement to fit the plan.

## Persistence model

### Calculated signal

The systematic-excess signal remains derived rather than persisted as a domain snapshot. It is rebuilt from authoritative sources so corrections to realized training or Plan–Real resolution cannot leave stale stored signals.

### Human acknowledgement

A coach acknowledgement has audit semantics and may be persisted when connected to UI. `SystematicVolumeSignalReview` identifies the reviewed snapshot through athlete, dimension, microcycle, `ruleVersion`, and `patternAtReview`, together with `acknowledgedBy`, `acknowledgedAt`, and an optional note.

Acknowledging a signal does not resolve it, erase evidence, modify training, or modify the plan. If source data later changes, the current signal is recalculated while the historical acknowledgement preserves what the coach reviewed at that time.

## Presentation

The domain exposes two projections:

1. **Compact** — `ok | info | review | unknown`, attention, pattern, primary dimension, and magnitude. Intended for future coach-dashboard triage and not dependent on color alone.
2. **Detail** — dimension evidence, magnitude, dates, coverage, unplanned activities, context, insufficiency reasons, contributing microcycles, and rule version.

The UI owns localized copy and visual semantics. Domain code does not own color meaning or presentation text.

## Related stories

- **KAN-259** — authoritative Plan–Real source.
- **KAN-260** — plan adherence; independent domain.
- **KAN-261** — estimated internal load through session-RPE × duration; independent domain.
- **KAN-262** — longitudinal external-volume excess.
- **KAN-342** — future research into longitudinal RPE/Feeling response.

A future triage layer may compose these independent signals. Convergence can raise review priority, but must not turn association into diagnosis.

## Functional walkthrough

### Isolated excess

```text
Microcycle 1: 10 km planned / 10 km realized
Microcycle 2: 10 km planned / 12 km realized

pattern   = isolated_excess
attention = info
```

### Persistent excess

```text
Microcycle 1: 10 km planned / 12 km realized
Microcycle 2: 10 km planned / 13 km realized

pattern   = systematic_excess
attention = review
contributors = [mc-1, mc-2]
```

### Unplanned activity

```text
Planned:             10 km
Linked realized:     11 km
Unplanned realized:   2 km
--------------------------
Realized total:      13 km
Planned total:       10 km
```

The free activity increases `realized`, remains identifiable as `unplanned_realized`, and never increases `planned`.

### Incomplete evidence

```text
Microcycle 1: known excess
Microcycle 2: realized unknown
Microcycle 3: known excess
```

No systematic excess is inferred between microcycles 1 and 3. The unknown microcycle breaks continuity and remains insufficient evidence.

### Divergent dimensions

```text
distanceKm      systematic_excess
durationMin     within_plan
elevationGainM  insufficient_data
```

Dimensions are not mixed into a false global conclusion. The highest-attention dimension may be projected as primary for triage while all dimensions remain available in detail.

### Taper context

```text
microcycle.type   = tapering
loadFocus         = recovery
planned distance  = 10 km
realized distance = 12 km
delta             = +2 km / +20%
```

The calculation remains +20%; taper/recovery context accompanies the evidence for human interpretation.

## Explicit limits

KAN-262 does not:

- diagnose fatigue, injury, overreaching, overtraining, or illness;
- estimate injury probability;
- automatically modify the training plan;
- interpret RPE or Feeling as external-volume excess;
- combine distance, duration, and elevation gain into one score;
- treat missing data as normal;
- use `priority` as clinical severity.

## Closure gate

Closure requires TypeScript without errors and the full test suite passing. Specific tests cover persistence, isolated excess, unknown discontinuity, divergent dimensions, Plan–Real integration, unplanned activity, insufficient evidence, and taper-context preservation.
