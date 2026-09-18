# Epic 4 — Field physiology and intensity guidance research

Status: research baseline for Epic 4 reconstruction
Date: 2026-09-18

## Purpose

This document records the scientific/product research and MVP decisions used to reconstruct Epic 4 ("Fisiología"). It is durable implementation rationale and a coach-facing reference for the MVP discussion.

It does not claim to define laboratory-grade physiological zones. The MVP distinguishes observed performance, deterministic derivation, product policy and physiological interpretation.

## Product context

The coach already runs a 1000 m track time trial with the group on the last Thursday of each month. The track is 400 m and a fixed distance is operationally convenient because the coach can time athletes consistently.

Epic 4 v1 retains this established workflow. Future protocols may be added, but this epic must not build a generic multi-test platform prematurely. The monthly schedule is coaching practice, not a physiological invariant, so it is not hard-coded into the domain.

## Evidence reviewed

### 1000 m field test

A validation study in 51 healthy adults compared repeated 1000 m walk-run field tests with laboratory maximal tests. It reported high repeatability and correlation r=0.88 with laboratory VO2max. The authors proposed a VO2max equation but called for cross-validation in other populations.

Díaz et al., "Validation and reliability of the 1,000 meter aerobic test", PMID 10818810:
https://pubmed.ncbi.nlm.nih.gov/10818810/

App interpretation: a timed 1000 m is legitimate repeatable performance evidence. This does not establish that average 1000 m speed is an exact PAM/MAS measurement or that it identifies ventilatory/lactate thresholds.

### MAS and protocol dependence

A 5-minute field test showed strong association with maximal aerobic velocity from progressive testing (r=0.94 in one study). This supports useful field speed references while also showing that protocol matters.

Berthon et al., "A 5-min running field test as a measurement of maximal aerobic velocity", PMID 9088842:
https://pubmed.ncbi.nlm.nih.gov/9088842/

MVP decision: do not replace the coach's 1000 m protocol. Preserve only a cheap protocol identity seam for future tests.

### Training intensity is not one universal five-zone table

Research commonly describes endurance intensity using physiological domains separated by ventilatory/lactate thresholds, often represented as a three-zone model. Five-zone systems are useful coaching subdivisions, but their boundaries are not five independently measured physiological thresholds.

A systematic review also found that training-intensity distribution changes according to the quantification method: session RPE, heart rate, lactate, race pace or running speed.

Campos et al., systematic review, PMID 34749417:
https://pubmed.ncbi.nlm.nih.gov/34749417/

Casado et al., systematic review of highly trained/elite distance runners, PMID 35418513:
https://pubmed.ncbi.nlm.nih.gov/35418513/

MVP decision: Z1–Z5 remain the app/coach prescription language. They are not presented as five laboratory-determined physiological zones.

### Five-zone examples are references, not universal truth

A published five-zone proposal for runners maps MAS approximately to 43–56%, 57–68%, 69–79%, 80–93%, and 94–105%, with corresponding RPE ranges. The authors explicitly note inter-individual variability and that effectiveness of their proposal still requires testing.

Cerezuela-Espejo et al.:
https://pmc.ncbi.nlm.nih.gov/articles/PMC6167480/

An analysis of 92 sub-elite marathon plans used another five-zone classification combining HRmax, RPE, thresholds and session duration. Its RPE 1–10 bands were approximately Z1 1–2, Z2 3–4, Z3 5–6, Z4 7–8, Z5 9–10.

https://pmc.ncbi.nlm.nih.gov/articles/PMC11065819/

These sources support a five-zone coaching vocabulary plus subjective guidance, but do not validate copying a MAS table onto average 1000 m speed.

### Simple speed percentages remain approximations

One study found that <=64% and >=86% of maximal treadmill running speed produced conditions consistent with intensities below ventilatory threshold and above respiratory compensation threshold. It recommends combining speed percentages with Talk Test and RPE.

PMID 24790484:
https://pubmed.ncbi.nlm.nih.gov/24790484/

Limitation: maximal treadmill speed is not average 1000 m time-trial speed. These values cannot be transferred as validated 1000 m zone boundaries.

### Performance-pace prescription is useful but imperfect

A 2026 randomized crossover study in recreational runners compared HR-based and 5 km race-pace-based prescriptions. HR prescription produced more time inside prescribed zones for both low-intensity continuous and interval sessions. Pace remains useful but is not a perfect proxy for internal physiological intensity.

Ranieri et al., PMID 41875873:
https://pubmed.ncbi.nlm.nih.gov/41875873/

MVP implication: pace derived from the 1000 m test is an orientative execution reference, not the definition of physiological state.

### RPE and Talk Test provide equipment-free control

A review concludes Talk Test is practical and inexpensive; comfortable speech is generally possible below ventilatory/lactate threshold and becomes difficult above it.

Reed & Pipe, PMID 25010379:
https://pubmed.ncbi.nlm.nih.gov/25010379/

Experimental work showed participants could regulate steady-state running using Talk Test alone.

Woltmann et al., PMID 25536539:
https://pubmed.ncbi.nlm.nih.gov/25536539/

A 2022 review supports RPE and Talk Test as practical subjective methods while documenting their limitations.

Bok et al., PMID 35507232:
https://pubmed.ncbi.nlm.nih.gov/35507232/

MVP decision: RPE and Talk Test are first-class execution guidance, especially without HR evidence. They are not fallback fake measurements.

### Trail terrain changes the cost of pace

In experienced male trail runners, uphill trail running produced about 10.5% higher oxygen cost and 21% higher ventilation than matched treadmill running at the same slope, speed and distance.

PMID 34663199:
https://pubmed.ncbi.nlm.nih.gov/34663199/

MVP decision: track-derived pace is contextual. On climbs, technical terrain or materially different conditions, athletes prioritize prescribed effort/RPE/Talk Test over rigid pace.

## MVP conclusions

### 1. Meaning of the 1000 m test

Epic 4 v1 supports 1000m_track. Observed evidence includes athlete, evaluation date, protocol identity, fixed distance, elapsed time and appropriate provenance/notes. Average pace and speed are deterministic derivatives.

The app must not label average 1000 m speed as directly measured PAM/MAS.

### 2. What is not inferred

The MVP does not infer resting HR, maximum HR, lactate/ventilatory thresholds, VO2max, readiness, injury risk, diagnosis or global fitness from the 1000 m result. Unknown HR remains unknown.

### 3. Z1–Z5 semantics

Z1–Z5 remain prescription intent owned by planning/coaching. A zone may expose complementary execution references: RPE, Talk Test, orientative pace when a valid 1000 m reference exists, and HR only when valid HR evidence exists.

Missing one reference does not block execution when other guidance is available.

### 4. Pace policy

The product may calculate orientative pace ranges from the latest applicable 1000 m reference, but the mapping is versioned product/coaching policy, not physiological truth.

The legacy 50–60 / 60–75 / 75–85 / 85–95 / 95–105% table must not be silently promoted as scientifically validated for a 1000 m time trial.

Research does not support exact universal percentages of average 1000 m speed for every Z1–Z5 boundary.

Epic 4 therefore makes the mapping explicit/versioned, reviewable with the coach, applies percentages on speed rather than directly on min/km pace, labels resulting pace orientative, pairs it with RPE/Talk Test, and preserves policy/version for explainability where durable derived references are stored.

### 5. Coach validation required

Before finalizing the initial pace policy, validate what Z1–Z5 mean in this group's real coaching language: intended effort, typical sessions, RPE, conversational ability, current pace translation, and whether legacy percentages are intentional coaching policy or implementation residue.

### 6. Longitudinal interpretation

Repeated 1000 m tests create useful longitudinal performance evidence. Allowed factual analytics include current/previous time, absolute and percentage change, mathematical direction, time series and evidence availability.

A lower time is a faster/lower 1000 m result. It is not automatically "better physiology", "higher readiness" or a causal conclusion.

## Architecture consequences

Dependency direction:

1000 m evidence -> deterministic derivation -> applicable running reference -> versioned intensity-guidance policy -> execution guidance (pace, RPE, Talk Test, optional known HR).

In parallel:

1000 m evidence -> consumer-neutral physiology/performance analytics -> Coach/Athlete projections.

Key invariants:
- observed != derived;
- unknown HR != estimated HR;
- prescription != execution reference;
- pace reference != physiological threshold;
- new evaluation != silent rewrite of accepted planning;
- historical evidence is traceable;
- policy is versioned/explainable;
- monitoring/load/Training Response remain separate from physiology;
- team/athlete isolation applies end-to-end.

## Scope boundary

In scope:
- 1000 m track evidence/history;
- deterministic pace/speed;
- current/applicable running reference;
- versioned execution-guidance policy;
- Z1–Z5 guidance through pace + RPE + Talk Test and optional known HR;
- coach capture/history;
- athlete-safe/coach-safe longitudinal analytics/projections;
- migration away from ambiguous legacy physiology authority where required.

Deferred:
- multi-test selector/framework;
- Cooper, 5-minute, VAMEVAL/UMTT and laboratory protocols;
- device/platform integrations;
- inferred HRmax/resting HR from pace;
- laboratory-equivalent threshold determination;
- VO2max prediction;
- AI recommendations;
- readiness/Training Response inference from test performance;
- automatic mutation of accepted plans after a new test.

## Coach-facing MVP explanation

El test de 1000 m es una referencia periódica de rendimiento que el grupo ya puede medir de forma simple y repetible. La app usa el tiempo observado para calcular velocidad y ritmo, conservar la evolución y ofrecer ritmos orientativos para las zonas de entrenamiento. Esos ritmos no pretenden reemplazar una evaluación fisiológica de laboratorio: se acompañan con percepción de esfuerzo y Talk Test, y en trail el esfuerzo tiene prioridad sobre el ritmo cuando cambian pendiente o terreno. Si existe una referencia cardíaca fiable, puede mostrarse como señal adicional; si no existe, la app no la inventa.

## Research limitations

Much of the literature studies trained/elite runners, laboratory thresholds or different field protocols rather than this group's exact monthly 1000 m workflow. Exact Z1–Z5 percentages cannot be validated from the reviewed evidence for average 1000 m speed. Age, sex, training status, terrain, environment and protocol affect the relation between external pace and internal load.

The app therefore uses conservative language, explicit provenance and coach-validated/versioned policy rather than claiming individualized physiological thresholds.

## Decision record

1. Retain the coach's 1000 m track workflow as the only v1 field-test protocol.
2. Model it as observed performance evidence, not direct PAM/MAS measurement.
3. Preserve protocol identity for cheap future extensibility.
4. Derive average pace/speed deterministically.
5. Do not estimate missing HR metrics from the test.
6. Keep Z1–Z5 as planning/prescription language.
7. Resolve zones into multi-signal execution guidance.
8. Treat 1000 m-derived pace as orientative/contextual.
9. Make pace mapping explicit, versioned and coach-validated.
10. Reuse Training Analytics/projection boundaries for evolution.
11. Preserve Epic 2/3 invariants and never silently mutate planning from physiology.
