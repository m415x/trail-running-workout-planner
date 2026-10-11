# H7A / KAN-726 — T1 writer exit matrix

This matrix is a decision and handoff companion to [the sensitive writer inventory](h7a-sensitive-writer-inventory.md). It classifies observed persistence paths without asserting that all repository files have been audited. T1 completion requires reconciling unresolved actual writers, not merely satisfying a text assertion.

## Cross-cutting contract

- **H2 actor source:** the authenticated EPT User established on the server; `authenticatedActorUserId` and `effectiveActorUserId` are distinct concepts with equal values during H7A. Neither comes from FormData, DTOs, a user-selected Coach ID or a legacy Team ID.
- **H3 Team authority:** resolved active Team, effective membership/grants, capability and domain ownership; authorship never substitutes for authorization.
- **DENY/failure:** cannot reach a successful mutation or produce success-looking audit records. Successful sensitive writes and their historical evidence require **atomicity**, in the same transaction or a demonstrated equivalent guarantee.
- **legacy unknown:** old rows whose author is absent remain unknown, with no inferred backfill.
- **out of scope:** adding H4C Coach authorization, impersonation, a parallel authorization framework, or author-attributing unrelated app/actions writers solely because a naming scan found them.

## T3 — Grants, membership, organization

| Item | Current evidence / gap |
| --- | --- |
| H2 actor source | Group assignment already accepts trusted `changedByUserId` through server action; cohorts use `planningContext.access.userId`. No verified grant-mutation action in the inspected H3 read path. |
| H3 Team authority | H4A group/cohort permissions and active Team apply before writes; `teamMemberships` and `authorizationGrants` are authority records, not authorization derived from audit. |
| durable writer | `lib/athletes/group-assignment.ts` transaction; `app/actions/planning-cohort-actions.ts` cohort transactions; `db/schema.ts` organizational tables. Locate any deployed grant or TeamMembership mutation entrypoint before changing it. |
| historical evidence | Existing `groupHistoryRecords.changedByUserId`, `planningCohortMemberships.assignedByUserId` / `endedByUserId`, and grants' grant/revocation metadata. Other athlete/group edits have unverified persistent authorship. |
| atomicity, DENY/failure | Preserve existing group/cohort transactions; do not write audit on forbidden or failed mutation. Separate group and cohort writer contracts when tests require independent implementation. |
| legacy unknown | Do not invent prior grant/member writers or infer missing authors. |

## T4 — Economic policy and athlete terms

| Item | Current evidence / gap |
| --- | --- |
| H2 actor source | `app/actions/membership-actions.ts` H6 authenticated boundary; `h6-policy-action.ts` and `h6-terms-materialization-actions.ts` currently pass Team context without trusted actor through all persistence callbacks. |
| H3 Team authority | Active Team H6/H3 authorization remains mandatory, not the legacy `CURRENT_TEAM_ID` configuration. |
| durable writer | `lib/memberships/billing-coach-actions.ts` → `billing-sqlite-coach-actions.ts` → `billing-coach-service.ts` / `athlete-billing-terms-service.ts` → `billing-drizzle-write-repository.ts`; policy/terms revisions. |
| historical evidence | Existing policy and terms revision model should remain authoritative; confirm whether persisted author is absent before choosing minimum migration. |
| atomicity, DENY/failure | Maintain synchronous SQLite transaction and revision transition together with trusted author; no attribution without successful write. |
| legacy unknown | No retroactive attribution. |

## T5 — Economic exceptions

| Item | Current evidence / gap |
| --- | --- |
| H2 actor source | H6 wrapper `h6-economic-exception-actions.ts` validates authenticated actor but still loses it at callback/writer handoff. |
| H3 Team authority | Effective Team and ownership remain enforced before exception mutation. |
| durable writer | `billing-coach-actions.ts` exception handlers → billing persistence for global due-date, reduction and extension revisions. Verify individual repository transaction methods in T5. |
| historical evidence | Existing exception revisions, rather than a fabricated generic event, are the baseline. |
| atomicity, DENY/failure | Each revision insertion/replacement and its actor require one atomic unit; DENY/failure must leave no misleading author record. |
| legacy unknown | Preserve unresolved legacy provenance. |

## T6 — Payment revisions

| Item | Current evidence / gap |
| --- | --- |
| H2 actor source | `h6-payment-actions.ts` now transports trusted authenticated actor to third callback argument; deployed callbacks in `app/actions/membership-actions.ts` still ignore it. |
| H3 Team authority | H6 checks actor, Team, charge ownership and payment ownership before callback. |
| durable writer | `billing-server-action-runtime.ts` → `billing-persistence.ts` → `billing-sqlite-persistence.ts` → `billing-drizzle-database.ts` → `payment_revisions`. |
| historical evidence | Payment append-only revisions exist, but `payment_revisions` has no authorship column. Persisted H7A attribution is **not** yet implemented. |
| atomicity, DENY/failure | Registration, correction and void must preserve concurrency/current-revision integrity and actor with the same durable mutation. Any denied or unsuccessful operation produces no false audit. |
| legacy unknown | Never assign current or target user to old payment revisions. |

## T7 — 1000 m evidence / H4C preparation

| Item | Current evidence / gap |
| --- | --- |
| H2 actor source | Athlete self evidence resolves server actor; Coach input `coachUserId` formerly polluted `recordedByUserId` and T1 removed that client-to-author assignment. Trusted Coach H2 provenance still needs implementation. |
| H3 Team authority | Existing SELF/Team enforcement remains; preparing attribution does **not** add H4C Coach permissions. |
| durable writer | `app/actions/field-performance-test-actions.ts` → `field-performance-test-application.ts` → `createSqliteFieldPerformanceTestRepository` in `field-performance-test-sqlite.ts`. |
| historical evidence | `fieldPerformanceTests.recordedBy` is role, not identity. `recordedByUserId` stores recorder when trustworthy. Review update is distinct from the append-only correction transaction and needs its own provenance decision. |
| atomicity, DENY/failure | Preserve the correction transaction and ensure reviewer/recorder authorship never claims success on failed authorization. |
| legacy unknown | Do not backfill Coach identity from input, team membership or athlete ownership. |

## T1 exit decision and T2 gate

The H7A-sensitive domains have a classified writer/historical-evidence/gap matrix. However, scans of exported action names and direct `app/actions` SQL calls are heuristic, not a proof that every internal repository sink has been traversed. **T1 is not closed solely by this matrix**, and **T2 must not be marked started** until the outstanding writer-path review is judged sufficient against KAN-726's exhaustive-inventory acceptance criterion. If any T3–T8 scope includes independent persistence contracts, split it into smaller Jira subtasks before implementation.

## T1 reconciliation — bounded sensitive-writer coverage

The operator validated focused RED/GREEN checks for documented H7A writers, H6 economic runtime/Drizzle sinks, group/cohort history, Coach 1000 m repository transactions, all 23 exported-action modules under `app/actions`, nonstandard exports, direct action SQL sinks, indirect synchronous billing writers, and sampled internal repository paths. `revokeTeamMembership` and `associateAuthorizedExternalIdentity` are lower-level SQLite writers but the executable scan of `app/` and `lib/` reports no production callers; grant lifecycle is evaluation rather than a confirmed deployed mutation action. **No invented grant writer or grant implementation is authorized.**

For the *approved H7A-sensitive scope* (T3–T7), known deployed entrypoints, durable sinks, existing author/history columns and missing provenance are enumerated above and in the writer inventory. Adjacent planning, competition, training and template operations were discovered and explicitly excluded from automatic H7A expansion. The scan is not proof of global whole-repository data-flow completeness; newly discovered sensitive writers must reopen T1 classification before implementation. T2 can define H2 actor context on the bounded H7A entrypoints without claiming persistent author support already exists.
