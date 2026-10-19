# Current candidate handoff — KAN-810 regional numeric inputs (2026-10-18)

- **Not yet integrated**: feature `feat/KAN-810-regional-numeric-inputs` accepted application candidate `e32e5ffabc7c8949425972da63e2e972a2e8f326`, operator `pn verify --db` PASS 6/6 (Tests 123709ms, TypeScript 12353ms, ESLint 28651ms, Build 27465ms, i18n 387ms, SQLite 50658ms; total 243223ms). Documentation-only commits follow this SHA; do not mislabel candidate gate as dev gate.
- **A3 acceptance**: direct WorkoutTemplateForm, MicrocycleVolume/Elevation, Biometric SELF, realized training LogWorkoutDialog, official Coach 1000m, and technical-equivalence-only SessionForm/LoadStrategy/SessionGenerationPreferences. H6 DENY uses prior automated tests, not new browser reproduction. ES/EN persisted editable decimal display corrected via two RED/GREEN cuts; [story handoff](kan-810.md).
- **Pending**: pre-merge docs check, PR against `dev`, required checks/review, merge, post-merge dev verification and docs check, fresh-chat-safe reconciliation and Jira closure. Previous dev integrated baseline is documented below until this merge actually occurs.

---

# Current integrated handoff — KAN-809 runner hardening (2026-10-17)

- **Integrated baseline:** KAN-809 via [PR #63](https://github.com/m415x/trail-running-workout-planner/pull/63), accepted head `725eefdd4c3736cba11a1310d315d2027347be72`, ordinary merge `a29170eecd4801990220ac552278e1c10a87e005` into `dev`. B1 real reproduction and B2/B3 operator focal GREEN are recorded in [KAN-809 story handoff](kan-809.md).
- **Candidate gate (operator):** `pn verify --db` PASS 6/6 — Tests 100214ms, TypeScript 9474ms, ESLint 31008ms, Build 47390ms, i18n 342ms, SQLite 44332ms, total 232760ms. This is a **pre-merge** result.
- **Preservation:** failure-before-test is not functional RED; Postgres safety guards, concurrency and typecheck are unchanged. No application-domain scope.
- **Pre-merge documentation check:** operator `HANDOFF DOCS: PASS` on PR head. GitHub Vercel head status `failure` links to `build-rate-limit`, not a demonstrated build regression; GitHub PR mergeable true, no GitHub check runs/reviews returned. `dev` branch protection could not be inspected due to connector permission limits.
- **Pending:** operator post-merge `pn verify --db` and `pn docs:handoff:check` on integrated `dev`; then Jira closure. KAN-810 starts only after this evidence.

---

# Current operational handoff — KAN-646 Athlete Profile SELF merged (2026-10-17)

- **Integrated baseline:** KAN-646 via GitHub [PR #62](https://github.com/m415x/trail-running-workout-planner/pull/62), approved head `2ed7a557aa76f57ecbc22efae8a649851c14c943`, ordinary merge `766cff4f942104e0576c508581c0cf8fd8a1ccf1`. The merged implementation lives in `dev`. See [KAN-646 story handoff](kan-646.md) and [durable architecture](../architecture/athlete-profile-self-biometrics.md).
- **Post-merge executable gate:** operator `pn verify --db -v` **PASS 6/6** on integrated `dev` (Tests 121027 ms; TypeScript 37019 ms; ESLint 31115 ms; Build 52635 ms; i18n 365 ms; SQLite 45260 ms; total 287421 ms).
- **Handoff reconciliation completed:** the initial post-merge `pn docs:handoff:check` failed because `kan-646.md` and its index were missing. Follow-up commits published the story handoff, indexed KAN-646 as the current integrated baseline, and updated the historical KAN-725 assertion. The operator subsequently confirmed **GREEN** for `pn tdd tests/scripts/kan-725-harness-v2-contract.test.ts`, **HANDOFF DOCS: PASS** for `pn docs:handoff:check`, and **PASS 6/6** for `pn verify --db -v` on the reconciled `dev` HEAD `b38edf9177d3e39163a7a41cb14095503fae7b68`. These are operator-reported results, not newly executed checks on this documentation-only commit.
- **Acceptance scope:** real Athlete Profile SELF read/write four manual metrics, append-only correction/provenance, Team IANA fail-closed, nondelegable H2/H3/H5A authorization. Athlete real browser ES/EN/responsive/accessibility PASS; focused denial/isolation GREEN; security action-wiring static test is not adversarial HTTP E2E. Missing eligible 1000m reference remains unknown; Material hidden, Settings reuse theme and Supabase Auth.
- **Explicitly deferred after merge:** application-wide decimal comma normalization of numeric inputs, not a KAN-646-only patch.
- **Closure:** KAN-646 transitioned to **Finalizada** in Jira after the successful post-merge focal, handoff and six-stage gates (Jira closure comment `13510`). The application-wide decimal-comma follow-up remains separate. Older integrated baselines follow as historical handoff below.

---

# PR #59 — KAN-790/T5 + KAN-791/T6 post-merge baseline (2026-10-17)

- **Merged to `dev` with GitHub ordinary merge**, PR #59: `e9f5f8276b4508e0fefdde7a7bd97787e27fd8d7`, confirmed GitHub `merged: true` and base `dev`. Authorized immutable PR head: `052dc218023bb4c50d53484373ce2847a5d4979a`, enforced as `expected_head_sha`. The PR was changed from Draft to Ready before merging. No bypass was used.
- Candidate gate on authorized head: `pn verify --db -v` **PASS 6/6**, ordinary tests 3017/3017 PASS; `pn docs:handoff:check` **PASS**. PostgreSQL disposable **71/71 PASS** and annual read-only **2/2 PASS** were accredited on `fe58c6356f5d8e5195fcf6c2aefd9c4ef850157e`; subsequent branch edits removed temporary test-only probe and updated docs without modifying production PG boundaries.
- Annual authenticated HTTP CREATE/GET/CONFIRM 53-week / 239-session acceptance approved. Second authenticated CONFIRM functional idempotence **PASS** with SQL before/after identical SHA256 `16DC3B65B94F6CF44C54A9C7624B75687629A5C11F855BD8FC7CD75AD208C8F5`. **Limit:** `already_consumed` was inferred from previously consumed snapshot, redirect and audited code path; it was **not** directly instrumented.
- Disposable PostgreSQL read-only physical schema inspection: 41 migration records vs 41 Drizzle journal entries, effective 20 constraints and 9 indexes on four critical tables. Seven truncated FK names (PostgreSQL identifier limit / `NOTICE 42622`) have intact constraints. Individual migration hashes were **not compared**; matching cardinality alone is not hash equivalence.
- Pre-merge Vercel `failure` linked to `build-rate-limit`, not evidence of a demonstrated compilation regression. **Merge commit** `e9f5f827...` separately reported combined Vercel status **success** with deployment URL; GitHub Actions PR workflow lookup returned no runs. Do not invent additional CI.
- Per-file PR #59 security/coverage review inspected auth/H2-H3-H4A, authorized CREATE/GET/CONFIRM and serializable CAS, protected reconciliation, schema and indexes, Coach UI and SQLite, test isolation; no material defect identified. GitHub oversized monolithic diff was not used; generated metadata snapshot files had no textual per-file patch.
- **Post-merge operator verification is still pending** on the final documentation HEAD: `pn verify --db -v` and `pn docs:handoff:check`. These are separate from the candidate gates and from GitHub Vercel status. Do not close KAN-790/KAN-791/KAN-784 until their complete acceptance and post-merge handoff conditions are confirmed. Neither historic annual nor forensic PostgreSQL databases may be modified. Do not rerun authenticated CONFIRM or the 73 already accredited focused PG tests without a new contract-relevant change.

---

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
