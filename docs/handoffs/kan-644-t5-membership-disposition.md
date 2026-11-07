# KAN-644/T5 — Membership exclusion and dependency disposition

**Decision (2026-11-04): justified no-op for Coach Home economic indicators.** This is a story-scoped decision, not a claim that the membership domain is absent.

## Evidence and dependency

- Canonical base: `dev@7aa26dc60085b946852d78a747031fa9863fcd3e`. Jira KAN-580 is `En curso`: KAN-626/T1 and KAN-627/T2 `Finalizada`, KAN-628/T3 `En curso`, KAN-629–631/T4–T6 `Tareas por hacer`.
- The baseline contains `lib/memberships/membership-authorized-page-reader.ts`, an H2/H3/H4A reader for a Team policy/page model. It does **not**, by itself, calculate Team-wide overdue or unpaid members.
- `lib/memberships/athlete-home-economic-reader.ts` consumes a **single athlete** economic snapshot; it is not an authorized Team-wide aggregate.
- The baseline contains billing and payment services, but no `lib/memberships/quick-payment-*` implementation from unfinished KAN-580 on `dev`. Story-level Jira completion of T1/T2 does not prove those new reader files have been integrated.

## Scope enforced in KAN-644

- T1 removed invented revenue, outstanding dues, percentage-of-paid-members, and debtors placeholders from Coach Home. It did not infer a Team debt count from policies or payment writes.
- T5 intentionally adds **no economic read, action, status badge, or quick-payment UI** to Coach Home. It does not depend on a pending KAN-580 feature branch.
- If a later integrated, H2/H3/H4A-authorized and batch-bounded Team-wide account projection becomes available, it may be considered in a separate approved increment. This exclusion is **not** permission to omit the required Plan-owned next Competition of KAN-867/T4.

## Verification boundary

The no-op is justified by inspected integrated source and Jira states; no invented RED or GREEN is claimed for absent functionality. T6 must check that Coach Home has no static economic copy or inaccessible CTA. T7 must reconcile this decision in the KAN-644 handoff and PR.
