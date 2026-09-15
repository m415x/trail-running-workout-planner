# KAN-344 — Operational interpretation of internal load for triage

Review date: 2026-09-14

## Question

What meaning can KAN-261 responsibly contribute to KAN-263 from the sRPE × duration series, its short- and long-term EWMAs, and `loadBalanceAu`, without turning that information into ACWR, a fatigue diagnosis, or an injury predictor?

## What KAN-261 currently calculates

KAN-261 calculates daily load as session-RPE × duration in arbitrary units (AU). It applies two EWMAs to the daily series, with 7- and 42-day time constants:

```text
alpha = 1 - exp(-1 / tau)
EWMA_t = EWMA_(t-1) + alpha * (load_t - EWMA_(t-1))
```

It then defines:

```text
loadBalanceAu = longTermLoadAu - shortTermLoadAu
```

Therefore:

- `loadBalanceAu < 0`: smoothed short-term load is above smoothed long-term load;
- `loadBalanceAu > 0`: smoothed short-term load is below smoothed long-term load;
- `loadBalanceAu ≈ 0`: both timescales are similar.

This balance is an **AU difference**, not a ratio and not ACWR. Its magnitude depends on the athlete's absolute load level: `-100 AU` does not necessarily have the same relative meaning for two athletes with very different histories.

The contract requires a 42-day warm-up and resets both EWMAs when daily evidence is unknown. This prevents a trend from being interpolated through gaps that could contain unobserved load.

## Findings from the literature

### 1. EWMA is useful as a smoothing technique, not as a diagnosis

EWMAs weight recent observations more heavily and can represent load changes without assigning equal weight to every observation in a window. They have been used in training-load research and acute/chronic load models.

However, short- and long-term periods are not universal physiological constants. Training-monitoring literature notes that fitness/fatigue decay rates may vary between athletes and sports, and commonly used windows such as 7/28 or 7/42 days should not be treated as individually validated physiological constants.

**Implication:** keep 7/42 as versioned MVP model parameters, not as validated individual physiological timescales.

### 2. Do not convert the EWMA difference into ACWR

Historical literature used ratios between acute and chronic load, including EWMA variants, and some studies found associations with injury in specific populations. Later methodological critiques identify important conceptual and statistical problems with ACWR and do not support using it as a causal load-management tool intended to reduce injury.

**Implication:** KAN-344 must not create `short/long`, `acute/chronic`, or "sweet spot" ratio bands. The existing difference is preferable as a descriptor of recent-load direction, but it must not be interpreted causally either.

### 3. Running evidence reinforces the need for caution

Evidence in runners does not support a universal weekly progression threshold. A large prospective cohort found an association between single-session distance increases and injury, while weekly ACWR and week-to-week changes did not show the expected association.

**Implication:** a smoothed internal-load trend may contribute to triage, but it must not produce messages such as "injury risk" or automatically prescribe load reduction.

### 4. Session-RPE remains a defensible input

sRPE × duration is a practical and widely used measure of internal training load. The limitation lies in downstream interpretation: high internal load may reflect deliberately demanding training, competition, a phase change, non-sport stress, or other factors. A trend alone does not determine a pathological response.

**Implication:** KAN-344 should describe **recent internal-load direction/change**, not "fatigue" or "overload".

## Why an absolute `loadBalanceAu` threshold is problematic

A rule such as:

```text
loadBalanceAu < -100 => review
```

would be difficult to defend because the value is expressed in absolute AU and scales with the athlete's habitual load. A global threshold would create poorly interpretable between-athlete comparisons.

Normalizing it as `shortTerm / longTerm` is also not recommended because that would conceptually recreate an ACWR.

## Recommendation for KAN-344

### Semantics

Create an **internal-load direction** signal rather than a risk signal:

```text
insufficient_data
stable_or_lower
recent_load_above_baseline
```

`recent_load_above_baseline` means only:

> Smoothed short-term internal load is above smoothed long-term internal load with sufficient evidence.

It does not mean fatigue, overload, injury, or maladaptation.

### Proposed v1 rule

Do not use a global AU threshold. In the first version, interpret only the **sign** of the balance once the series is `available`:

```text
latest.status != available
  => insufficient_data

loadBalanceAu === null
  => insufficient_data

loadBalanceAu < 0
  => recent_load_above_baseline

loadBalanceAu >= 0
  => stable_or_lower
```

The sign is mathematically equivalent to asking whether `shortTermLoadAu > longTermLoadAu`, without converting the magnitudes into a ratio.

### Why this signal does not independently escalate to `review`

A negative balance in isolation can be completely intentional during a loading week. Therefore this signal should not independently carry `review` semantics. It should act as a **contextual internal-load contributor** for KAN-263.

Example:

```text
KAN-261 semantic signal:
recent_load_above_baseline

by itself
=> descriptive information

+ contemporaneous KAN-262 systematic_excess
=> KAN-263 may consider convergence and elevate review priority
```

The escalation belongs to the KAN-345 convergence matrix, not KAN-344.

## Explainable magnitude

Although v1 classification uses direction only, preserve:

- `shortTermLoadAu`;
- `longTermLoadAu`;
- `loadBalanceAu`;
- evidence window;
- coverage;
- KAN-261 `ruleVersion`;
- KAN-344 interpretation `ruleVersion`.

This lets the coach inspect magnitude without the product claiming a clinical cutoff exists.

## Unknown evidence, warm-up, and discontinuity

The semantics must inherit the current protections:

- `warming_up` => `insufficient_data`;
- `insufficient_data` => `insufficient_data`;
- `latest === null` => `insufficient_data`;
- `loadBalanceAu === null` => `insufficient_data`;
- a gap with unknown load resets the EWMAs and requires a new warm-up before the trend becomes interpretable again.

A series that merely lacks evidence must never be labelled `stable_or_lower`.

## Recommended versioning

Keep the KAN-261 calculation version separate from the KAN-344 semantic version:

```text
sourceRuleVersion = srpe-duration-v1
interpretationRuleVersion = internal-load-direction-v1
```

This allows interpretation to evolve without rewriting historical evidence or pretending the original calculation changed.

## Rejected decisions

- ACWR or EWMA ratio.
- Load "sweet spot".
- Global absolute AU threshold.
- Population percentiles without a validated dataset.
- `recent_load_above_baseline = fatigue`.
- `recent_load_above_baseline = injury risk`.
- Using a signal during warm-up or after an unknown discontinuity.
- Automatically modifying the training plan.

## Consequence for KAN-345

The convergence matrix should consume a semantic input such as:

```text
internalLoad.direction = recent_load_above_baseline
internalLoad.status = available
```

together with explainable evidence, rather than reading `loadBalanceAu` directly and applying hidden thresholds.

This keeps KAN-263 as a domain compositor and prevents it from duplicating or contaminating KAN-261 logic.

## References

- Foster C, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109-115. PMID 11708692.
- Haddad M, et al. Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors. Front Neurosci. 2017. PMCID PMC5673663.
- Williams S, et al. Better way to determine the acute:chronic workload ratio? Br J Sports Med. 2017. Work that helped popularize EWMA weighting in this context.
- Impellizzeri FM, Tenan MS, Kempton T, Novak A, Coutts AJ. Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. Int J Sports Physiol Perform. 2020;15(6):907-913. PMID 32502973. DOI 10.1123/ijspp.2019-0864.
- Bourdon PC, et al. Monitoring Athlete Training Loads: Consensus Statement. Int J Sports Physiol Perform. 2017.
- Coyne JOC, et al. The Current State of Subjective Training Load Monitoring—a Practical Perspective and Call to Action. Related review literature on load modelling and individual decay assumptions.
- Nielsen and colleagues. How much running is too much? Identifying high-risk running sessions in a 5200-person cohort study. Br J Sports Med. 2025;59:1203ff. DOI 10.1136/bjsports-2024-109380.

## Recommended decision

Adopt `internal-load-direction-v1` as a **descriptive, versioned interpretation of internal-load direction**, based only on an available KAN-261 series. Use `recent_load_above_baseline` as a convergence contributor, never as a diagnosis or independent clinical alert.
