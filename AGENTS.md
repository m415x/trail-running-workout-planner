# AGENTS.md

## Purpose

This repository contains the Trail Running Workout Planner. Treat durable repository documentation and current code as the source of truth for architecture and implementation. Jira defines story scope and workflow state, but must be reconciled with the repository before implementation.

## Source-of-truth order

When sources disagree, use this order unless a story explicitly changes a contract:

1. current code and tests;
2. architecture/domain documentation under `docs/architecture/`;
3. current Jira story and accepted scope clarifications;
4. handoffs and historical implementation plans.

Do not infer current project state from chat memory or from an old handoff alone.

## Required workflow for a new story

Before proposing code or creating tasks:

1. read this file and any nested `AGENTS.md` that applies to files you will touch;
2. read `docs/README.md`, relevant architecture/domain docs and the latest completed-story handoff;
3. inspect current code/tests where needed to verify documentation;
4. read the complete Jira story, including acceptance criteria, comments, links, subtasks and dependencies;
5. classify Jira scope into already implemented, partially implemented, missing and obsolete/conflicting portions;
6. present the reconstructed scope and discrepancies before creating tasks.

Do not reopen settled architectural decisions unless the new story requires it.

## Branching

Stories start from current `dev`, never from the previous story branch. Inspect existing remote branches before creating a branch and follow the established naming convention rather than inventing one.

## Delivery strategy

Work remote-first whenever available tools permit it. Prefer repository inspection, remote file changes and small coherent commits tied to the active task. Keep Jira synchronized with actual implementation state.

Before implementing a task, inspect existing contracts and abstractions so the change extends the current architecture instead of creating a parallel model.

## Verification strategy

Use focused static inspection and focused tests during implementation. Do not require repeated full local executions of `pn test`, `pn lint`, TypeScript, build or i18n checks after every change.

Request an intermediate local command only when it is necessary to resolve a compilation/type uncertainty, diagnose behavior unavailable remotely, verify a critical integration, unblock subsequent work or validate runtime/visual behavior. Prefer the narrowest relevant command.

Reserve the complete applicable gate for story closure. Never report a command as passing without verifiable execution evidence.

## Story closure

Before closing a story:

1. reconcile every task/subtask with implementation;
2. review parent acceptance criteria individually;
3. run the complete applicable local gate, including tests, lint, TypeScript, build, i18n and story-specific verification;
4. record final evidence in Jira;
5. update durable architecture/handoff/index documentation with delivered contracts, limitations, deliberate deferrals and the baseline for the next story;
6. mark implementation plans completed/historical where applicable;
7. only then close the Jira story.

## Current durable baseline — after KAN-264

KAN-264 / Historia 8 is complete on `dev`. Its durable baseline is documented in:

- `docs/architecture/monitoring/athlete-stats-analytics.md`;
- `docs/handoffs/kan-264-athlete-stats.md`.

Reported final KAN-264 gate: 790/790 tests across 157 suites, lint passed, `pn exec tsc --noEmit` passed, build passed, `pn i18n:check` passed with 452 aligned ES/EN message leaves, and the Athlete responsive walkthrough was approved.

The next Epic 3 story is **KAN-281 — Historia 9: Registrar inscripciones y participación histórica en carreras**.

Before KAN-281 implementation, preserve these established boundaries:

- competitive identity is `RaceEvent → RaceEdition → RaceCourse`;
- `TrainingGoal`, `CompetitionEntry` and `RaceRegistration` are independent facts;
- a registration targets one concrete `RaceCourse` and carries explicit team + athlete scope;
- realized-training evidence remains authoritative for performed training; a registration or race result must not silently create realized training;
- `unknown != 0`; missing evidence is not negative evidence; known zero remains zero;
- historical consumer facts must not silently change when the live catalog is edited or archived.

The future registration extension point reserved by KAN-275 is documented at `docs/architecture/competitions/race-registration-boundary.md`. That reservation intentionally did not define lifecycle, participation/result semantics, historical snapshot fields, persistence or deduplication; those decisions belong to KAN-281.

### Accepted KAN-281 MVP clarification

`RaceRegistration` represents an **effective individual registration**, not a mere intention/planned registration. Existing goal/planning concepts continue to represent competitive intent and must not automatically create a registration.

Registration lifecycle and participation/result evidence must be modeled as distinct concerns. Being registered does not imply started, finished, DNS or DNF. Absence of explicit participation/result evidence remains unknown.

The complete KAN-281 contract must be designed and documented before Jira implementation tasks are created.

## Domain invariants

### Evidence semantics

Across realized training, monitoring and analytics:

- unknown evidence is never converted to zero;
- known explicit zero remains zero;
- missing evidence is not negative evidence;
- insufficient evidence must not fabricate a comparison, trend or conclusion;
- technical failure is distinct from a valid unknown/insufficient/empty state.

### Training load

Training-load v1 uses internal load AU = duration minutes × session RPE, rule `srpe-duration-v1`. AU is an estimated internal/relative load and must not be presented as energy, power, direct physiological fatigue/fitness, readiness or injury risk. Derived load is calculated on demand from authoritative realized-training evidence.

### Analytics and athlete disclosure

Consumer-neutral Training Analytics is separate from Athlete Stats Projections. Athlete projections are explicit allowlists, never coach projections with fields removed. Coach-only Training Response/Readiness interpretation does not cross into athlete-facing contracts automatically.

### Catalog and historical facts

Catalog identity uses opaque IDs. Stable event metadata, edition metadata and concrete course metadata remain separated according to the documented catalog contracts. Consumer snapshots preserve accepted historical facts; catalog edits/archive do not silently refresh them.

## Documentation map

Start at `docs/README.md`. Architecture documents are grouped by domain under `docs/architecture/`; story transition notes live under `docs/handoffs/`; completed historical material lives under `docs/history/`; research rationale lives under `docs/research/`.

Keep durable documentation concise and current. A handoff may point to architecture rather than duplicating the complete contract.
