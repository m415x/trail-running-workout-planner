# Realized-training flow audit

Story: KAN-258 — Record realized training durably  
Task: KAN-284 — Audit the legacy logging flow  
Branch: `h-23-realized-training`

## Objective

Identify which parts of the current workout logging flow can be reused and which must be replaced to make realized-training evidence durable and compatible with the H12/readiness boundary.

## Current flow

The visible flow starts at `WorkoutCard` and opens `LogWorkoutDialog` for a calendar session. The dialog delegates state and serialization to `useLogWorkoutDialog`.

At the time of this audit:

1. `LogWorkoutDialog` captures distance, duration, self-assessment/RPE and notes for a planned session.
2. `useLogWorkoutDialog` initializes several values from the prescribed workout.
3. `handleSave()` converts empty inputs to `0` through `parseFloat(...) || 0`, `parseInt(...) || 0` and equivalent defaults.
4. The resulting payload uses the legacy `LoggedWorkoutPayload` contract.
5. `WorkoutCard` passes that payload to `useWorkoutCard.handleSaveSession()`.
6. `handleSaveSession()` only calls `setIsLogged(true)`; this path has no server action or durable write.
7. Reloading or restarting loses the “logged” state.

The product flow therefore locally simulates a logged session but does not complete the persistent `workout_logs` + `workout_log_evidence` boundary.

## Legacy contract vs H12

### `LoggedWorkoutPayload`

The legacy contract requires or materializes the following as numbers:

- `distanceKm`
- `durationMin`
- `elevationGain`
- `rpe`

This prevents a reliable distinction between:

- a known value of zero;
- an unrecorded/unknown value;
- a form-derived default;
- a prescribed value copied as an initial value but not confirmed by the athlete.

### H12/readiness boundary

H12 already provides:

- `RealizedMetric` with `known` / `unknown` states;
- `RealizedMetricName` for distance, duration, D+, average heart rate and RPE;
- `RawRealizedTrainingRecord` / `RealizedTrainingRecord`;
- provenance (`source`, `sourceActivityId`, `loggedAt`, explicit `Session` linkage);
- `legacy_zero_ambiguous` semantics;
- deduplication by stable identity only;
- quality/limitations for partial or ambiguous data.

`workout_log_evidence` already acts as a sidecar to `workout_logs`, with `source`, `sourceActivityId` and `knownMetricFields`.

## What to reuse

### UI and composition

Reuse these as the foundation:

- `WorkoutCard` as the entry point from a planned session;
- `LogWorkoutDialog` as the visual/modal pattern;
- `SelfAssessment`, `RpeSelector` and existing controls;
- `ConfirmActionDialog` for destructive actions/corrections where appropriate.

Adapt the UI to the new contract rather than discarding it entirely.

### Persistence and domain

Reuse:

- `workout_logs` as the durable realized-training entity;
- `workout_log_evidence` for evidence/provenance and per-metric known state;
- H12 normalization in `lib/readiness/realized-training.ts`;
- `sessionId` as the only authoritative link to a planned session;
- H12 legacy/unknown/deduplication semantics.

Do not create a second parallel realized-training table/model.

## What to replace or modify

### 1. Local-only persistence

`useWorkoutCard.isLogged` cannot be the source of truth. Derive it from the existing durable record and update it after a successful persistent operation.

### 2. `empty -> 0` serialization

Remove automatic conversion of empty inputs to zero. The capture contract must explicitly carry known/unknown state or an equivalent representation that allows unambiguous construction of `knownMetricFields`.

### 3. Prescribed values treated as evidence

Planned distance, duration or D+ may serve as visual suggestions, but must not become “realized” merely because they were prefilled. Persistence must reflect values confirmed by the athlete.

### 4. Implicit linkage

Opening the dialog from a `Session` can supply an explicit `sessionId`. For unplanned records, `sessionId = null`. Do not infer associations from date, workout, title or metric similarity.

### 5. `LoggedWorkoutPayload` contract

It must stop being the authoritative persistence contract. It may be deprecated or become a temporary adapter, but the new flow must use a durable input aligned with H12.

### 6. Legacy delete/reset

“Reset log” currently only changes local state. The story must define durable, traceable editing/correction before exposing physical deletion as normal behavior.

## Identified risks

- Prefilling planned metrics can create false evidence if saved without confirmation.
- Using `|| 0` destroys the unknown/zero distinction required by H12.
- Local `isLogged` state can show a session as logged without persisted evidence.
- `workoutId` identifies a template/workout; it does not replace `sessionId` as the plan-to-realized link.
- Deduplicating by date or metrics would prevent two real workouts on the same day.

## Decisions for subsequent tasks

1. The new flow will always persist `workout_logs` + `workout_log_evidence` consistently/atomically.
2. Use `source = manual` for capture in this story.
3. Use `sourceActivityId = null` for manual capture unless a stable external identity exists in the future.
4. `knownMetricFields` will explicitly identify known metrics for new records.
5. Store a confirmed zero as `0` and include the corresponding field in `knownMetricFields`.
6. An unknown field must not appear in `knownMetricFields`; its persisted representation must not be reinterpreted as known zero.
7. Planning linkage will use only an explicit `sessionId`.
8. Unplanned records are valid with `sessionId = null`.
9. Readiness will continue consuming the existing H12 boundary; this story must feed that boundary rather than duplicate it.

## Recommended sequence

- KAN-285: durable known/unknown/zero capture contract.
- KAN-286: SQLite/Supabase persistence and log + evidence atomicity.
- KAN-287: durable repository/service.
- KAN-288/KAN-289: explicit linkage and unplanned records.
- KAN-290: adapt `LogWorkoutDialog` to the durable contract.

This audit does not yet change product behavior.
