# Realized training — story validation and walkthrough

## Scope

This document closes the implementation evidence for Epic 3 Story 2 (`KAN-258`). It complements the focused architecture documents; it does not redefine their contracts.

The story establishes durable realized training as evidence distinct from prescribed planning. A workout log may reference an official `Session`, but free training is valid with `sessionId = null`. Missing evidence is not equivalent to zero or to absence of training.

## Durable boundaries covered

- Manual capture persists occurrence time separately from recording time.
- Decimal duration is preserved.
- Known, unknown and known-zero metrics remain distinguishable through `workout_log_evidence`.
- Manual correction updates the live projection transactionally and appends a before/after audit record to `workout_log_corrections`.
- Deduplication requires stable persisted identity; metric/date similarity never invents identity.
- History reads require both team and athlete scope.
- Readiness consumes the durable realized-training boundary rather than prescribed sessions or client state.
- The coach history includes a five-week calendar projection of applicable prescribed sessions plus unplanned realized training. The projection reuses explicit session linkage and never treats planning as realized evidence.
- Day status is reconciliable: an expired session can be `missed` with the evidence currently available and later become `completed` or `partial` when late manual/imported evidence is linked.
- A realized workout without an official session remains extra training and contributes to realized load/readiness without being assigned to a prescribed session.

## Representative fixtures

`pn db:seed` now runs `db/seed-realized-training-fixtures.ts` after the base and race-catalog fixtures. The realized-training fixture uses Ana Acosta (`profile_user_2`) and creates relative dates in `America/Argentina/Buenos_Aires` so the walkthrough remains useful over time.

It includes:

1. a completed prescribed session with durable known metrics;
2. a partial prescribed session where average HR is explicitly unknown;
3. an expired prescribed session without realized evidence, suitable for validating `missed` reconciliation;
4. an extra realized workout with `sessionId = null` on a day without an official fixture session.

The three prescribed fixtures include group prescriptions attached to the applicable base-plan microcycle, so the calendar resolves them through the same planning hierarchy as production sessions. Fixture IDs use the `kan297_` prefix and inserts are idempotent through stable IDs plus conflict-safe insertion.

The seed is representative, not exhaustive production data. Automated tests remain the authoritative coverage for edge cases such as stable imported identity, rollback, cross-team/cross-athlete isolation, legacy zero ambiguity and late evidence reconciliation.

## Database evidence

The final Supabase migration for this story is `0015_wonderful_patriot.sql`. It creates `workout_log_corrections`, its foreign keys and indexes, and enables RLS. The previously versioned realized-training timing migration covers nullable `performed_at` and decimal duration.

Final environment verification reported:

- application tables: **35/35**;
- tables with RLS: **35/35**.

The Data API remains disabled. RLS enablement is a persistence/security gate and must not be interpreted as a future direct-client authorization design.

## Automated gate

The final pre-walkthrough gate reported:

- `pn tsc`: no errors;
- `pn test`: **643/643 passed**, **117 suites**, 0 failed;
- `pn lint`: **0 errors, 7 warnings**;
- `pn build`: successful;
- Supabase migration/verification: successful, 35/35 application tables and 35/35 with RLS.

The seven lint warnings are the current legacy baseline. No new warning is accepted silently; touched legacy follows the repository cleanup/i18n policy.

## Manual walkthrough

Run from a freshly seeded local database:

```bash
pn db:seed
pn dev
```

Use the normal development authentication/session and validate the following behavior.

### 1. History and durable detail

Open Dashboard → Athletes → Ana Acosta → realized-training history.

Expected:

- completed, partial and extra fixture records are visible in chronological history;
- performed time and recorded time are distinct where applicable;
- the partial fixture does not present unknown average HR as `0`;
- the extra workout is not presented as linked to an official session.

### 2. Correction traceability

Open an editable manual realized workout, change at least one metric and save it.

Expected:

- the live record reflects the correction;
- the form does not create a duplicate workout log;
- correction history shows actor/time and before/after evidence;
- original `loggedAt` is preserved by the correction contract;
- a validation failure keeps the entered form data and does not leave a partial write.

### 3. Day-state reconciliation

Inspect a week containing prescribed sessions and realized evidence.

Expected visual semantics:

- completed prescribed session → check indicator;
- partial prescribed session → minus indicator;
- expired prescribed session without evidence → missed/X;
- pending future session → pending indicator;
- extra realized workout without an official session → plus-circle indicator.

Then register late evidence for a previously missed session.

Expected: the session reconciles from `missed` to the evaluated realized status (`completed` or `partial`); `missed` is not terminal.

### 4. Free training

On a day without an official session, register a realized workout.

Expected:

- persistence succeeds with `sessionId = null`;
- the day exposes the extra-training indicator;
- reload/week navigation preserves it from durable storage;
- no prescribed session is fabricated or silently linked.

### 5. Isolation smoke check

From the coach dashboard, switch between athletes and inspect realized-training history.

Expected: one athlete's realized evidence never appears in another athlete's history. Automated repository tests provide the stronger team/athlete isolation regression.

## Interpretation limits

Realized training is evidence, not a medical conclusion. `completed`/`partial` describe comparison with prescription; extra training describes realized activity without an official session. These states can inform future adherence, load and fatigue features but do not diagnose injury risk or certify readiness.

External-device synchronization is not implemented in this story. The stable-identity, occurrence-time and reconciliable-status contracts are deliberately compatible with a future Strava/Garmin/import workflow without pretending that integration already exists.
