# Epic 4 — Field physiology and intensity guidance

## Purpose

This document records the research and architecture decisions behind Epic 4. It restores the research artifact referenced by KAN-376 and separates observed field evidence from later interpretation and training guidance.

## Operational context

The coach currently uses a fixed-distance 1000 m track test as a practical periodic control. The operational practice is to repeat it on the last Thursday of each month because a fixed distance makes elapsed-time comparison simple. That cadence is operational context, not a domain rule: Epic 4 does not automate the calendar.

Epic 4 v1 supports only the 1000 m track protocol. A generic multi-test framework and protocol selector are intentionally out of scope.

## Core evidence model

A 1000 m test is repeatable performance evidence. It is not, by itself, a direct measurement of PAM/MAS, VO2max, lactate threshold, maximum heart rate, resting heart rate, or blood-pressure-derived physiology.

Canonical observed evidence:

- athlete
- performed-at date/time
- protocol identity: `1000m_track`
- fixed distance: 1000 m
- elapsed time in seconds
- optional notes
- provenance
- persistence/audit metadata

Average pace and average speed are deterministic derivatives of distance and elapsed time. They must be recomputed from the observation rather than entered as independent authoritative values.

Missing heart-rate data remains unknown. No heart-rate value is inferred from elapsed time, pace, age, blood pressure, PAM, or another proxy.

## Provenance decision

For the current MVP, provenance distinguishes the two evidence origins that already exist:

- `source: 'coach_manual'` — the field-test observation was manually registered through the coach application boundary.
- `source: 'legacy_migration'` — valid observed 1000 m evidence was promoted from an explicit legacy `1000m_track` record during reconciliation.

This is the minimum truthful provenance contract for the current system, not a generic source framework.

This is deliberately narrow. It does not claim who physically timed the test, which individual user account typed the value, which device was used, or whether a particular sensor produced it. Those facts are not currently captured reliably and must not be invented.

Future ingestion paths may extend provenance with explicit source identities (for example device/import sources) only when a concrete use case requires them. Epic 4 v1 must not introduce a generic source framework pre-emptively.

## Historical and correction semantics

Field-test evidence is append-oriented. A new evaluation never overwrites a previous evaluation.

A correction validates the replacement first, invalidates the superseded row, and appends the replacement as a new row. Cross-athlete correction is rejected. Invalid replacement data must leave the original active.

The durable model therefore preserves historical facts and auditability without turning an edited value into an invisible overwrite.

## Legacy physiology reconciliation

The legacy physiology model mixes concepts such as PAM-labelled performance, heart-rate data, body measurements, and snapshots. It must not remain a second ambiguous authority for the new 1000 m evidence.

Only legacy records explicitly identified as the 1000 m track protocol may be promoted to canonical field-test evidence, and only when their observed facts validate under the new contract. Ambiguous/null/other test types are not reinterpreted.

Legacy source records are retained non-destructively for compatibility. Promotion is additive. Existing cardiac/body data is preserved as legacy data but is not made a requirement of the new field-test model.

## Epic 4 architecture

The intended flow is:

1. **KAN-376 — Evidence:** record trustworthy 1000 m observations and deterministic derivatives.
2. **KAN-377 — Running reference:** resolve an applicable current running reference from eligible evidence.
3. **KAN-378 — Guidance:** produce versioned Z1–Z5 execution guidance from the applicable reference.
4. **KAN-379 — Evolution:** expose factual history and changes over time.
5. **KAN-380 — UI integration:** surface physiology/performance safely in Coach and Athlete Stats.

The dependency direction is evidence → reference → guidance → history/UI.

A new test may create new evidence and later a new individual reference/guidance version. It must never mutate accepted workout planning or rewrite historical planning snapshots.

## Safety boundaries

Epic 4 must preserve these invariants:

- Coach remains the decision owner for training prescription.
- Observed evidence is distinct from derived performance values.
- Derived performance values are distinct from physiological interpretation.
- No unsupported inference of HRmax, HRrest, VO2max, PAM/MAS, thresholds, or blood-pressure-based running zones.
- Ambiguity is not evidence.
- Missing data remains unknown.
- Team/athlete isolation applies end-to-end.
- Historical evidence is not overwritten.
- Accepted planning is not mutated by new physiology evidence.

## Deferred questions

The following require later stories or explicit research and are not solved by KAN-376:

- how KAN-377 selects and versions the applicable running reference;
- how KAN-378 maps that reference to Z1–Z5 guidance and communicates uncertainty;
- whether future evidence sources need actor/device/import provenance;
- multi-protocol field testing;
- automated monthly scheduling;
- device ingestion and sensor-derived physiology.

These decisions should be revisited only with a concrete downstream requirement rather than by expanding the KAN-376 evidence model speculatively.
