# Realized training deduplication

## Purpose

Realized training must never be collapsed because two records look similar. Same date, distance, duration, elevation, RPE or Session context are not reliable proof that two rows represent the same performed activity.

Deduplication is therefore identity-based only.

## Accepted identities

The system accepts two forms of trustworthy identity:

1. The persisted `workout_logs.id` itself.
2. A stable imported source identity represented by the pair `source + sourceActivityId`.

Manual entries do not receive a synthetic source identity. Two manual records with identical metrics on the same day remain two distinct records unless the exact persisted log ID is repeated in memory.

## Imported evidence

Imported evidence may provide `sourceActivityId`. It must be explicit and non-blank before it can participate in deduplication.

The current provenance boundary exposes the broad source value `imported`. Until provider-specific source values are introduced, future integrations must namespace `sourceActivityId` with their provider identity, for example:

```text
strava:123456789
coros:activity-987
```

This prevents collisions between providers while preserving the durable `source + sourceActivityId` uniqueness contract.

An imported record with no stable identity is not discarded. It remains visible and is reported as ambiguous so downstream readiness calculations can reason about provenance quality rather than inventing a heuristic duplicate.

## Persistence guard

`workout_log_evidence` already has a unique index on `(source, source_activity_id)` in both SQLite and Supabase schemas. Because SQL unique constraints permit multiple `NULL` values, manual rows with `sourceActivityId = NULL` remain independently valid.

The application-level deduplication function mirrors this persistence rule and additionally treats blank/whitespace source IDs as absent identity.

## Non-rules

The following must never be used as automatic duplicate keys:

- same athlete;
- same calendar day;
- same Session;
- same distance or duration;
- same elevation gain;
- matching RPE/heart rate;
- approximate timestamps;
- any weighted similarity score.

These signals may be useful for a future human review tool, but they are not authoritative identity.

## Future integrations

A provider adapter must normalize its upstream stable activity identifier before persistence. If the provider cannot offer a stable ID, the imported row may still be stored, but it must remain ambiguity-aware and must not silently replace another record.

No provider integration is implemented by KAN-293; this document only defines the boundary future adapters must satisfy.
