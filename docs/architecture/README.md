# Architecture index

Architecture documents are the durable contracts for current domain and technical behavior. Read the relevant domain folder before changing implementation.

## Domains

### Competitions

`competitions/` owns competitive identity and catalog-related consumer boundaries.

- `competitions/race-catalog-planning.md` documents catalog selection snapshots plus the KAN-504 read-only RaceCourse → planning-impact projection.

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

- `planning/planning-cohorts.md` documents Sporting group vs Planning subgroup, dated membership, variant lineage and the KAN-504 transactional derivation workflow.

### Memberships

`memberships.md` owns the Epic 5 membership economic foundation and post-Epic consumers: temporal team policy, athlete billing terms, monthly charge snapshots, H2 exceptions, H3 Payment revision history, H4/H5 account/debt projection, and the KAN-581 read-only Athlete Home disclosure boundary.

### Platform

`platform/` owns cross-cutting platform/infrastructure contracts.

- `platform/ui-design-system.md` — KAN-507 Brand/UI foundations, authority hierarchy, primitive/pattern ownership and KAN-507 ↔ KAN-508 boundary.
- `platform/internationalization-policy.md` — KAN-506 language, presentation locale, operational timezone, temporal-value and economic-currency consumption boundary.
- `platform/sqlite-local-operations.md` — supported local SQLite bootstrap, upgrade, preservation, drift and rerun lifecycle.
- `platform/identity-and-team-membership.md` — KAN-601 durable identity model: User, ExternalIdentityLink, TeamMembership authority, nullable AthleteProfile linkage, non-destructive lifecycle and persistence evidence boundaries.

## Cross-domain invariants

- `unknown != 0`.
- Missing evidence is not negative evidence.
- Known explicit zero remains zero.
- Historical accepted facts do not silently mutate with live catalog changes.
- `TrainingGoal`, `CompetitionEntry`, `RaceRegistration` and realized training are distinct facts.
- Semantic disclosure and subject authorization are separate boundaries.

## Workflow

For current story/baseline pointers also read `docs/README.md`, `docs/history/epic-3.md` and the current story handoff. Historical plans/handoffs provide traceability but do not override current architecture, code/tests or current Jira scope.
