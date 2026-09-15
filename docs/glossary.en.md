# Domain Glossary — English

This glossary defines product/domain terminology used in code, research, and technical documentation. Keep it synchronized with `docs/glossary.es.md` whenever a term is added or its semantics change.

| Term | Definition |
| --- | --- |
| Adherence | Degree to which confirmed training outcomes correspond to the prescribed plan. Missing/unknown evidence is not automatically a failure. |
| External load | Work performed by the athlete described through externally observable quantities such as distance, duration, and elevation gain. |
| Internal load | Athlete's internal response to training. In the current MVP, estimated as session-RPE × duration and expressed in arbitrary units (AU). |
| session-RPE (sRPE) | Session rating of perceived exertion. In the current load model, RPE is multiplied by session duration to estimate internal training load. |
| Short-term load | EWMA-smoothed internal load using the current short-term time constant (7 days in `srpe-duration-v1`). It is a model parameter, not a universal physiological constant. |
| Long-term load | EWMA-smoothed internal load using the current long-term time constant (42 days in `srpe-duration-v1`). It is a model parameter, not a universal physiological constant. |
| Load balance | Difference `longTermLoadAu - shortTermLoadAu`. It is expressed in AU, is not a ratio, and must not be called ACWR. |
| Recent load above baseline | Operational KAN-344 state indicating that the available smoothed short-term internal load is greater than the smoothed long-term load. It is descriptive and does not mean fatigue, overload, or injury risk. |
| Stable or lower internal load | Operational KAN-344 state indicating that available smoothed short-term internal load is less than or equal to smoothed long-term load. It is not proof of recovery or absence of risk. |
| Systematic volume excess | KAN-262 pattern in which external realized volume exceeds planned volume across the required consecutive evaluable microcycles for a given dimension. It is a review signal, not a diagnosis. |
| Isolated volume excess | External realized volume exceeds planned volume in an evaluable microcycle without satisfying the persistence rule for systematic excess. |
| Training-response review | Non-diagnostic triage domain that composes independent, temporally compatible signals to help order coach review. |
| Convergence | Explicit, versioned combination of independent compatible signals. It is not a sum of heterogeneous units and does not imply causality. |
| Contributor | Source-domain signal that actively participates in a triage classification and remains traceable in its evidence. |
| Review priority | Operational ordering for coach attention (`none`, `info`, `review`, `priority`). It is not clinical severity or injury probability. |
| Unknown / insufficient data | State indicating that evidence is absent or insufficient for the relevant inference. It must never be treated as zero, normal, or negative evidence. |
| Coverage | Description of how much of the requested evidence window is supported by usable observations. Coverage qualifies interpretation; it does not replace missing evidence. |
| Rule version | Identifier for a calculation or interpretation rule, allowing semantics to evolve without silently rewriting the meaning of historical outputs. |
| ACWR | Acute:Chronic Workload Ratio. Not used by the current MVP triage design; `loadBalanceAu` is a difference, not ACWR. |
| Overload | Training stimulus above habitual or prior demand that may be part of normal adaptation. The product must not use this term as a diagnosis of maladaptation. |
| Overreaching / overtraining syndrome | Physiological/clinical concepts that cannot be diagnosed by the current MVP signals. They are outside KAN-263's inference scope. |
