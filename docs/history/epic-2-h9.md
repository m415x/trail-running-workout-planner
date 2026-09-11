# Epic 2 / H9 — Planning intent and competitive calendar

Status: completed.

## Context

H8 made sporting-category race-distance compatibility explicit, but competitive information was still represented through legacy race fields attached to planning goals and macrocycle snapshots.

While preparing the competition-calendar story, that model exposed a deeper contradiction. A macrocycle described as a race objective could make an entire sporting group appear to be training for one competition, even though H7 had established planning cohorts precisely because only part of a sporting group may share a temporary planning context.

The problem was therefore not only to add a calendar. The domain needed to separate:

```text
why/how a plan should evolve

from

which competitive events condition that plan
```

## Domain refinement — planning intent is not a race

The previous model allowed `goalType = race` to carry two responsibilities:

- describe planning intent;
- signal that a competition should trigger race-specific behavior such as taper.

H9 rejected that coupling.

The new model distinguishes:

```text
PlanningIntent
    → planning purpose / evolution

CompetitionContext
    → competitive events relevant to planning
```

A sporting group such as S2 therefore remains a sporting classification. It does not become a race-specific group because some of its athletes will compete.

Neutral development/improvement planning can exist with no competition at all. The same neutral planning intent can also receive competitive context when a plan or cohort variant has an active primary competition.

## CompetitionEntry — live competitive data

H9 introduced `CompetitionEntry` as the live source of truth for the competitive calendar.

A competition belongs to a planning boundary rather than directly to an athlete. It records the sporting data needed by planning, including:

- date;
- mandatory distance;
- optional elevation gain;
- A/B/C priority;
- explicit lifecycle state;
- descriptive information.

Distance remains mandatory because planning cannot meaningfully derive competitive context without it.

The calendar supports creation, editing, rescheduling and explicit lifecycle changes while preserving history.

## Priority and lifecycle

Competitive priority became explicit:

```text
A → principal competition
B → intermediate competition
C → intermediate competition
```

Only one active A is valid in the relevant planning horizon.

Lifecycle is also explicit:

```text
planned
confirmed
completed
cancelled
```

Cancellation preserves the competition rather than deleting it. Completed, cancelled and logically deleted competitions do not condition future planning context.

This separates sporting data changes from lifecycle transitions and prevents a generic edit operation from silently changing the meaning of a competition.

## Ownership and planning cohorts

H7 introduced planning cohorts as temporary planning subdivisions of a stable sporting group. H9 extended that architecture rather than bypassing it.

A base group plan may own a calendar for its whole planning audience. A cohort variant may own a different calendar for that cohort.

Deriving a cohort variant does not automatically copy every source competition. Only explicitly selected competitions are copied, with new identities and ownership by the derived plan.

After derivation, base and variant calendars are independent snapshots. Changes to one do not live-synchronize into the other.

## CompetitionContext — the periodization boundary

The periodization generator does not consume persistence entities directly.

H9 introduced a pure projection:

```text
CompetitionEntry[]
        ↓
deriveCompetitionContext()
        ↓
CompetitionContext
├─ primaryCompetition
└─ intermediateCompetitions
```

An active A becomes `primaryCompetition`. Active B/C entries become intermediate context. Multiple active A entries are invalid.

This boundary keeps repositories and database concerns outside the core generator and allows periodization to reason only about the competitive information it actually needs.

## Domain refinement — taper follows competitive context

Once `CompetitionContext` existed, taper no longer needed `goalType = race` as its architectural trigger.

The rule became:

```text
competitionContext.primaryCompetition
        ↓
competitive/taper behavior
```

rather than:

```text
goalType === 'race'
        ↓
competitive/taper behavior
```

This means a neutral development plan can taper when it actually has a principal competition, while a legacy race label by itself no longer owns competitive behavior.

## Reuse of H8

H9 did not create a second category-distance policy.

The H8 compatibility evaluator now consumes `CompetitionEntry.distanceKm` together with the sporting category.

The result remains:

- derived rather than persisted;
- advisory rather than blocking;
- incapable of silently changing group, category, planning audience or load strategy.

This moved H8 from embedded target-race data toward the real live competition model.

## Historical snapshots — Macrocycle.targetRace*

H9 retained `Macrocycle.targetRace*`, but changed its meaning.

It is no longer a competing live race model. It is a historical snapshot of the primary competition that conditioned an explicitly accepted planning generation or revision.

H9 added `targetRaceDate` so the historical record can preserve the date that actually influenced an accepted plan even if the live competition is later rescheduled.

The critical invariant is:

```text
live CompetitionEntry edit/reschedule/cancel
    ≠ automatic historical snapshot rewrite
```

Only explicit planning persistence may replace the macrocycle snapshot.

This continues the Epic 2 automation-ownership principle: new live data must not silently rewrite an accepted coach-owned planning decision.

## Legacy compatibility

Existing persisted plans may still contain `goalType = race` and `Macrocycle.targetRace*` without any `CompetitionEntry` rows.

H9 isolates that compatibility in a removable adapter:

1. a live competition calendar has precedence;
2. when no calendar exists, a complete historical snapshot may be adapted to `CompetitionContext`;
3. incomplete legacy snapshots do not invent missing dates or competitive data;
4. reading legacy state does not auto-create calendar rows;
5. an inactive current calendar does not cause the old historical snapshot to reappear as live competitive context.

Legacy compatibility therefore remains a boundary, not a renewed source of domain authority.

## Persistence

Competition calendars were added to both SQLite and PostgreSQL/Supabase.

The story also added persistence for `macrocycles.target_race_date`.

Supabase migrations introduced during H9 include:

- `0010_charming_lockheed.sql` for competition-calendar persistence;
- `0011_left_franklin_richards.sql` for the historical target-race date.

SQLite uses explicit idempotent migrations and runners for the same structural evolution.

## Product-facing result

The planning detail now presents the live competition calendar instead of treating `Macrocycle.targetRace*` as the current race.

The calendar exposes:

- priority A/B/C;
- lifecycle state;
- date;
- distance;
- elevation gain;
- H8 compatibility;
- the active A marked as the principal competition.

A plan with no competitions remains a valid neutral plan and does not need a competitive section.

H9 also established progressive ES/EN internationalization and reusable product-help/glossary policies for new explanatory domain UI.

## Validation and regression outcome

The completed story includes regression coverage for:

- neutral planning without competition context;
- A/B/C derivation;
- inactive/cancelled/completed filtering;
- multiple-A conflicts;
- plan ownership and base/variant independence;
- selected A/B/C cohort derivation;
- H8 compatibility over live competition distance;
- legacy precedence/fallback behavior;
- immutable historical snapshots under live edits/rescheduling;
- planning intent remaining authoritative over legacy race goal type;
- preservation of H6 generation/regeneration guarantees.

The final story gate passed:

```text
pn test
pn lint
pn exec tsc --noEmit
pn build
pn db:check:supabase
```

Lint remained at the pre-existing baseline of 0 errors and 11 warnings.

## Durable outcome

H9 adds the following principles to Epic 2:

- planning purpose and competitive context are separate concepts;
- a sporting group is not itself a race objective;
- live competitive data belongs to plan-scoped `CompetitionEntry` records;
- competition priority and lifecycle are explicit domain concepts;
- cohort variants may own independent competitive calendars;
- periodization consumes `CompetitionContext`, not repository entities;
- taper follows the primary competition, not a legacy race label;
- H8 category-distance policy remains derived and advisory;
- accepted macrocycle race data is historical snapshot state, not live calendar state;
- live calendar changes must not silently rewrite accepted planning;
- legacy race fields are supported through an isolated, removable compatibility boundary.

These decisions are the baseline for subsequent planning-automation stories.