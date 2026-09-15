# KAN-263 — Scientific basis for training-load/response review indicators

Review date: 2026-09-14

## Product question

Do the currently available data responsibly support detecting "possible overload", or should the product model a more conservative signal indicating that an athlete's training load/response requires coach review?

## Executive conclusion

The evidence supports longitudinal and contextual monitoring of external load, internal load, and subjective responses. It does not support turning an isolated metric, a universal percentage rule, or a simple combination of loads into a diagnosis of fatigue, overtraining, or injury risk.

KAN-263 should therefore model **human review priority based on convergence of independent signals**, not a clinical "overload" classifier. The domain must preserve contributing signals, coverage, time window, planning context, and rule version.

## Significant findings

### 1. Overload is necessary for adaptation; overload plus insufficient recovery can become problematic

The joint ECSS/ACSM consensus distinguishes functional overreaching, non-functional overreaching, and overtraining syndrome (OTS). Successful training requires overload, while problems may arise when excessive stimulus is combined with insufficient recovery. Distinguishing NFOR from OTS is difficult and depends on clinical outcome and exclusion of other diagnoses.

**Implication:** high load or excess relative to plan cannot automatically be labelled pathological. KAN-263 should surface evidence for review, not diagnose OTS/NFOR.

Source: Meeusen et al. (2013), ECSS/ACSM joint consensus statement. PubMed PMID 23247672. DOI 10.1249/MSS.0b013e318279a10a.

### 2. Subjective measures are useful for monitoring, but are not diagnoses

The systematic review by Saw, Main, and Gastin included 56 studies and found that subjective wellbeing measures responded to acute and chronic load changes with greater sensitivity and consistency than many commonly used objective measures. Subjective wellbeing tended to worsen as load increased and improve as load decreased. However, subjective and objective measures did not show a consistent association.

**Implication:** RPE/Feeling/wellness are valuable complementary information. Lack of correlation with an objective measure does not automatically invalidate a subjective signal, but an isolated value cannot be interpreted as injury or clinical fatigue. This supports future KAN-342 and later multimodal composition.

Source: Saw AE, Main LC, Gastin PB (2016), British Journal of Sports Medicine. PMID 26423706. PMCID PMC4789708.

### 3. Session-RPE is a valid internal-load monitoring method

Reviews of the session-RPE method report evidence of validity, reliability, and practical usefulness across multiple sports, ages, and competitive levels. Load is obtained by combining perceived session exertion with duration. Contextual factors that can alter RPE should also be considered, and other measures may be useful depending on the setting.

**Implication:** KAN-261 provides a defensible internal-load monitoring signal. KAN-263 must preserve it as an independent domain and must not reinterpret it as injury probability.

Sources: Foster et al. (2001), J Strength Cond Res, PMID 11708692; Haddad et al. (2017), Session-RPE Method for Training Load Monitoring, PMCID PMC5673663.

### 4. Load and injury: plausible association, limited individual prediction

The IOC consensus on load and injury risk states that inappropriate load management can contribute to risk within a multifactorial phenomenon. This does not imply a universal threshold capable of predicting injury in an individual athlete.

In runners, a systematic review of training-load changes found very limited evidence. Three of four included studies observed some association with load increases, but the commonly cited "10% rule" was not supported and no well-defined hazardous threshold could be established.

A later review of 36 prospective studies and 23,047 runners concluded that evidence linking distance, duration, frequency, intensity, or recent changes to injury was conflicting. It recommends caution when prescribing supposedly optimal progression and emphasizes the multifactorial nature of running injuries.

**Implication:** KAN-263 must not implement rules such as `>10% = risk`, `>30% = probable injury`, or equivalents. Volume excess may contribute to a review signal, but it is not a clinical injury-risk estimator.

Sources: Soligard et al. (2016), IOC consensus, PMID 27535989; Damsted et al. (2018), PMID 30534459 / PMCID PMC6253751; Fredette et al. (2022), PMCID PMC9528699.

### 5. Individual response and context matter

Training-monitoring literature emphasizes intra- and inter-individual variability, as well as influences from sleep, stress, recovery, environment, hydration, and other factors. The same external load does not necessarily imply the same internal response between athletes or within the same athlete at different times.

**Implication:** when possible, longitudinal signals should favour within-athlete evolution and context over rigid population thresholds. KAN-263 should compose states already interpreted by their source domains rather than indiscriminately normalizing heterogeneous magnitudes.

### 6. Single-item wellness measures have practical value but heterogeneous relationships

A systematic review of single-item athlete wellbeing measures found relationships between fatigue, soreness, sleep, stress, mood, and training load ranging from null to large, with predominantly trivial-to-moderate associations in studies with more observations. The authors call for further work on measurement properties and relationships with clinically meaningful outcomes.

**Implication:** a simple `FeelingSelector` may be useful as a practical longitudinal signal, but its semantics and scale must be investigated before it is incorporated into triage rules. It should not be rushed into KAN-263; that work belongs to KAN-342.

Source: Duignan et al. (2020), Single-Item Self-Report Measures of Team-Sport Athlete Wellbeing..., PMCID PMC7534939.

## Decisions the evidence does NOT justify

1. Diagnosing fatigue, injury, NFOR, or OTS from the currently available data.
2. Predicting individual injury from volume, sRPE, or adherence in isolation.
3. Adopting the weekly 10% rule as a universal scientific limit.
4. Applying a single load threshold to every athlete and planning phase.
5. Treating missing data as a normal state.
6. Adding heterogeneous magnitudes (km, minutes, elevation gain, sRPE) into an unvalidated score.
7. Treating `acknowledged` as physiological resolution of a signal.

## Recommended design for KAN-263

### Semantics

Use an operational domain name such as **`training_response_review`**. The contract must describe a training response/load state that requires human review rather than assert clinical overload.

### v1 inputs

Compose only implemented domains with stable semantics:

- KAN-260: adherence;
- KAN-261: longitudinal internal load;
- KAN-262: systematic external-volume excess;
- existing microcycle/competition context.

KAN-342 (longitudinal RPE/Feeling) should be incorporated only after its own research and independent design are complete.

### v1 output

The composition should produce an operational review priority, for example:

- `none`: no convergent evidence requiring review;
- `info`: an isolated/informational signal;
- `review`: sufficient evidence for coach review;
- `priority`: multiple relevant independent signals converge and justify earlier review, without clinical meaning.

`priority` means **coach work-order/review priority**, never medical severity.

### Convergence principle

Do not add arbitrary points. Preserve each source signal and apply explicit, versioned convergence rules. Conceptual example, subject to design and tests:

```text
systematic external-volume excess
              +
internal-load direction above baseline
              |
              v
priority review candidate
```

Adherence can provide important context, but low adherence caused by omitted sessions must be distinguished from behaviour that increases load; not all low adherence indicates overload.

### Unknown evidence and coverage

If a source is not evaluable, it must remain `unknown`/insufficient and reduce composition coverage. Absence of a signal cannot count as negative evidence when the underlying data are actually missing.

### Explainability

Every output must make it possible to answer:

- Which signals contributed?
- What period was evaluated?
- What data were missing?
- What planning/competition context was present?
- Which rule version produced the priority?
- What did the coach review/acknowledge?

## Architectural options considered

### A. Composite numeric score

Assign points to adherence, internal load, and external excess, then apply thresholds.

**Advantage:** easy to sort and display.

**Problem:** weights and thresholds would be difficult to defend scientifically with the current data; the score hides heterogeneity and can create false precision.

**Recommendation:** do not use for v1.

### B. Explicit convergence rules — recommended

Each domain retains its signal. A triage layer evaluates explicit, versioned combinations and returns `none/info/review/priority` together with contributors and unknowns.

**Advantages:** explainable, auditable, testable, extensible to KAN-342, and avoids false precision.

**Cost:** combinations and precedence must be designed carefully.

### C. Display signals without composition

The dashboard presents KAN-260/261/262 separately and the coach integrates them mentally.

**Advantage:** minimal algorithmic inference.

**Problem:** it does not solve rapid triage when many athletes must be reviewed.

**Recommendation:** useful as a fallback/detail view, insufficient as the final KAN-263 objective.

## Main references

- Meeusen R, et al. Prevention, diagnosis, and treatment of the overtraining syndrome. Med Sci Sports Exerc. 2013;45(1):186-205. PMID 23247672. DOI 10.1249/MSS.0b013e318279a10a.
- Saw AE, Main LC, Gastin PB. Monitoring the athlete training response: subjective self-reported measures trump commonly used objective measures: a systematic review. Br J Sports Med. 2016. PMID 26423706. PMCID PMC4789708.
- Foster C, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109-115. PMID 11708692.
- Haddad M, et al. Session-RPE Method for Training Load Monitoring: Validity, Ecological Usefulness, and Influencing Factors. Front Neurosci. 2017. PMCID PMC5673663.
- Soligard T, et al. How much is too much? (Part 1) IOC consensus statement on load in sport and risk of injury. Br J Sports Med. 2016;50:1030-1041. PMID 27535989.
- Damsted C, et al. Is there evidence for an association between changes in training load and running-related injuries? Int J Sports Phys Ther. 2018;13(6):931-942. PMID 30534459. PMCID PMC6253751.
- Fredette A, et al. The Association Between Running Injuries and Training Parameters: A Systematic Review. J Athl Train. 2022;57(7):650-671. PMCID PMC9528699.
- Duignan C, et al. Single-Item Self-Report Measures of Team-Sport Athlete Wellbeing and Their Relationship With Training Load: A Systematic Review. Sports Med Open. 2020. PMCID PMC7534939.

## Decision status

The evidence supports **Option B: explicit, versioned convergence rules that prioritize human review**, while keeping source signals separate and explainable. The approved implementation direction is to define an operational interpretation of KAN-261 first, then design the KAN-345 convergence matrix before implementing the triage engine.
