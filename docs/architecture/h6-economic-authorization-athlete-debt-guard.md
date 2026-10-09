# H6 — Economic authorization and Athlete prior-debt write guard (KAN-609)

## Frozen P7: economic decision

H4 is the only source of charge status. A zero remaining amount is `settled`; a positive remaining amount with server civil cutoff on or before `effectiveDueDate` is `pending`; if cutoff is later it is `overdue`. The date is inclusive and is evaluated using `America/Argentina/Buenos_Aires`.

`blockedForPriorDebt` requires at least one MonthlyCharge from a civil month before the current month whose H4 status is `overdue`. A still-effective extension leaves a prior charge pending. A current-month overdue charge alone does not block. Settlement clears the block unless another prior-month overdue charge exists; payment correction or void may restore it. Missing, inconsistent or unavailable evidence is never represented as debt.

H6 returns non-persisted `allowed | blocked | unavailable`. `blocked` means confirmed prior-month overdue debt; `unavailable` means the required economic evidence cannot be established and temporarily denies protected writes without attributing morosity. `allowed` never grants SELF authorization independently.

## Frozen P8: economic authority

Every public economic write requires H2 EPT identity, active server-resolved Team, current TeamMembership, effective H3 capability and ownership established from persisted resources. Client-supplied IDs, route state or legacy `team_1` never confer authority. `economic_policy.manage` (COACH/ADMIN) and `economy.manage` (ASSISTANT/COACH/ADMIN) are independent, nondelegable capabilities.

| Public action (`app/actions/membership-actions.ts`) | Required capability | Resource |
| --- | --- | --- |
| `configureTeamEconomicPolicyAction` | `economic_policy.manage` | Team policy |
| `applyInitialAthleteBillingTermsAction` | `economy.manage` | Athlete terms |
| `changeAthleteBillingTermsAction` | `economy.manage` | Athlete terms |
| `materializeTeamMonthlyChargesAction` | `economy.manage` | Team charges |
| `applyGlobalDueDateExceptionAction` | `economy.manage` | Team/month revision |
| `applyMonthlyChargeReductionAction` | `economy.manage` | Athlete charge reduction |
| `applyMonthlyChargeExtensionAction` | `economy.manage` | Athlete charge extension |
| `registerManualPaymentAction` | `economy.manage` | Athlete charge payment |
| `correctManualPaymentAction` | `economy.manage` | Payment correction revision |
| `voidManualPaymentAction` | `economy.manage` | Payment void revision |

`createAthlete` retains its billing initialization as an internal transactional effect of the H4A-authorized administration action, not a public alternate economic command or a new requirement that H4A actors also possess `economy.manage`.

## Frozen Athlete SELF write boundary

H2 actor -> active Team/TeamMembership -> `workout_log.self.manage` SELF capability -> own AthleteProfile -> H6 state for the same Team/AthleteProfile -> all remaining H5A session/ownership checks -> persistence only for `allowed`.

| Public action | First mutating repository | Persisted resources | Apply H6 |
| --- | --- | --- | --- |
| `createManualRealizedTrainingAction` | `createManualRealizedTrainingRecord` | `workoutLogs`, `workoutLogEvidence` | Yes |
| `correctManualRealizedTrainingAction` | `correctManualRealizedTrainingRecord` | `workoutLogs`, `workoutLogEvidence`, `workoutLogCorrections` | Yes |

For `blocked` and `unavailable`, **no mutation** means no write transaction, INSERT/UPDATE/DELETE, new revision or evidence sidecar, derived event/reconciliation, or post-write `revalidatePath`. Tests must assert zero persistence calls and unchanged durable snapshots. Client `athleteId`, `teamId`, `sessionId` and `workoutLogId` are never authority to select SELF subject.

Existing SELF reads Home Athlete, Plan, Stats, Profile and Membership, together with authentication and recovery, remain available under their original guards. Admin Athlete/Groups, Planning/Cohorts/Sessions/Adjustments, competitions/race administration, training goals, templates, Team selection and Coach evidence operations are outside Athlete H6. `getCurrentAthleteTrack1000mEvidenceAction` remains out of scope pending H4C/H7A; generic `createTrack1000mEvidenceAction`/`correctTrack1000mEvidenceAction` and Coach actions are also excluded.

## RED/GREEN test matrix

| Cut | Focused test path | Distinct acceptance |
| --- | --- | --- |
| T1 KAN-714 | `tests/authorization/kan-714-h6-durable-contract.test.ts` | Contract, boundary matrix and test plan |
| T2 KAN-715 | `tests/authorization/kan-715-economic-active-team-boundary.test.ts` | H2/Team/Membership/H3/ownership deny |
| T3 KAN-716 | `tests/memberships/kan-716-economic-policy-authorization.test.ts` | Policy-only capability and no write on deny |
| T4 KAN-717 | `tests/memberships/kan-717-economic-terms-materialization-authorization.test.ts` | Terms/materialization with H4A internal init intact |
| T5 KAN-718 | `tests/memberships/kan-718-economic-exceptions-authorization.test.ts` | Global due date, reductions and extensions |
| T6 KAN-719 | `tests/memberships/kan-719-economic-payments-authorization.test.ts` | Payment, correction, void and ownership |
| T7 KAN-720 | `tests/memberships/kan-720-h6-prior-debt-self-guard.test.ts` | Prior/current periods, extension, settled, unavailable |
| T8 KAN-721 | `tests/realized-training/kan-721-h6-self-write-no-mutation.test.ts` | Both H5A writes, zero observable effects on deny |
| T9 KAN-722 | `tests/memberships/kan-722-h6-debt-reversal-isolation.test.ts` | Settlement/reversal, Team isolation, SELF reads retained |
| T10 KAN-723 | `tests/authorization/kan-723-h6-closure-regression.test.ts` | Closure contract plus full gates, walkthrough, Jira/PR/merge |

Each micro-sprint produces focused RED/GREEN evidence bound to recoverable SHA. Full `pn verify --db` 6/6 and interactive ES/EN acceptance belong to T10 absent a technical reason to run earlier. The T1 RED was operator-reported against `3107ed0d3a8b8fa3b5481b1d40c22abbba0cf093`; no GREEN is claimed yet.
