# Individual readiness assessment

## Status

Epic 2 / H12 (`KAN-242`) evaluates mismatches between an athlete's recent **realized** preparation and an applicable competition demand. It complements H8 category-distance compatibility, H9 competition context, H10 competitive adjustment, and H11 integral planning review. It does not certify fitness to compete and it never mutates planning automatically.

This document starts with the KAN-243 audit of the data currently available for realized training. Later H12 tasks may extend the contracts, but must preserve the source-of-truth rules below.

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

KAN-244 must define a normalized domain contract where each optional realized metric can be known or unknown. A schema migration may be required before H12 persists new logs, but existing zero-valued records must not be reinterpreted as known measurements without evidence.

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

KAN-244 must model source/provenance in the domain even if the initial supported source is only `manual`. Any future importer must provide its own stable source identity before automatic deduplication can be trusted.

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

KAN-244 will formalize the types, but the audit establishes these distinctions:

- **usable realized record:** explicit performed status plus at least one trustworthy realized metric;
- **partial record:** activity occurrence is credible but some requested dimensions are unknown;
- **non-exposure record:** pending/rest and other states that do not represent performed load;
- **explicit missed assertion:** `missed`, distinct from missing data;
- **ambiguous legacy record:** values such as default zeros whose known-ness cannot be proven.

An overall readiness evaluation may proceed only for indicators whose own sufficiency requirements are met. Missing one dimension does not necessarily invalidate every other dimension, but it must appear in coverage/limitations.

## Required follow-up from the audit

KAN-244 must define the typed realized-training normalization, provenance, quality and deduplication contract and decide the durable storage change required for new logs.

Subsequent tasks must then:

- define data sufficiency/windows before computing summaries;
- build individual recent-preparation summaries from normalized realized records only;
- reuse H9/H10 competition demand and H10 impact phases;
- keep H8 compatibility, H10 planning treatment and H12 readiness alerts separate;
- persist evaluation evidence and coach decisions separately.

## Interpretation limits

Readiness alerts identify product-policy mismatches that merit coach review. They are not diagnoses, injury predictions, medical advice, race authorization, or proof of readiness. An assessed athlete with zero alerts means only that the evaluated rules did not detect a mismatch in the available data.