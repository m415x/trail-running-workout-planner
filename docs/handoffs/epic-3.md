# Epic 3 — Seguimiento individual, carga y catálogo competitivo

## Current status

Epic 3 Stories 1–9 are implemented through **KAN-281**. KAN-281 adds effective individual race registration, participation evidence and factual competitive history. The next story is **KAN-282 — Historia 10: Proteger acciones sensibles y cambios sin guardar en la UI**.

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

## Next story baseline — KAN-282

KAN-282 is the final Epic 3 story and owns cross-cutting UI action safety and unsaved-change protection. Start from [`ux-action-safety.md`](../architecture/platform/ux-action-safety.md). Reuse `ConfirmActionDialog`, the three-level action-safety policy and KAN-366 bulk registration as the first explicit Level 2 adoption.

KAN-282 should inventory sensitive lifecycle actions, apply consistent confirmation semantics, and design a reusable dirty-form/navigation guard. Race-registration lifecycle actions are part of the inventory surface, but KAN-282 should not reopen KAN-281 domain semantics.

Because KAN-282 is the second `harness-eval-v1` story, keep the harness unchanged and compare its closure trace with the KAN-281 evaluation before proposing v2.
