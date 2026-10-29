# Current integrated handoff — KAN-855/S3 (2026-10-29)

- **Integrated:** [PR #76](https://github.com/m415x/trail-running-workout-planner/pull/76) ordinary merge `bf62a678bd0c7f5b1c680c638c0636607d827549`, PR HEAD `3fb51903fa2ef9e51a6f0db227b8c7b7fd2c42d4`, prior dev `0a7e197c29af80be4479a3c739aa63a589c2427c`. Next/eslint-config-next upgraded 16.3.8 → 16.4.3, 18 files. No KAN-856/KAN-858.
- **Operator premerge evidence:** `pn verify --db` PASS 6/6 on functional candidate `913b1d97a036aeea7ccdb9a8ce02dea331c1b6cf`; final documentation-only PR HEAD `3fb51903...` had `pn docs:handoff:check` PASS. No postmerge functional gate yet.
- **Remote postmerge:** dev HEAD independently verified as merge SHA. Vercel status success and Vercel Preview Comments success. No KAN-855 GitHub Actions workflow; historical workflows scoped to other branches. Branch-protection API inaccessible (403), ordinary merge accepted by GitHub.
- **Acceptance:** real Supabase Coach SSR login and protected HTTP PASS; incoming expired cookie triggers HTTP proxy token refresh and rotated Set-Cookie, next authorized GET PASS. SQLite read-only H4A Coach ALLOW/DENY contract PASS. **Authenticated H4A HTTP DENY NOT ACCREDITED**, residual risk expressly accepted for S3 upgrade, not an end-to-end DENY GREEN.
- **Remaining S3 closure:** postmerge operator `pn verify --db` on integrated dev SHA, doc checker on documentary head, Jira KAN-855 administrative resolution and operator-mediated worktree inventory/preservation/retirement or explicit blocker. KAN-852 parent remains open for S4/S5; do not start S4 here. [Details](kan-855.md).

---

# Current integrated handoff — KAN-854/S2 (2026-10-27)

- **Integrated S2:** [PR #75](https://github.com/m415x/trail-running-workout-planner/pull/75) merged normally into `dev` at `8c4757ae5bbc4511952c932558918b349b94c3b2`. Candidate SHA `dd59907df026cac301db86d938b017606ade0d3e`, base `7db8331b23f8770db8169b8b0d3d91d978d463fd`. Clean 12-file reduction: seven durable docs, capture helper and four autonomous deterministic tests. No Next.js/Zod/package/lockfile change; no experimental runner exclusions. See [story handoff](kan-854.md), [retention policy](../security/kan-854-test-retention-policy.md) and [causal matrix](../security/kan-854-t5-causal-matrix.md).
- **Candidate verification (operator):** `pn verify --db` PASS 6/6 — Tests 148528ms, TypeScript 13119ms, ESLint 32990ms, Build 25924ms, i18n 323ms, SQLite 45154ms; total 266038ms. `pn docs:handoff:check` PASS. HEAD at execution not independently printed; no incorrect attribution to merge or subsequent docs commits. Vercel `success` on merge; GitHub Actions functional CI not run/applicable to branch-scoped historical workflows.
- **Postmerge:** remote `dev` merge SHA verified. Reconciliation on later docs-only commits follows; final structural docs checker **pending operator run on final documentary SHA**. Postmerge six-gate repeat not claimed; follow applicable Harness v2 closure criteria. Jira reconciliation pending record; worktree cleanup requires separate operator inventory/preservation.
- **Outstanding:** A/B/C causal evidence retained, Next 16.4.3 unpatched 10 localhost authenticated GET routes, IPv4 `307 Location: /` self-loop; exact emitting component remains unknown and is scoped to KAN-855/S3 *after* S2 closure. C POST completion (`ERR_ABORTED`) and refresh authentic behavior remain inconclusive. KAN-858 H4B fixed-Team defect independent. Experimental PR #73 remains Draft/intact; do not redo CDP or `groupNotFound`.

---

# Current integrated handoff — KAN-853/S1 (2026-10-27)

- **Integrated:** KAN-853/S1 security dependency characterization, [PR #74](https://github.com/m415x/trail-running-workout-planner/pull/74) ordinary merge into `dev` at `b45e3e9a2d539c360be66c1272b1b64bf87533e1`; approved PR head `63f904f51210cd813c4482ed47f55c7cb37e4086`, previous integrated `dev` `dfbd0018b4b9d19f9764df054535da24bf032de0`.
- **Scope:** three files only: `docs/security/kan-853-dependency-audit-baseline.md`, `tests/scripts/kan-853-pnpm-lockfile-baseline.test.ts`, `tests/sqlite-upgrade-contract.test.ts` (cross-platform Drizzle Kit Node CLI test invocation). No production change or package/lockfile upgrade. Jira KAN-853 Finalizada.
- **Premerge:** operator-reported focal Drizzle, `pn verify --db` PASS and `pn docs:handoff:check` PASS on candidate SHA (Jira comment `14432`); no independent detailed 6-gate transcript. Vercel candidate success. GitHub Actions functional workflow **not applicable to this PR** based on four historical branch-scoped workflows; no GitHub Actions run or functional CI PASS claimed. GitHub `dev` protection endpoint inaccessible to connector (403); GitHub nevertheless accepted ordinary Ready → merge with expected head SHA.
- **Postmerge:** operator confirmed local `dev@364a567a8f66bc0eb4062a0a607ed410a5a783c8`; `pn verify --db` **PASS 6/6** (Tests 154525ms, TypeScript 17695ms, ESLint 34528ms, Build 28343ms, i18n 361ms, SQLite 50212ms; total 285664ms). `pn docs:handoff:check` **FAIL** on that same docs HEAD: missing story `kan-853.md` and current-baseline index. Corrected with docs-only story handoff and index commits; **new docs HEAD requires checker PASS** (do not rerun the 6-stage functional gate solely for documentation correction). Vercel postmerge `success`, separate from functional verification. Worktree inventory/preservation/retirement remains operator-mediated. See [KAN-853 handoff](kan-853.md).
- **Next:** KAN-854/S2 reduced clean candidate only after S1 integrated. Original experimental [PR #73](https://github.com/m415x/trail-running-workout-planner/pull/73) stays Draft and unmodified, HEAD `2724544094789c440d4faa94063db1761daa2459`. Preserve approved KEEP/REMOVE/SEPARATE in Jira KAN-854 comments `14421`–`14424`; do not repeat A/B/C and do not begin KAN-855/S3 before S2 closure.

---

# Current integrated handoff — KAN-689/T2–T4 (2026-10-21)

## T2–T4 integrated closure — 2026-10-21

- **T2 KAN-844:** ten economic writers individually inventoried and characterized. Handler tests verify H2 anonymous, H3 invalid/revoked Team, capability/ownership DENY and no callback writer/revalidation; no production guards changed. Jira T2 finalized.
- **T3 KAN-845:** SQLite disposable `:memory:` multi-Team characterization for Team A/B policy/exception/charge/payment isolation; real Drizzle persistence for payment CAS, global exception revision, charge insertion and reduction/extension, with no-mutation snapshots under cross-Team DENY, H2 anonymous, revoked/invalid/ambiguous Team, insufficient capability and spoofed fields. Four T3 suites and ten-suite focal battery were reported GREEN; TypeScript PASS. Jira T3 finalized.
- **T4 KAN-846:** PR [#72](https://github.com/m415x/trail-running-workout-planner/pull/72) merged normally to `dev` at `f21226e3466151392723f9045a9a2a3a63c8e24b`; candidate SHA `de6d4c09ea15589c764a876bdf48d019b23a2751`. Premerge `pn verify --db` PASS 6/6, total 293914ms; **postmerge on exact dev SHA PASS 6/6**, Tests 165193ms, TypeScript 13123ms, ESLint 31473ms, Build 22568ms, i18n 349ms, SQLite 46916ms; total 279622ms. All PR changes were tests (8 files). Operator also reported `pn docs:handoff:check` PASS prior to this Markdown reconciliation; rerun on updated docs HEAD.
- **Limits:** H2 subjects injected in these integration tests, not browser/Supabase HTTP sessions; some SQLite fixtures use reduced schemas rather than full migration snapshot; reduction/extension H6 handler and Drizzle repository evidence are distinct. No authenticated browser ES/EN walkthrough is claimed. These limitations remain documented rather than silently certified.
- **Administrative guard:** close KAN-846 and parent KAN-689 only after current documentation check and Jira reconciliation; subsequent doc-only commits do not retroactively change the executable postmerge gate SHA.


---

# Current integrated handoff — KAN-689/T1 (2026-10-21)

- PR #71 merged normally to dev at `3bb52c8571b10a5af227684dede133637078bbe5` (remote identity verified).
- Operator-confirmed post-merge `pn verify --db` **PASS 6/6** at this exact local dev SHA: Tests 174905ms, TypeScript 242488ms, ESLint 65868ms, Build 128304ms, i18n 406ms, SQLite 37017ms; total 648988ms.
- T1 enforces H2/H3/H4A `economic_policy.manage` before Team-policy and due-date-exception reads; removes hardcoded `team_1`, preserves presentation loader and economic writers. The ASSISTANT `economy.manage` ability is independent; policy landing denied.
- Authenticated HTTP/browser acceptance, multi-Team end-to-end and durable snapshots remain for KAN-689/T3; ten writer adversarial checks belong to T2. Jira KAN-843 administrative completion and handoff check on this documentation commit are pending.
- Detail: [KAN-689](kan-689.md). Existing historical handoffs preserved below.

---

# Current integrated handoff — KAN-696 Coach Planning authorization states (2026-10-21)

- **Integrated dev:** PR [#70](https://github.com/m415x/trail-running-workout-planner/pull/70), ordinary merge `b4ba97944b2a54cc9dc308c75af4cef1d4acb4ce`, feature/candidate HEAD `28e67a51f5e12a3a826e9faa8705bef4e6830f2c`. Previous integrated handoff KAN-359 remains below.
- **Premerge gate:** operator-reported `pn verify --db` PASS 6/6 on candidate HEAD (Tests 143138ms; TypeScript 12137ms; ESLint 36952ms; Build 30225ms; i18n 359ms; SQLite 44467ms); `pn docs:handoff:check` PASS reported. **Post-merge gate on dev is pending**; do not reinterpret candidate evidence as postmerge.
- **Scope:** Coach Planning listing distinguishes denied, empty, ready, error, plus active-Team selection_required/invalid_context; H2/H3/H4A and H4B per-Plan persisted ownership; independently authorized active-group CTA and protected direct New Strategy route; ES/EN messages. Legacy array reader retained for compatible callers.
- **Acceptance:** operator-observed real-browser Coach ES/EN rendering, KAN-758 multi-Team: no selection deny, team_1 ATHLETE redirects Home, team_2 COACH returns authorized EMPTY without CTA, invalid Team denied, revocation denied. A disposable SQLite 54-table snapshot proved no additional durable changes beyond deliberate revocation and exact restoration; no direct denied Writer mutation or HTTP status capture claimed.
- **Durable detail:** [KAN-696 story handoff](kan-696.md); Jira KAN-696 / KAN-840 / KAN-841 / KAN-842. Complete postmerge verification and docs check on the updated dev head before declaring fresh-chat-safe.
- **Worktree:** operator inventory/preservation and safe retirement pending; do not delete worktrees automatically.

---

# Current integrated handoff — KAN-359 Athlete responsive typography (2026-10-20)

- **Integrated dev:** [PR #69](https://github.com/m415x/trail-running-workout-planner/pull/69), ordinary merge `6dc25aa149e1523723723b23059dedbe41e8482d`, PR head `8a94d39971038eb62ac2c5c1327af54f66b24b10`. Historical divergent KAN-359 branch remains preserved. Latest integrated baseline before this story was KAN-832, preserved below.
- **Functional premerge gate:** operator-reported `pn verify --db` PASS 6/6, functional SHA `3a13257df21009e72679212773d4fbb4fba1519a` (operator did not separately provide local HEAD at that stage). Premerge `HANDOFF DOCS: PASS` and exact local docs HEAD `8a94d39971038eb62ac2c5c1327af54f66b24b10` confirmed.
- **Post-merge gate:** operator-reported `pn verify --db` **PASS 6/6** on locally confirmed `dev@6dc25aa149e1523723723b23059dedbe41e8482d`: Tests 159625ms; TypeScript 10666ms; ESLint 26000ms; Build 22306ms; i18n 406ms; SQLite 48877ms; total 267880ms. Do not attribute this gate to later documentation-only commits.
- **Delivered:** four Athlete typography presets (compact, standard, large, extra-large), validated preference / SSR bootstrap, scoped Athlete text roles across Home/Plan/Stats/Profile, nested cards, calendar, zone heart-rate popover and workout logging dialog; keyboard/reflow/legibility visual corrections operator-accepted. Integrated KAN-645 multisemana Plan retained; Coach scope, H5A/H5B and workout persistence unchanged.
- **Pre-merge finding:** legacy hard-coded class assertions in six tests reconciled to Athlete semantic typography, layout and preserved reset action; first full gate FAIL followed by PASS 6/6.
- **Pending administrative:** `pn docs:handoff:check` on final docs-only `dev` SHA; reconcile Jira KAN-820 and parent KAN-359 status; inspect worktrees with ignored/untracked assets before operator-mediated disposition; no force removal. See [KAN-359 handoff](kan-359.md).

---

# Current integrated handoff — KAN-832 progressive SQLite seeds (2026-10-20)

- **Integrated dev:** [PR #68](https://github.com/m415x/trail-running-workout-planner/pull/68), ordinary merge `80c9bda168561cdddc71278a83500e711f59f17d`; documentation fix `80cc99a171e89be7c39767a356178a13c514bce3` restored three rich alias references required by historical SQLite operations test.
- **Gates:** premerge operator `pn verify --db` PASS 6/6 (detailed durations in [story handoff](kan-832.md)); initial postmerge test gate FAIL only on outdated documentation of rich aliases, corrected documentation-only; subsequent operator-reported postmerge `pn verify --db` **PASS 6/6**, Jira KAN-838 comment 13760. Operator did not provide local HEAD SHA or duration breakdown for latest PASS; do not attribute to exact locally attested HEAD.
- **Delivered:** safe progressive `init` → `base` → `plan` → `demo`; explicit staged `acceptance` with local H4B fixture validation and shared S2/M1 prescriptions; `db:seed` retains rich demo-plus-complements composition, multiteam remains opt-in. KAN-834 rejects non-accredited targets; no claim of live Supabase authentication.
- **Pending administrative closure:** documentation handoff check on final `dev` documentation HEAD; Jira reconciliation; operator-mediated story worktree inventory and disposition or recorded blocker. Inspect ignored SQLite, env, logs and local evidence before any worktree retirement; no automated force-delete.

---

# Current integrated handoff — KAN-645 Athlete Plan multisemana (2026-10-19)

- **Integrated dev baseline:** [PR #66](https://github.com/m415x/trail-running-workout-planner/pull/66), ordinary merge `fba2e11e7a3f777602c253e73a9a33ccc364eee1`; PR head `388450950004aa546df43b29443aa6e5f0900ca7`; functional candidate and pre-merge gate `0458afb6a341a05d399cb547a5fc8570605089ab`. Documentation-only follow-ups have separate SHAs.
- **Post-merge operator gate on integrated dev:** `pn verify --db` **PASS 6/6** — Tests 133323ms, TypeScript 12189ms, ESLint 34225ms, Build 32184ms, i18n 379ms, SQLite 48243ms, total 260543ms. GitHub dev confirmed identical to merge SHA at documentation start. Local `git rev-parse HEAD` was not included with post-merge gate output; treat attribution to merge SHA as operator worktree context rather than independently confirmed local HEAD.
- **Acceptance:** /plan?week civil-week navigation, seven-day effective sessions, 3-week planned distance/D+ summary, Competition context, ES/EN, dark/light, 360/390/mobile, landscape/tablet/desktop, keyboard/focus and 200% zoom operator PASS. The S2 SQLite fixture is seeded; its 101 km / 2970m D+ represents persisted data, **not** coach-generated load validation. Initial artificial `missing-effective-prescription` conflict traced to a zero-prescription Team seed session; corrected with fail-closed preservation for genuine conflict and temporal candidate guard. See [KAN-645 story handoff](kan-645.md).
- **Post-merge publication:** update of integrated current/index and story reconciliation is documentation-only. `pn docs:handoff:check` on the documentation HEAD and Jira KAN-645/KAN-766 administrative closure remain required. Do not attribute the full post-merge gate to later docs-only commits.

---

# Current integrated handoff — KAN-810 regional numeric inputs (2026-10-18)

- **Integrated dev baseline:** [PR #64](https://github.com/m415x/trail-running-workout-planner/pull/64) ordinary merge `d127b40dd67285b5568e841934d06c4dafe3aba8`; PR head `614c3f6decbc438cd5ccc238e2b058cb11d1adb1`, functional candidate gate SHA `e32e5ffabc7c8949425972da63e2e972a2e8f326`. Documentation-only follow-ups are separate identities.
- **Post-merge operator evidence on merge SHA:** `pn verify --db` PASS 6/6 (Tests 135460ms, TypeScript 19554ms, ESLint 32979ms, Build 32753ms, i18n 391ms, SQLite 52195ms; total 273332ms); `pn docs:handoff:check` HANDOFF DOCS: PASS.
- **Accepted behavior:** decimal comma/dot input, strictly validated domain boundaries, canonical persisted dot, locale-aware editable retrieved decimals ES comma / EN dot. Direct operator A3: template, microcycle, biometric SELF, realized-training capture, official Coach 1000m; explicit limited technical equivalence for SessionForm, LoadStrategy and SessionGenerationPreferences, H6 DENY by prior automated regression. See [KAN-810 story handoff](kan-810.md).
- **Post-merge publication:** updated this integrated baseline and documentation index; final documentation-only SHA requires separate `pn docs:handoff:check` and administrative Jira reconciliation. Do not attribute the integrated full gate to this later documentation SHA.

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
