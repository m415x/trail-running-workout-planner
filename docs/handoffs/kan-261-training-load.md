# KAN-261 — Training load v1 handoff

## Scope delivered

KAN-261 introduces an explainable, versioned training-load domain derived only from reliable realized-training evidence.

The v1 method is:

`internalLoadAU = durationMin × sessionRpe`

The visible unit is **AU (arbitrary units)**. AU is relative/internal and must not be presented as energy, power, physiological stress, injury risk, fitness, fatigue, or readiness.

Scientific rationale and references live in:

`docs/research/training-load-fitness-fatigue-scientific-foundations.md`

## Rule version

Default rule: `srpe-duration-v1`.

Parameters are explicit and injectable:

- short-term exponential time constant: 7 days;
- long-term exponential time constant: 42 days;
- minimum reliable warm-up: 42 consecutive usable days;
- unknown evidence breaks continuity in v1;
- required metrics: `durationMin` and `rpe`.

The 7/42 values are heuristics/conventions for the MVP, not universal physiological constants.

## Evidence semantics

Daily states:

- `known_load`: performed training with reliable duration + session RPE;
- `confirmed_rest`: explicit non-exposure evidence; contributes 0 AU;
- `unknown_load`: performed training exists but duration or RPE is missing;
- `no_evidence`: neither reliable performed training nor confirmed rest is known.

`unknown_load` and `no_evidence` are never converted to zero load.

If a day is unknown, the v1 longitudinal series resets rather than silently assuming recovery. The following reliable observations begin a new warm-up segment.

## Trail-specific context

Distance and elevation gain are retained as external context only. They do not multiply sRPE load in v1. Elevation loss is represented in the contract but remains `null` until realized capture persists it reliably.

This avoids pretending that a single D+ multiplier captures both uphill metabolic demand and downhill eccentric/neuromuscular demand.

## Longitudinal state

The domain exposes:

- daily load AU;
- short-term estimated load;
- long-term estimated load;
- estimated load balance (`longTerm - shortTerm`);
- evidence coverage;
- current reliable streak;
- rule version;
- status: `insufficient_data`, `warming_up`, or `available`.

The calculations use exponential smoothing without rounding intermediate values. UI formatting may round for presentation, but the domain must preserve full numeric precision.

Legacy CTL/ATL/TSB terminology is not used as primary product language. If referenced in technical discussion, it is only as a mathematical analogy to accumulated-load estimates.

## Persistence decision

**KAN-261 v1 is calculated on demand and does not persist derived load snapshots.**

Reasons:

1. realized training is already the authoritative durable evidence;
2. rule parameters are cheap to recompute for the current MVP scale;
3. avoiding snapshots prevents stale derived state after corrections to realized training;
4. versioned rules can be replayed against the same evidence for reproducibility.

Persisted snapshots should only be introduced later if profiling demonstrates a real performance need or if historical audit requirements demand preserving previously published derived values. Any future snapshot must store at least rule version, rule parameters, evidence boundary and calculation timestamp.

## Isolation and source boundary

`getAthleteTrainingLoadAction()` resolves the athlete through the existing coach/team boundary and then reads realized records through `listRealizedTrainingRecordsForAthleteInDateRange(athlete.id, athlete.teamId, ...)`.

Planning data is never used to fill load gaps.

## UI copy constraints

Coach-facing UI must use neutral language:

- “Carga de entrenamiento estimada”;
- “Carga estimada de corto plazo”;
- “Carga estimada de largo plazo”;
- “Balance de carga estimado”.

Avoid claims such as:

- “fatiga fisiológica”;
- “fitness medido”;
- “recuperado/no recuperado”;
- “riesgo de lesión”;
- “óptimo/sobreentrenado” based on the load series alone.

The UI explicitly states that the series is a mathematical estimate, not a direct physiological measurement.

## Walkthrough

On an athlete's **Entrenamiento realizado** page verify:

1. the estimated-load card appears before adherence;
2. the card displays rule version and current status;
3. AU values are shown for daily/short/long/balance only when evidence permits them;
4. coverage and reliable-streak counts are visible;
5. the method is described as session RPE × duration;
6. a missing-evidence day does not appear as 0 AU;
7. confirmed rest contributes 0 AU;
8. after a gap, the series returns to warm-up rather than continuing as if the gap were rest;
9. distance/D+ do not alter AU when duration/RPE are unchanged;
10. no copy interprets the result as diagnosis, direct fitness/fatigue, readiness, or injury risk.

## Final gate

Before closing KAN-261 run from `h-25-fitness-fatigue`:

```bash
pn test
pn lint
pn tsc
pn build
```

All four commands must pass on the final HEAD.
