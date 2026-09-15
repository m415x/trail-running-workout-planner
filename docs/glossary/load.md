# Load

## Short-term load
The recent internal-load EWMA used by KAN-261. The current model uses a 7-day decay constant. This parameter is a product/model choice, not a universal physiological constant.

## Long-term load
The longer-horizon internal-load EWMA used by KAN-261. The current model uses a 42-day decay constant. It is a model baseline, not a direct measurement of fitness.

## Load balance
`longTermLoadAu - shortTermLoadAu`. A negative value means recent smoothed internal load is above the longer-term smoothed baseline. It is not ACWR and is not an injury-risk score.

## Recent load above baseline
Operational interpretation used when `loadBalanceAu < 0` and the internal-load state has sufficient evidence. It means recent smoothed internal load exceeds the longer-term smoothed baseline; it does not mean fatigue, overload, or injury risk. Cross-domain consumers use the versioned semantic signal rather than reinterpreting `loadBalanceAu` directly.

## Stable or lower recent load
Operational interpretation used when `loadBalanceAu >= 0` with sufficient evidence. It means recent smoothed internal load does not exceed the longer-term smoothed baseline. It is not proof of recovery or absence of fatigue.

## Isolated volume excess
External realized volume exceeds planned volume in one evaluable microcycle without qualifying consecutive persistence. The systematic-volume domain treats it as informational context.

## Systematic volume excess
External realized volume exceeds planned volume in consecutive evaluable microcycles according to the versioned systematic-volume rule. It is a coach-review signal, not a diagnosis.

## Training response review
A versioned composition of existing semantic training-response signals used to prioritize coach review. It does not recalculate source metrics and is not a physiological or medical diagnosis.

## Contributor
A traceable source signal included in a training-response review. A contributor has a domain, semantic signal, role, evidence window, and source rule version.

## Evidence contributor
A contributor whose semantic state may affect review attention according to the versioned convergence matrix. Multiple dimensions from one source domain do not become independent evidence domains.

## Context contributor
A contributor that helps explain the athlete's situation but cannot independently establish overload or priority. Adherence is contextual in `training-response-convergence-v1`.

## Signal convergence
Independent evidence domains supporting increased review attention over temporally compatible evidence windows. In `training-response-convergence-v1`, `priority` requires systematic external-volume excess and recent internal load above baseline.

## Evidence window
The time interval represented by a source signal. Evidence windows must overlap before independent signals can establish priority convergence. Missing temporal information makes compatibility indeterminate rather than false or normal.

## Priority review
A workflow attention level indicating that independent systematic-volume and internal-load evidence converges over compatible evidence windows. It means the athlete should be reviewed earlier; it does not mean fatigue, harmful overload, injury risk, or overtraining has been diagnosed.

## Insufficient data
A source state indicating that available evidence cannot safely establish the corresponding semantic state. It is preserved as a limitation and is never treated as normality or positive evidence.

## ACWR
Acute:Chronic Workload Ratio. The current product does not use ACWR for training-response triage because the ratio has important methodological limitations and should not be treated as a causal injury-risk rule.

## Overload
A training stimulus above an athlete's habitual level. In this product, the term must not be used as an automated diagnosis of harmful physiological overload.
