# Handoff — Epic 2 / H9: Planning intent and competition calendar

## Status

- Story: `KAN-84` — H9: Desacoplar objetivos de planificación y gestionar calendario competitivo.
- Story branch: `h-18-competition-calendar`.
- H9 implementation is complete through `KAN-203`.
- All 19 H9 subtasks (`KAN-185` through `KAN-203`) are complete in Jira.
- Final local story gate confirmed on 2026-09-11: `pn test`, `pn lint`, `pn exec tsc --noEmit`, `pn build`, and `pn db:check:supabase` all passed. Lint remained at the known baseline of 0 errors / 11 pre-existing warnings.
- Remote Vercel checks for the final implementation checkpoints were successful.
- This file is now a completed-story handoff. The next story should create its own handoff rather than extending this file.

## Why H9 changed the model

H9 began as a competition-calendar story but exposed a deeper modeling problem: the old planning model could make `goalType = race` imply that an entire sporting group was preparing for one race, while planning cohorts existed precisely because only part of a group may share a competitive objective.

The approved model separates two independent concepts:

```text
PlanningIntent
    → why/how the plan should evolve

CompetitionEntry[]
    → which competitions condition a plan or cohort variant
```

A sporting group therefore remains a sporting classification. It does not become a "race group" merely because some athletes compete.

## Durable architecture established by H9

### Planning intent

`PlanningIntent` is the planning authority. New planning behavior must not be selected by the literal legacy `goalType = race` value.

The current neutral baseline is development/improvement planning. Competitive behavior is added through `CompetitionContext`, not by changing the planning intent into a race objective.

Relevant references:

- `docs/architecture/planning-intent-and-competition-context.md`
- `lib/periodization/planning-intent.ts`
- `lib/periodization/planning-context-macrocycle-generator.ts`

### CompetitionEntry is the live calendar source

`CompetitionEntry` is the source of truth for the live competitive calendar. It is plan-scoped and contains the sporting data required by planning, including mandatory distance, date, optional elevation gain, A/B/C priority and lifecycle state.

Priorities:

- `A`: principal competition that may condition taper and the macrocycle.
- `B` / `C`: intermediate competitions that provide context.
- only one active A is valid inside the relevant planning horizon.

Lifecycle:

- `planned`
- `confirmed`
- `completed`
- `cancelled`

Cancellation preserves the entry and history. Completed, cancelled and soft-deleted entries do not condition future planning context.

Relevant references:

- `docs/architecture/competition-calendar.md`
- `types/training/competition-entry.types.ts`
- `lib/periodization/competition-calendar-policy.ts`
- `lib/periodization/competition-calendar-service.ts`
- `app/actions/competition-calendar-actions.ts`

### Ownership and cohort variants

Competitions belong to a planning boundary, not directly to an athlete.

A base group plan may own competitions for its full planning audience. A cohort variant may own its own competition calendar. Deriving a cohort variant does not silently copy every competition: selected competitions are copied as detached entries with new identities and variant ownership.

Base and variant competition calendars remain independent after derivation.

Relevant references:

- `docs/architecture/planning-cohorts.md`
- `lib/planning-cohorts/plan-derivation.ts`
- `tests/planning-cohorts/competition-derivation.test.ts`

### CompetitionContext is the periodization boundary

Periodization consumes a pure projection rather than persistence entities:

```text
CompetitionEntry[]
        ↓
deriveCompetitionContext()
        ↓
CompetitionContext
├─ primaryCompetition
└─ intermediateCompetitions
```

An active A becomes `primaryCompetition`; active B/C entries become `intermediateCompetitions`. Multiple active A entries are invalid.

Taper and competitive generation are driven by `competitionContext.primaryCompetition`, not by `goalType === 'race'`.

Relevant references:

- `types/training/competition-context.types.ts`
- `lib/periodization/competition-context.ts`
- `lib/periodization/planning-context-macrocycle-generator.ts`

### H8 distance compatibility is reused, not duplicated

Competitive-distance compatibility remains the H8 policy. H9 evaluates it against `CompetitionEntry.distanceKm` and the sporting category. The result is derived on read, advisory and non-blocking; it is not persisted and never reclassifies an athlete or mutates planning automatically.

Relevant references:

- `docs/architecture/category-race-distance.md`
- `lib/periodization/competition-distance-context.ts`

### Macrocycle.targetRace* is a historical snapshot

`Macrocycle.targetRace*` is no longer the live race model. It is an immutable-by-default historical snapshot of the primary competition used when a planning generation/revision was explicitly accepted.

The snapshot includes:

- `targetRaceName`
- `targetRaceDate`
- `targetRaceDistanceKm`
- `targetRaceElevationGain`
- the resulting taper information stored by the macrocycle flow

Critical invariant:

```text
live CompetitionEntry edit/reschedule/cancel
    ≠ automatic Macrocycle.targetRace* rewrite

explicit planning generation/revision persistence
    → may replace the historical snapshot
```

The regression suite explicitly verifies that editing or reprogramming a live competition does not mutate the accepted macrocycle snapshot.

Relevant references:

- `lib/periodization/progression-persistence.ts`
- `tests/periodization/macrocycle-competition-snapshot-persistence.test.ts`
- `tests/periodization/competition-snapshot-regression.test.ts`

### Legacy compatibility is isolated

Existing plans may still contain `goalType = race` and `Macrocycle.targetRace*` without `CompetitionEntry` rows.

Compatibility is isolated in `lib/periodization/legacy-competition-context.ts`:

1. if a `CompetitionEntry` calendar exists, it wins;
2. if no calendar exists, a complete legacy snapshot may be adapted to `CompetitionContext`;
3. an incomplete snapshot (for example no historical race date) remains readable but does not fabricate competitive context;
4. reading a legacy plan never auto-creates `CompetitionEntry` rows;
5. a cancelled/inactive current calendar must not revive the historical snapshot.

Do not expand this compatibility path into new domain authority. It is deliberately removable legacy infrastructure.

## Persistence delivered

Competition-calendar persistence exists for both SQLite and PostgreSQL/Supabase.

H9 also added `macrocycles.target_race_date` so historical snapshots preserve the date that actually conditioned an accepted plan.

SQLite includes explicit idempotent migrations and runners for:

- competition entries;
- macrocycle target-race date.

Supabase migrations include:

- `drizzle/supabase/0010_charming_lockheed.sql` — competition calendar persistence;
- `drizzle/supabase/0011_left_franklin_richards.sql` — `macrocycles.target_race_date`.

The generated Supabase journal/snapshots were checked with `pn db:check:supabase`.

## User-facing planning result

The planning detail now displays the live competition calendar instead of presenting `Macrocycle.targetRace*` as the current race source.

The calendar summary exposes:

- A/B/C priority;
- lifecycle status;
- date;
- distance;
- D+;
- H8 distance compatibility;
- the active A competition marked as principal.

Plans with no competition calendar remain valid neutral plans and do not show a competitive section.

New H9 user-facing copy follows the progressive ES/EN internationalization policy and the shared product-help/glossary policy.

## Regression coverage at story close

H9 coverage includes:

- neutral/base planning without competitions;
- A/B/C context derivation;
- cancelled/completed/deleted competition filtering;
- multiple-A rejection;
- base/variant ownership and calendar independence;
- explicit A/B/C cohort derivation;
- H8 compatibility over `CompetitionEntry.distanceKm`;
- legacy-calendar precedence and fallback behavior;
- immutable historical snapshots under live calendar edits/rescheduling;
- planning intent remaining authoritative over legacy race goal type;
- H6 session-generation/regeneration guarantees remaining covered by the existing session-generation suites.

Final H9 regression commits include:

- `48b3d79` — protect historical snapshot from live calendar edits;
- `bec7389` — cover A/B/C cohort competition derivation.

## Closed decisions — carry these into the next story

Do not reopen these decisions without an explicit new domain requirement:

- planning intent and competitive context are separate concepts;
- sporting group classification is not a race objective;
- `CompetitionEntry` is the live competitive source of truth;
- competition ownership is plan-scoped;
- A/B/C priorities and explicit lifecycle remain the calendar semantics;
- `CompetitionContext` is the periodization boundary;
- taper is driven by `primaryCompetition`, not literal `goalType = race`;
- `Macrocycle.targetRace*` is a historical snapshot only;
- live calendar edits never silently rewrite an accepted snapshot;
- legacy compatibility remains isolated and removable;
- H8 category-distance compatibility stays derived/advisory;
- new product copy follows ES/EN progressive internationalization;
- shared domain help should use the product-help/glossary policy rather than ad-hoc explanatory copy.

## Starting the next story

The next story has not yet been accepted into this handoff. When its scope is provided:

1. review `AGENTS.md`;
2. review `docs/README.md`;
3. use this completed H9 handoff only for dependencies on competitive planning;
4. read the relevant architecture documents rather than reconstructing H9 from chat history;
5. create a new story branch from the updated `dashboard` branch;
6. create a new handoff for the new story once its domain boundary is agreed.

H9 should not be extended with unrelated follow-up work after merge. New requirements belong to the next Jira story/task set.