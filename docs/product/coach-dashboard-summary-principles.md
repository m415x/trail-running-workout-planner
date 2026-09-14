# Coach dashboard summary principles

## Purpose

The coach dashboard should prioritize rapid triage across many athletes. Detailed training evidence remains available in each athlete profile, but the team-level summary must make important states scannable without requiring the coach to open every athlete individually.

## Product principle

Use compact visual indicators — icons, short labels and/or small numeric values — to surface athlete states that may deserve attention. The dashboard is a prioritization layer, not a replacement for athlete detail.

Examples of candidate summary signals include:

- insufficient or degraded evidence coverage;
- estimated short-term load unusually high relative to the athlete's recent long-term load;
- persistent negative/positive estimated load balance when relevant to the product rule set;
- adherence deterioration or repeated confirmed non-completion;
- overload or fatigue-related alerts produced by explicit, versioned rules;
- other readiness or continuity signals supported by the underlying domain model.

## Interaction model

1. The coach scans the roster/dashboard.
2. Each athlete exposes only a small set of high-signal indicators.
3. Indicators should communicate severity/status consistently through iconography, label, number and accessible text; color must not be the only carrier of meaning.
4. Selecting an athlete or indicator navigates to the detailed athlete view where the full evidence, time window, rule/version, limitations and history are available.
5. The dashboard should support prioritization (who should I inspect first?) rather than diagnosis.

## Scientific and semantic constraints

- Do not label estimated load trends as direct physiological measurements of fatigue or fitness.
- Do not infer injury risk from a single metric or ratio.
- Missing/unknown evidence must remain distinguishable from confirmed rest or normal status.
- Any alert or compact state must remain traceable to its evidence window and versioned rule.
- Where evidence is insufficient, prefer an explicit unknown/insufficient indicator over a reassuring green state.

## Architectural implication

Detailed domains such as realized training, plan-real comparison, adherence, training load and future alert rules should expose stable summary/read-model fields suitable for aggregation by the coach dashboard. The dashboard should consume those projections rather than reimplementing the underlying calculations.

## Future dashboard acceptance direction

A future coach-summary story should validate at minimum:

- rapid scan of multiple athletes without opening each profile;
- clear distinction between normal, attention-needed and insufficient-data states;
- compact representation of significant load/adherence/readiness signals;
- deterministic drill-down from any indicator to the athlete detail that explains it;
- accessibility without relying exclusively on color;
- avoidance of false precision or unsupported physiological/medical claims.

This document records a future product requirement and does not introduce dashboard implementation work into KAN-261/KAN-262 by itself.
