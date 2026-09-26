# Architecture index

Architecture documents are the durable contracts for current domain and technical behavior. Read the relevant domain folder before changing implementation.

## Domains

### Competitions

`competitions/` owns competitive identity and catalog-related consumer boundaries.

Key competition documents:

- `competitions/race-registration.md` — implemented KAN-281 contract for effective registration, lifecycle, participation/result evidence, historical snapshots, persistence/isolation and Coach/Athlete disclosure.
- `competitions/race-registration-boundary.md` — KAN-275 historical reservation that established the minimum concrete RaceCourse target before KAN-281.

### Realized training

`realized-training/` owns durable performed-training evidence and capture/linkage semantics. Registration or race-result data must not silently create realized training.

### Monitoring

`monitoring/` owns monitoring/analytics contracts built from authoritative evidence.

- `monitoring/athlete-stats-analytics.md` is the completed KAN-264 baseline: consumer-neutral Training Analytics plus explicit Athlete Stats Projection allowlists, preserving known-zero/unknown/insufficient/empty/error semantics.
- `monitoring/field-performance-and-execution-guidance.md` is the Epic 4 contract for canonical 1000 m evidence, lifecycle, RunningReference, factual evolution and safe execution/presentation boundaries.

### Planning

`planning/` owns planning contracts. `CompetitionEntry` remains a planning fact and must not imply individual registration.

### Memberships

`memberships.md` owns the Epic 5 membership economic foundation: temporal team policy, athlete billing terms, monthly charge snapshots, materialization semantics and the H1/H2 boundary.

### Platform

`platform/` owns cross-cutting platform/infrastructure contracts.

## Cross-domain invariants

- `unknown != 0`.
- Missing evidence is not negative evidence.
- Known explicit zero remains zero.
- Historical accepted facts do not silently mutate with live catalog changes.
- `TrainingGoal`, `CompetitionEntry`, `RaceRegistration` and realized training are distinct facts.
- Semantic disclosure and subject authorization are separate boundaries.

## Workflow

For current story/baseline pointers also read `docs/README.md`, `docs/history/epic-3.md` and the current story handoff. Historical plans/handoffs provide traceability but do not override current architecture, code/tests or current Jira scope.
