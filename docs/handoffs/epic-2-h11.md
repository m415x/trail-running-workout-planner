# Handoff — Epic 2 / H11: Planning review and safe persistence

## Status

- Story: `KAN-224` — H11: Revisión integral y persistencia segura del motor de planificación.
- Branch: `h-20-planning-review-persistence`.
- Base: `dashboard` after H10 closure documentation.
- Completed: `KAN-225` — audit of H6–H10 boundaries.
- Completed: `KAN-226` — integral planning review contract.
- Completed: `KAN-227` — integral group/cohort summary.
- Completed: `KAN-228` — provenance, ownership and base/variant origin.
- Completed: `KAN-229` — global cross-domain consistency validator.
- Completed: `KAN-230` — integral diff before regeneration/persistence.
- Completed: `KAN-231` — coherent block acceptance/rejection.
- Completed: `KAN-232` — exact block/range-scoped reconciliation.
- Completed: `KAN-233` — stable identity audit across the integral write set.
- Completed: `KAN-234` — atomic persistence boundary for the accepted write set.
- Completed: `KAN-235` — end-to-end idempotency of the integral workflow.
- Current: `KAN-236` — cohort-first/group-fallback resolution regression.
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

## KAN-229 global consistency validator

`lib/periodization/planning-review-validator.ts` now performs one pure
pre-persistence pass over the complete `IntegralPlanningReview`.

The validator:

- returns stable, typed issue codes with `warning` or blocking `conflict`
  severity and entity/field references;
- verifies scope against plan ID, group, base/variant kind, cohort and direct
  source-plan lineage;
- verifies load/intensity strategy ownership and composes the existing load
  strategy validator instead of redefining its policy;
- checks macro → meso → micro parent references, type-scoped duplicate IDs,
  valid date ranges, child containment and target projection consistency;
- composes the existing intensity feasibility validator against materialized
  weekly sessions;
- checks session team/date ownership, prescription session/group/microcycle
  references and H6 stable provenance keys;
- checks competition plan ownership, calendar horizon and H10 impact-window
  identity/date/priority coherence;
- verifies that every protected-value annotation points to an entity present in
  the review;
- carries pre-existing review issues forward and never mutates or persists the
  aggregate.

Warnings remain reviewable and do not make the result invalid; any conflict
blocks persistence. Focused tests cover a valid immutable aggregate,
multi-boundary conflicts in one pass, non-blocking warnings and malformed H6
provenance. The remote Vercel build passed.

## KAN-230 integral pre-persistence diff

`lib/periodization/planning-review-diff.ts` now compares a persisted/current
integral review with a proposed review without accepting or writing changes.

The diff:

- classifies each matched entity as `added`, `updated`, `preserved` or
  `conflict`;
- keeps the classification set required by H11 while representing concrete
  `create`, `update`, `remove` or `none` operations separately;
- includes inspectable field-level current/proposed values and deterministic
  aggregate counts;
- matches macro/meso/micro/competition entities by stable persisted ID;
- matches generated Sessions and GroupSessionPrescriptions by authoritative H6
  `sharedEventKey` / `generationKey`, so an identity-breaking recreation is
  surfaced as conflict rather than a duplicate create;
- allows ordinary generated changes and removals while preserving manual,
  generated-modified, coach-owned or explicitly protected values;
- treats disappearance of protected records as preservation, never silent
  deletion;
- carries global validation issues from KAN-229 and reports them through the
  same pre-persistence artifact;
- remains pure and leaves block acceptance to KAN-231.

Focused tests cover identical/preserved state, generated updates/removals,
manual preservation, added entities, manual/coach protection, protected session
changes, stable-key identity and input immutability. The remote Vercel build
passed.

## KAN-231 coherent block decisions

`lib/periodization/planning-review-blocks.ts` now turns the KAN-230 diff into
pure, reviewable acceptance units without persisting any decision.

The decision boundary:

- groups every changed macrocycle with its complete mesocycle, microcycle,
  session and prescription subtree, so internal references cannot be split by a
  partial coach decision;
- keeps plan changes and each competition change in explicit blocks;
- declares plan dependencies whenever a changed plan block must be accepted
  with a macrocycle or competition block;
- excludes unchanged/preserved items from the decision set while continuing to
  surface protected conflicts from the diff;
- marks blocks containing protected or global validation conflicts as
  non-acceptable;
- validates duplicate, unknown, conflicted and dependency-breaking decisions;
- retains the coach ID, timestamp and optional reason on every accepted or
  rejected block;
- produces only the accepted diff item identities for KAN-232 reconciliation;
- remains immutable and performs no database write.

The KAN-230 diff now carries `parentIdentity`, preserving its hierarchy for
safe grouping without duplicating H6 ownership or H10 provenance. Focused tests
cover subtree cohesion, dependencies, accepted write-set projection, coach
provenance, conflict blocking and input immutability. The remote Vercel build
passed.

## KAN-232 exact scoped reconciliation

`lib/periodization/planning-review-reconciliation.ts` now rebuilds the
KAN-230/KAN-231 review pipeline and projects only valid, explicitly accepted
changes into a pure persistence-ready write set.

The reconciliation boundary:

- requires current and proposed reviews to have the exact same team, group,
  plan, group-base/cohort-variant kind and lineage scope;
- rebuilds the integral diff and coherent blocks instead of trusting caller
  supplied item identities;
- validates every coach decision and refuses conflicted or
  dependency-breaking selections;
- emits only accepted `create | update | remove` items; unchanged descendants,
  rejected blocks and pending blocks never enter the write set;
- preserves block ranges, parent identities and coach decision provenance on
  every operation;
- separates exact planning, Session, GroupSessionPrescription and competition
  operations so KAN-234 can route them through the existing H6/H10 persistence
  boundaries in one transaction;
- supports both group-base and shared cohort-variant plans without introducing
  athlete-specific overrides;
- performs no database mutation and never expands a selection to a complete
  macrocycle implicitly.

Focused tests cover an accepted range inside a two-macrocycle cohort variant,
rejected and pending block exclusion, exact session/prescription inclusion,
coach provenance, protected-conflict refusal, scope isolation and input
immutability. The remote Vercel build passed.

## KAN-233 stable regeneration identities

The identity audit confirmed that random UUID creation remains correct at two
boundaries: initial persistence of a brand-new plan and one-time derivation of
an independent cohort variant. Reconciliation must not use those new UUIDs as
logical matching keys.

`lib/periodization/planning-stable-identity.ts` now centralizes the
authoritative H11 matching rules:

- a macrocycle is stable by plan plus generated ordinal;
- a mesocycle is stable by its macrocycle key plus mesocycle number;
- a microcycle is stable by plan plus week number, matching the existing
  planning-regeneration boundary;
- generated Sessions continue to use the H6 `sharedEventKey`;
- generated GroupSessionPrescriptions continue to use the H6 `generationKey`;
- manual Session/prescription records continue to use their persisted IDs;
- base and cohort-variant identities remain isolated because every planning key
  is namespaced by the owning plan ID.

The KAN-230 diff now matches macro/meso/micro entities through these logical
keys. Transient draft IDs and regenerated parent UUIDs do not produce false
delete/create operations; a real update retains the current persisted entity
ID. Duplicate logical positions still fail fast, while H6 protected identity
rules remain unchanged.

Focused tests prove deterministic keys, base/variant isolation, H6 key reuse,
invalid-key rejection, equivalent hierarchy regeneration with entirely new
draft UUIDs, persisted-ID retention on a real update, and the updated KAN-230–
KAN-232 pipeline. The remote Vercel build passed.

## KAN-234 atomic persistence boundary

`lib/periodization/planning-review-persistence.ts` now applies one validated
KAN-232 reconciliation and all of its audit records through a single shared
transaction callback.

The boundary:

- refuses duplicate operations, unaccepted identities, invalid coach
  provenance, excluded blocks and any mismatch between accepted blocks and the
  atomic write set before opening a transaction;
- orders removals from prescriptions toward parent planning entities, then
  orders creates/updates from plan parents toward sessions and prescriptions;
- applies each operation and appends its audit record through the same
  transaction handle;
- includes exact group/cohort scope, changed fields, block identity and coach
  decision provenance in every audit record;
- returns a committed result only after every operation and audit append
  succeeds;
- delegates concrete database statements to
  `PlanningReviewTransactionPort`, whose contract requires rollback when the
  callback throws;
- preserves the existing specialized H6/H10 rules behind the future concrete
  adapter instead of nesting their independent transactions.

Focused transaction-port tests prove referential ordering, one-to-one
operation/audit application, exact accepted-set enforcement and full rollback
when audit persistence fails after earlier writes. Vercel passed. KAN-239 still
owns validation of this same contract against the real Supabase transaction and
rollback mechanism.

## KAN-235 end-to-end idempotency

`lib/periodization/planning-review-idempotency.ts` now derives a canonical
SHA-256 submission key from the exact group/cohort scope, accepted blocks,
operations, field changes and coach decisions.

The KAN-234 transaction port now requires an idempotency journal that is read
and written through the same transaction handle as domain operations and audit
records:

- a first submission applies every accepted operation, appends one matching
  audit record and stores the committed result;
- an equivalent replay returns `already_committed` with the original key and
  result, without applying or auditing anything again;
- block, operation and decision ordering is canonicalized, so caller array order
  cannot bypass replay detection;
- a changed scope, write set, field value or coach decision produces a distinct
  semantic submission;
- journal registration occurs only after every operation and audit succeeds, so
  rollback cannot leave a false committed marker;
- stable KAN-233 identities remain the entity-level defense against duplicate
  plans/microcycles/sessions/prescriptions, while the journal prevents duplicate
  competitive adjustments and audit records for the same accepted submission.

Focused tests cover first commit versus replay, unchanged state after replay,
all integral entity categories, absence of duplicate audits, canonical ordering
and the existing transaction rollback guarantees. The remote Vercel build
passed. KAN-240 still owns simultaneous double-submit/concurrency behavior and
the database-level uniqueness mechanism.

## Task classification after KAN-225

| Task | Classification | H11 interpretation |
| --- | --- | --- |
| KAN-226 integral review model | implemented | pure composition contract; reuse existing domain entities |
| KAN-227 integral summary | implemented | pure deterministic projection over the integral review aggregate |
| KAN-228 provenance/ownership | implemented | expose authoritative H7/H6/H10 semantics and derived H6 replaceability |
| KAN-229 global validator | implemented | typed pure composition of referential, temporal and cross-domain checks |
| KAN-230 integral diff | implemented | pure stable-identity diff with create/update/remove intent and protection-aware classification |
| KAN-231 accept/reject blocks | implemented | pure macrocycle/competition/plan blocks with dependencies and coach-decision provenance |
| KAN-232 unified partial reconciliation | implemented | exact accepted-item write set, block ranges, scope isolation and existing-boundary routing |
| KAN-233 stable IDs | implemented | centralized logical hierarchy keys, retained H6 keys and persisted-ID updates |

| KAN-234 atomic persistence | implemented | one transaction port applies exact operations and audit records with rollback semantics |
| KAN-235 end-to-end idempotency | implemented | canonical submission key and same-transaction replay journal suppress duplicate writes/audits |
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

Close `KAN-235` after recording replay suppression in Jira. Then start `KAN-236` by verifying cohort-first/group-fallback resolution against the completed H11 flow.
