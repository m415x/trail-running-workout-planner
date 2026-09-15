# Training Response Convergence

## Purpose

`training-response-convergence-v1` composes existing semantic monitoring signals into a traceable coach-review attention level. It is a triage layer: it helps decide which athlete state deserves earlier review without introducing a physiological diagnosis or a global numeric risk score.

The layer does not recalculate source metrics. Each source domain owns its own measurement, evidence sufficiency, and semantic interpretation.

## End-to-end architecture

The integrated path is deliberately layered:

```text
systematic volume ─┐
internal load ─────┼─> source adapters ─> convergence/triage ─> compact/detail projections
adherence ─────────┘
```

The adapters normalize already-interpreted source signals. Convergence establishes workflow attention and reasons. Projections expose stable coach-facing data contracts without introducing presentation copy or new domain inference.

## Domain boundaries

Three source domains participate in v1:

1. **Systematic external volume** — evidence from the systematic-volume domain. Multiple dimensions such as distance, duration, and elevation remain one evidence domain.
2. **Internal load** — consumes the versioned `InternalLoadSignal` boundary. The convergence layer must not inspect or reinterpret `loadBalanceAu`.
3. **Adherence** — contextual information only in v1. A declining adherence trend can help explain the athlete state but cannot independently establish overload or priority.

The adapter boundary is implemented in `lib/training-response/training-response-adapters.ts`.

## Semantic input contract

Each contributor carries:

- `domain`
- `signal`
- `role` (`evidence` or `context`)
- `evidenceWindow`
- `sourceRuleVersion`

Source uncertainty is preserved as explicit limitations. `insufficient_data` is never converted into normality, absence of a problem, or positive evidence.

## Attention levels

The domain attention contract is:

- `none` — no source evidence currently requires review.
- `info` — useful evidence exists, but it does not independently require a stronger review level.
- `review` — a known source signal warrants coach review.
- `priority` — independent systematic-volume and internal-load evidence converge over compatible evidence periods.

These values are workflow attention levels, not physiological severity labels.

The compact/detail projection layer may additionally expose `unknown` when the integrated review has no meaningful known result and only insufficient evidence. `unknown` is a projection state, not a fifth convergence attention level.

## Convergence matrix v1

| Systematic volume | Internal load | Temporal relation | Adherence | Result |
| --- | --- | --- | --- | --- |
| systematic excess | recent load above baseline | compatible | any | `priority` |
| systematic excess | recent load above baseline | not compatible / indeterminate | any | `review` + limitation |
| systematic excess | stable/lower or insufficient | any | any | `review` (+ limitation when insufficient) |
| within plan / insufficient | recent load above baseline | any | any | `info` (+ limitation when insufficient) |
| no review evidence | no review evidence | any | declining | `none`, adherence retained as context |
| insufficient across domains | insufficient | indeterminate | insufficient | domain `none`, projection `unknown` |

Multiple systematic-volume dimensions cannot satisfy the independent-domain requirement because they share the same source domain.

## Temporal compatibility

Convergence requires temporal compatibility between the independent evidence contributors. V1 uses direct interval overlap:

`left.startDate <= right.endDate && right.startDate <= left.endDate`

The result is one of:

- `compatible` — evidence windows overlap.
- `not_compatible` — both windows are known but disjoint.
- `indeterminate` — at least one required evidence window is unavailable.

Disjoint or indeterminate evidence cannot produce `priority`. The corresponding limitation remains visible to downstream consumers.

## Monotonic uncertainty behavior

Missing evidence in one domain does not erase stronger known evidence from another domain. For example:

`systematic_excess + internal_load_insufficient_data -> review + limitation`

This prevents uncertainty from being interpreted as reassurance.

## Coach projections and evidence coverage

`projectTrainingResponseCompact()` exposes only the workflow status, primary reason, whether limitations exist, and convergence rule version.

`projectTrainingResponseDetail()` exposes reasons, contributors, unknowns, temporal compatibility, rule version, and qualitative domain coverage. Coverage is intentionally semantic:

- `available` — a traceable contributor exists for the domain.
- `insufficient` — the domain explicitly reports insufficient evidence.
- `known_without_contributor` — the domain was evaluated without producing a contributor requiring display.

The projection does not invent a quantitative coverage percentage because the integrated review contract does not preserve one consistently across all source domains.

## Provenance and rule versioning

The integrated output carries `training-response-convergence-v1`. Every contributor retains its own `sourceRuleVersion`, so source interpretation and convergence policy can evolve independently.

The current semantic boundaries include the systematic-volume rule version, `internal-load-signal-v1`, the adherence rule configuration, and `training-response-convergence-v1`. A future change in decision semantics must use a new convergence rule version rather than silently changing the meaning of historical outputs.

## End-to-end walkthrough

A representative priority path is:

1. Systematic-volume assessment reports `systematic_excess` for a known evidence window.
2. Internal-load semantic signal reports `recent_load_above_baseline` for an overlapping window.
3. Adherence may contribute context, for example a declining trend, but does not establish overload evidence.
4. Source adapters preserve domain, semantic signal, evidence window, role, and source rule version.
5. Convergence confirms independent evidence and compatible periods, producing `priority` plus explicit reason codes.
6. Compact projection exposes the priority status and primary reason.
7. Detail projection preserves all contributors, reasons, coverage, unknowns, temporal compatibility, and rule provenance for coach drill-down.

The inverse cases are equally important: insufficient evidence survives as limitations/unknowns, and disjoint evidence periods cannot be promoted to priority.

## Scientific and product boundaries

This model is an operational review heuristic, not a validated medical or physiological risk model. In particular:

- `priority` means **review this athlete earlier**; it does not mean severe fatigue, harmful overload, injury risk, overtraining syndrome, or impaired readiness.
- The model does not estimate a probability or likelihood of injury, illness, non-functional overreaching, or overtraining.
- Association between external volume, internal load, adherence, and an athlete outcome is not treated as causation.
- Missing or insufficient evidence is represented explicitly and must not be interpreted as reassurance.
- Adherence is contextual in v1 and must not be used as independent overload evidence.
- Multiple measurements from the same systematic-volume domain do not become independent evidence merely because several dimensions agree.
- Temporal compatibility means overlapping observation periods, not proof that two signals share a physiological cause.
- Qualitative coverage in the projection describes evidence availability, not confidence, probability, data quality percentage, or model certainty.
- The current rule is deterministic and versioned; it is not a substitute for coach judgment or clinical assessment.

Future qualitative athlete-reported inputs such as RPE and feeling may add contextual evidence only after their semantics and evidence policy are researched and versioned separately.

## Verification scenarios

The focused end-to-end contract is protected by `tests/training-response/training-response-e2e.test.ts`, including:

- compatible independent evidence reaching `priority` and both projections;
- insufficient evidence surviving to projection-level `unknown`;
- temporally incompatible evidence remaining below `priority`;
- declining adherence remaining contextual;
- operational output remaining free of diagnostic and probabilistic claims.

Unit-level contracts remain in the training-response adapter, convergence, integrated-review, projection, and glossary tests.

## Implementation map

- Contract: `types/training/training-response-review.types.ts`
- Internal-load semantic boundary: `lib/training-load/internal-load-signal.ts`
- Source adapters: `lib/training-response/training-response-adapters.ts`
- Convergence policy: `lib/training-response/training-response-convergence.ts`
- Integrated application function: `lib/training-response/athlete-training-response-review.ts`
- Coach projections: `lib/training-response/training-response-projections.ts`
- End-to-end fixtures: `tests/training-response/fixtures/training-response-e2e-fixtures.ts`
- End-to-end contract: `tests/training-response/training-response-e2e.test.ts`
- Training-response contract tests: `tests/training-response/`
