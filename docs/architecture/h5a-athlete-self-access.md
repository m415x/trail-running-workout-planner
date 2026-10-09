# KAN-607 — H5A Athlete SELF access

## Authority (joint requirements)

Every H5A SELF read or mutation requires **all** of these server-proven facts:

1. An authenticated, valid H2 EPT `User`, resolved from the authenticated external identity.
2. A valid, currently active **Team and TeamMembership** for that User, respecting validity and revocation.
3. The specific effective SELF capability: `planning.self.read` for plan/session reads, or `workout_log.self.manage` for realized-training management.
4. A unique, active, nondeleted `AthleteProfile` owned by that User in that Team.

An AthleteProfile alone **never grants authority**. Membership preset, legacy `users.role`, `team_1`, or client-supplied athlete/session/workout/log identifiers cannot replace these conjunctive requirements. SELF capabilities are non-delegable and constrained to `SELF`; neither expands `planning.manage` nor confers authority over other profiles.

## Effective planning and session evidence

`getCurrentAthletePlanningWeek` resolves sporting SELF before reading effective week planning. The selected `sessionId` is a *locator*, not authority. `createH5aEffectiveSessionNextServerBoundary` resolves the current athlete and Team and validates persisted session, group history, dated planning-cohort membership, base or variant plan lineage, effective date, and matching group prescription. Same Team or a matching `sessionId` alone is insufficient; ambiguity, missing effective plan or mismatch returns DENY. The server's effective prescription wins over arbitrary client references.

## Realized-training read, capture and correction

- Home weekly realized-training range resolves SELF server-side and queries only that profile and Team. Empty successful records are distinct from denied/error.
- Manual capture derives `athleteId` from SELF. A linked capture requires an effective permitted session. A free capture explicitly uses `sessionId = null` and `workoutId = null`; it does not invent plan compliance.
- Manual correction resolves H2 actor and SELF owner, validates any replacement session, verifies persisted WorkoutLog ownership, and records corrected projection and append-only audit provenance transactionally. DENY must not mutate historical rows or snapshots.
- Historical and imported evidence remains conservatively readable but is not automatically editable. No delete operation is part of KAN-607.

## Athlete UI and failure semantics

Home/Plan/WorkoutCard/LogWorkoutDialog consume server-resolved data. `AthletePageState` uses the existing `CustomCard` presentation pattern; it never grants authorization. Weekly navigation distinguishes success with records, success empty, denied and error. DENY/error are never turned into `[]`; in-flight revalidation does not continue to disclose the former week's privileged projections. Feedback strings come from ES/EN `next-intl` messages. Read `docs/architecture/athlete-page-state-pattern.md` for concrete UI rules.

## Explicit exclusions and shared boundaries

KAN-607 does not extend Coach capabilities, H5B Stats, H4C membership/economics, H6, H7A or physiology. No new schema, migration or production identity provisioning is part of the H5A diff. Coach-facing realized-training services remain separate from Athlete SELF flows; any future modifications must assess their authorization independently.

## Traceable verification

Source of truth: `lib/authorization/h5a-self-context.ts`, `lib/authorization/h5a-self-next-server.ts`, `lib/athlete-planning/effective-self-session*.ts`, `lib/realized-training/manual-self-*-boundary.ts` and `app/actions/{dashboard,realized-training}-actions.ts`. Behavioral and SQLite tests in `tests/authorization`, `tests/athlete-planning`, `tests/realized-training`; UI contract and regression tests in `tests/athletes`. The exact candidate gate, PR and merge evidence belongs to the handoff, not to assumptions about earlier SHAs.
