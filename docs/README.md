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
- [`architecture/memberships.md`](architecture/memberships.md) — Epic 5 H1–H5 economic contract: temporal policy/terms/charges, auditable exceptions, append-only Payments, derived account/history projection and Coach/Athlete prior-debt experience.

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

`docs/handoffs/` is temporary operational state, not an archive. The current operational handoff is [`handoffs/kan-499.md`](handoffs/kan-499.md), covering KAN-463 H5 closure and the KAN-464 entry contract. Completed Epic 4 evolution is consolidated in [`history/epic-4.md`](history/epic-4.md).

## Agent harness

- [`agent-harness.md`](agent-harness.md) — `harness-eval-v1` context/tool discipline, behavioral evaluation and completed KAN-281/KAN-282 experiment record. `AGENTS.md` remains the operational authority.

Do not modify the published harness as incidental feature/epic bootstrap work. Any v2 change must be an explicit workflow decision based on the recorded experiment conclusions.

## Current baseline

Epics 1–4 are complete. Epic 5 is active. KAN-459 H1, KAN-460 H2, KAN-461 H3 and KAN-462 H4 are complete through the current story progression once KAN-462 is integrated into `dev`.

KAN-462 delivers deterministic `settled | pending | overdue` account projection from an explicit civil cutoff date, paid/remaining and per-currency account balances derived from H2/H3 facts, an explainable economic history, and localized Coach ES/EN presentation. H4 adds no mutable balance/status persistence or parallel ledger. Its durable contract is [`architecture/memberships.md`](architecture/memberships.md) and its closure/next-story baseline is [`handoffs/kan-493.md`](handoffs/kan-493.md).

The verified Supabase deployment evidence remains the KAN-461 H3 controlled run: H1/H2/H3 billing persistence contracts reported OK, with 45/45 application tables and 45/45 tables protected by RLS. KAN-462 adds no schema or RLS changes; later stories must reverify current deployment state rather than treating old evidence as timeless.

KAN-463 — H5 Experiencia Coach/Athlete y bloqueo por deuda anterior — is the next Epic 5 story after KAN-462 integration. H5 consumes the H4 projection for Coach/Athlete presentation and derived prior-debt blocking; it must not persist a second debt/account-state authority and must remain separate from the KAN-298 identity/session/authorization phase.

Epic 4 is consolidated in [`history/epic-4.md`](history/epic-4.md). Its durable field-performance/execution contract is [`architecture/monitoring/field-performance-and-execution-guidance.md`](architecture/monitoring/field-performance-and-execution-guidance.md), with research rationale in [`research/epic-4-field-physiology-and-intensity-guidance.md`](research/epic-4-field-physiology-and-intensity-guidance.md).

Before starting the next story, follow the fresh-chat bootstrap contract in `AGENTS.md`: current `dev` → this index → most recent relevant handoff → only relevant durable domain docs → focused code/tests → complete Jira issue/dependencies. Apply [`agent-harness.md`](agent-harness.md) as the workflow-discipline companion throughout the story without treating its historical experiment record as current product state.

## Other documentation

- [`research/`](research/) — scientific/product research and rationale. Research informs contracts but is not automatically implementation scope.
- [`product/`](product/) — product-facing documentation.
- [`glossary/`](glossary/) — terminology.
- [`superpowers/`](superpowers/) — implementation plans/workflow artifacts; completed plans must be clearly treated as historical rather than pending work.

## Reading rule

For new work, read `AGENTS.md`, this index, the current epic/story handoff when one exists, the latest completed epic history when relevant, and only the durable domain documents required by the scope. Then reconcile them with focused current code/tests and the complete Jira issue. Retrieve additional detail just in time instead of preloading the repository or relying on chat history.
