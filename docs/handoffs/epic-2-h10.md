# Handoff — Epic 2 / H10: Competitive adjustment

## Status

- Story: `KAN-204` — H10: Refinar taper y reajustar semanas competitivas.
- Branch: `h-19-competitive-adjustment`.
- Base branch: `dashboard` after H9 closure.
- Current starting task: `KAN-205` — Auditar taper y reestructuración competitiva actual.
- Delivery mode for H10: remote-first on GitHub/Jira. Local validation is reserved for cases that cannot be validated reasonably in remote review; the complete local gate and Vercel deployment validation are required before story merge.

## Why H10 exists

H9 established the competitive-calendar model and moved periodization away from `goalType === 'race'` toward `CompetitionContext`. That solved ownership and source-of-truth problems, but intentionally retained a simplified taper algorithm.

The current taper still reflects the old model in several ways:

- duration is effectively coarse (`0 | 2 | 3` weeks);
- distance and a fixed weekly-volume threshold play too large a role;
- one primary competition is the dominant case;
- the algorithm does not yet model B/C adjustments as local competitive windows;
- training load and race load are not yet represented as separate concepts for race week;
- post-competition recovery and overlapping competitive windows are not first-class domain concepts.

H10 evolves this into a local competitive-adjustment system rather than merely extending the old taper function.

## Research conclusions adopted before implementation

### Taper duration

The story must move away from a fixed week count. Effective tapers exist across sub-week, 1–2 week, and longer ranges depending on event demand, preceding load and athlete context. H10 therefore models taper duration in **days**, not as a closed `0 | 2 | 3` week union.

The implementation must not embed a direct distance-to-days lookup as if it were physiologically exact. Domain policies should return a rationale and remain configurable/replaceable.

### Competition demand

Distance alone is insufficient for trail running.

For H10 v1, the available course inputs are:

- distance in kilometers;
- positive elevation gain in meters.

A course-effort baseline may use the established trail-running concept:

```text
courseEffortKm = distanceKm + elevationGainM / 100
```

This value estimates course demand; it does **not** directly determine taper duration.

Future `CourseProfile` enrichment must remain possible without redesigning taper/recovery policy. A GPX/FIT track may later provide:

- measured distance;
- D+;
- D-;
- gradient distribution;
- major climbs and descents;
- altitude profile;
- terrain/technicality signals where derivable;
- estimated race duration from athlete-specific context.

GPX/FIT parsing must stay upstream of the taper policy. `TaperDecision` and `RecoveryDecision` consume assessed demand, not track-file formats.

### Pre-competition load

The taper should use the load **actually reached by the generated/persisted progression**, not the configured theoretical maximum.

A single peak is still insufficient. H10 should introduce a `PreCompetitionLoadContext` or equivalent that can describe, at minimum:

- recent reference window;
- recent average volume;
- achieved peak volume;
- volume trend;
- recent average elevation gain;
- achieved peak elevation gain;
- elevation trend;
- relative load band versus the plan/group's own preparation context.

Volume and elevation remain separate dimensions. Do not invent a generic training-load formula by reusing course-effort mathematics.

Initial reference-window policy may use approximately the last four complete pre-taper weeks, but the value belongs in domain policy rather than scattered generator constants.

### Unit convention

H10 must make elevation units explicit in names. In particular, rename:

```text
achievedPeakElevationGain
```

to:

```text
achievedPeakElevationGainM
```

when the affected contract is modified. Follow the same explicit-unit convention for new fields (`distanceKm`, `elevationGainM`, `durationMinutes`, etc.).

### Priority and physiological demand are independent

Competition priority answers how the competition should influence planning; it does not reduce the physiological cost of the event.

Initial planning behavior:

- **A**: full taper, principal peak, race week and protected recovery.
- **B**: proportional taper/local adjustment and contextual recovery.
- **C**: minimal or no formal taper when appropriate; may act as a quality/specific stimulus.

However, a long/high-demand C event remains physiologically demanding. Recovery need must be derived from event demand, while priority modifies how that need is handled in the surrounding plan.

### Recovery

Post-competition recovery is not the mirror image of taper and should not be calculated with the same formula.

Conceptually:

```text
PRE
CompetitionDemand + PreCompetitionLoad + Priority
    -> TaperDecision

POST
CompetitionDemand + eccentric/recovery demand + future actual response
    -> RecoveryDecision
```

H10 v1 may have limited eccentric-demand information because current `CompetitionEntry` does not contain D-. The model should represent that limitation explicitly and allow confidence to increase when richer course data becomes available later.

Prefer recovery ranges/proposals over pretending that one exact number of days is physiologically certain.

### Competition impact window

H10 should model the local effect of a competition as a window containing distinct phases:

```text
CompetitionImpactWindow
├── preCompetition
├── competition
└── postCompetition
```

The pre and post windows are derived through different decisions.

Overlapping windows must be resolved as one planning problem rather than by running independent tapers/recoveries over the same microcycles.

### Proposal before persistence

Competitive adjustment should be a pure/reviewable proposal before it changes persisted planning:

```text
current planning
    -> competitive adjustment policy
    -> CompetitionAdjustmentProposal
    -> conflicts / protected values
    -> coach review
    -> local reconciliation
```

This continues the Epic 2 automation-ownership rule: automation may update automation-owned state, but must not silently overwrite explicit coach-owned state.

### Planned versus realized impact

Changing/cancelling a competition after a taper has already been accepted exposes an important distinction:

- planned competitive impact;
- realized competition/recovery impact.

A cancellation before the event must not create post-race recovery as if the competition occurred. Conversely, already-realized taper changes must not be silently rolled back.

## Domain boundaries inherited from H9

The following decisions are closed and must not be reopened in H10:

- `CompetitionEntry` is the live competitive-calendar source of truth.
- `CompetitionContext` is the pure competitive boundary consumed by periodization.
- `PlanningIntent` contains no race intent.
- `goalType = race` remains compatibility-only legacy behavior.
- `Macrocycle.targetRace*` is a historical snapshot, not the live race entity.
- editing/rescheduling/cancelling a live competition does not silently rewrite accepted macrocycle snapshots.
- H8 category-distance compatibility remains advisory.
- competition changes do not automatically change sporting group, cohort membership or athlete `TrainingGoal`.

References:

- `docs/handoffs/epic-2-h9.md`
- `docs/history/epic-2-h9.md`
- `docs/architecture/planning-intent-and-competition-context.md`
- `docs/architecture/competition-calendar.md`
- `docs/architecture/category-race-distance.md`

## Jira task sequence

- `KAN-205` — Audit current taper and competitive restructuring.
- `KAN-206` — Define `CompetitionAdjustmentPolicy` for A/B/C.
- `KAN-207` — Define `CompetitionImpactWindow` pre/race/post.
- `KAN-208` — Calculate the reached pre-competition load context and apply explicit units (`achievedPeakElevationGainM`).
- `KAN-209` — Determine adjustment duration/intensity from priority, course demand and reached load.
- `KAN-210` — Define progressive volume reductions.
- `KAN-211` — Reduce elevation while preserving specificity.
- `KAN-212` — Preserve brief intensity stimuli.
- `KAN-213` — Model race week separating training load and competition load.
- `KAN-214` — Generate full taper for A competition.
- `KAN-215` — Generate proportional/local adjustment for B competition.
- `KAN-216` — Model C competition as optional specific training stimulus.
- `KAN-217` — Add post-competition recovery.
- `KAN-218` — Resolve overlapping competitive windows.
- `KAN-219` — Generate `CompetitionAdjustmentProposal` over existing microcycles.
- `KAN-220` — Detect and preserve protected/manual values, microcycles and sessions.
- `KAN-221` — Allow coach review/manual adjustment before persistence.
- `KAN-222` — Reconcile only the affected window and record generated/manual adjustments.
- `KAN-223` — Cover rescheduling, reprioritization, cancellation and complete taper/competitive regression suite.

## Minimum regression scenarios

H10 should eventually cover at least:

1. no competition -> no taper/competitive adjustment;
2. short A -> short taper;
3. marathon/ultra A -> longer taper;
4. high-D+ race -> reduce load while preserving relevant specificity;
5. B inside a development week;
6. B near an existing deload;
7. C used as a quality/specific session;
8. two intermediate competitions close together;
9. date change shifts the impact window;
10. cancellation after planning was previously adjusted;
11. protected/manual values inside the window remain untouched and surface conflict;
12. race-week training and competition load are accounted for separately;
13. A cancellation after an accepted taper does not pretend the taper never happened;
14. B inside an A taper/recovery window does not create an incompatible second taper;
15. C inside post-A recovery produces a deterministic adjustment/conflict;
16. B -> A reprioritization recalculates the entire affected policy/window.

## Definition of Done

H10 is complete when A/B/C competitions can produce local, reviewable competitive adjustments over existing planning using course demand and the load actually reached; A can generate an appropriately sized taper and race week, B/C can produce proportional adjustments, training and competition load remain separate, post-race recovery is explicit, overlapping windows resolve deterministically, coach-protected state is never overwritten silently, and date/priority/status changes regenerate only the affected competitive window.

## Delivery workflow for this story

- Work directly on `h-19-competitive-adjustment` through GitHub/Jira.
- Prefer pure domain changes and focused remote review/checks task by task.
- Do not ask for local tests after every ticket.
- Request local validation only where runtime/interactive/database behavior cannot be established reliably remotely.
- Before closing H10, run the complete local gate: `pn test`, `pn lint`, `pn exec tsc --noEmit`, `pn build`, and relevant database migration checks.
- Validate the final Vercel deployment before fast-forward/merging into `dashboard`.

## Immediate starting point

Start with `KAN-205`. Audit the existing taper implementation and identify precisely:

- current duration heuristics and constants;
- inputs actually used by current taper generation;
- where achieved peak volume/elevation already exist;
- how competitive mesocycles/microcycles are created;
- how race week is currently represented;
- what H6 ownership/provenance protections can be reused;
- which responsibilities must move out of the legacy macrocycle generator into pure H10 policies;
- tests that encode current behavior and therefore form the migration safety net.

Do not implement the new taper policy until this audit is documented and its migration boundary is agreed.