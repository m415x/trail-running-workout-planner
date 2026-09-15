# Competition adjustment proposal

`CompetitionAdjustmentProposal` is the pure review boundary introduced by H10 / `KAN-219` before any persistence or ownership reconciliation.

## Inputs

The proposal composes:

- one already-built A/B/C source adjustment proposal;
- its `RecoveryDecision`;
- the existing microcycles that may intersect the competitive impact window;
- optional overlap resolution from `CompetitionImpactWindow`.

## Output

The proposal exposes:

- the explicit pre/race/post `CompetitionImpactWindow`;
- taper and recovery rationale;
- competition-week training load kept separate from race load;
- only the existing microcycles that intersect the local window;
- current values alongside the proposed values;
- visible calendar-overlap conflicts requiring coach review.

It does **not** persist changes or mutate microcycles.

## Microcycle preview rules

For the pre-competition phase, daily taper curves are projected onto each intersecting microcycle as ceilings. The strictest taper point that falls inside that microcycle is used for preview purposes.

For the competition microcycle, the explicit `CompetitionWeekLoad.training` target is used and the preview marks the microcycle as `race`; competition distance/D+ remain outside the training target.

For post-competition recovery, the strictest overlapping recovery phase provides a training-load ceiling relative to the reached reference load. Recovery can also explicitly disallow intense sessions during the preview.

These are proposal values only. `KAN-220` is responsible for applying ownership/provenance rules and surfacing manual/protected-state conflicts before any later reconciliation.

## Conflict boundary

`KAN-219` surfaces calendar overlap conflicts already identified by the impact-window resolver. Manual/provenance conflicts intentionally remain out of scope until `KAN-220`, so the proposal can be enriched without coupling pure competitive policy to persistence ownership semantics.
