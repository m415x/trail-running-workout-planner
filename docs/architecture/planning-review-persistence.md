# Integral planning review and safe persistence

H11 (`KAN-224`) composes the H6–H10 planning boundaries into one reviewable and atomic workflow. It does not replace session-generation ownership, cohort semantics, competition context, or competitive-adjustment policy.

## Integral review boundary

`IntegralPlanningReview` is the persistence-free representation inspected before relevant regeneration or persistence. It combines:

- exact team/group/plan/cohort scope and base/variant lineage;
- plan, macrocycle, mesocycle and microcycle hierarchy;
- load and intensity planning projections;
- persisted Sessions and GroupSessionPrescriptions with H6 provenance;
- plan-scoped CompetitionEntries and H10 impact windows;
- protected/manual/coach-owned annotations and cross-domain issues.

The global validator rejects referential, scope and temporal inconsistencies before persistence. Athlete resolution selects one complete review aggregate after applying H7 cohort-first/group-fallback resolution; data from base and variant reviews must never be mixed.

## Stable identities and diff

Logical reconciliation identity is separate from draft UUID creation:

- plan: persisted plan ID;
- macrocycle: owning plan + generated ordinal;
- mesocycle: stable macrocycle identity + mesocycle number;
- microcycle: owning plan + week number;
- generated Session: H6 `sharedEventKey`;
- generated GroupSessionPrescription: H6 `generationKey`;
- manual Session/prescription: persisted ID.

Regenerated hierarchy UUIDs are transient and do not imply delete/create. By contrast, once an H6 generated Session or prescription has been persisted, changing its UUID while retaining the same logical generation key is an identity conflict and cannot be silently updated.

The integral diff classifies changes as `added`, `updated`, `preserved` or `conflict` and carries field-level values. Manual/generated-modified/coach-owned/protected values remain authoritative.

## Coherent block acceptance

Changed planning is grouped into dependency-safe blocks. A macrocycle block owns its changed meso/micro/session/prescription subtree; plan and competition changes are explicit blocks with declared dependencies. A coach may accept or reject coherent blocks only. Conflicted blocks cannot enter the write set.

`reconcileAcceptedPlanningBlocks()` rebuilds the diff and decisions rather than trusting caller-provided item IDs. It emits only accepted `create | update | remove` operations and attaches the exact `PlanningReviewScope` to every operation.

## Atomic persistence and isolation

Every operation is validated against the accepted team/group/plan/cohort/lineage scope before opening the transaction. The persistence boundary orders removals child-first and creates/updates parent-first, then applies each operation and its audit record inside one transaction.

The synchronous transaction port remains available for SQLite/in-memory execution. `AsyncPlanningReviewTransactionPort` is the PostgreSQL/Supabase boundary. Concrete adapters must provide real rollback semantics; H11 does not nest the older independent persistence transactions.

No H11 domain write may cross team, group, cohort or plan scope. Cross-scope write sets are rejected before any database mutation.

## Idempotency

A canonical SHA-256 submission key includes:

- exact planning scope;
- source and result review revisions;
- accepted blocks and operations;
- field changes;
- rejected/pending blocks;
- coach decisions and provenance.

An equivalent replay returns the original committed result and produces no duplicate domain write or audit record.

## Optimistic concurrency and stale reviews

`integralPlanningReviewRevisionKey()` hashes the authoritative integral review state. Derived validation issues are excluded; hierarchy array order is retained because generated macrocycle ordinal is semantically significant.

A reconciliation carries both:

- `sourceRevisionKey`: state the coach reviewed;
- `resultRevisionKey`: expected state after applying the accepted proposal.

For PostgreSQL/Supabase the async transaction sequence is:

```text
journal lookup
  -> plan-scoped revision lock
  -> journal recheck
  -> source revision comparison
  -> accepted writes + audits
  -> idempotency journal write
  -> revision advance
  -> commit
```

The second journal lookup is intentional. Two equivalent submissions may race while one waits on the plan lock; after the first commits, the waiter becomes an idempotent replay rather than a stale error. A different submission based on the old revision throws `StalePlanningReviewError` before domain writes, preventing silent last-write-wins.

If any operation, audit, journal or revision update fails, the complete asynchronous transaction must roll back.

## Supabase verification boundary

`pn db:verify:h11:supabase` runs the H11 transaction probe using `SUPABASE_DIRECT_URL`. It uses connection-local temporary tables so transaction semantics can be tested without changing production schema. The probe verifies:

- required planning tables and CompetitionEntry → GroupTrainingPlan FK;
- commit and equivalent replay;
- rollback after an intentional audit failure;
- cross-scope rejection without partial state;
- revision locking and stale-submission rejection.

The general `pn db:verify:supabase` inventory includes `competition_entries`. Do not generate a migration merely to run this probe; create a migration only for a real durable schema delta.

## End-to-end invariant

The H11 regression path composes base plan → cohort variant → competition → H10 proposal/review → coach edit → integral diff/block reconciliation → atomic/idempotent persistence → athlete cohort-first resolution. This integration test supplements rather than duplicates the focused H6–H10 policy suites.
