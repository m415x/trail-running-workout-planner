# Training Response Convergence Design

**Story:** KAN-345  
**Rule:** `training-response-convergence-v1`  
**Status:** Design approved for implementation planning

## Purpose

Define an explainable, versioned composition layer that helps a coach prioritize athlete review when independent training-response signals converge. The layer does not diagnose fatigue, overload, injury risk, overtraining, or readiness, and it does not mutate planning or realized-training evidence.

## Scope

KAN-345 composes existing semantic outputs rather than recalculating their source metrics:

- plan adherence/trend from KAN-260;
- systematic external-volume assessment from KAN-261/KAN-262 boundaries;
- internal-load trend from KAN-344;
- source limitations, evidence windows, and rule versions.

The result is a coach-review attention level with explicit contributors and limitations.

## Architectural boundary

`training-response-review` is a pure composition layer. Source engines remain independent and do not depend on the convergence layer or on each other.

```text
adherence -------------------+
systematic volume -----------+--> training-response-review
internal load ---------------+           |
                                          +-- attention
                                          +-- contributors
                                          +-- limitations
                                          +-- convergence rule version
```

The compositor consumes semantic states only. It must not derive new distance, duration, elevation, RPE, session-load, adherence, or baseline calculations.

## Attention semantics

The public attention vocabulary is:

- `none`: no known signal currently warrants additional review;
- `info`: known contextual evidence is worth surfacing but does not independently require review;
- `review`: a known source signal already warrants coach review, or multiple weaker independent signals converge without satisfying the priority rule;
- `priority`: independent evidence from systematic external volume and internal load converges over compatible evidence periods and warrants earlier coach review.

`priority` is workflow prioritization only. It is not a physiological or medical classification.

## Contributor roles

Every contributor has a role:

- `evidence`: may participate in attention escalation according to the versioned matrix;
- `context`: explains the athlete situation but cannot independently establish overload or priority.

Each contributor preserves at least:

- `domain`;
- `signal`;
- `role`;
- `evidenceWindow`;
- `sourceRuleVersion`.

The global result preserves its own `convergenceRuleVersion` so source-rule evolution and composition-rule evolution remain independently auditable.

## Source interpretation

### Systematic external volume

Systematic volume is an evidence domain.

- no systematic or isolated excess: no escalation from this domain;
- `isolated_excess`: `info` when considered alone;
- `systematic_excess`: `review` when considered alone.

Two exceeded dimensions within systematic volume remain one source domain and therefore cannot satisfy independent-domain convergence by themselves.

### Internal load

Internal load is an evidence domain only when its source state is available.

- stable/lower recent load: no escalation;
- `recent_load_above_baseline`: `info` when considered alone;
- `warming_up` or `insufficient_data`: limitation/context only, never positive evidence.

No ACWR threshold or new physiological threshold is introduced by this layer.

### Adherence

Adherence remains an independent contextual domain.

- `improving` and `stable` provide context;
- `declining` may explain why review deserves attention but is not an overload signal;
- `insufficient_data` remains an explicit limitation.

Adherence is not required for `priority`, and declining adherence must never independently produce an overload conclusion.

## Decision matrix

The v1 matrix is deliberately small and deterministic.

| Systematic volume | Internal load | Adherence | Attention |
| --- | --- | --- | --- |
| no excess | stable/lower | any | `none` |
| `isolated_excess` | stable/lower | any | `info` |
| `systematic_excess` | stable/lower | any | `review` |
| no excess | `recent_load_above_baseline` | any | `info` |
| `isolated_excess` | `recent_load_above_baseline` | any | `review` |
| `systematic_excess` | `recent_load_above_baseline` | any | `priority` when temporally compatible |

Adherence may add context and limitations to every row but does not change these v1 outcomes by itself.

When evidence that would otherwise converge is temporally incompatible or indeterminate, the compositor must not produce `priority`. Each known contributor retains its standalone semantics.

## Temporal compatibility

Convergence is based on source evidence periods, not on a new global tolerance such as "within seven days".

For two evidence windows `[aStart, aEnd]` and `[bStart, bEnd]`:

- `compatible`: their effective intervals overlap;
- `not_compatible`: both intervals are known and disjoint;
- `indeterminate`: at least one source does not provide enough temporal information to establish overlap safely.

Only `compatible` contributors can satisfy the v1 `priority` convergence rule.

A historical systematic excess must therefore not combine with a separate recent internal-load increase merely because both signals exist in the athlete record.

## Missing and insufficient evidence

Missing evidence never means normality and never erases known evidence.

Examples:

- `systematic_excess` + internal-load `insufficient_data` => `review` plus an internal-load limitation;
- `recent_load_above_baseline` + volume `insufficient_data` => `info` plus a volume limitation;
- all relevant domains insufficient => no positive conclusion, with limitations preserved;
- `systematic_excess` + `recent_load_above_baseline` + indeterminate temporal compatibility => no `priority`; preserve both contributors and the temporal limitation.

The compositor therefore applies monotonic known-evidence semantics: uncertainty in another domain cannot downgrade a known contributor's standalone attention level.

## Explainability and provenance

A result must be explainable without rerunning source calculations. A future UI should be able to render statements such as:

> Prioritized because systematic volume excess and elevated recent internal load were detected over overlapping evidence periods.

The stored/returned explanation is derived from stable semantic contributor identifiers rather than persisted prose. Product copy remains localized through `messages/en` and `messages/es`.

The result should expose:

- final attention;
- ordered contributors;
- source evidence windows;
- temporal compatibility where convergence is evaluated;
- source rule versions;
- convergence rule version;
- limitations/reasons for unavailable or indeterminate evidence.

## Determinism and ordering

Given the same semantic inputs and rule versions, the compositor must return the same result. Contributor ordering must be stable and domain-defined so UI and tests do not depend on incidental object iteration order.

## Product glossary impact

Technical terminology remains English-only under `docs/glossary/`. User-facing help is localized separately under `messages/{locale}/glossary/`.

KAN-345 should extend product help for concepts exposed to the coach, including review priority, convergence, contributor, evidence window, insufficient data, and the distinction between a review signal and a diagnosis. EN and ES catalogs must remain structurally symmetric.

## Testing strategy

Implementation tests should cover the matrix as a table-driven contract and independently cover:

- two independent compatible evidence domains produce `priority`;
- two dimensions from systematic volume do not count as two domains;
- temporal incompatibility prevents `priority`;
- indeterminate temporal compatibility prevents `priority` and produces a limitation;
- missing/insufficient domains do not downgrade known standalone evidence;
- declining adherence remains contextual;
- unknown is never coerced to zero, normal, or negative evidence;
- contributor ordering and rule provenance are deterministic;
- EN/ES product-glossary key/shape parity.

Per the story workflow, the complete local gate is deferred until story end unless an earlier blocker requires execution.

## Non-goals

KAN-345 does not:

- diagnose fatigue, injury, overload, overtraining syndrome, or fitness;
- introduce ACWR or new physiological thresholds;
- calculate source-domain metrics again;
- automatically change training plans;
- merge heterogeneous dimensions into an opaque score;
- infer normality from missing evidence;
- make adherence an overload proxy;
- persist localized explanatory prose.

## Acceptance summary

`training-response-convergence-v1` is acceptable when it deterministically composes existing semantic source signals, preserves unknown/limitations and provenance, escalates to `priority` only for temporally compatible independent systematic-volume and internal-load evidence, keeps adherence contextual, and remains explicitly a coach-review prioritization mechanism rather than a diagnostic model.
