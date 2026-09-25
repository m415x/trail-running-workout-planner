# Field performance and execution guidance

## Scope

This document is the durable Epic 4 contract for canonical 1000 m field-performance evidence, running-reference resolution, execution guidance, factual evolution, and safe Coach/Athlete presentation.

## Canonical evidence

The supported field protocol is `1000m_track`. Canonical evidence stores the observed athlete, performed date, protocol, fixed 1000 m distance, elapsed seconds, notes and provenance/lifecycle metadata. Pace and average speed are deterministic derivatives, not independent evidence.

A 1000 m result does not measure PAM/MAS, VO2max, threshold, HRmax, resting HR or blood-pressure-derived physiology. Missing physiology remains unknown.

Official evidence is tied to a stable TestEvent. Self-directed evidence cannot reference a TestEvent. Recorder role and recorder user identity are independent provenance dimensions.

## Lifecycle and eligibility

Evidence history is append-oriented. Correction invalidates the original row and appends a replacement rather than overwriting the observation.

Review lifecycle is `pending_review | accepted | rejected`. Active accepted evidence is analytically eligible. Legacy rows without lifecycle metadata are treated as accepted by construction. Pending, rejected and invalidated rows are excluded from RunningReference and factual evolution.

## Running reference and evolution

RunningReference resolves the latest eligible observation applicable on or before an explicit effective date. It exposes the source evaluation plus deterministic pace and average speed.

Evolution compares eligible observations factually. Lower elapsed time is faster, higher elapsed time is slower, and equal elapsed time is stable. These changes are not interpreted as fitness, readiness or adaptation.

## Execution guidance

Z1-Z5 and explicit quality percentages are separate prescription systems.

An explicit percentage may produce deterministic pace/speed guidance from an applicable RunningReference in level/road/track contexts. Z1-Z5 does not imply a percentage of the 1000 m reference and does not generate BPM.

Heart-rate guidance may be shown only from explicit athlete HR evidence or a future validated sensor source. The system does not invent HR values.

For Trail, Hills or known positive grade, intensity intent remains valid but level-track pace/speed is not presented as an execution target. Execution is effort-led; RPE/Talk Test may support the athlete. Coach notes are the surface for context-specific instructions such as prioritizing effort over pace.

`GroupSessionPrescription.durationMin` is explicit coach-planned group duration in minutes. Absence is null/unknown; a planned value is positive and is distinct from realized duration and from any athlete-specific duration estimate.

On Trail/Hills, planned group duration may remain visible, but it must not be converted into athlete-facing pace/speed or presented as an individual predicted completion time. Individual trail-time estimation remains outside the current contract.

## Persistence and isolation

SQLite and Supabase schemas preserve the same field-performance lifecycle/provenance dimensions. Supabase migrations enable RLS for field-performance evidence and TestEvents, and the verifier checks application-table and RLS coverage.

Application boundaries resolve the owned/self athlete before reads or mutations. Cross-athlete evidence is not exposed through correction/review boundaries.

SQLite is currently the runtime repository for these server actions; Supabase schema/migrations/RLS provide the corresponding deployment contract and must not be described as protecting SQLite calls directly.

## Safety invariants

- `unknown != 0`.
- Observed evidence, deterministic derivatives and physiological interpretation are distinct.
- No unsupported HR/PAM/MAS/VO2max/threshold inference.
- Historical observations are not silently overwritten.
- New physiology evidence does not mutate accepted planning.
- Team/athlete isolation and semantic disclosure are separate boundaries.

Research rationale and citations remain in `docs/research/epic-4-field-physiology-and-intensity-guidance.md`.
