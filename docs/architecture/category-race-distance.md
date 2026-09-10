# Category and competitive distance

## Status and purpose

Epic 2 / H8 / T1 (KAN-178): initial product policy approved by the user.
The 10% tolerance is an initial configurable product rule, subject to future
coach refinement. T2 adds the typed catalog and T3 implements pure evaluation;
planning and UI integration follow in T4–T5.

## Implementation map

- `types/athlete/category-race-distance.types.ts`: readonly discriminated
  policy union (`bounded`, `unrestricted`, `pending`), nonempty bounds and
  evaluation options. Public types are re-exported by `types/index.ts`.
- `lib/category-race-distance-policy.ts`: exhaustive frozen category catalog
  and frozen default options (`tolerancePercent: 10`). No database or volume
  matrix dependency. Callers can supply separate options without mutation.
- `lib/validate-race-distance-for-category.ts`: pure evaluator accepting a
  category, a distance in km, and optional tolerance options. Returns compatible,
  incompatible, unrestricted, policy_not_defined, not_applicable or invalid.
  Only invalid results are blocking; incompatible results include direction and
  base/effective bounds for later presentation. No translated UI text is emitted.
- T3 validates numeric bounds/options at runtime: positive finite bounds,
  ordered endpoints, and finite tolerance in [0, 100). Zero disables tolerance;
  100 or above is invalid configuration because it eliminates a positive lower
  threshold. Category and options validation precede missing-distance handling;
  null/undefined distance is not applicable, while strings are never coerced.
  Invalid data remains invalid for E/B. Four scaled machine epsilons compensate
  endpoint representation noise without adding another sporting tolerance.
- `tests/category-race-distance/validation.test.ts`: nine focused tests cover
  category states, boundaries, invalid data/options, absent context, configurable
  tolerance, and non-mutation/determinism.

Competitive distance is measured in kilometers. It is distinct from weekly
training volume, elevation gain, and athlete level. This policy must not change
`GROUP_VOLUME_MATRIX`, `LoadStrategy`, group membership, or cohort membership.

## Existing evidence

Sources: `types/athlete/group.types.ts`, `lib/constants.ts` and
`data/periodization-matrix.ts`. Jira KAN-178 supplies additional design context.

| Category | Current description in code | Initial design question (resolved below except B) |
| --- | --- | --- |
| E | Elite; high performance and competition | KAN-178 proposes no automatic distance restriction; coach judgment |
| U | Distances above 42 km and mountain ultras | Exact lower threshold and whether 42.195 belongs to M |
| M | 42 km road or trail marathon | Upper threshold, shorter-distance compatibility, and any lower bound |
| H | Half marathon (21 km) | Upper threshold, shorter-distance compatibility, and any lower bound |
| S | Short distances, 5 to 15 km | Confirm inclusive endpoints and treatment below 5 km |
| B | Initiation, adaptation and conditioning | No competitive distance limit is currently defined |

The descriptions are not an implemented numeric policy. For example, S2 has a
weekly range of 35–42 km; that does not make a 42 km race compatible with S.
M and H descriptions do not establish the words “up to” or a lower bound.

## Agreed story behavior

- A valid distance outside a defined policy's tolerance produces a non-blocking warning.
- A supplied non-finite, zero, or negative distance is invalid input.
- Missing competitive context is not an incompatibility. Existing forms may
  still require distance when the user explicitly selects a race objective.
- Undefined policy is explicit and must never be reported as compatible.
- A cohort variant uses the category of its parent sporting group.
- Levels 1, 2, and 3 do not change this distance policy.
- Validation is pure and preserves coach edits; it has no persistence effects.
- Persisted exceptions, automatic reassignment, race calendars, and cohort
  proposals are outside H8.

## Policy semantics for T2/T3

Represent a category policy as one of: bounded, unrestricted, or pending.
A bounded policy uses inclusive endpoints; an
intentionally absent bound differs from an unknown bound. Do not implement a
partially understood category as unrestricted or compatible.

The evaluation should distinguish compatible, incompatible, unrestricted,
pending policy, not applicable, and invalid input. Unrestricted means that this
policy imposes no distance restriction, not that every athlete is prepared for
every race. Unknown category codes are invalid context, not pending categories.

Evaluate validity before category-policy compatibility: E or B must not make a
negative or non-finite distance acceptable. Do not round competitive distance to
whole kilometers for classification. Practical rounding of weekly training
targets is a different rule.

Overlapping category ranges are intentional. This is a
compatibility check for an existing group, not a classifier that must assign
each race to exactly one category.

## Approved initial ranges and tolerance

| Category | Policy | Base range (km) | Inclusive alert-free range with 10% tolerance (km) |
| --- | --- | --- | --- |
| E | Unrestricted | No bounds | Any valid positive distance |
| U | Bounded | 42 and above | 37.8 and above |
| M | Bounded | 21–42 | 18.9–46.2 |
| H | Bounded | 15–21 | 13.5–23.1 |
| S | Bounded | 5–15 | 4.5–16.5 |
| B | Pending | Undefined | Cannot evaluate compatibility |

Keep the base ranges visible. Apply tolerance only to warning thresholds:
`effectiveMinKm = minKm * (1 - tolerancePercent / 100)` and
`effectiveMaxKm = maxKm * (1 + tolerancePercent / 100)` for existing bounds.
An absent bound stays absent. Use a named configurable value initially set to
10 percent; do not add a settings screen or persistence in T2.

Do not round race distances or compound tolerance across evaluations. Exact
effective endpoints are included; numeric comparisons must account for ordinary
floating-point representation without creating a further domain tolerance.

An Ultra athlete may race 10 km and an H athlete may race 50 km: both produce
warnings and can still save. No diagnosis, injury, or readiness is inferred.
The only unresolved category policy is B; retain pending until defined with
the coach. E and B must not collapse into the same null-bound interpretation.

## Review examples and future test cases

| Input | Expected outcome or decision |
| --- | --- |
| S2 + 12 km | Compatible |
| S2 + 42 km | Non-blocking warning |
| S + 5 / 15 km | Compatible |
| S + 4.5 / 16.5 km | Compatible at tolerance endpoints |
| S + 4.499 / 16.501 km | Non-blocking warning |
| H + 21 / 21.0975 km | Compatible |
| M + 21 / 42 / 42.195 / 46 km | Compatible |
| M + 46.201 km | Non-blocking warning |
| U + 37.8 / 42 / 42.195 km | Compatible |
| U + 10 km; H + 50 km | Non-blocking warning; coach can continue |
| B + 10 km | Pending policy until a B rule is confirmed |
| E + valid positive distance | Unrestricted |
| Any category + 0, negative or non-finite distance | Invalid input |
| No competitive distance context | Not applicable to this policy |
| Same race and category, different levels | Same compatibility result |
| Base plan and cohort variant with same group/target | Same result |

## Task boundary

T1 documents evidence, approved initial semantics, and the pending B policy. T2 defines the typed
policy; T3 implements evaluation; T4/T5 integrate and present it; T6 broadens
tests; T7 consolidates the final documentation. Future coach refinements must
update the policy and its boundary examples together.
