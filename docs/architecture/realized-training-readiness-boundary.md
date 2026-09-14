# Realized training → readiness boundary

## Decision

H12/readiness consumes realized training from the same durable persistence boundary used by capture, history, and correction. Planned sessions, React/local component state, and temporary "completed" flags are not alternative sources of performed evidence.

`buildDurableRecentPreparation` is the database-backed entry point for recent-preparation summaries:

1. load `workout_logs` plus `workout_log_evidence` through `listRealizedTrainingRecordsForAthlete(athleteId, teamId)`;
2. normalize persisted evidence into `RealizedTrainingRecord`;
3. deduplicate only by stable identity;
4. evaluate data sufficiency and build `RecentPreparationSummary` from the deduplicated records.

## Why this matters

The UI may know that a card was just saved, but that state is presentation state only. Readiness must be reproducible after reload and must use the same durable evidence that a coach sees in the athlete history.

Likewise, a planned `Session` is never converted into performed evidence because it exists in the calendar. It contributes to plan-vs-real comparisons only when a realized record contains an explicit authoritative `sessionId` link.

## Legacy compatibility

Legacy `workout_logs` may have numeric zero defaults without a `workout_log_evidence` sidecar. Those rows remain readable, but zero values are ambiguous unless field-level knownness exists. The durable readiness boundary therefore preserves them as unknown metrics and surfaces the corresponding limitations instead of treating them as confirmed zero training.

This is deliberate:

- absence of evidence is not absence of training;
- unknown is not known zero;
- insufficient metric coverage must not become a false readiness confirmation.

## Corrections

A manual correction updates the live durable projection and appends an immutable audit record. Subsequent readiness evaluations consume the corrected live projection; they do not read stale component state or reconstruct current values from the audit trail.

Persisted readiness evaluations remain snapshots of what was evaluated at that time. A later correction does not silently rewrite an already-persisted historical evaluation.

## Deduplication

Stable-identity deduplication occurs before readiness sufficiency and aggregation. This prevents a duplicated imported activity from inflating volume, frequency, or other recent-preparation metrics. Manual records are never collapsed by date or metric similarity.

## Isolation

The loader requires both athlete and team scope. See `realized-training-isolation.md` for the security boundary and the pending PostgreSQL/RLS runtime gate.
