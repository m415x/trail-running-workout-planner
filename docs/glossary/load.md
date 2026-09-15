# Load

## Short-term load
The recent internal-load EWMA used by KAN-261. The current model uses a 7-day decay constant. This parameter is a product/model choice, not a universal physiological constant.

## Long-term load
The longer-horizon internal-load EWMA used by KAN-261. The current model uses a 42-day decay constant. It is a model baseline, not a direct measurement of fitness.

## Load balance
`longTermLoadAu - shortTermLoadAu`. A negative value means recent smoothed internal load is above the longer-term smoothed baseline. It is not ACWR and is not an injury-risk score.

## Recent load above baseline
Operational interpretation used when `loadBalanceAu < 0` and the KAN-261 state has sufficient evidence. It means recent smoothed internal load exceeds the longer-term smoothed baseline; it does not mean fatigue, overload, or injury risk.

## Stable or lower recent load
Operational interpretation used when `loadBalanceAu >= 0` with sufficient evidence. It means recent smoothed internal load does not exceed the longer-term smoothed baseline. It is not proof of recovery or absence of fatigue.

## Isolated volume excess
External realized volume exceeds planned volume in one evaluable microcycle without qualifying consecutive persistence. KAN-262 treats it as informational context.

## Systematic volume excess
External realized volume exceeds planned volume in consecutive evaluable microcycles according to the versioned KAN-262 rule. It is a coach-review signal, not a diagnosis.

## ACWR
Acute:Chronic Workload Ratio. The current product does not use ACWR for KAN-263 triage because the ratio has important methodological limitations and should not be treated as a causal injury-risk rule.

## Overload
A training stimulus above an athlete's habitual level. In this product, the term must not be used as an automated diagnosis of harmful physiological overload.
