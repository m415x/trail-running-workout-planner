# Training Response Convergence

## Purpose

`training-response-convergence-v1` composes existing semantic monitoring signals into a traceable coach-review attention level. It is a triage layer: it helps decide which athlete state deserves earlier review without introducing a physiological diagnosis or a global numeric risk score.

The layer does not recalculate source metrics. Each source domain owns its own measurement, evidence sufficiency, and semantic interpretation.

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

The public attention contract is:

- `none` — no source evidence currently requires review.
- `info` — useful evidence exists, but it does not independently require a stronger review level.
- `review` — a known source signal warrants coach review.
- `priority` — independent systematic-volume and internal-load evidence converge over compatible evidence periods.

These values are workflow attention levels, not physiological severity labels.

## Convergence matrix v1

The strongest v1 convergence is intentionally narrow:

`systematic_excess + recent_load_above_baseline + compatible evidence windows -> priority`

A systematic excess alone remains `review`. Recent internal load above baseline alone remains `info`. Declining adherence remains context and does not raise attention by itself.

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

## Provenance and versioning

The output carries `training-response-convergence-v1`, while each contributor retains its source rule version. Internal load additionally crosses the `internal-load-signal-v1` semantic boundary before entering this layer.

This separation allows source models and convergence policy to evolve independently and keeps future review decisions auditable.

## Non-diagnostic boundary

`priority` means **review this athlete earlier**. It must not be presented as a diagnosis of fatigue, harmful overload, injury risk, overtraining, or readiness impairment.

Future qualitative athlete-reported inputs such as RPE and feeling may add contextual evidence only after their semantics and evidence policy are researched and versioned separately.

## Implementation map

- Contract: `types/training/training-response-review.types.ts`
- Internal-load semantic boundary: `lib/training-load/internal-load-signal.ts`
- Source adapters: `lib/training-response/training-response-adapters.ts`
- Convergence policy: `lib/training-response/training-response-convergence.ts`
- Integrated application function: `lib/training-response/athlete-training-response-review.ts`
- Contract tests: `tests/training-response/`
