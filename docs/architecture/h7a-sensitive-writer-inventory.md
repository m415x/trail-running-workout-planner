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
- `app/actions/planning-cohort-actions.ts`: `createPlanningCohort`, `updatePlanningCohort`, `assignAthleteToPlanningCohort`, `closePlanningCohortMembership`, and `derivePlanningCohortVariantAction` (a separate authorized sporting-planning variant creation boundary that delegates to `persistPlanningCohortVariantSynchronously`; its caller derives Team from `requirePlanningContext`, but does not visibly transport actor into that persistence operation). This is a discovery/classification of a writer, not an approval to broaden T3 into planning variant audit; determine its H7A sensitive-operation applicability before implementing anything there.  assignment and closure explicitly use `planningContext.access.userId` for `assignedByUserId`/`endedByUserId` in existing transactions. Preserve provenance and history. Do not treat `assignedByUserId` as continuing athlete authorization.

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

## Payment persistence chain — T1 classification

- `lib/memberships/billing-server-action-runtime.ts` dispatches register/correct/void to a `createBillingPersistenceAdapter` backed by `createSqliteBillingPersistencePort(createDrizzleBillingDatabase(db))`. The current runtime input receives business identifiers and values, not a persisted actor.
- `lib/memberships/billing-persistence.ts` defines `PaymentPersistencePort`, `PersistedPaymentRevision`, `insertPaymentRevision` and the optional atomic current-revision replacement. These domain ports model payment revisions but do not establish an H2 author.
- `lib/memberships/billing-sqlite-persistence.ts` connects the domain port to database operations, including listing, insertion and atomic replacement of payment revisions. Passing through this port does not by itself add authorship.
- `lib/memberships/billing-drizzle-database.ts` maps revision rows and performs actual `paymentRevisions` insert/update work; this is the concrete database sink whose transaction and concurrency behavior must be verified in T6.
- `lib/memberships/billing-drizzle-write-repository.ts` implements policy/terms revision writes, a separate T4 persistence contract; it should not be mistaken for the payment writer.
- `lib/memberships/billing-sqlite-transaction.ts` provides synchronous SQLite transaction support for existing billing work; applicability to each payment revision must be proven at the actual write boundary rather than inferred from the presence of a helper.
- `db/schema.ts` `payment_revisions` has payment ID, charge ID, amount, method, date, voided and current flags, but **no authorship column**. Existing append-only payment history therefore cannot durably identify `authenticatedActorUserId` or `effectiveActorUserId`. No inferred backfill for prior revisions is allowed.
- T1 decision: **T6 has a confirmed persistence gap**. Design of the minimum author field(s), SQLite/PostgreSQL migration and atomic insert/replacement awaits the bounded T6 RED and verification. The focused H6 callback GREEN does not satisfy this requirement.

## Economic application writers — concrete T4/T5 routing

- `lib/memberships/billing-coach-actions.ts` exposes `configureTeamEconomicPolicyAction`, `applyInitialAthleteBillingTermsAction`, `changeAthleteBillingTermsAction`, `applyGlobalDueDateExceptionAction`, `applyMonthlyChargeReductionAction`, `applyMonthlyChargeExtensionAction`, and `materializeTeamMonthlyChargesAction`. These are domain application operations and their presence alone does not establish that each direct caller has H2/H3 enforcement.
- **T4**: policy and terms routing covers `configureTeamEconomicPolicyAction`, `applyInitialAthleteBillingTermsAction`, `changeAthleteBillingTermsAction`, and `materializeTeamMonthlyChargesAction`. `lib/memberships/billing-drizzle-write-repository.ts` / `createSynchronousDrizzleBillingRepository` supplies policy/terms revisions, but must be reviewed for actor fields, transactional author writes and existing history before implementation.
- **T5**: exception routing covers `applyGlobalDueDateExceptionAction`, `applyMonthlyChargeReductionAction`, and `applyMonthlyChargeExtensionAction`. The protected H6 surface in `app/actions/membership-actions.ts` authenticates and authorizes requests but currently loses actor context in the callback boundary; review persisted exception revisions separately.
- Do not merge T4/T5 merely because both pass through billing-coach-actions. Neither authorization decisions nor economic source semantics may be replaced with a generic author audit.
- The `CURRENT_TEAM_ID` legacy handler configuration must be distinguished from the active H6 authorization path during actual caller tracing; a fixed Team ID does not establish authority.

## Organization and sporting repository sink closure (KAN-726)

- `teamMemberships` and `authorizationGrants` are persisted authority models in `db/schema.ts`; `lib/authorization/grant-lifecycle.ts` evaluates grants and revocation metadata, but is not a writer. **no deployed grant mutation writer** was established by the inspected H3 path: do not invent grant/revoke actions for T3 merely because schema supports them. TeamMembership management requires explicit discovery of a real authenticated operation before changing authority.
- `app/actions/planning-cohort-actions.ts`: `planningCohortMemberships` insert/close is performed inside SQLite transactions and attributes `assignedByUserId` / `endedByUserId` from server-resolved `planningContext.access.userId`. Preserve the existing authorization and assignment history; creation/update of planning cohorts are separate mutable records.
- `lib/athletes/group-assignment.ts`: the existing assignment transaction writes `groupHistoryRecords` with `changedByUserId` from the authenticated H4A calling action, while updating the athlete/group link and ending affected cohort memberships. A validated actor must remain inseparable from this write.
- `lib/physiology/field-performance-test-sqlite.ts`: `createSqliteFieldPerformanceTestRepository` implements the concrete `fieldPerformanceTests` persistence sink. It inserts new observations, performs a `review update`, and uses a `correction transaction` to invalidate the previous evidence and insert its replacement. The review update is not equivalent to append-only correction: **T7** must preserve existing lifecycle and determine whether review-specific audit evidence is sufficient.
- `app/actions/field-performance-test-actions.ts` exports the public Coach creation/correction/review actions, and `lib/physiology/field-performance-test-application.ts` supplies application-level validation. Neither a stored `recordedBy` role nor the existence of `recordedByUserId` constitutes proof of H2-derived Coach identity; T7 must resolve trusted actor without implementing H4C authority.
- **T3** remains limited to verified organizational writes and their current historical model; grant lifecycle read helpers are not evidence of live mutation functionality. No inferred author backfill or second authorization mechanism.
- Classification boundary: these files and their direct sinks are identified; an unrestricted repository-wide exhaustive code traversal has not been demonstrated by focused document-presence tests. T1 closure must make this limitation explicit rather than asserting completeness without evidence.

## Full app/actions exported-mutation survey (KAN-726)

The repo tree at commit `18f91a9de21027cfbe436f8c8990110c83cf7d3a` contains **23** TypeScript modules under `app/actions`. The automated scanner identifies exported functions whose names begin with the configured mutation verbs, including operations outside the approved H7A-sensitive domains. These newly discovered entrypoints are classified here as **adjacent inventory, not automatically H7A scope**:

- `app/actions/competition-calendar-actions.ts`: `createCompetitionAction`, `updateCompetitionAction`, `createCompetitionFromCatalogAction` — competition calendar writes; no T3–T7 authorship implementation assigned solely by discovery.
- `app/actions/load-strategy-actions.ts`: `createGroupPlanWithLoadStrategy` — planning strategy writer; review H7A applicability separately.
- `app/actions/race-registration-actions.ts`: `registerAthleteForRaceCourseAction`, `registerAthletesForRaceCourse`, `updateRaceRegistrationLifecycleAction`, `updateRaceParticipationAction`, `registerAthleteForRaceCourseFormAction`, `updateRaceRegistrationLifecycleFormAction`, `updateRaceParticipationFormAction` — event registration lifecycle; some are wrappers and must not be counted as seven independent persisted sinks.
- `app/actions/planning-actions.ts`: `updateMicrocycleVolume`, `updateMicrocycleElevation`, `updateMicrocycleDates`, `updateMicrocycleType`, `updateMicrocycleNotes` — planning microcycle mutation; outside the predefined H7A T3–T7 target without an explicit scope decision.
- `app/actions/realized-training-actions.ts`: `createManualRealizedTrainingAction`, `correctManualRealizedTrainingAction` — training history writes; H6 access/authorization is implemented separately from H7A authorship, and must not silently expand the story.
- `app/actions/session-actions.ts`: `createSession`, `updateSession` — session editing; identify domain ownership before any independent H7A scope change.
- `app/actions/training-goal-actions.ts`: `createTrainingGoal` — goal writer, adjacent domain.
- `app/actions/session-generation-preferences-actions.ts`: `updateSessionGenerationPreferences` — settings writer, adjacent domain.
- `app/actions/workout-template-actions.ts`: `createWorkoutTemplate`, `updateWorkoutTemplate`, `setWorkoutTemplateArchiveStatus` — template mutations, adjacent domain.

Previously covered `athlete-actions.ts`, `group-actions.ts`, `planning-cohort-actions.ts`, `membership-actions.ts`, and `field-performance-test-actions.ts` remain classified above. Modules with no matches to this export-name heuristic are **not** evidence of no writes: anonymous exports, arrow functions, re-exports, internal functions, and non-`app/actions` routes or repositories can still write. This scan supplies code-derived discovery, **not exhaustive whole-repository proof**. No modification to authorization, persistence or H7A scope is authorized by this list alone.

## Nonstandard action names excluded by the initial export heuristic

- `app/actions/team-context-actions.ts`: `selectActiveTeamAction` changes the active Team context selected by the actor. This is a session/context operation, **not** the grant or TeamMembership persistence writer; selecting a Team never creates H3 authority.
- `app/actions/session-generation-actions.ts`: `persistGeneratedSessions` delegates generated sporting sessions to persistence. It is a real planning/session mutation outside the explicitly approved H7A T3–T7 sensitive-writer set; flag for separate scope assessment rather than quietly extending KAN-610.
- `app/actions/auth-actions.ts`: `loginAction`, `logoutAction`, and `completePasswordRecoveryAction` mutate authentication/session or credential state through auth services. They are identity lifecycle boundaries, not a trusted H7A source of author IDs from client payload. H2 server authentication remains the authoritative actor resolver for sensitive writes. This inventory classification does not require recording login/logout in a new H7A audit table.
- The earlier `create|update|...` exported-function regex missed `select`, `persist`, `login`, `logout`, and `complete` prefixes. A naming heuristic is discovery assistance, not proof that no other internal or indirect writers exist.

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
