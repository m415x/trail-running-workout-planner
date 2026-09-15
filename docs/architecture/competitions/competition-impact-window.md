# Competition impact windows

H10 models each competition as an explicit calendar window with three independent phases:

- `pre`: optional taper/local adjustment days before the event;
- `race`: the competition date itself;
- `post`: physiological recovery and progressive reentry after the event.

`buildCompetitionImpactWindow()` receives the already-decided taper duration and `RecoveryDecision`. It does not recalculate physiology, mutate microcycles or persist planning state.

## Date boundaries

All dates use `YYYY-MM-DD`. A ten-day taper ending at a race on `2026-11-15` spans `2026-11-05` through `2026-11-14`; the race remains its own one-day phase. Recovery starts the following day. B/C decisions with zero taper days have `pre = null` rather than a fabricated taper phase.

The overall `startDate`/`endDate` make the window suitable for local reconciliation and for detecting competition-calendar changes without regenerating the full macrocycle.

## Deterministic overlap rules

`resolveCompetitionImpactWindows()` returns pairwise overlap decisions without changing the source windows.

1. Overlapping pre/race adjustments use priority ordering `A > B > C`. A therefore prevails over incompatible B/C preparation, and B prevails over C.
2. Same-priority pre/race collisions are not guessed automatically; they require coach review.
3. Post-race physiological recovery is never discarded because a later competition has lower planning priority. A recovery/taper overlap is marked `recovery_preserved` so later reconciliation can apply the stricter compatible load constraint.
4. If a later race itself occurs while recovery from an earlier event is still active, the resolver returns `coach_review_required`. The system must not silently cancel recovery or suppress the race.
5. Recovery/recovery overlaps remain visible and preserved rather than being resolved through competitive priority.

These rules preserve the H10 distinction between planning importance and physiological cost: priority can resolve competing taper intentions, but it cannot erase recovery already required by a previous event.

## Scope

This layer only defines calendar impact and conflict semantics. KAN-219 will compose these windows into a local `CompetitionAdjustmentProposal`; later tasks will preserve manual/coach-owned state and reconcile only the affected microcycles.
