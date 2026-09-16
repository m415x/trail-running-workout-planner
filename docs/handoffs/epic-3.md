# Epic 3 — Seguimiento individual, carga y catálogo competitivo

## Current status

Epic 3 Stories 1–8 are complete through **KAN-264**. The current `dev` baseline includes Athlete Stats and its responsive Athlete shell. The next story is **KAN-281 — Historia 9: Registrar inscripciones y participación histórica en carreras**.

Use the story-specific handoffs and architecture documents as durable authority rather than treating older branch references in historical handoffs as current operational instructions.

## Delivered foundations relevant to KAN-281

### Competitive catalog — KAN-257

```text
RaceEvent → RaceEdition → RaceCourse
                            ├→ explicit selection → CompetitionEntry snapshot
                            ├→ explicit selection → TrainingGoal snapshot
                            └→ reserved RaceRegistration target
```

Catalog identity is explicit and historical consumer snapshots do not silently refresh after catalog edits/archive. `TrainingGoal`, `CompetitionEntry` and registration are independent facts. See `docs/architecture/competitions/`.

### Realized training and monitoring — KAN-258 through KAN-263

Epic 3 now has durable realized-training evidence, plan-vs-real comparison, adherence, estimated internal load, systematic-volume monitoring and Training Response convergence. These models preserve `unknown != 0` and do not fabricate performed training from planning data.

A future race registration/result may provide competitive context, but KAN-281 must not turn registration or result state into realized-training evidence implicitly.

### Athlete Stats — KAN-264

KAN-264 established consumer-neutral Training Analytics and explicit Athlete Stats Projection allowlists with `/stats` and Training, Load, Adherence and Competition detail routes. Athlete presentation is mobile-first; coach-only interpretation remains outside athlete disclosure by default.

Final reported KAN-264 gate: 790/790 tests across 157 suites; lint, TypeScript, build and i18n passed; 452 ES/EN message leaves aligned; responsive walkthrough approved.

See [`kan-264-athlete-stats.md`](kan-264-athlete-stats.md) and [`athlete-stats-analytics.md`](../architecture/monitoring/athlete-stats-analytics.md).

## KAN-281 starting boundary

KAN-275 deliberately reserved only the minimum future registration target:

```text
teamId + athleteProfileId + concrete RaceCourseReference
```

It intentionally left lifecycle, result/participation semantics, historical snapshot fields, persistence, deduplication and integrations undefined. Those decisions now belong to KAN-281. See [`race-registration-boundary.md`](../architecture/competitions/race-registration-boundary.md).

### Accepted MVP clarification

For KAN-281, `RaceRegistration` represents an **effective individual registration**, not an intention to register. Competitive intent remains represented by existing goal/planning concepts.

Registration lifecycle is distinct from participation/result evidence. An athlete may be registered while participation is still unknown. Missing evidence must not be inferred as DNS or DNF.

The complete contract must be designed before implementation tasks are created.

## Baseline invariants for subsequent work

- `RaceCourse` is the minimum concrete competitive target.
- Team and athlete scope are explicit for individual registration.
- Goal, planning entry and registration remain independent facts.
- Historical facts survive catalog evolution without silent mutation.
- Nominal course distance and actually covered distance are different facts.
- Unknown participation/result/distance evidence remains unknown.
- Registration/result data does not itself prove readiness, authorization, fitness or performed training.
- Existing authorization and athlete-disclosure boundaries must not be weakened.

## Historical material

Earlier implementation chronology and detailed commit traceability for KAN-257 remain available through repository history. Story-specific durable outcomes are indexed from `docs/README.md`; completed plans and superseded operational handoffs should be treated as historical evidence, not current instructions.
