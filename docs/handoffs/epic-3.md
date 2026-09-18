# Epic 3 — Seguimiento individual, carga y catálogo competitivo

## Current status

Epic 3 Stories 1–10 are implemented through **KAN-282**. KAN-282 completes the epic with cross-cutting confirmation semantics and reusable unsaved-change protection.

Use current architecture and code/tests as authority. The durable KAN-281 contract is [`race-registration.md`](../architecture/competitions/race-registration.md); the older boundary document is the historical KAN-275 reservation.

## KAN-281 delivered behavior

- `RaceRegistration` is an effective individual registration scoped by explicit team + athlete and one concrete `RaceCourseReference`.
- Registration lifecycle is `registered | cancelled`; participation is separately `unknown | started | finished | dnf | dns`.
- Factual result stores nullable actual distance and elapsed time; null remains unknown and explicit zero remains known.
- Historical event/edition/course labels, edition date and nominal course facts are snapshotted.
- Persistence uniqueness is `teamId + athleteProfileId + raceEditionId`; same-edition course change is an explicit mutation, not a second registration.
- SQLite and Supabase persistence are aligned; final remote verification reported 36/36 application tables with RLS.

Coach surfaces support course-first bulk registration with Level 2 confirmation and partial success, explicit course change, RaceEdition lifecycle and participation/result editing, athlete-first registration with edition-scoped courses, and factual individual history.

Athlete disclosure uses a dedicated safe projection. **Plan -> Competition** shows upcoming effective registrations; **Stats -> Competition** shows historical factual participation/results. This presentation does not couple registration to TrainingGoal, CompetitionEntry, readiness or realized training.

## Preserved invariants

- Goal, planning entry, registration, participation/result and realized training are distinct facts.
- `unknown != 0`; missing evidence is not negative evidence.
- Registered does not imply started, finished, DNS or DNF.
- Nominal course distance is not actual covered distance.
- Historical accepted facts do not silently mutate with live catalog changes.
- Team/athlete isolation remains explicit.
- Athlete disclosure uses explicit allowlists/projections.

## Deliberate deferrals

KAN-281 does not implement organizer integrations, payment/bib/qualification/lottery/waitlist, official ranking/position/classification, performance prediction, automatic planning/goal/readiness/realized-training mutation, or authentication/tenant resolution. KAN-360 remains deferred. Pure visual/Tailwind polish identified during the walkthrough is deferred to a later UI/UX epic.

## Verified KAN-281 closure evidence

Fresh after the final production/UI changes and test reconciliation:

- `pn exec tsc --noEmit`: clean.
- `pn lint`: 0 errors / 7 warnings.
- focused reconciliation gate: 17/17 tests across 6 suites.
- `pn test`: 908/908 tests across 202 suites, 0 failed, 0 skipped.
- `pn build`: green.
- Supabase migration check: green.
- Supabase verifier: 36/36 application tables, 36/36 with RLS.
- Coach desktop manual walkthrough: functional registration, course change, lifecycle and participation/result flows validated after runtime fixes.
- Athlete mobile manual walkthrough: Plan/Competition and Stats/Competition separation validated with no functional errors reported.

## KAN-282 closure baseline\n\nKAN-282 establishes the shared three-level action-safety policy and reusable dirty-form/navigation guard documented in [`ux-action-safety.md`](../architecture/platform/ux-action-safety.md). Athlete deactivation and race-registration cancellation use Level 3 confirmation; activation/reactivation remain lower-risk direct transitions. Race-registration course change uses Level 2 contextual confirmation. Athlete Edit is the first end-to-end dirty-form adoption at dashboard scope.\n\nFresh KAN-373 closure evidence: focused action-safety/dirty-form regression tests green; `pnpm test` green; `pnpm lint` green; `pnpm exec tsc --noEmit` green; `pnpm build` green. Task-level manual walkthroughs validated Athlete Edit dirty/unchanged/restored/saved behavior, athlete deactivate/activate, registration cancel/reactivate, and course-change confirmation. Browser-native `beforeunload` UI remains browser-controlled; KAN-369 runtime instrumentation established that the dirty handler fired and applied the browser protection contract.\n\nFollow-up debt discovered during the walkthrough remains deliberately outside KAN-282: **KAN-374** owns future-date-of-birth validation and **KAN-375** owns ES/EN migration on untouched legacy athlete surfaces.\n\nKAN-282 is the second and final `harness-eval-v1` story. Compare its record with KAN-281 in `docs/agent-harness.md` before changing the harness.