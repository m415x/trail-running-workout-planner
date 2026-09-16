# Architecture index

Architecture documents are the durable contracts for current domain and technical behavior. Read the relevant domain folder before changing implementation.

## Domains

### Competitions

`competitions/` owns competitive identity and catalog-related consumer boundaries.

Key starting documents for current work:

- `competitions/race-registration-boundary.md` — KAN-275 minimum future registration target: explicit team + athlete scope bound to one concrete `RaceCourseReference`. It intentionally does not define registration lifecycle, participation/result semantics, snapshot fields or persistence.

KAN-281 is the story responsible for turning that reserved boundary into an actual durable individual registration/history model. The accepted MVP clarification is that `RaceRegistration` represents an effective registration, not competitive intent; participation/result evidence remains a separate concern and missing evidence remains unknown.

### Realized training

`realized-training/` owns durable performed-training evidence and capture/linkage semantics. Registration or race-result data must not silently create realized training.

### Monitoring

`monitoring/` owns monitoring/analytics contracts built from authoritative evidence.

- `monitoring/athlete-stats-analytics.md` is the completed KAN-264 baseline: consumer-neutral Training Analytics plus explicit Athlete Stats Projection allowlists, preserving known-zero/unknown/insufficient/empty/error semantics.

### Planning

`planning/` owns planning contracts. `CompetitionEntry` remains a planning fact and must not imply individual registration.

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

For current story/baseline pointers also read `docs/README.md`, `docs/handoffs/epic-3.md` and the latest completed-story handoff. Historical plans/handoffs provide traceability but do not override current architecture, code/tests or current Jira scope.
