# Handoff — Epic 2 / H8: Category and competitive distance

## Status

- Story: KAN-177 — H8: Validate compatibility between category and target distance.
- Branch: `h-17-category-race-distance`.
- H8 implementation is complete through T6; T7 / KAN-184 closes the story documentation.
- The story started from clean, synchronized `dashboard` at H7 merge `e48ca8d`.
- Last implementation/test commit before T7: `a45ca98f` (`test: cover race distance notices and planning preservation`).

## Completed outcome

H8 makes competitive-distance compatibility an explicit domain rule without
turning it into automatic athlete classification or a planning constraint.

The story originated when seed maintenance exposed a technically valid but
sportingly incoherent combination: an S2 group paired with a 42 km race. That
showed that two independent concepts had been conflated:

```text
AthleteCategory / race distance
    → competitive context

AthleteGroup / GROUP_VOLUME_MATRIX
    → weekly training load
```

Weekly kilometers never determine race-category compatibility.

## Approved policy

The initial base ranges are inclusive:

- E: unrestricted; coach judgment, no automatic distance ceiling.
- U: 42 km and above.
- M: 21–42 km.
- H: 15–21 km.
- S: 5–15 km.
- B: pending; no competitive range has been approved yet.

A configurable initial 10% outward tolerance applies only to alert thresholds.
It does not modify the base sporting ranges. Overlap between category ranges is
intentional because this is a compatibility check for an existing group, not a
classifier that assigns each race to exactly one category.

Levels 1, 2 and 3 do not alter competitive-distance policy. A cohort variant
uses the category of its parent sporting group.

## Domain and implementation contract

`CATEGORY_RACE_DISTANCE_POLICY` is a typed, frozen catalog independent from
`GROUP_VOLUME_MATRIX` and `LoadStrategy`. The pure
`validateRaceDistanceForCategory` evaluator distinguishes compatible,
incompatible, unrestricted, policy_not_defined, not_applicable and invalid
results. It validates category/options/input before compatibility and does not
coerce or round competitive distances.

A valid mismatch is advisory and non-blocking. It never changes the athlete's
group, goal, load strategy, planning, cohort membership, or persisted override.
The coach can deliberately save the combination unchanged. The validator does
not infer readiness, injury risk, or whether an athlete should change category.

Planning integration derives `raceDistanceCompatibility` for generated
previews and persisted plan reads. The evaluation result is not stored in the
database. Persisted macrocycle race snapshots allow the notice to be
re-evaluated after save/reload and after progression operations. Cohort variants
use their parent group's category.

`RaceDistanceNotice` exposes the result in the creation and plan-detail flows.
Incompatible distances show the sporting reason, base range and tolerance while
making it clear that the coach may continue. B shows a pending-policy notice.
Compatible, E/unrestricted and no-race contexts remain silent. No override
checkbox, automatic reassignment or save restriction was introduced.

The durable contract, exact endpoints and review examples live in
`docs/architecture/category-race-distance.md`.

## Tasks completed

- T1 / KAN-178 — Define category-distance policy.
- T2 / KAN-179 — Model `CATEGORY_RACE_DISTANCE_POLICY`.
- T3 / KAN-180 — Implement pure compatibility validation.
- T4 / KAN-181 — Integrate policy with planning context.
- T5 / KAN-182 — Expose coach warning.
- T6 / KAN-183 — Cover policy and integration with tests.
- T7 / KAN-184 — Consolidate the durable rule and Epic 2 evolution documentation.

## Validation evidence

H8 finishes with 21 focused tests: nine evaluator tests, seven planning-context
tests and five rendered-component tests. T6 reported the full suite at 288
passing tests. Production build and its TypeScript check passed. Full lint had
zero errors and the same 11 known baseline warnings.

The rendering tests use the actual notice and next-intl provider but are not
browser/E2E tests. T5's approved manual walkthrough remains the evidence for
live interaction, save/reload behavior, responsiveness and localization.

Manual checks included S2 42 warning; S2 12 silent; S2 16.5 accepted and 16.501
warning; H 21.0975 and M 42.195 accepted; E silent; B pending; non-race hidden;
and save/reload preserving both the warning context and planning data.

T7 is documentation-only. No new runtime behavior was introduced and no new
test/build execution should be inferred from the T7 documentation commits.

## Decisions still open

- B remains `pending` until its competitive-distance semantics are validated
  with the coach.
- The 10% tolerance is an initial configurable product rule and remains subject
  to future coach refinement.
- Persisted exceptions/override auditing, automatic group reassignment,
  race-calendar behavior and cohort proposals remain outside H8.

## Next starting point

H8 is ready to close after the T7 documentation changes are reviewed. The next
Epic 2 story is H9 — Manage competition calendar. Start future work from
`AGENTS.md`, `docs/README.md`, the relevant new H9 handoff when it exists, and
the durable architecture documents it references. Do not reconstruct H8 from
chat history unless historical rationale is specifically needed.
