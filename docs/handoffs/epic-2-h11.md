# Handoff — Epic 2 / H11: Planning review and safe persistence

## Status

- Story: `KAN-224` — H11: Revisión integral y persistencia segura del motor de planificación.
- Branch: `h-20-planning-review-persistence`.
- Base: `dashboard` after H10 closure documentation.
- Completed: `KAN-225` — audit of H6–H10 boundaries.
- Completed: `KAN-226` — integral planning review contract.
- Completed: `KAN-227` — integral group/cohort summary.
- Completed: `KAN-228` — provenance, ownership and base/variant origin.
- Current: `KAN-229` — global cross-domain consistency validator.
- Delivery mode: remote-first. Local full gate remains a story-end requirement unless a task specifically needs local DB/runtime validation.

## H11 purpose

H11 is an integration and persistence-hardening story. It must not reimplement H6–H10 domain capabilities. Its job is to compose the existing boundaries into one reviewable, consistent and safely persisted planning workflow for a group or cohort.

The target flow is conceptually:

```text
base group plan / cohort variant
        ↓
planning aggregate + competition calendar
        ↓
integral review model
        ↓
global consistency validation
        ↓
integral diff / block review
        ↓
scoped reconciliation
        ↓
atomic persistence + audit
        ↓
resolved athlete view
```

## KAN-225 audit — existing boundaries

### Already implemented and authoritative

- **H6 session ownership/regeneration** — stable generation keys distinguish `generated`, `generated_modified` and `manual`; regeneration preserves coach-owned records and exposes obsolete generated records instead of blindly appending duplicates.
- **H7 cohort derivation** — a cohort variant is a detached snapshot with new persisted identities and a direct base-plan lineage; mutable IDs are never shared with the source aggregate. Sessions/prescriptions are deliberately outside derivation.
- **H7 athlete planning resolution** — date-aware resolution prefers exactly one applicable cohort variant and otherwise falls back to the group base plan; ambiguity is surfaced rather than chosen silently.
- **H7 plan-association invariants** — a cohort variant belongs to the same group, points directly to one base plan, forbids variant chains and remains within the base planning horizon.
- **H9/H10 competition boundaries** — `CompetitionEntry` is the live plan-scoped calendar source and `CompetitionContext` is the pure periodization input.
- **H10 proposal/review/reconciliation** — competitive adjustment is proposal-first, preserves protected/manual state, requires coach review and emits only the accepted local write set plus audit records for actual changes.

### Partially implemented capabilities to compose, not duplicate

- **Planning review UI** — the existing planning detail page already shows the competition calendar, load progression, intensity distribution, session-generation preferences/preview and macro/meso/micro structure, but there is no single integral review aggregate that explicitly represents base-vs-cohort origin, persisted sessions/prescriptions, provenance, conflicts and pending changes together.
- **Planning regeneration** — `reconcilePlanningRegeneration()` preserves manual volume/D+ and reports conflicts by stable week number, but it is separate from session regeneration and competitive reconciliation.
- **Planning persistence** — `persistGeneratedPlanning()` creates a plan hierarchy transactionally; `persistProgression()` and `persistIntensityPlanning()` each use their own transactions. These are separate transaction boundaries.
- **Session/prescription persistence** — `persistGeneratedSessions()` reconciles generated sessions/prescriptions and writes their audit records in one transaction, but that transaction is independent from planning/intensity persistence.
- **Auditability** — planning modification and session-generation modification records exist, and H10 reconciliation carries competition/provenance context, but there is no one integral audit/write boundary spanning planning + sessions + prescriptions.
- **Idempotency** — deterministic/stable reconciliation exists within planning/session/H10 components, but end-to-end idempotency across the complete accepted review has not yet been proven as one operation.
- **Isolation** — team/group/cohort ownership is validated in several focused flows, but H11 still needs integrated verification across the final review/persistence boundary.

### Missing H11-level capabilities

- a typed integral review model for group/base and cohort-variant plans;
- one global cross-domain consistency validator;
- one integral diff that classifies added/updated/preserved/conflicting changes before persistence;
- block-level accept/reject semantics that cannot create an invalid partial state;
- one unified scoped reconciliation contract across planning, intensity, sessions/prescriptions and competitive windows;
- one atomic persistence boundary for an accepted integral write set;
- complete end-to-end idempotency tests for that boundary;
- real Supabase transaction/rollback validation;
- explicit concurrency/double-submit/stale-review handling.

## KAN-226 integral review contract

`types/training/planning-review.types.ts` now defines a pure composition model instead of another persistence/domain model.

Key decisions:

- `PlanningReviewScope` reuses H7 `GroupTrainingPlanKind` and lineage IDs to distinguish `group_base` from `cohort_variant` without duplicating association rules.
- macro → meso → micro hierarchy wraps existing persisted entities rather than copying their fields into a second planning schema.
- microcycle targets keep the existing `generated | manual` volume/D+ source semantics; the review model only makes units explicit (`targetElevationGainM`).
- persisted Sessions and GroupSessionPrescriptions are paired with the existing H6 provenance unions (`SessionEventGenerationProvenance` / `SessionPrescriptionGenerationProvenance`).
- competitions reuse `CompetitionEntry`; competitive windows reuse `CompetitionImpactWindow`.
- protected values are review annotations that point back to the authoritative boundary (`planning_manual`, `session_generation`, `competition_adjustment`) rather than defining new ownership states.
- cross-domain issues have a common review shape, while stable issue codes/rules remain intentionally deferred to KAN-229.
- `IntegralPlanningReview` is persistence-agnostic: constructing or reviewing it performs no writes.

No DB/schema changes are required for KAN-226.

## KAN-227 integral summary

`lib/periodization/planning-review-summary.ts` now projects an `IntegralPlanningReview`
into the typed `IntegralPlanningReviewSummary` without persistence or UI coupling.

The projection:

- preserves the exact group-base or cohort-variant review scope;
- aggregates target volume (km), positive elevation (m), duration (minutes),
  microcycles, sessions and prescriptions at week, mesocycle, macrocycle and
  whole-plan levels;
- keeps null targets visible in the authoritative aggregate while treating them
  as zero only for summary arithmetic;
- associates plan-scoped competitions with calendar weeks by inclusive ISO date
  range and preserves every A/B/C entry plus its H10 impact window in the
  integral calendar;
- sorts copied hierarchy/calendar arrays deterministically without mutating the
  review aggregate;
- deliberately performs no H11 global validation, diff or persistence work,
  which remain owned by KAN-229 onward.

Focused tests cover hierarchical totals, null targets, competition counts,
deterministic ordering, input immutability, cohort lineage and impact-window
preservation. The remote Vercel build for the implementation commit passed.

## KAN-228 provenance and ownership projection

`lib/periodization/planning-review-provenance.ts` now exposes the existing
H7/H6/H10 source semantics through the integral review and its summary.

The projection:

- preserves the exact H7 `PlanningReviewScope`, including `group_base` or
  `cohort_variant`, cohort identity and direct base-plan lineage;
- exposes persisted microcycle `generated | manual` target sources unchanged;
- carries H10 `generated | coach` competitive-adjustment value sources when a
  reviewed competitive change affected the microcycle;
- preserves H6 session and prescription provenance unions, including stable
  `sharedEventKey` and `generationKey` values;
- derives replaceability only through H6 `canRegenerationReplace()`, so only
  untouched generated records are replaceable;
- groups existing protected-value annotations by entity while retaining the
  authoritative source boundary;
- sorts copied projections deterministically without mutating the review.

No new ownership/provenance enum, persistence model, schema migration or UI was
introduced. Focused tests cover cohort lineage, planning and H10 sources,
generated/generated-modified/manual ownership, stable keys, protection and
input immutability. The remote Vercel build passed.

## Task classification after KAN-225

| Task | Classification | H11 interpretation |
| --- | --- | --- |
| KAN-226 integral review model | implemented | pure composition contract; reuse existing domain entities |
| KAN-227 integral summary | implemented | pure deterministic projection over the integral review aggregate |
| KAN-228 provenance/ownership | implemented | expose authoritative H7/H6/H10 semantics and derived H6 replaceability |
| KAN-229 global validator | missing | compose focused validators into cross-domain checks |
| KAN-230 integral diff | partial | generalize existing regeneration/H10 reconciliation concepts |
| KAN-231 accept/reject blocks | partial | extend explicit H10 coach-review principle to coherent blocks |
| KAN-232 unified partial reconciliation | partial | compose planning, session and competitive scoped reconciliation |
| KAN-233 stable IDs | mostly implemented | audit and test cross-boundary stability; fix only real gaps |
| KAN-234 atomic persistence | partial | separate transactions exist; one accepted aggregate transaction is missing |
| KAN-235 end-to-end idempotency | partial | component guarantees exist; prove complete workflow |
| KAN-236 cohort → group resolution | already implemented | integration/regression validation only |
| KAN-237 isolation | partial | consolidate team/group/cohort/plan scope tests |
| KAN-238 end-to-end tests | missing | compose H6–H10 paths rather than duplicate unit tests |
| KAN-239 Supabase rollback | missing | real integration gate |
| KAN-240 concurrency/failure handling | missing | define stale/double-submit and rollback behavior |
| KAN-241 docs/handoff | pending | consolidate final H11 architecture/history and handoff |

## Key implementation constraints

- Do not replace existing H6 generation ownership or H10 review/provenance with new competing models.
- A cohort remains a shared planning variant, not an athlete-specific override.
- Athlete resolution continues to use cohort first, group fallback, with ambiguity surfaced.
- Planning, intensity, sessions and prescriptions may have separate current persistence functions; H11 may orchestrate/refactor them behind one transaction but must preserve their validated domain rules.
- Stable identity is an invariant. Avoid delete/recreate strategies that break regeneration identity or audit history.
- Block-level rejection must not allow a partially accepted set that violates referential or domain consistency.
- The integral review artifact should be pure/reviewable before persistence whenever possible.
- H12 preparation assessment is explicitly outside H11.

## Next step

Close `KAN-228` after recording the projection in Jira. Then start `KAN-229` by composing existing focused validators into stable cross-domain consistency rules; do not mix validation with persistence.
