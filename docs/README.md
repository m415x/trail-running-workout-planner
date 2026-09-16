# Documentation index

Durable project documentation is organized by purpose. Start here rather than relying on chat history or an old implementation branch.

## Architecture

Domain and technical contracts that current implementation should preserve unless a story explicitly changes them.

- [`architecture/README.md`](architecture/README.md) — architecture index.
- [`architecture/competitions/`](architecture/competitions/) — competitive catalog, classification, planning/goal integration, persistence and future registration boundary.
- [`architecture/realized-training/`](architecture/realized-training/) — durable realized-training evidence and capture contracts.
- [`architecture/monitoring/`](architecture/monitoring/) — adherence/load/monitoring, Training Response and Athlete Stats analytics/disclosure contracts.
- [`architecture/planning/`](architecture/planning/) — planning-domain contracts.
- [`architecture/platform/`](architecture/platform/) — platform/infrastructure contracts.

### Current monitoring baseline

- [`architecture/monitoring/athlete-stats-analytics.md`](architecture/monitoring/athlete-stats-analytics.md) — KAN-264 completed Athlete Stats architecture and final verification baseline.

### Current competitive-registration starting point

- [`architecture/competitions/race-registration-boundary.md`](architecture/competitions/race-registration-boundary.md) — minimum target reserved by KAN-275. Lifecycle, participation/result evidence, snapshot and persistence are intentionally deferred to KAN-281.

## Handoffs

Use handoffs to reconstruct the transition between completed stories; architecture remains the durable domain authority.

- [`handoffs/epic-3.md`](handoffs/epic-3.md) — current Epic 3 operational baseline and next-story pointer.
- [`handoffs/kan-264-athlete-stats.md`](handoffs/kan-264-athlete-stats.md) — completed Historia 8 baseline for KAN-281.
- [`handoffs/kan-261-training-load.md`](handoffs/kan-261-training-load.md) — training-load v1 boundary.
- [`handoffs/kan-260-adherence.md`](handoffs/kan-260-adherence.md) — adherence boundary.

## Current story transition

Stories KAN-257 through KAN-264 are complete. The next Epic 3 story is **KAN-281 — Registrar inscripciones y participación histórica en carreras**.

Before KAN-281 implementation, the accepted MVP clarification is:

- `RaceRegistration` starts from an effective individual registration, not a mere intention to register;
- registration lifecycle is separate from participation/result evidence;
- being registered does not imply started/finished/DNS/DNF;
- absence of explicit participation/result evidence remains unknown;
- `TrainingGoal` and `CompetitionEntry` remain independent and do not create registrations automatically.

The complete KAN-281 contract still needs to be designed before Jira implementation tasks are created.

## Other documentation

- [`research/`](research/) — scientific/product research and rationale. Research informs contracts but is not automatically implementation scope.
- [`product/`](product/) — product-facing documentation.
- [`glossary/`](glossary/) — terminology.
- [`history/`](history/) — superseded/completed historical material retained for traceability.
- [`superpowers/`](superpowers/) — implementation plans/workflow artifacts; completed plans must be clearly treated as historical rather than pending work.

## Reading rule

For a new story, read `AGENTS.md`, this index, the relevant architecture documents and the latest completed-story handoff; then reconcile them with current code/tests and the complete Jira story before designing implementation tasks.
