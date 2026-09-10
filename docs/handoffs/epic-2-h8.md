# Handoff — Epic 2 / H8: Category and competitive distance

## Starting state

- Story: KAN-177; current task: T2 / KAN-179.
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

## Next steps

Proceed to T3 / KAN-180: implement pure evaluation, including
runtime input/configuration validation and inclusive tolerance boundaries.
Read the architecture document for effective endpoints and test examples.
Do not infer competitive limits from weekly kilometers or enforce exclusive
category ranges. B remains pending without blocking T2/T3.

## Validation

T1 was documentation-only and accepted through domain review.
T2: 267 existing tests passed; production build (including TypeScript) passed;
lint reports zero errors and the same 11 baseline warnings. Diff whitespace
checks passed. No new UI behavior exists to exercise; review the policy states,
base ranges and default tolerance before approving the task commit.
