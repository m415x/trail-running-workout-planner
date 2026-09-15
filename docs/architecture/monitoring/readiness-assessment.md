# Individual readiness assessment

## Status

Epic 2 / H12 (`KAN-242`) evaluates mismatches between an athlete's recent **realized** preparation and an applicable competition demand. It complements H8 category-distance compatibility, H9 competition context, H10 competitive adjustment, and H11 integral planning review. It does not certify fitness to compete and it never mutates planning automatically.

This document starts with the KAN-243 audit of the data currently available for realized training and records the KAN-244 normalization boundary. Later H12 tasks may extend the contracts, but must preserve the source-of-truth rules below.

## KAN-243 audit: current realized-training sources

### `workout_logs` is the only durable candidate

Both SQLite and Supabase schemas contain `workout_logs`. A row is athlete-scoped and may reference the planned `session` and/or reusable `workout` that motivated the activity. It stores:

- athlete ID;
- optional Session and Workout references;
- activity date and day status;
- distance, duration and elevation gain;
- optional average heart rate;
- athlete feeling, RPE and notes;
- logged timestamp.

`WorkoutLog` / `LoggedWorkoutPayload` provide the corresponding application types.

A persisted log explicitly representing a performed activity is therefore the correct starting source for H12. A Session, GroupSessionPrescription, Workout template, Microcycle target, or planned competition is **not** realized training on its own.

### The current athlete logging UI is not durable evidence

`LogWorkoutDialog` collects activity data, but its current integration does not persist the payload. `useWorkoutCard.handleSaveSession()` only toggles the local React `isLogged` flag and ignores the payload. Closing/reloading the page therefore loses the apparent completion state.

Consequently H12 must not infer realized history from the current UI state. KAN-244+ must introduce an explicit persistence/normalization boundary before production readiness indicators consume these records.

### Planned values are currently prefilled into the realized form

`useLogWorkoutDialog()` initializes distance, duration and elevation from the planned Workout. On save it converts empty/invalid form values to zero.

This is convenient UX but is not sufficient provenance for H12: an untouched prefilled value does not prove the athlete actually performed that amount. The realized-training boundary must treat submitted values as athlete-reported observations only after explicit logging/persistence, not because they originated in a planned prescription.

## Data-quality gaps that H12 must resolve

### Unknown versus zero

The current database columns `distance_km`, `duration_min` and `elevation_gain` are non-null with default `0`; `rpe` also defaults to `0`. The current form similarly coerces empty values to zero.

For H12 this is semantically unsafe: `0` may mean a real zero, an omitted measurement, a UI default, or a legacy placeholder. Readiness calculations require `unknown` to remain distinct from numeric zero.

Existing zero-valued records must not be reinterpreted as known measurements without evidence.

### Day status is not equivalent to measurements

`status` can be `completed`, `partial`, `missed`, `pending`, or `rest`.

- `completed` / `partial` can indicate that training occurred, but do not make every numeric metric known.
- `missed` is an explicit athlete/application assertion and may be used only according to its provenance; absence of any row is **not** `missed`.
- `pending` and `rest` are not realized training exposure.

Readiness summaries must filter statuses explicitly and preserve uncertainty.

### Session linkage

A `workout_logs.session_id` FK is the strongest currently available linkage between a realized record and a prescribed Session. If it is present and valid, H12 may use it as the basis for plan-versus-real comparisons, subject to athlete/scope validation.

`workout_id` links to a reusable Workout/template and is not by itself proof that a specific prescription was performed.

If `session_id` is absent, H12 must not manufacture linkage from same date, title, distance or proximity. Such heuristics may be designed later but cannot be treated as authoritative in H12 v1.

### Provenance/source

The current schema has no explicit `source`/external activity identifier on `workout_logs`. The only implemented logging path is the manual in-app athlete dialog; integrations with Strava/Garmin/etc. are outside H12.

Any future importer must provide its own stable source identity before automatic deduplication can be trusted.

### Duplicate detection

There is currently no durable external source ID or uniqueness constraint that can prove two similar logs are duplicates. Same athlete/date/distance/duration is not enough: athletes may legitimately perform multiple sessions in one day.

Therefore H12 v1 must:

- never deduplicate merely by date or metric equality;
- treat distinct persisted rows as distinct unless they share a trustworthy stable source identity or an explicit replacement relationship;
- surface potentially ambiguous legacy data as a limitation instead of deleting exposure silently.

### Intensity

Available realized intensity evidence is `avgHr`, subjective `rpe` and `feeling`. These are not interchangeable with prescribed H6/H10 intensity fields (`zone`, `pamPercentage`, etc.).

H12 may derive intensity indicators only when the selected method has enough trustworthy data and a declared calculation. Missing HR must not be inferred from prescribed zone. RPE is athlete-reported perceived exertion and must remain labelled accordingly.

### Team isolation

`workout_logs` carries `athlete_id`, not `team_id`. Team ownership is obtained through `athlete_profiles.team_id`. Every H12 repository/query boundary must therefore constrain the athlete by the accepted team and must not retrieve arbitrary logs by athlete ID without verifying team scope.

## KAN-244 realized-training contract

The H12 domain introduces `RawRealizedTrainingRecord` as the persistence-facing input and `RealizedTrainingRecord` as the normalized analysis input.

Each numeric metric is represented as a discriminated `RealizedMetric`:

```text
known(value)
unknown(not_recorded | legacy_zero_ambiguous | invalid_value)
```

This is intentionally more explicit than the current database row. `0` is a valid known value only when the writer has evidence that the field was explicitly supplied. For legacy rows without field-level evidence, a non-zero finite value is usable evidence but a zero remains ambiguous.

Normalized records carry:

- exact team + athlete scope;
- optional authoritative Session linkage;
- status and activity date;
- normalized metrics;
- source provenance;
- quality classification;
- machine-readable limitations.

Initial quality classes are `usable`, `partial`, `non_exposure`, `explicit_missed`, and `ambiguous`.

### Deduplication contract

`deduplicateRealizedTrainingRecords()` only removes a duplicate when identity is trustworthy:

1. the same persisted log ID; or
2. the same explicit `source + sourceActivityId`.

Date, distance, duration, D+, HR, RPE, Workout ID, or similar values are never used as automatic duplicate identity. An imported row without an external stable identity remains present and is marked ambiguous instead of being silently discarded.

### Plan-versus-real contract

`hasAuthoritativeSessionLink()` is true only for an explicit persisted Session reference. H12 v1 does not infer prescription linkage from date or Workout template. Indicators comparing prescribed and realized load must require this boundary.

### Durable storage decision

The domain contract is intentionally introduced before the schema migration. When H12 adds durable write/read support in KAN-254, new `workout_logs` persistence must preserve:

- **nullable numeric metrics** so absence remains distinct from an observed zero; defaults of numeric zero must be removed for new writes;
- explicit `source` (initially `manual`);
- nullable stable `source_activity_id` for future importers;
- enough field-level evidence to distinguish an explicitly entered zero from a legacy/default zero while legacy records still exist;
- the existing explicit `session_id` linkage;
- team isolation through the athlete relationship and repository boundary.

The migration is deliberately deferred to KAN-254 so H12 introduces one coherent persistence change together with evaluation/review storage rather than speculative incremental migrations. Until then the pure normalizer is the compatibility boundary for legacy rows.

## Source-of-truth rules for H12

1. A prescribed Session/Prescription/Workout/Microcycle is planned state, never realized state by itself.
2. A durable realized record must be explicitly logged as an activity by/for the athlete.
3. No row means `unknown`, not zero exposure and not a missed workout.
4. Unknown metric values stay unknown; they are never imputed from the plan.
5. Plan-versus-real comparisons require an authoritative linkage, initially explicit `session_id`.
6. Same date/metrics do not establish duplication.
7. Realized intensity is based only on realized evidence and its declared method.
8. Queries and persistence are isolated by team + athlete.
9. H12 results are advisory evidence; they do not enter H11's planning write-set automatically.

## Initial quality interpretation

- **usable realized record:** explicit performed status with full trustworthy metric coverage required by the consumer;
- **partial record:** activity occurrence is credible but one or more dimensions are unknown;
- **non-exposure record:** pending/rest and other states that do not represent performed load;
- **explicit missed assertion:** `missed`, distinct from missing data;
- **ambiguous legacy record:** no trustworthy realized metric can be established from the persisted evidence.

An overall readiness evaluation may proceed only for indicators whose own sufficiency requirements are met. Missing one dimension does not necessarily invalidate every other dimension, but it must appear in coverage/limitations.

## Required follow-up

Subsequent tasks must:

- define data sufficiency/windows before computing summaries;
- build individual recent-preparation summaries from normalized realized records only;
- reuse H9/H10 competition demand and H10 impact phases;
- keep H8 compatibility, H10 planning treatment and H12 readiness alerts separate;
- persist evaluation evidence and coach decisions separately.

## Interpretation limits

Readiness alerts identify product-policy mismatches that merit coach review. They are not diagnoses, injury predictions, medical advice, race authorization, or proof of readiness. An assessed athlete with zero alerts means only that the evaluated rules did not detect a mismatch in the available data.