# Current operational handoff — KAN-724 audience session routing merged baseline (2026-10-12)

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
