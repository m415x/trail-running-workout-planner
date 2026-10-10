# H7A — Sensitive writer inventory (KAN-726/T1)

Baseline: `dev` at `51d9fae2e862d7450eaf0e11ccb58112f0aa3e1a`; H7A work branch `feat/KAN-610-h7a-authorship-audit`. This is an **inventory of verified named boundaries**, not a claim that a search of every source file and indirect repository writer has been completed. It is the T1 working authority and must be reconciled before T1 closure.

## Identity and membership

- `app/actions/athlete-actions.ts`: `createAthlete`, `updateAthlete`, `setAthleteActiveState`. H2 and active Team/H3 are used for administration; athlete facts are **not** internal EPT User provisioning. Inspect durable mutation provenance in the implementation/repository before calling it audited.
- `db/schema.ts`: `teamMemberships` stores Team/User/preset/validity but has no grant-style per-operation author fields. No general TeamMembership grant/revoke writer has yet been verified by this inventory. Do **not** fabricate one or silently equate membership lifecycle with authorization grants.
- `externalIdentityLinks`: identity association is not evidence of an authenticated request; no automatic linkage by email or athlete data. Audit any actual linking writer when found.
- Status: scope identified, **authoritative writer closure unresolved**; T3 must not presume nonexistent administration features.

## Delegated grants

- `db/schema.ts`: `authorizationGrants` has `grantedByUserId`, `reason`, `effectiveFrom`, `effectiveUntil`, `revokedAt`, `revokedByUserId`, `revocationReason`; grants remain history-bearing and revocation must preserve original grant evidence.
- `lib/authorization/grant-lifecycle.ts`: validation and effective applicability are **read/resolution semantics, not proof of a deployed writer**.
- `lib/authorization/h4a-next-server-authorization.ts`: reads grants for H3 authority. A writer that creates/revokes grants has not been established by these files; verify actual invocations before implementation. **T3 gap**: server-authenticated author derivation, transaction, historical reads and concurrency if such writes exist.

## Groups and cohorts

- `app/actions/group-actions.ts`: `createGroup`, `updateGroup` use H2, active Team and H3. Verify downstream author/evidence persistence rather than inferring it from authorization.
- `app/actions/athlete-actions.ts`: `assignAthleteToGroup` delegates to group-assignment boundary; H4A contract already requires `changedByUserId` from H2. Preserve the atomic group-assignment writer.
- `app/actions/planning-cohort-actions.ts`: `createPlanningCohort`, `updatePlanningCohort`, `assignAthleteToPlanningCohort`, `closePlanningCohortMembership`; assignment and closure explicitly use `planningContext.access.userId` for `assignedByUserId`/`endedByUserId` in existing transactions. Preserve provenance and history. Do not treat `assignedByUserId` as continuing athlete authorization.

## Economic policy and terms

- `app/actions/membership-actions.ts` exposes `configureTeamEconomicPolicyAction`, `applyInitialAthleteBillingTermsAction`, `changeAthleteBillingTermsAction`, `materializeTeamMonthlyChargesAction`.
- `lib/memberships/h6-policy-action.ts`: `configure(teamId,input)` writer callback receives authorized Team/input **without server H2 author**.
- `lib/memberships/h6-terms-materialization-actions.ts`: `initializeTerms`, `changeTerms`, `materialize` similarly receive Team and domain inputs without H2 author. **T4 gap**: evidence linked atomically to each real policy/terms mutation; preserve existing economic semantics.

## Economic exceptions

- `app/actions/membership-actions.ts`: `applyGlobalDueDateExceptionAction`, `applyMonthlyChargeReductionAction`, `applyMonthlyChargeExtensionAction`.
- `lib/memberships/h6-economic-exception-actions.ts`: `globalDueDate`, `reduce`, `extend` depend on H2/H6 authorization, but delegate only Team and input to the writer. **T5 gap**: server-derived actor persisted with actual revision/exception, DENY/failure with no successful-looking audit.
- Exception sources and existing reversible histories must be inspected before deciding that new persistence is necessary.

## Payment revisions

- `app/actions/membership-actions.ts`: `registerManualPaymentAction`, `correctManualPaymentAction`, `voidManualPaymentAction` delegate to runtime.
- `lib/memberships/h6-payment-actions.ts`: H6 checks H2, capability and Team/resource ownership. KAN-726 focused seam now passes `{ authenticatedActorUserId, effectiveActorUserId }` derived from the same verified H2 User to the callbacks. **This is not yet evidence that the runtime persists that actor**.
- `db/schema.ts`: `paymentRevisions` represents revision history, and its actual columns and transaction semantics must be reconciled in T6. No inferred legacy author or payment backfill.
- **T6 gap**: use true revision persistence with atomic author, concurrency/replay and no audit for DENY/failed writes.

## Sporting 1000 m evidence

- `app/actions/field-performance-test-actions.ts`: writers `createTrack1000mEvidenceAction`, `correctTrack1000mEvidenceAction`, `getCurrentAthleteTrack1000mEvidenceAction`, `createCoachTrack1000mEvidenceAction`, `reviewCoachTrack1000mEvidenceAction`. The other `get*` actions are reads, not writers.
- `lib/physiology/field-performance-test-application.ts`: `createTrack1000mEvidence`, `createAthleteTrack1000mEvidence`, `createCoachTrack1000mEvidence`, `correctTrack1000mEvidence`, `reviewCoachTrack1000mEvidence`.
- Athlete path receives `userId` from server-side current-athlete context at the calling action. The Coach application input historically allowed `coachUserId` to populate `recordedByUserId`; KAN-726 removes this client-origin author propagation, but **does not yet persist verified Coach authorship**.
- `db/schema.ts`: field evidence has `recordedBy` (role/provenance dimension) and `recordedByUserId` (actor identity); these must never be conflated. Official evidence requires TestEvent consistency; corrections preserve prior observations and append replacements. **T7 gap**: H2 provenance on Coach writes, TestEvent and review/correction, without expanding H4C authorization.


## Indirect runtime writers and legacy context (KAN-726)

- `lib/memberships/billing-server-action-runtime.ts`: concrete economic server runtime; `registerManualPayment`, `correctManualPayment` and `voidManualPayment` delegate to durable payment revision operations. The H6 adapter may now carry actor to its callback, but runtime parameter types and durable revisions still require explicit H7A wiring in T6. Do not mistake an authorized Team ID for recorder identity.
- `lib/memberships/membership-action-handlers.ts`: legacy intermediary with `registerManualPayment`, `correctManualPayment` and `voidManualPayment`. Inspect all live callers before changing its contract; the presence of a handler does not prove it is the authoritative H6 protected entrypoint.
- `app/actions/membership-actions.ts`: `CURRENT_TEAM_ID = 'team_1'` remains a legacy context for `createMembershipActionHandlers`. It is neither authenticated actor nor H3 Team authorization and cannot be reused as H7A authority. Current H6 protected entrypoints instead resolve the active Team server-side. Auditing any still-exposed handler entrypoints remains necessary.
- `lib/athletes/group-assignment.ts`: `assignAthleteToGroupSynchronously` uses a transaction to update athlete/group assignments and insert `groupHistoryRecords`, assigning `changedByUserId` from the caller-provided trusted H4A boundary. It also closes prior cohort membership with `endedByUserId`. This is reusable historical and transactional infrastructure; its server action must keep deriving the actor from H2 and never from FormData.
- `db/schema.ts`: `paymentRevisions` and `groupHistoryRecords` are existing historical data stores. Reuse their factual history; first determine whether authorship columns and atomic writes are sufficient, rather than automatically introducing an additional audit table.
- T1 classification: named indirect runtime sinks identified, **but repository-level transitive writer completeness and historical author persistence are not yet demonstrated**. Follow-up bounded work stays with T1 discovery and, for confirmed writers, the previously approved T3–T7 cuts.

## Shared invariants and classification

- H7A: `authenticatedActorUserId` and `effectiveActorUserId` are conceptually distinct but **equal**; never accept either from FormData/DTO/client payload. No impersonation.
- H2 + H3 + domain ownership remain the only authority; the audit layer does not authorize.
- Every successful sensitive mutation must be inseparable from its evidence (same transaction or equivalent atomic guarantee). **DENY** and failed operations cannot create successful-looking audit records.
- Prefer existing **append-only** revisions. Unknown **legacy** authors remain unknown; no backfill inferred from email, role, owner, target or current user.
- **T2 is gated by the T1 exhaustive inventory**, not merely by this file existing or by a passing structural test.
- Verified reusable attribution: cohort assign/close. Verified gaps: H6 callback-to-writer loss of actor; prior Coach input-supplied recorder. Partial/unresolved: group/athlete authorship persistence, identity/membership administration writer discovery, grant mutation entrypoints, repository-level economic auditing, review/correction evidence author.
- No new schema/table is authorized solely by this inventory. Resolve missing writer paths and repository transactions in T1; then decide whether T3–T8 are independently bounded or require Jira subdivision.

## Existing focused evidence

- `tests/authorization/kan-610-authorship-contract.test.ts`: Payments transport and client-selected Coach recorder RED → operator-reported GREEN on candidate `bbe7e8acac678fab36796c21899fe501f0842fe4`. This proves two boundary contracts, **not persisted atomic audit**.
- `tests/authorization/kan-726-writer-inventory.test.ts`: structural requirement for this document; does not itself establish complete traversal or business correctness.
