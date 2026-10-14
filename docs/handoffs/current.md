# Current operational handoff — KAN-792 Coach Competition Calendar reader merged (2026-10-13)

## Latest integrated delivery

- [KAN-792](kan-792.md) merged to `dev` via [PR #58](https://github.com/m415x/trail-running-workout-planner/pull/58). PR head `a0297e6a8ec5640b38e1359d52b1ef7f8a488ef6`; merge SHA `7d11c885f827f62448f49c9fbed0dddbe81963cf`.
- Read-only Competition Calendar boundary now requires H2 EPT authentication, valid H3 active Team, H4A `planning.manage` and real Plan→Group Team ownership. Base/Variant calendars remain Plan-scoped, and the preview distinguishes DENY from authorized empty rather than treating failure as an empty list.
- Operator `pn verify --db` PASS **6/6** on PR head `a0297e6a8ec5640b38e1359d52b1ef7f8a488ef6` (Tests 82817ms, TypeScript 10012ms, ESLint 27730ms, Build 21443ms, i18n 293ms, SQLite 44183ms). This is pre-merge gate evidence, **not** a new full gate on merged or documentation-only SHAs.
- Operator `pn docs:handoff:check` PASS was reported on earlier pre-merge HEAD `0cdb9bd3e927452bdb50a6a8bbb2e3ccfa5b9761`. Post-merge documentation HEAD must pass a new handoff check. GitHub showed Vercel success and no GitHub Actions workflows for the PR commit; do not invent remote CI.
- **Security blocker [KAN-798](https://trail-running-workout-planning.atlassian.net/browse/KAN-798), High:** five legacy Competition Calendar mutation Server Actions lack verified H2/H3/H4A enforcement. None is accredited for acceptance or release; do not use as trusted walkthrough actions. No HTTP exploit has been proven. `competition.manage` TEAM is the established writer capability. Global race catalog, existing Base/Variant lifecycle and audit remain independently governed.
- KAN-787/T3a may resume **after final handoff reconciliation** against the current integrated `dev` baseline to evaluate authorized read sources, exact reconstruction/equivalence, staleness and concurrency. KAN-784 transport/persist/reconciliation stays unchanged pending alternative A/B decision. Prior integrated KAN-688 baseline follows below.

---

# Current operational handoff — KAN-688 Coach Templates authority merged (2026-10-13)

## Latest integrated delivery

- [KAN-688](kan-688.md) Coach Templates server-owned H2/H3/H4A authority merged to `dev` via [PR #57](https://github.com/m415x/trail-running-workout-planner/pull/57); PR head `0d4944115ad1eb6bbe49772b0f0d53c0fd2d0833`, merge SHA `02923d0facb66d8db6335d6348a4919158d19bf2`.
- Seven template Server Actions share real H2 authenticated actor, H3 active Team and H4A `planning.manage` checks. SQLite scope/isolation/no-write DENY and fresh Team/user resolution are covered. KAN-682 Templates navigation remains hidden.
- Operator pre-merge isolated-branch `pn verify --db` **PASS 6/6** on candidate `9f92d11ec3e3ef440831b06f5ba15fed64a4bd69`; operator pre-merge `pn docs:handoff:check` **PASS** on `0d4944115ad1eb6bbe49772b0f0d53c0fd2d0833`. These are not execution evidence for merge or post-merge documentation commits.
- Vercel status was `success`; no GitHub Actions workflow runs were returned and no reviewer submission observed for PR #57. Do not describe GitHub Actions as GREEN.
- KAN-787 preview authority and KAN-792 Competition Calendar Team scope are separate pending work; no KAN-787 RED tests, no KAN-786 HTTP fixture, and no KAN-784 implementation from the mixed branch were merged in PR #57.
- Post-merge documentation SHA(s) differ from the integration SHA. A new `pn docs:handoff:check` is needed on their final `dev` HEAD; a post-merge full `pn verify --db` has not been reported. Jira KAN-797/T5 and KAN-688 reconcile after the documentation check.

---

# Current operational handoff — KAN-778 Athlete B provisioning merged (2026-10-13)

## Latest integrated delivery

- KAN-725 post-merge index regression corrected via [PR #56](https://github.com/m415x/trail-running-workout-planner/pull/56), merge `8ce4c44efcc3f959fcdd08eb9bd125e1c086a45b`; updated the current KAN-778 assertion and retained KAN-724/H4C history. Operator test focal GREEN, `pn docs:handoff:check` PASS and `pn verify --db` PASS 6/6 on pre-merge candidate `b1a165d0f1a2c96aee52347f2bf3b47dbf9bc188`. No new post-merge full gate claimed.

- [KAN-778](kan-778.md) local Acceptance Athlete B provisioning merged through [PR #55](https://github.com/m415x/trail-running-workout-planner/pull/55), merge SHA `59e7b3ac1fd573b0d3be45ddf8acc600ce36d720`, candidate gate SHA `b0546f717d0c9221f28d603c93b7a687d13cefce`.
- Operator `pn verify --db` PASS 6/6; dry-run, atomic apply and no-write rerun on disposable and local SQLite; FK/integrity pass; Supabase Athlete B login and `/plan` manual PASS. Not a fresh post-merge `dev` gate.
- Platform contract [here](../architecture/platform/acceptance-athlete-b-provisioning.md). Subject UUID stays out of repository evidence. KAN-766/T8 remains OPEN pending full Coach → Athlete multieweek acceptance and G1 draft/active lifecycle.
- Previous KAN-772 SQLite drift baseline and earlier KAN-724 routing evidence preserved below.

---

# Current operational handoff — KAN-772 H7A SQLite drift audit merged baseline (2026-10-12)

## Latest merged correction
- [KAN-772](kan-772.md) merged via [PR #54](https://github.com/m415x/trail-running-workout-planner/pull/54), merge `70994015c9cd11b107b7bda134c5b23e3d9ce213`. Canonical fresh SQLite and all nine disposable lifecycle scenarios passed; physical H7A 0020–0025 drift and metadata checks now fail closed.
- Operator pre-merge `pn verify --db` PASS 6/6, `pn docs:handoff:check` PASS. Vercel was rate-limited, not a product test failure; no Vercel deployment success is claimed.
- Developer `sqlite.db` still carries drift and was not deleted. Its explicit regeneration requires separate authorization. KAN-766 remains blocked and the `/plan` conflict requires independent verification.
- Previous integrated functional routing baseline: KAN-724, details below.

## Prior functional baseline — KAN-724 audience session routing (2026-10-12)

## Verified integration
- KAN-724/T1–T8 merged to `dev` in [PR #53](https://github.com/m415x/trail-running-workout-planner/pull/53), merge SHA `b3c04e8d295b6d43fa0c02bc39e3af188bd32c89`; feature HEAD `13131c1e8d4ef6f32c55697e49d1bfa331c73eb1`.
- [KAN-724 story handoff](kan-724.md) and [authentication-session lifecycle](../architecture/platform/authentication-session-lifecycle.md) explain the authoritative H2 EPT user, validated active Team and effective H3 TeamMembership preset. Navigation is not resource authorization.
- Operator confirmed `pn verify --db` PASS 6/6 on feature HEAD `13131c1e`: Tests 81063ms, TypeScript 9551ms, ESLint 21259ms, Build 19642ms, i18n 390ms, SQLite 43913ms; total 175818ms. This is pre-merge verification, not a fresh post-merge gate.
- PR #53 displayed two successful GitHub checks, no base-branch conflicts and enabled merge. Vercel preview comments had no unresolved feedback. No GitHub Actions runs were returned by the commit-workflow lookup; do not invent CI coverage or a production deployment.

## Functional acceptance
- Operator confirmed localized ES/EN login, existing session, logout, Athlete and Coach shell landing, direct-URL cross-audience routing and fail-closed unresolved access.
- KAN-758 opt-in multi-Team acceptance fixture reused one EPT User and one Supabase ExternalIdentityLink: `team_1` ATHLETE/Home and `team_2` COACH/Dashboard. None selected → fail-closed; invalid selected Team → fail-closed; revoked COACH membership with `team_2` cookie → fail-closed; restored membership and SQLite verification reported PASS.
- Acceptance seed was applied first to isolated SQLite with idempotent rerun and 8/8 invariant checks; separately backed-up local SQLite then received explicit opt-in provisioning. It is **not** a production/base seed and creates **no** second Supabase identity or Coach-team AthleteProfile.
- KAN-757 inherited H7A reviewer-column SQLite drift was corrected by fail-closed canonical 0024 recovery, first on a validation copy, then in local SQLite; physical schema, FK and Athlete Home checks PASS. Historic migration metadata was preserved, not rewritten.
- One aggregate KAN-615 test failure did not reproduce in isolated TAP (4/4 PASS); subsequent full six-gate verification PASS. No KAN-615 migration repair was made.

## Normative workflow and unresolved scope
- Read `AGENTS.md`, `docs/agent-harness.md`, this handoff, story handoff and relevant Jira.
- Focused tests: `pn tdd:red <test-file>` and `pn tdd <test-file>`; full local gate: `pn verify --db`; handoff consistency: `pn docs:handoff:check`.
- No interactive Team-selection UI was delivered by KAN-724; manually set acceptance cookie simulated persisted selection. Server-side selection action and authorization remain distinct boundaries; direct route redirect is not resource-level authority.
- Previous merged baseline: [KAN-606/H4C](kan-606.md), PR #52 merge `8f27f6ec02dd4642806298f87930d429472e3494`.

## Post-merge closure status
- PR #53 merge SHA: `b3c04e8d295b6d43fa0c02bc39e3af188bd32c89`; subsequent documentation/index HEAD before this reconciliation: `d05a76e0daa3f4a6acd358f72cc3c3c1a77f17bb`. These are distinct from the verified pre-merge feature HEAD `13131c1e8d4ef6f32c55697e49d1bfa331c73eb1`.
- The operator previously confirmed the post-merge `pn docs:handoff:check` PASS; Jira KAN-756 and KAN-724 are both `Finalizada` (verified 2026-10-12). They must not be reopened for this wording reconciliation.
- This correction is documentation-only. Its new `dev` HEAD requires its own `pn docs:handoff:check` confirmation; that check covers handoff consistency only. No post-merge `pn verify --db` or transfer of the pre-merge functional gate is claimed.
