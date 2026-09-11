# Handoff — Epic 2 / H9: Planning intent and competition calendar

## Status

- Story: KAN-84 — H9: Desacoplar objetivos de planificación y gestionar calendario competitivo.
- Branch: `h-18-competition-calendar`.
- Work is complete through KAN-199.
- KAN-200 — Maintain compatibility with legacy plans — is the next starting point.
- KAN-199 was closed technically after the Supabase migration for `macrocycles.target_race_date` was generated, checked and pushed.
- Latest known validation before this handoff: tests green, production build/TypeScript green, Supabase schema check green, lint with zero errors and the same 11 pre-existing warnings.

## Why H9 was restructured

H9 originally started as a conventional competition-calendar story, but the domain audit exposed a deeper modeling problem: race information existed in two places with different responsibilities.

The old model allowed a macrocycle goal such as `goalType = race` to imply that the whole group was training for one race. At the same time, planning cohorts were being introduced precisely because only part of a sporting group may share a competition.

That duplication was rejected. A sporting group such as S2 must not become a "race group" merely because some athletes will compete. The approved model separates two independent questions:

```text
PlanningIntent
    → why/how the plan should evolve

CompetitionEntry[]
    → which competitions condition the plan or one of its cohort variants
```

The default conceptual baseline is therefore neutral improvement/development rather than an implicit race objective. Competitions are contextual events, not planning intents.

Legacy `goalType = race` remains temporarily supported only for backward compatibility; KAN-200 owns that compatibility boundary.

## Consolidated architecture

### Planning intent

Planning intent is independent from competition ownership. The current planning flow supports neutral intents and no longer requires a race in order to generate a plan.

The UI/help work introduced during H9 follows the repository-wide product-help policy and progressive ES/EN internationalization policy. New domain concepts should use translation keys rather than adding new hard-coded Spanish-only copy.

Durable references:

- `docs/architecture/planning-intent-and-competition-context.md`
- `docs/architecture/product-help-and-domain-glossary.md`
- `docs/architecture/internationalization-policy.md`

### CompetitionEntry

`CompetitionEntry` is the source of truth for the live competition calendar. It is persisted independently from macrocycle snapshots and is associated with a training plan.

The model includes the competitive data required by planning, including at least date, mandatory distance, optional elevation gain, priority and lifecycle status. Distance is mandatory because planning cannot meaningfully derive race context without it.

Relevant implementation boundaries:

- `types/training/competition-entry.types.ts`
- `lib/periodization/competition-entry.ts`
- `lib/periodization/competition-repository.ts`
- `lib/periodization/competition-calendar-policy.ts`
- `lib/periodization/competition-calendar-service.ts`
- `app/actions/competition-calendar-actions.ts`
- SQLite/PostgreSQL schemas in `db/competition-entry-schema.ts` and `db/supabase/competition-entry-schema.ts`

### Competition priorities

Priorities are A, B and C.

- A: principal competition that may condition the macrocycle.
- B/C: intermediate competitions that provide context but are not the primary macrocycle target.
- Only one active A is valid inside the relevant planning horizon.

Multiple competitions on the same date are detected as an advisory condition but are not rejected automatically.

### Competition lifecycle

Lifecycle is explicit and must not be bypassed through generic edit operations. The implemented states use the current domain vocabulary (`planned`, `confirmed`, `completed`, `cancelled`).

Editing descriptive/sporting data does not mutate lifecycle state. Status transitions use the dedicated lifecycle operation. Cancellation preserves the entry and its history; it is never implemented as deletion.

Completed, cancelled and soft-deleted entries do not condition future planning context.

Relevant files:

- `lib/periodization/competition-lifecycle.ts`
- `tests/periodization/competition-lifecycle.test.ts`

### Ownership and cohorts

Competitions belong to a plan boundary. Server actions verify that the plan belongs to the active team and derive whether the plan is a base group plan or cohort variant from persisted data rather than trusting UI input.

This preserves the H7 model: sporting groups remain stable training structures, while planning cohorts/variants represent temporary subsets that may have distinct competition context.

A competition must not silently reassign athletes, groups or cohorts.

Durable references:

- `docs/architecture/planning-cohorts.md`
- `docs/architecture/competition-calendar.md`

## Reuse of H8 category-distance policy

H8 remains the authoritative category-versus-race-distance policy. H9 does not duplicate it.

The integration now evaluates:

```text
CompetitionEntry.distanceKm
        +
AthleteGroup.categoryCode
        ↓
validateRaceDistanceForCategory()
        ↓
derived advisory
```

The result is derived on read and is not persisted. A mismatch remains advisory and non-blocking: it does not modify load, planning, group membership or cohort membership.

This is the correct long-term placement of H8 compatibility: against real competition-calendar entries rather than an embedded macrocycle "race objective".

Relevant files:

- `lib/periodization/competition-distance-context.ts`
- `lib/validate-race-distance-for-category.ts`
- `docs/architecture/category-race-distance.md`

## CompetitionContext boundary

Planning does not query the competition repository directly. H9 introduced a pure `CompetitionContext` boundary derived from `CompetitionEntry[]`.

Conceptually:

```text
CompetitionEntry[]
        ↓
deriveCompetitionContext()
        ↓
CompetitionContext
├─ primaryCompetition
└─ intermediateCompetitions
```

Only active/applicable entries participate. A valid active A becomes `primaryCompetition`; B/C entries become `intermediateCompetitions`. Multiple active A entries are invalid.

`CompetitionContext` intentionally projects only the data required by planning rather than exposing persistence entities directly. This keeps the periodization generator independent from repositories and database concerns.

Relevant files:

- `types/training/competition-context.types.ts`
- `lib/periodization/competition-context.ts`
- `tests/periodization/competition-context.test.ts`

## Taper and competitive behavior

The new competitive trigger is the competition context, not the legacy goal type.

Approved direction:

```text
goalType === 'race'                  // legacy signal; must not drive new behavior

competitionContext.primaryCompetition // current competitive signal
```

`generateMacrocycleFromPlanningContext()` already uses `primaryCompetition` for the competitive/taper path. A neutral planning intent with a primary A competition can therefore taper correctly, while a legacy `goalType = race` must not remain the architectural trigger once KAN-200's adapter boundary is in place.

KAN-198 was closed after auditing that this behavior was already implemented and covered by tests.

Relevant file:

- `lib/periodization/planning-context-macrocycle-generator.ts`

## TargetRaceSnapshot after KAN-199

`Macrocycle.targetRace*` has been deliberately retained, but its meaning changed.

It is **not the live race model** and must not compete with `CompetitionEntry` as a source of truth.

It is an immutable-by-default historical snapshot of the primary A competition that was used when a macrocycle generation/revision was explicitly accepted/persisted.

The snapshot now preserves:

- target race name;
- target race distance;
- target race elevation gain;
- target race date (`targetRaceDate`);
- the resulting taper information already stored by the macrocycle flow.

`targetRaceDate` was added because a live `CompetitionEntry` can later be reprogrammed. Historical planning must still be able to answer which date conditioned the generation/revision that produced the stored macrocycle.

### Critical invariant: no silent synchronization

Changing, reprogramming, cancelling or otherwise editing `CompetitionEntry` must **not** rewrite an already accepted macrocycle snapshot.

The snapshot changes only through an explicit planning generation/revision persistence boundary. `persistProgression()` writes or clears the snapshot when a new planning result is explicitly persisted.

Therefore:

```text
CompetitionEntry changes
    ≠ automatic Macrocycle.targetRace* changes

explicit planning generation/revision
    → may replace Macrocycle.targetRace* snapshot
```

Do not introduce listeners, repository hooks, triggers or server-action side effects that synchronize these models automatically.

Relevant files:

- `lib/periodization/target-race.ts`
- `lib/periodization/progression-persistence.ts`
- `types/training/periodization.types.ts`
- `tests/periodization/macrocycle-competition-snapshot-persistence.test.ts`

## Persistence and migrations completed

Competition calendar persistence was added for both SQLite and PostgreSQL/Supabase, with tests and repository/service coverage.

KAN-199 additionally added `macrocycles.target_race_date` to both schemas.

SQLite:

- schema includes `targetRaceDate` / `target_race_date`;
- idempotent migration: `db/migrations/macrocycle-target-race-date-sqlite.ts`;
- runner: `scripts/migrate-macrocycle-target-race-date-sqlite.ts`;
- package script exposes the migration;
- migration tests preserve legacy rows and verify safe re-execution.

PostgreSQL/Supabase:

- Drizzle schema includes `targetRaceDate`;
- generated migration: `drizzle/supabase/0011_left_franklin_richards.sql`;
- migration SQL is intentionally minimal:

```sql
ALTER TABLE "macrocycles" ADD COLUMN "target_race_date" text;
```

- `0011_snapshot.json` and `_journal.json` were generated by Drizzle and pushed;
- `pn db:check:supabase` reported a consistent migration chain.

Existing/legacy snapshots naturally keep `target_race_date = NULL`; the field is optional at the compatibility boundary for that reason.

## Application/service boundary completed

The competition calendar now has an application service and server-action boundary for:

- list/read;
- create;
- update sporting/descriptive data;
- reschedule;
- explicit lifecycle status changes.

Calendar policy validates ownership, planning horizon and multiple-A conflicts. Same-date conflicts are surfaced but remain non-blocking.

Repository/service operations preserve cancellation/history and do not couple the domain to UI components.

## Validation evidence

During H9 the suite was repeatedly run after checkpoints. The last confirmed state before this handoff was:

- `pn test`: green;
- `pn lint`: zero errors and 11 known pre-existing warnings;
- `pn build`: green, including TypeScript;
- SQLite target-race-date migration executed successfully;
- `pn db:generate:supabase`: generated only migration 0011 for `target_race_date`;
- `pn db:check:supabase`: green;
- migration 0011, snapshot and journal were committed and pushed.

Do not treat the 11 lint warnings as H9 regressions. A temporary 12th warning introduced by the calendar server action was fixed during KAN-195, returning the baseline to 11.

## H9 task progression through this handoff

The story was restructured during implementation, so Jira is the authoritative task numbering/status source. The key completed sequence immediately before this handoff is:

- KAN-195 — competition calendar policy/repository/service/server actions and integration coverage: completed.
- KAN-196 — reuse H8 distance compatibility on `CompetitionEntry`: completed.
- KAN-197 — derive `CompetitionContext`: completed.
- KAN-198 — migrate taper/competitive behavior to `primaryCompetition`: completed after audit showed the desired behavior was already implemented and tested.
- KAN-199 — evolve `TargetRaceSnapshot`, add historical date and explicit persistence/migrations: technically completed and pushed.
- KAN-200 — maintain compatibility with legacy plans: **next task**.

Earlier H9 tasks established the planning-intent separation, competition model, priorities, lifecycle, ownership, validation and persistence. Consult Jira and the architecture documents for their exact ticket mapping rather than renumbering them from memory.

## KAN-200 — exact next objective

KAN-200 exists to keep old persisted plans operational while the new model becomes authoritative.

Jira contract:

> Maintain existing plans with `goalType = race` and `Macrocycle.targetRace*`. Resolve competitive context from `CompetitionEntry` when it exists and use a legacy adapter from the snapshot when the new calendar does not yet exist.

The intended resolution order is:

```text
1. Current CompetitionEntry calendar exists
        ↓
   derive CompetitionContext from CompetitionEntry
        ↓
   use that context

2. No applicable new calendar exists for a legacy plan
        ↓
   adapt persisted Macrocycle.targetRace* snapshot
        ↓
   produce compatibility CompetitionContext
```

### Rules for KAN-200

1. **CompetitionEntry wins.** Never merge a live A competition with a legacy target-race snapshot into two competing primaries.
2. The snapshot adapter is a fallback for legacy data, not a second source of truth.
3. `goalType = race` may help identify a legacy record, but must not become the new domain trigger for taper or competition behavior.
4. Do not rewrite/migrate legacy rows destructively just to make them look like new `CompetitionEntry` rows unless a separate migration policy is explicitly approved.
5. Do not auto-create `CompetitionEntry` records from snapshots as a side effect of reading a plan.
6. Preserve historical snapshot semantics from KAN-199.
7. Legacy snapshots may lack `targetRaceDate`; the adapter must handle that explicitly rather than inventing a date.
8. New plans without competition context must remain valid neutral plans.
9. Keep the adapter isolated and removable so the legacy path can be retired in a future cleanup story.
10. Add focused tests for precedence, legacy fallback, incomplete legacy snapshots and neutral/no-competition behavior before changing UI.

## Suggested KAN-200 implementation sequence

Start by auditing all current reads of:

```text
goalType === 'race'
targetRaceName
targetRaceDistanceKm
targetRaceElevationGain
targetRaceDate
TargetRaceSnapshot
CompetitionContext
```

Then introduce a pure compatibility resolver/adapter. Prefer a shape such as:

```text
resolveCompetitionContext({
  competitionEntries,
  legacyMacrocycleSnapshot,
  ...
})
```

or two explicit functions:

```text
deriveCompetitionContext(entries)
adaptLegacyTargetRaceSnapshot(snapshot)
```

with a small resolver enforcing new-calendar precedence.

The adapter should return the existing `CompetitionContext` abstraction rather than teach the generator about legacy fields. The generator should continue consuming one context type.

After unit tests, integrate the resolver at the application/read/generation boundary where both persisted calendar entries and legacy macrocycle data are available. Avoid putting DB access inside the pure domain adapter.

## Decisions that are closed — do not reopen in KAN-200

- Planning intent and competition are separate concepts.
- A sporting group is not globally transformed into a race-specific group.
- `CompetitionEntry` is the live calendar source of truth.
- A/B/C priority semantics remain as defined by H9.
- Lifecycle changes are explicit; cancellation preserves history.
- Category-distance compatibility is H8 advisory logic and remains derived/non-persisted.
- `CompetitionContext` is the boundary consumed by periodization.
- Taper is driven by `primaryCompetition`, not by the literal legacy goal type.
- `Macrocycle.targetRace*` is a historical snapshot, not the live race entity.
- `targetRaceDate` is part of new snapshots because historical date matters.
- Live calendar edits must never silently rewrite accepted snapshots.
- ES/EN internationalization and shared help/glossary policies apply progressively to new H9 UI/copy.

## Files to read first in a new session

Read these before changing KAN-200 code:

1. `AGENTS.md`
2. `docs/handoffs/epic-2-h9.md`
3. `docs/architecture/planning-intent-and-competition-context.md`
4. `docs/architecture/competition-calendar.md`
5. `docs/architecture/category-race-distance.md`
6. `types/training/competition-context.types.ts`
7. `lib/periodization/competition-context.ts`
8. `lib/periodization/planning-context-macrocycle-generator.ts`
9. `lib/periodization/target-race.ts`
10. `lib/periodization/progression-persistence.ts`

Use Jira KAN-200 as the acceptance contract. Do not reconstruct H9 from chat history unless historical rationale is specifically needed.

## Branch / working procedure

Continue on `h-18-competition-calendar` until H9 is complete unless Jira/branch strategy is deliberately changed.

Before starting KAN-200 locally:

```bash
git checkout h-18-competition-calendar
git pull
git status
```

Expected baseline: clean working tree synchronized with origin after the KAN-199 migration push.

For implementation checkpoints continue using:

```bash
pn test
pn lint
pn build
```

The known lint baseline is 11 warnings and 0 errors. Any increase should be treated as a regression until explained.
