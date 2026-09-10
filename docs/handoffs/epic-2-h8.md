# Handoff — Epic 2 / H8: Category and competitive distance

## Starting state

- Story: KAN-177; current task: T1 / KAN-178.
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

## Next steps

Proceed to T2 / KAN-179: model the typed policy with distinct bounded,
unrestricted and pending states and an explicit tolerance parameter/default.
Read the architecture document for effective endpoints and test examples.
Do not infer competitive limits from weekly kilometers or enforce exclusive
category ranges. B remains pending without blocking T2/T3.

## Validation

Documentation-only task: review file diffs, source references and relative
Markdown links. No app walkthrough is required; manual acceptance is the domain
review above. Runtime tests are required when implementation begins, following
AGENTS.md and the established task workflow.
