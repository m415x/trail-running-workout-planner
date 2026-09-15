# KAN-262 — Scientific foundations for a systematic planned-vs-realized volume signal

Status: research/design input for MVP. This document supports a coach-facing monitoring signal; it does **not** define a medical, injury-risk, overtraining, or fatigue diagnostic.

## Research question

KAN-262 needs to distinguish an isolated planned-vs-realized excess from a repeated pattern. The initial product hypothesis was to classify a pattern as systematic when the same dimension exceeded plan in 3 of the last 4 comparable sessions. Before adopting that rule, we reviewed evidence on training-load monitoring, running-related injury, acute/chronic windows, coach-athlete agreement, missing data, and trail-running specificity.

## Executive conclusion

The literature supports monitoring both external and internal training load longitudinally and supports paying attention to abrupt or repeated changes. It does **not** provide a scientifically validated universal rule such as `3 of 4 sessions`, `2 consecutive weeks`, `+10%`, `+20%`, or a universal ACWR band that can be interpreted as a biological threshold.

Therefore KAN-262 should **not** encode 3/4 as a scientifically established cutoff. For the MVP, the defensible approach is:

1. Treat the signal as **plan-adherence / coach-attention monitoring**, not injury prediction.
2. Evaluate external dimensions independently: duration, distance and elevation gain (D+). Do not combine heterogeneous units into one physiological score.
3. Preserve session-level deviations for explanation, but classify systematic excess primarily over a **rolling weekly/microcycle aggregation**, because training prescription and volume progression are commonly interpreted over weekly periods and individual sessions can vary intentionally within a microcycle.
4. Use a configurable, versioned product heuristic for persistence and magnitude; label it as such. A reasonable MVP starting heuristic is **2 consecutive evaluable microcycles above plan in the same dimension**, with sufficient coverage in each microcycle. This is a conservative operational rule, not a physiological threshold.
5. Keep magnitude (`+x%`, absolute delta) separate from attention (`none | info | review | priority`). Attention must incorporate persistence, magnitude, coverage and context rather than claiming a direct biological risk.
6. Do not use ACWR as a causal injury predictor or derive injury-risk labels from the signal.
7. Missing/unknown evidence must reduce confidence/coverage; it must never silently become zero load or normality.
8. Competition, taper, recovery and plan/cohort transitions are contextual modifiers requiring coach interpretation.

## What the evidence supports

### 1. Monitoring load is useful, but no single marker is definitive

The 2017 consensus on athlete training-load monitoring recommends a multidisciplinary view of internal and external load and frames monitoring as support for coaching and decision-making rather than a single deterministic metric. Halson's review similarly notes that no single fatigue marker has sufficiently strong evidence to serve as a definitive measure and emphasizes individualization.

**Product implication:** KAN-262 should emit an explainable signal, not a diagnosis. It should coexist with KAN-260 adherence, KAN-261 internal-load trends, athlete response/readiness, and coach judgement.

### 2. Training load and health outcomes are related, but thresholds are not universal

Systematic reviews report associations between training load and injury/illness in athlete populations, but direction and magnitude depend on the load variable, timeframe, sport and athlete. More recent methodological critiques conclude that existing training-load research cannot justify quantitative universal cutoffs for manipulating training to prevent injury.

The IOC consensus recognizes absolute and relative changes in load as relevant factors, while also emphasizing broader context and individualized monitoring.

**Product implication:** an excess-vs-plan signal is justified as a monitoring cue. A threshold such as +20% cannot be described as a universal injury threshold.

### 3. The running-specific evidence does not validate the 10% rule

A randomized trial in novice runners found that a graded program based on the 10% rule did not reduce running-related injuries compared with a standard program. A systematic review found very limited evidence that sudden training-load changes are associated with running-related injury and reported no clear difference between average weekly increases of 10% and 24% in the available evidence. An earlier GPS study observed large weekly progressions before injury in a small novice-running cohort, but explicitly concluded that no clear evidence for a safe progression threshold existed.

**Product implication:** do not implement `10% per week` as a safety boundary. Likewise, do not replace it with another unsupported universal percentage.

### 4. ACWR is unsuitable as the scientific foundation of KAN-262

ACWR literature is heterogeneous in variables, windows and reference categories. Methodological analyses identify problems with ratios, coupling, causal interpretation, time-window choices and missing data. A 2020 critique concluded that evidence did not support ACWR for training recommendations aimed at reducing injury risk. A recent meta-analysis still finds substantial heterogeneity and concludes that ACWR should not be used as a stand-alone causal or predictive model.

**Product implication:** KAN-262 should compare planned and realized work directly and longitudinally. It should not convert those values into an ACWR-based injury-risk category.

### 5. Weekly/microcycle aggregation is more defensible than a universal 3-of-4-session rule

The literature frequently summarizes training load over weekly periods, and week-to-week changes are common in research and practice. This does **not** validate a specific weekly cutoff, but it aligns the monitoring window with common programming units. By contrast, we found no evidence validating `3 of the last 4 comparable sessions` as a universal boundary for systematic excess.

Session-level comparison remains valuable: it identifies exactly where plan and execution diverged. However, an intentionally long session, race-specific workout or compensatory redistribution can produce a large session deviation without representing systematic excess in the microcycle.

**MVP recommendation:**

- retain session-level deviations as evidence;
- aggregate planned and realized values by athlete, dimension and applicable microcycle/week;
- classify a repeated pattern only after **2 consecutive evaluable microcycles** exceed plan in the same dimension;
- make `2` configurable and versioned;
- do not describe this persistence rule as a scientifically validated biological threshold.

Why two microcycles? It is the smallest longitudinal persistence rule that is genuinely more than an isolated week while remaining useful in an MVP. Longer persistence would delay coach feedback. This is a product trade-off informed by longitudinal monitoring principles, not a claim from a trial.

### 6. Magnitude should remain explicit and dimension-specific

External and internal loads represent different pathways. Distance, duration and elevation are not interchangeable. Trail running adds irregular terrain, ascent and especially eccentric demands associated with descent; the trail literature remains heterogeneous and does not provide universal conversion factors between these dimensions.

**Product implication:** calculate independently, for example:

- duration: planned minutes vs realized minutes;
- distance: planned metres vs realized metres;
- elevation gain: planned D+ vs realized D+.

For each dimension preserve absolute delta and relative delta only when the planned denominator is valid. Never sum percentages across dimensions.

### 7. Trail-running evidence argues for context, not a new magic coefficient

Systematic reviews of trail running describe large elevation changes, uneven terrain and meaningful muscular/neuromuscular stress, but injury-risk-factor evidence remains limited. Recent reviews emphasize heterogeneity and the multifactorial nature of trail-running demands.

**Product implication:** D+ deserves its own external-load dimension. Future capture of D- may add useful mechanical context, but KAN-262 should not infer a physiological equivalent from D+ or D- using an arbitrary multiplier.

### 8. Missing data are part of the model

A systematic review of missing data in training-load/injury research found that missingness was often poorly reported and that handling strategy can materially affect results.

**Product implication:** a microcycle is `evaluable` only when coverage meets an explicit versioned criterion. `unknown` realized evidence must not be imputed as zero. If coverage is insufficient, output `insufficient_data` and expose coverage to the coach.

### 9. Planned versus perceived/realized load can legitimately diverge

A systematic review/meta-analysis comparing coach-planned and athlete-perceived internal load found overall agreement but disagreement in some categories, particularly easy work. This reinforces that prescription and athlete experience are related but not identical constructs.

**Product implication:** deviation is information, not automatically an error. KAN-262 should flag a repeated external-volume mismatch for review; the coach decides whether it was intentional, acceptable or requires intervention.

## Recommended MVP signal semantics

### Pattern state

- `insufficient_data`: coverage cannot support interpretation.
- `within_plan`: no material excess under the configured rule.
- `isolated_excess`: an evaluable microcycle exceeds plan, but persistence is not established.
- `systematic_excess`: the same dimension exceeds plan for the configured number of consecutive evaluable microcycles (v1 recommendation: 2).

A gap/insufficient microcycle should break evidence of consecutiveness unless a future model explicitly handles missingness differently.

### Attention state

Keep attention separate from pattern:

- `none`: no current review cue.
- `info`: isolated deviation worth showing but not prioritizing.
- `review`: systematic excess with adequate evidence.
- `priority`: reserved for stronger **product-defined** combinations such as systematic excess plus materially larger magnitude and/or corroborating independent signals. It must never mean predicted injury, overtraining syndrome, or medical risk.

For v1, avoid assigning `priority` from volume excess alone until product validation with coaches establishes useful, explainable thresholds.

### Magnitude

For an evaluable dimension:

`delta = realized - planned`

`deltaPercent = (realized - planned) / planned * 100`

Only compute percentage when planned > 0 and units are directly comparable. Preserve the absolute values and unit for auditability.

### Threshold strategy

There is no evidence-based universal percentage to adopt. Therefore:

- thresholds belong in a versioned configuration;
- initial values must be labelled **MVP heuristics**;
- coach feedback and retrospective product data should be used to calibrate them;
- the UI should explain the rule used;
- future rule versions must be reproducible against historical evidence.

A useful implementation option is to keep magnitude categories configurable rather than hard-code a safety claim, e.g. `materialExcessPercent`. Its initial value should be chosen during product validation, not presented as a medical cutoff.

## Decision for the earlier 3-of-4 question

**Do not adopt `3 of last 4 sessions` as the primary scientific rule.**

Use session-level deviations as supporting evidence, but base `systematic_excess` on consecutive evaluable microcycles/weeks. For MVP v1, recommend `2 consecutive evaluable microcycles`, explicitly documented as a versioned operational heuristic.

This design has four advantages:

1. aligns better with how training volume is commonly programmed and summarized;
2. distinguishes persistence from a single unusual workout;
3. remains explainable to a coach;
4. does not pretend that the literature provides a universal biological threshold where it does not.

## What we should say to the coach

> EPT compares what was planned with what the athlete actually completed and looks for repeated deviations in the same volume dimension. A repeated signal is a prompt to review the athlete, not a diagnosis of fatigue, overload or injury risk. The coach can open the detail to see the planned and realized values, the period, data coverage and contextual factors that produced the signal.

## What we should not claim

- `+10%` or another percentage is universally safe/unsafe.
- `2 weeks` predicts injury.
- `3 of 4 sessions` is scientifically validated.
- ACWR identifies a causal injury-risk zone.
- excess volume proves physiological fatigue or overtraining.
- missing training records represent rest.
- D+ can be converted to equivalent flat distance or physiological load with a universal coefficient.

## References

1. Bourdon PC, et al. Monitoring Athlete Training Loads: Consensus Statement. Int J Sports Physiol Perform. 2017;12(Suppl 2):S2-161–S2-170. PMID 28463642. https://pubmed.ncbi.nlm.nih.gov/28463642/
2. Soligard T, et al. How much is too much? (Part 1) IOC consensus statement on load in sport and risk of injury. Br J Sports Med. 2016;50:1030–1041. PMID 27535989. https://pubmed.ncbi.nlm.nih.gov/27535989/
3. Halson SL. Monitoring training load to understand fatigue in athletes. Sports Med. 2014;44 Suppl 2:S139–147. PMID 25200666. https://pubmed.ncbi.nlm.nih.gov/25200666/
4. Drew MK, Finch CF. The Relationship Between Training Load and Injury, Illness and Soreness: A Systematic and Literature Review. Sports Med. 2016. PMID 26822969. https://pubmed.ncbi.nlm.nih.gov/26822969/
5. Eckard TG, et al. The Relationship Between Training Load and Injury in Athletes: A Systematic Review. Sports Med. 2018;48:1929–1961. PMID 29943231. https://pubmed.ncbi.nlm.nih.gov/29943231/
6. Kalkhoven JT, et al. Training Load and Its Role in Injury Prevention, Part I: Back to the Future. J Athl Train. 2020. PMID 32991701. https://pubmed.ncbi.nlm.nih.gov/32991701/
7. Kalkhoven JT, et al. Training Load and Its Role in Injury Prevention, Part 2: Conceptual and Methodologic Pitfalls. J Athl Train. 2020. PMID 32991699. https://pubmed.ncbi.nlm.nih.gov/32991699/
8. Impellizzeri FM, et al. Acute:Chronic Workload Ratio: Conceptual Issues and Fundamental Pitfalls. Int J Sports Physiol Perform. 2020. PMID 32502973. https://pubmed.ncbi.nlm.nih.gov/32502973/
9. Maupin D, et al. The Relationship Between Acute:Chronic Workload Ratios and Injury Risk in Sports: A Systematic Review. Open Access J Sports Med. 2020. PMID 32158285. https://pubmed.ncbi.nlm.nih.gov/32158285/
10. ACWR for predicting sports injury risk: systematic review and meta-analysis. 2025. PMID 41029871. https://pubmed.ncbi.nlm.nih.gov/41029871/
11. Acute:chronic workload ratio and load management for team sports: a multilevel meta-analysis. 2026. PMID 42662491. https://pubmed.ncbi.nlm.nih.gov/42662491/
12. Damsted C, et al. Is there evidence for an association between changes in training load and running-related injuries? A systematic review. PMID 30534459. https://pubmed.ncbi.nlm.nih.gov/30534459/
13. Buist I, et al. No effect of a graded training program on the number of running-related injuries in novice runners: a randomized controlled trial. PMID 17940147. https://pubmed.ncbi.nlm.nih.gov/17940147/
14. Nielsen RO, et al. Can GPS be used to detect deleterious progression in training volume among runners? PMID 22990565. https://pubmed.ncbi.nlm.nih.gov/22990565/
15. Inoue A, et al. Internal Training Load Perceived by Athletes and Planned by Coaches: A Systematic Review and Meta-Analysis. Sports Med Open. 2022;8:35. PMID 35244801. https://pubmed.ncbi.nlm.nih.gov/35244801/
16. Handling and reporting missing data in training load and injury risk research. PMID 36412175. https://pubmed.ncbi.nlm.nih.gov/36412175/
17. Epidemiology of Injury and Illness Among Trail Runners: A Systematic Review. PMID 33538997. https://pubmed.ncbi.nlm.nih.gov/33538997/
18. Trail running injury risk factors: a living systematic review. PMID 35022162. https://pubmed.ncbi.nlm.nih.gov/35022162/
19. Muscle, Neuromuscular, and Cardiac Damage in Trail Running: A Systematic Review. PMID 41718076. https://pubmed.ncbi.nlm.nih.gov/41718076/
20. Muñoz de la Cruz V, et al. Decoding Neuromuscular Fatigue in Trail Running: A Systematic Review Across Distances and Sex Differences. 2026. PMID 42114829. https://pubmed.ncbi.nlm.nih.gov/42114829/
