# Documentation index

Durable project documentation is organized by purpose. Start here rather than relying on chat history or an old implementation branch.

## Architecture

Domain and technical contracts that current implementation should preserve unless a story explicitly changes them.

- [`architecture/README.md`](architecture/README.md) — architecture index.
- [`architecture/competitions/`](architecture/competitions/) — competitive catalog, classification, planning/goal integration, registration and competitive-history contracts.
- [`architecture/realized-training/`](architecture/realized-training/) — durable realized-training evidence, plan-real comparison and capture contracts.
- [`architecture/monitoring/`](architecture/monitoring/) — monitoring, Training Response and Athlete Stats analytics/disclosure contracts.
- [`architecture/planning/`](architecture/planning/) — planning-domain contracts.
- [`architecture/platform/`](architecture/platform/) — platform/infrastructure contracts, including the supported [SQLite local lifecycle](architecture/platform/sqlite-local-operations.md).

### Monitoring baseline

- [`architecture/monitoring/athlete-stats-analytics.md`](architecture/monitoring/athlete-stats-analytics.md) — KAN-264 completed Athlete Stats architecture and disclosure baseline.
- [`architecture/monitoring/field-performance-and-execution-guidance.md`](architecture/monitoring/field-performance-and-execution-guidance.md) — Epic 4 canonical 1000 m evidence, lifecycle, RunningReference and safe execution/presentation contract.
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
- [`history/epic-4.md`](history/epic-4.md) — canonical 1000 m evidence, RunningReference, execution guidance, factual evolution, lifecycle and safe Coach/Athlete integration.

## Handoffs

`docs/handoffs/` is temporary operational state, not an archive. The most recent completed-story baseline is [`handoffs/kan-410.md`](handoffs/kan-410.md), covering the canonical workout-type catalog and Sessions ES/EN boundary. Earlier KAN-407/KAN-375/KAN-409 handoffs remain only as recent navigation context until consolidated/removed. When no story is active, the most recent completed handoff is a bootstrap aid rather than execution authority: new work must still verify current `dev`, read only relevant durable domain docs, and then consult current Jira.

## Agent harness

- [`agent-harness.md`](agent-harness.md) — `harness-eval-v1` context/tool discipline, behavioral evaluation and completed KAN-281/KAN-282 experiment record. `AGENTS.md` remains the operational authority.

Do not modify the published harness as incidental feature/epic bootstrap work. Any v2 change must be an explicit workflow decision based on the recorded experiment conclusions.

## Current baseline

Epics 1–4 are complete. Epic 4 is consolidated in [`history/epic-4.md`](history/epic-4.md). Its durable field-performance/execution contract is [`architecture/monitoring/field-performance-and-execution-guidance.md`](architecture/monitoring/field-performance-and-execution-guidance.md), with research rationale in [`research/epic-4-field-physiology-and-intensity-guidance.md`](research/epic-4-field-physiology-and-intensity-guidance.md).

No later epic should infer PAM/MAS/VO2max/HR from the 1000 m result or reintroduce flat-reference pace targets on variable terrain. Monitoring/Training Response, physiology and coach-owned planning remain distinct authorities.

Post-KAN-410 baseline: the workout-type catalog is canonical, Sessions create/list/calendar/detail/edit and SessionForm use the modular ES/EN boundary, server-side Session errors cross the UI boundary as stable codes, and microcycle options expose structural data for localized composition. KAN-410 closed with 1183/1183 tests, lint/typecheck/i18n/build GREEN and an ES/EN walkthrough; its branch was integrated into `dev` at `5dfb36d035ce38e724a18b78c7b77371f1cc0bd8`. Jira-owned deferred work includes KAN-411 date-derived microcycle selection, KAN-412 legacy intensity-percentage reconciliation and KAN-413 `durationMin` semantics. Treat those keys as navigation pointers only until their current Jira state and complete issue content are read.

Before starting the next story, follow the fresh-chat bootstrap contract in `AGENTS.md`: current `dev` → this index → most recent relevant handoff → only relevant durable domain docs → focused code/tests → complete Jira issue/dependencies. Apply [`agent-harness.md`](agent-harness.md) as the workflow-discipline companion throughout the story without treating its historical experiment record as current product state.

## Other documentation

- [`research/`](research/) — scientific/product research and rationale. Research informs contracts but is not automatically implementation scope.
- [`product/`](product/) — product-facing documentation.
- [`glossary/`](glossary/) — terminology.
- [`superpowers/`](superpowers/) — implementation plans/workflow artifacts; completed plans must be clearly treated as historical rather than pending work.

## Reading rule

For new work, read `AGENTS.md`, this index, the current epic/story handoff when one exists, the latest completed epic history when relevant, and only the durable domain documents required by the scope. Then reconcile them with focused current code/tests and the complete Jira issue. Retrieve additional detail just in time instead of preloading the repository or relying on chat history.
