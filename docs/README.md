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

`docs/handoffs/` is temporary operational state, not an archive. Completed Epic 3 handoffs were consolidated into `history/epic-3.md`. The current operational baseline is [`handoffs/kan-401.md`](handoffs/kan-401.md), which records the durable 1000 m TestEvent, provenance, review lifecycle and analytical-eligibility contract built on KAN-376..379.

## Agent harness

- [`agent-harness.md`](agent-harness.md) — `harness-eval-v1` context/tool discipline, behavioral evaluation and completed KAN-281/KAN-282 experiment record. `AGENTS.md` remains the operational authority.

Do not modify the published harness as incidental feature/epic bootstrap work. Any v2 change must be an explicit workflow decision based on the recorded experiment conclusions.

## Current transition

Epic 3 is consolidated in [`history/epic-3.md`](history/epic-3.md). Epic 4 implementation has progressed through KAN-401 under KAN-380. KAN-376 establishes canonical `1000m_track` evidence; KAN-377 resolves the authorized running reference applicable to an effective date from active canonical evidence; KAN-378 separates explicit quality percentages from Z1–Z5 execution guidance, adds safe HR provenance/age-prediction semantics, and removes fabricated HR and zone→PAM guidance from WorkoutCard. KAN-379 adds consumer-neutral factual 1000 m history/evolution and an ownership-gated read boundary. KAN-401 adds stable official TestEvent identity, durable official/self-directed provenance, independent recorder identity, review lifecycle and accepted-evidence eligibility across SQLite/Supabase.

Use [`handoffs/kan-401.md`](handoffs/kan-401.md) as the immediate implementation baseline and [`research/epic-4-field-physiology-and-intensity-guidance.md`](research/epic-4-field-physiology-and-intensity-guidance.md) for the Epic 4 research/decision context. Current code/tests remain authoritative for actual behavior.

Subsequent Epic 4 work must be reconstructed from the current `dev` baseline and Jira rather than assuming the preliminary sequence still matches delivered reality. Monitoring/Training Response remains distinct from measured physiology; later reference/guidance work must build on canonical evidence rather than introduce parallel authority.

## Other documentation

- [`research/`](research/) — scientific/product research and rationale. Research informs contracts but is not automatically implementation scope.
- [`product/`](product/) — product-facing documentation.
- [`glossary/`](glossary/) — terminology.
- [`superpowers/`](superpowers/) — implementation plans/workflow artifacts; completed plans must be clearly treated as historical rather than pending work.

## Reading rule

For new work, read `AGENTS.md`, this index, the current epic/story handoff when one exists, the latest completed epic history when relevant, and only the durable domain documents required by the scope. Then reconcile them with focused current code/tests and the complete Jira issue. Retrieve additional detail just in time instead of preloading the repository or relying on chat history.
