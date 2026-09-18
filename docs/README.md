# Documentation index

Durable project documentation is organized by purpose. Start here rather than relying on chat history or an old implementation branch.

## Architecture

Domain and technical contracts that current implementation should preserve unless a story explicitly changes them.

- [`architecture/README.md`](architecture/README.md) — architecture index.
- [`architecture/competitions/`](architecture/competitions/) — competitive catalog, classification, planning/goal integration, registration and competitive-history contracts.
- [`architecture/realized-training/`](architecture/realized-training/) — durable realized-training evidence, plan-real comparison and capture contracts.
- [`architecture/monitoring/`](architecture/monitoring/) — monitoring, Training Response and Athlete Stats analytics/disclosure contracts.
- [`architecture/planning/`](architecture/planning/) — planning-domain contracts.
- [`architecture/platform/`](architecture/platform/) — platform/infrastructure contracts.

### Monitoring baseline

- [`architecture/monitoring/athlete-stats-analytics.md`](architecture/monitoring/athlete-stats-analytics.md) — KAN-264 completed Athlete Stats architecture and disclosure baseline.
- [`architecture/monitoring/systematic-volume-excess.md`](architecture/monitoring/systematic-volume-excess.md) — versioned external-volume persistence/review signal.
- [`architecture/monitoring/training-response-convergence.md`](architecture/monitoring/training-response-convergence.md) — coach-review convergence/triage boundary; explicitly not a physiological diagnosis.
- [`architecture/monitoring/readiness-assessment.md`](architecture/monitoring/readiness-assessment.md) — individual readiness evidence boundary inherited from Epic 2.

### Competitive baseline

- [`architecture/competitions/race-catalog.md`](architecture/competitions/race-catalog.md) — RaceEvent → RaceEdition → RaceCourse identity and course-demand contract.
- [`architecture/competitions/race-registration.md`](architecture/competitions/race-registration.md) — implemented KAN-281 registration lifecycle, participation/result, historical snapshot, persistence/isolation and Coach/Athlete disclosure contract.
- [`architecture/competitions/race-registration-boundary.md`](architecture/competitions/race-registration-boundary.md) — historical KAN-275 reservation that preceded the implemented contract.

## History

Completed epics are consolidated here. History explains evolution and prior decisions; current architecture/code remain authoritative for present behavior.

- [`history/epic-1.md`](history/epic-1.md) — foundational coach/group/planning workflow.
- [`history/epic-2.md`](history/epic-2.md) — planning automation, safe persistence and readiness evidence.
- [`history/epic-3.md`](history/epic-3.md) — realized training, plan-real monitoring, load/triage, Athlete Stats, competitive catalog/registration and action safety.

## Handoffs

`docs/handoffs/` is temporary operational state, not an archive. Completed Epic 3 handoffs were consolidated into `history/epic-3.md`; future work should create/retain only the current or recent handoff required for safe resumption.

## Agent harness

- [`agent-harness.md`](agent-harness.md) — `harness-eval-v1` context/tool discipline, behavioral evaluation and completed KAN-281/KAN-282 experiment record. `AGENTS.md` remains the operational authority.

Do not modify the published harness as incidental feature/epic bootstrap work. Any v2 change must be an explicit workflow decision based on the recorded experiment conclusions.

## Current transition

Epic 3 is functionally complete through KAN-282. Use [`history/epic-3.md`](history/epic-3.md) for the consolidated evolution and the relevant architecture documents for current contracts.

The next epic must be reconstructed from the actual `dev` baseline rather than assuming preliminary future-story descriptions are still correct. In particular, monitoring/Training Response must remain distinct from measured physiology, and new physiological work must reuse existing planning/intensity/analytics boundaries instead of introducing parallel authority.

## Other documentation

- [`research/`](research/) — scientific/product research and rationale. Research informs contracts but is not automatically implementation scope.
- [`research/epic-4-field-physiology-and-intensity-guidance.md`](research/epic-4-field-physiology-and-intensity-guidance.md) — Epic 4 evidence review and MVP decisions for the 1000 m field test, execution guidance and physiology boundaries.
- [`product/`](product/) — product-facing documentation.
- [`glossary/`](glossary/) — terminology.
- [`superpowers/`](superpowers/) — implementation plans/workflow artifacts; completed plans must be clearly treated as historical rather than pending work.

## Reading rule

For new work, read `AGENTS.md`, this index, the current epic/story handoff when one exists, the latest completed epic history when relevant, and only the durable domain documents required by the scope. Then reconcile them with focused current code/tests and the complete Jira issue. Retrieve additional detail just in time instead of preloading the repository or relying on chat history.
