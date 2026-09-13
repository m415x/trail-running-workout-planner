# Epic 2 / H11 — Integral planning review and safe persistence

H11 (`KAN-224`) hardened the planning automation built in H6–H10 by composing their existing contracts into one inspectable and atomic workflow. The story deliberately avoided redefining session generation, cohort derivation/resolution, competition calendars or competitive-adjustment policy.

## Starting problem

Before H11, the individual components were already strong but their boundaries remained separate:

- planning, intensity and session-generation persistence had independent transaction boundaries;
- H10 produced local competitive reconciliation artifacts but did not own the complete plan write transaction;
- stable identities and idempotency were proven per component rather than across the full accepted planning set;
- team/group/cohort/plan isolation existed in focused flows but was not enforced at one final persistence boundary;
- no common diff/acceptance model represented hierarchy, sessions, prescriptions, competitions, provenance and conflicts together.

## Resulting H11 workflow

H11 introduced:

1. `IntegralPlanningReview` as the pure review aggregate.
2. An integral summary over group-base or cohort-variant planning.
3. Projection of existing H6/H7/H10 provenance and ownership.
4. A global pre-persistence consistency validator.
5. A stable-identity integral diff.
6. Coherent block accept/reject decisions with dependencies.
7. Exact block/range-scoped reconciliation.
8. Stable regeneration identities across hierarchy, Sessions and prescriptions.
9. One atomic operation/audit persistence boundary.
10. End-to-end idempotency through a canonical submission journal key.
11. Regression of athlete cohort-first/group-fallback resolution over the full review aggregate.
12. Explicit team/group/cohort/plan isolation on every reconciled write.
13. One cross-story E2E regression covering cohort, competition, H10 review, regeneration, persistence and athlete resolution.
14. An async PostgreSQL/Supabase transaction boundary and real integration probe.
15. Revision-based optimistic concurrency for stale data and double-submit handling.

## Stable identity refinement

The stable-ID audit distinguished legitimate new persisted IDs from logical reconciliation identity. Brand-new plan persistence and one-time cohort derivation still create independent UUIDs. Regeneration does not use those UUIDs as logical matching keys.

A regression discovered during the H11 gate clarified the H6 rule: a generated Session or GroupSessionPrescription that preserves its `sharedEventKey` / `generationKey` but changes its already-persisted UUID is the same logical entity with an illegal identity replacement. The integral diff now reports that as a protected conflict rather than an ordinary update or duplicate create.

## Isolation refinement

KAN-237 exposed that the aggregate reconciliation carried scope but individual operations did not. `PlanningReviewScopedOperation` now transports the exact team/group/plan/cohort/lineage scope. The atomic persistence boundary verifies every operation against the accepted scope before the transaction opens.

This makes isolation explicit at review, diff, reconciliation and persistence rather than relying only on upstream queries.

## PostgreSQL and concurrency refinement

The original transaction-port abstraction was synchronous because H11 had initially been proven with memory/SQLite-style adapters. KAN-239 showed that a real `postgres.js` transaction needs an asynchronous contract. H11 therefore retains the synchronous port and adds `AsyncPlanningReviewTransactionPort` for PostgreSQL/Supabase.

KAN-240 adds review revisions. Every accepted reconciliation carries the SHA-256 revision of the review the coach inspected and the revision of the proposed resulting state. The PostgreSQL path serializes new writes through a plan-scoped revision lock, rechecks the idempotency journal after acquiring the lock, rejects stale distinct submissions, and advances the revision in the same transaction.

This gives explicit behavior for:

- equivalent double submit: one commit plus one replay;
- two different decisions from the same source state: one commit, one stale rejection;
- partial failure: complete rollback, including journal and revision advance;
- stale review: no domain writes;
- cross-scope operation: rejection before transaction writes.

## Supabase verification

The H11 probe is intentionally non-destructive to product schema. `db/supabase/verify-planning-review-transaction.ts` uses temporary PostgreSQL tables to exercise the same async transaction boundary against a real Supabase direct connection. It checks required planning tables/constraints, idempotent replay, rollback, scope isolation and revision locking/stale rejection.

No migration was created merely for the probe. A durable production idempotency/revision storage design should be migrated only when the PostgreSQL runtime adapter becomes authoritative and a real schema delta is approved.

## Validation state at documentation consolidation

Remote Vercel builds passed through the KAN-240 implementation. KAN-237, KAN-238 and KAN-240 were closed with remote evidence. KAN-239 remains open until the real Supabase commands are executed against the connected project. The final local H11 gate is still mandatory before closing the parent story: full tests, lint with no increase over the 11-warning baseline, TypeScript, production build and functional walkthrough.
