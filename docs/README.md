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

`docs/handoffs/` is temporary operational state, not an archive. Epic 4 story handoffs have been consolidated into `history/epic-4.md` and removed. The current operational handoff is [`handoffs/kan-375.md`](handoffs/kan-375.md), covering KAN-375 Athlete legacy ES/EN localization and closure. The prior KAN-409 baseline/gate reconciliation handoff remains available as [`handoffs/kan-409.md`](handoffs/kan-409.md). When no story is active, there is intentionally no required current handoff; new work must reconstruct from the latest completed epic history, relevant architecture, current code/tests and Jira.

## Agent harness

- [`agent-harness.md`](agent-harness.md) — `harness-eval-v1` context/tool discipline, behavioral evaluation and completed KAN-281/KAN-282 experiment record. `AGENTS.md` remains the operational authority.

Do not modify the published harness as incidental feature/epic bootstrap work. Any v2 change must be an explicit workflow decision based on the recorded experiment conclusions.

## Current baseline

Epics 1–4 are complete. Epic 4 is consolidated in [`history/epic-4.md`](history/epic-4.md). Its durable field-performance/execution contract is [`architecture/monitoring/field-performance-and-execution-guidance.md`](architecture/monitoring/field-performance-and-execution-guidance.md), with research rationale in [`research/epic-4-field-physiology-and-intensity-guidance.md`](research/epic-4-field-physiology-and-intensity-guidance.md).

No later epic should infer PAM/MAS/VO2max/HR from the 1000 m result or reintroduce flat-reference pace targets on variable terrain. Monitoring/Training Response, physiology and coach-owned planning remain distinct authorities.

Known deferred work includes legacy ES/EN migration, session/intensity terminology and semantics, date-derived microcycle selection, Trail/Hills duration semantics, KAN-407 SQLite upgrade-path reliability and KAN-374 athlete date-of-birth validation. These are inputs to later scoping, not incomplete Epic 4 acceptance.

Before defining the next epic, reconcile current `dev`, [`history/epic-4.md`](history/epic-4.md), relevant architecture and Jira. Do not rely on removed per-story handoffs or preliminary future-epic outlines.

## Other documentation

- [`research/`](research/) — scientific/product research and rationale. Research informs contracts but is not automatically implementation scope.
- [`product/`](product/) — product-facing documentation.
- [`glossary/`](glossary/) — terminology.
- [`superpowers/`](superpowers/) — implementation plans/workflow artifacts; completed plans must be clearly treated as historical rather than pending work.

## Reading rule

For new work, read `AGENTS.md`, this index, the current epic/story handoff when one exists, the latest completed epic history when relevant, and only the durable domain documents required by the scope. Then reconcile them with focused current code/tests and the complete Jira issue. Retrieve additional detail just in time instead of preloading the repository or relying on chat history.
