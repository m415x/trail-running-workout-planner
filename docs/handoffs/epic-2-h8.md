# Handoff — Epic 2 / H8: Category and competitive distance

## Starting state

- Story: KAN-177; current task: T6 / KAN-183.
- Branch: `h-17-category-race-distance`.
- Started from clean, synchronized `dashboard` at H7 merge `e48ca8d`.
- Read AGENTS.md, docs/README.md, the H7 handoff and cohort architecture.

## T1 completed — user-approved initial policy

Reviewed the actual E/U/M/H/S/B category definitions and the separate weekly
volume matrix. Added [policy design](../architecture/category-race-distance.md)
with source evidence, evaluation semantics, boundary examples and precise
questions for the coach. The M/H descriptions do not establish complete ranges.

The user approved inclusive base ranges U >=42, M 21–42, H 15–21, S 5–15 km,
with a configurable initial 10% outward tolerance used only for alerts.
E is explicitly unrestricted; B remains pending. Warnings never block valid
competitive distances. No runtime code, schema, fixtures, or category constants
were changed. The user approved closure of this documentation task.

## T2 completed — user approved

Added readonly discriminated policy types and an exhaustive frozen catalog,
separating E (unrestricted) from B (pending). Bounded policies require at least
one bound. Added frozen default options with tolerancePercent = 10 and JSDoc
for units, inclusivity, configuration constraints and scope. T2 adds no evaluator,
UI or persistence changes. The user approved T2 after technical validation.

## T3 completed — user approved

T3 implemented `validateRaceDistanceForCategory` and the shared result type.
Nine focused tests passed. The evaluator has no UI or persistence dependency;
it reports non-blocking mismatches with direction and original/effective bounds.
Category/options validation precedes missing-distance handling; E/B do not
bypass invalid inputs. Machine epsilon handles inclusive decimal boundaries.
The user approved T3 after validation. No UI behavior is available to manually
test in T3.

## Next steps

T4 implemented: the central evaluator is adapted by race-distance-context.ts.
Generated drafts/previews carry raceDistanceCompatibility; plan list/detail
queries enrich persisted macrocycles using the parent group's category, so
cohort variants inherit the same policy. Results are computed, not persisted.
Incompatibility never becomes a blocking regeneration conflict.
Five integration tests cover generation, preview states, no race, persisted
snapshot enrichment and group-code handling (14 focused H8 tests passed).
T4 user approval received after the manual regression walkthrough. Continue
with T5 / KAN-182 (UI) after committing T4.

Manual T4 regression: open planning list/detail; create a disposable S2 race
plan with 42 km, generate/save progression, reload and verify race distance and
group stay unchanged. Also check a no-race plan. Warnings are not visible yet.
The user confirmed this walkthrough passed.
Read the architecture document for effective endpoints and test examples.
Do not infer competitive limits from weekly kilometers or enforce exclusive
category ranges. B remains pending without blocking T2/T3.

## T5 completed — manual checks approved

Localized RaceDistanceNotice now appears in the creation form and plan detail.
It shows mismatch context, base range, 10% tolerance, and permission to continue
through the existing save action. B gets a pending-policy informational notice;
compatible/E/no-race states are silent. Detail uses saved macrocycle snapshots.
Distance input accepts decimal steps for half/full-marathon precision.
No overrides, checkbox, automatic group/load changes, or save restrictions added.
The user confirmed the manual checks passed. Next task after commit:
T6 / KAN-183 (policy/integration test review).

Manual checks: S2 42 warns, 12 clears; S2 16.5 is accepted and 16.501 warns;
H 21.0975 and M 42.195 are accepted; E silent; B pending; non-race hides notice.
Save S2 42, reload, and save progression: warning remains and data are retained.
Check English messages, mobile wrapping, and console.

## Validation

T6 adds seven tests without changing runtime behavior: five rendered-component
tests using the actual next-intl provider, plus manual volume/D+ preservation
and stale/invalid snapshot reevaluation. H8 now has 21 focused tests.
Rendering tests are not browser interaction/E2E tests; T5's approved walkthrough
remains the evidence for save/reload, responsiveness and live interaction.
The user approved T6. Next is T7 / KAN-184 documentation closeout.

T6 validation: full suite 288 passed; build passed after fixing test-provider
typing. The final test-only provider-props adjustment passed focused rendering
tests and focused lint. Full lint baseline: zero errors, 11 known warnings.

T5: 281 tests passed. A notice type-narrowing error found by the initial build
was corrected; subsequent lint and build/type checking passed (11 unchanged
lint warnings, zero errors). The user approved the visual walkthrough without
requesting code changes; the unchanged validation gate was not repeated.

T4: 281 tests passed (five new integration tests); production build and its
TypeScript check passed. Lint: zero errors and 11 existing warnings.

T3: all 276 tests passed (including nine new evaluator tests), standalone
TypeScript and production build passed. Lint: zero errors, 11 existing warnings.
No UI walkthrough applies until integration; user review is complete.

T1 was documentation-only and accepted through domain review.
T2: 267 existing tests passed; production build (including TypeScript) passed;
lint reports zero errors and the same 11 baseline warnings. Diff whitespace
checks passed. No new UI behavior exists to exercise; review the policy states,
base ranges and default tolerance before approving the task commit.
