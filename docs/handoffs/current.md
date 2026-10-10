# Current operational handoff — KAN-609/H6 merged baseline (2026-10-10)

## Verified integration
- KAN-609/H6: **Finalizada**. T1–T10 KAN-714–KAN-723: **Finalizada**.
- [PR #48](https://github.com/m415x/trail-running-workout-planner/pull/48) was merged to `dev` by merge commit `24318f1e33111b002086452add32fc11d0f7368e`; GitHub comparison confirmed `dev` identical to the merge SHA immediately after integration.
- Feature checkpoint `fce3403bb10767dcd4927c8e92619a3bd2cf809d`: operator `pn verify --db` **PASS 6/6**, total 168150 ms. This gate belongs **only to that premerge SHA**, not to the merge SHA or this documentation-only update.
- Full architecture, evidence, closure and Jira reconciliation: [KAN-609 handoff](kan-609.md) and [H6 contract](../architecture/h6-economic-authorization-athlete-debt-guard.md).

## Durable guards
- Ten membership economic Server Actions require authenticated H2, active server Team/TeamMembership, H3 capability and persisted resource ownership. `economic_policy.manage` is for COACH/ADMIN; `economy.manage` for ASSISTANT/COACH/ADMIN.
- Derived `allowed | blocked | unavailable` based on prior civil-month overdue debt; no persistent H6 block flag. Two Athlete SELF manual realized-training writes (create/correct) fail closed before persistence on `blocked` and `unavailable`.
- KAN-721's no-invocation-of-mutating-dependency evidence is accepted for no mutation on DENY after review of all prior steps. Reads remain governed by existing guards. ES/EN error causes and entered form values are preserved.

## Next work / exclusions
- **KAN-724**: independent authentication/routing story covering post-login preset destination, direct cross-surface redirects, immediate logout transition and authenticated /login handling. It is **not** part of KAN-609/PR #48.
- KAN-606/H4C remains deferred pending H7A/KAN-610; do not silently expand H6 or H5A.
- Prior baseline KAN-608/H5B is archived in Jira, PR #47 and its architecture document. This current handoff supersedes previous `current.md` wording that treated KAN-609 as unselected.
- Next operation: read AGENTS.md, docs/agent-harness.md, this handoff, latest remote `dev`, relevant architecture and Jira. New work requires explicit scope and focused RED/GREEN checkpoints.
- No post-merge 6/6 gate is claimed. Documentation-only edits must receive diff/link inspection and SHA verification; a subsequent functional/test/configuration change requires an appropriate new verification.
