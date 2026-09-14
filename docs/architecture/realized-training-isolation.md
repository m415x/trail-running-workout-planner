# Realized training isolation

## Purpose

Realized-training evidence is individual athlete data. A caller must not be able to create, read, link, or correct evidence that belongs to another athlete or another team.

This document records the isolation boundary introduced and verified by KAN-294. It complements the generic Supabase RLS verification rather than replacing it.

## Server-side ownership rules

### Athlete-facing capture and correction

Athlete-facing actions do not accept an authoritative athlete identity from the client.

- `createManualRealizedTrainingAction` resolves the current athlete on the server and overwrites any client-supplied athlete scope before persistence.
- `correctManualRealizedTrainingAction` resolves both the current athlete and the audit actor on the server. A client cannot choose either value.
- `getManualRealizedSessionStateAction` resolves the current athlete before looking up a realized row.

The repository also validates an explicit `Session` link against the authoritative athlete team. A session from another team is rejected with `cross_team_session` instead of being silently attached.

### Coach-facing reads

Coach-facing history starts with `getAthleteById`, whose lookup is scoped to the current team and excludes soft-deleted athletes. After that check, `listRealizedTrainingRecordsForAthlete` requires both `athleteId` and `teamId` and applies both predicates again at the repository boundary.

This duplication is intentional defense in depth: a future caller cannot obtain another team's history merely by bypassing the action and passing an athlete ID directly to the repository.

Correction-history reads first prove that the requested athlete belongs to the current coach team and then prove that the parent `workout_log` belongs to that athlete before returning audit rows.

## Persistence invariants

- `workout_logs.athlete_id` is the authoritative owner of realized evidence.
- `workout_log_evidence` is a sidecar of one `workout_log`; it does not define independent athlete ownership.
- `workout_log_corrections` is append-only audit data owned transitively through its parent `workout_log`.
- Session linkage is optional, but when present `Session.teamId` must equal the athlete's team.
- Similar dates, titles, or metrics never establish ownership or linkage.

## Supabase / RLS gate

`db/supabase/verify.ts` treats all application tables as protected resources and now includes `workout_log_corrections`. The Supabase gate must fail if that table is missing or if RLS is not enabled.

The current workstation does not have `SUPABASE_DIRECT_URL`, so runtime verification of the new table is deferred until a credentialed environment is available. KAN-294 must not be considered fully closed until the generated migration has been inspected/applied and `pn db:verify:supabase` confirms the table is present with RLS enabled.

The verifier currently checks RLS enablement, consistent with the repository's existing Supabase gate. It does not prove the semantic correctness of every policy expression; if direct client-side Supabase access is introduced, policy-behavior tests must become a separate explicit gate.

## Regression coverage

Credential-independent tests cover:

- cross-team `Session` linkage rejection;
- repository history requiring matching athlete and team scopes;
- another athlete in the same team not appearing in history;
- another team's athlete not appearing even when their ID is known;
- soft-deleted realized rows remaining excluded.

Actual PostgreSQL RLS verification remains an environment-dependent gate.
