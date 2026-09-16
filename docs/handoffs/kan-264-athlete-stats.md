# KAN-264 — Athlete Stats handoff

## Status

KAN-264 / Historia 8 is complete and verified on 2026-09-15. The durable architecture and verification baseline live in [`docs/architecture/monitoring/athlete-stats-analytics.md`](../architecture/monitoring/athlete-stats-analytics.md).

Final reported local verification:

- `pn test` — 790/790 tests passed across 157 suites, 0 failures.
- `pn lint` — passed.
- `pn exec tsc --noEmit` — passed.
- `pn build` — passed.
- `pn i18n:check` — passed; 452 message leaves aligned ES/EN.
- Athlete responsive walkthrough — approved across the target form factors exercised during the story.

## Durable outcome

KAN-264 established consumer-neutral Training Analytics plus explicit Athlete Stats Projection allowlists. Athlete-facing Stats now has `/stats` plus Training, Load, Adherence and Competition detail routes. Evidence semantics preserve known zero, unknown, insufficient, valid empty and technical error as distinct states.

Athlete-facing presentation is mobile-first and uses the real Athlete shell. Analytics and projections remain locale-neutral; ES/EN copy belongs to the Stats message namespace. Coach-only Training Response/Readiness interpretation does not cross into athlete-facing contracts automatically.

## Baseline for the next story

The next Epic 3 story is KAN-281, **Registrar inscripciones y participación histórica en carreras**. It must start from `dev` after KAN-264 rather than from the Historia 8 implementation branch.

KAN-281 may assume:

- the competitive catalog `RaceEvent → RaceEdition → RaceCourse` is durable;
- `TrainingGoal`, `CompetitionEntry` and future `RaceRegistration` are independent facts;
- realized-training evidence is authoritative for performed training and must not be fabricated from a registration/result;
- `unknown != 0`, missing evidence is not negative evidence and known zero remains zero;
- team/athlete authorization and athlete-facing disclosure remain explicit boundaries.

The reserved registration boundary is documented in [`race-registration-boundary.md`](../architecture/competitions/race-registration-boundary.md). KAN-281 is responsible for designing the actual registration lifecycle, historical snapshot, participation/result evidence and persistence; KAN-275 deliberately did not decide those details.

## KAN-281 scope clarification agreed before implementation

For the KAN-281 MVP, `RaceRegistration` represents an **effective individual registration**, not an intention to register. A mere planned/intended competition remains represented by existing goal/planning concepts and must not create a registration.

The initial registration lifecycle therefore starts from an explicitly recorded registration and may later transition to cancellation. Participation/result evidence is a separate dimension: being registered does not imply starting or finishing, and absence of participation evidence must not be inferred as DNS/DNF.

This clarification is a design input for KAN-281; the complete contract still needs to be designed and documented before implementation tasks are created.

## Historical follow-ups from KAN-264

The following remain deliberately deferred and are not KAN-281 acceptance criteria unless Jira scope changes explicitly:

- desktop Athlete navigation/sidebar evolution;
- user-controlled accessibility text scaling;
- arbitrary/custom Stats period selection;
- athlete-facing Training Response/Readiness interpretation.
