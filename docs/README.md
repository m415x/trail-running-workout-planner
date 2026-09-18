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

### Current competitive-registration baseline

- [`architecture/competitions/race-registration.md`](architecture/competitions/race-registration.md) — implemented KAN-281 registration lifecycle, participation/result, historical snapshot, persistence/isolation and Coach/Athlete disclosure contract.
- [`architecture/competitions/race-registration-boundary.md`](architecture/competitions/race-registration-boundary.md) — historical KAN-275 reservation that preceded the implemented contract.

## Handoffs

Use handoffs to reconstruct the transition between completed stories; architecture remains the durable domain authority.

- [`handoffs/epic-3.md`](handoffs/epic-3.md) — current Epic 3 operational baseline and next-story pointer.
- [`handoffs/kan-264-athlete-stats.md`](handoffs/kan-264-athlete-stats.md) — completed Historia 8 baseline for KAN-281.
- [`handoffs/kan-261-training-load.md`](handoffs/kan-261-training-load.md) — training-load v1 boundary.
- [`handoffs/kan-260-adherence.md`](handoffs/kan-260-adherence.md) — adherence boundary.

## Agent harness

- [`agent-harness.md`](agent-harness.md) — `harness-eval-v1` context/tool discipline, behavioral evals and the two-story evaluation protocol. `AGENTS.md` remains the operational authority.

The final two Epic 3 stories intentionally use the same harness version. Record observations at story closure; do not tune v1 between stories unless a rule creates a blocking safety/correctness failure.

## Current story transition

KAN-281 — Historia 9 is implemented and verified. Its durable contract is `architecture/competitions/race-registration.md`; the current Epic 3 handoff contains the exact next-story baseline. RaceRegistration is an effective individual registration, registration lifecycle remains separate from participation evidence, and missing evidence remains unknown.

The final Athlete information architecture keeps upcoming effective registrations under Plan -> Competition and historical factual participation/results under Stats -> Competition without coupling registration to planning or realized training.

## Other documentation

- [`research/`](research/) — scientific/product research and rationale. Research informs contracts but is not automatically implementation scope.
- [`product/`](product/) — product-facing documentation.
- [`glossary/`](glossary/) — terminology.
- [`history/`](history/) — superseded/completed historical material retained for traceability.
- [`superpowers/`](superpowers/) — implementation plans/workflow artifacts; completed plans must be clearly treated as historical rather than pending work.

## Reading rule

For a new story, read `AGENTS.md`, this index, the current epic handoff and only the relevant durable domain documents; then reconcile them with focused current code/tests and the complete Jira story. Retrieve additional detail just in time instead of preloading the repository or relying on chat history.
