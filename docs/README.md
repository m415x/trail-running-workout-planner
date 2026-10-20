# Documentation index

Durable project documentation is organized by purpose. Start here rather than relying on chat history or an old implementation branch.

## Current execution and handoffs

- [KAN-645 Athlete Plan multisemana — integrado en dev](handoffs/kan-645.md) — [PR #66](https://github.com/m415x/trail-running-workout-planner/pull/66), merge `fba2e11e7a3f777602c253e73a9a33ccc364eee1`, gate post-merge PASS 6/6 informado, aceptación ES/EN y accesibilidad, resolución de conflicto seed; publicación documental posterior requiere handoff check.

- [KAN-798 Competition Calendar writer authorization](handoffs/kan-798.md) — H2/H3/H4A `competition.manage` TEAM, Plan/Entry ownership and atomic catalog linking, integrated through PR #65, `dev` merge `b6e80ac441baaab999f7193ccf894c2cca24a70a`; operator-reported post-merge PASS 6/6.

- [KAN-810 regional numeric inputs](handoffs/kan-810.md) — A1–A3 operator RED/GREEN, direct/equivalence acceptance, integrated via PR #64, ordinary dev merge `d127b40dd67285b5568e841934d06c4dafe3aba8`, post-merge PASS 6/6 and handoff PASS.

- [KAN-809 TDD runner preparation hardening](handoffs/kan-809.md) — B1/B2/B3 operator evidence, candidate gate, preservation contracts, and closure status. KAN-810 regional numeric inputs was subsequently integrated via PR #64.

## Architecture

- [`architecture/athlete-profile-self-biometrics.md`](architecture/athlete-profile-self-biometrics.md) — KAN-646 Athlete Profile SELF biometrics, transactional authorization, provenance, account reuse and pre-merge acceptance evidence.

- [`architecture/platform/acceptance-athlete-b-provisioning.md`](architecture/platform/acceptance-athlete-b-provisioning.md) — KAN-778 local acceptance Athlete B provisioning, idempotence, identity safeguards and evidence limits.

Domain and technical contracts that current implementation should preserve unless a story explicitly changes them.

- [`architecture/README.md`](architecture/README.md) — architecture index.
- [`architecture/competitions/`](architecture/competitions/) — competitive catalog, classification, planning/goal integration, registration and competitive-history contracts.
- [`architecture/realized-training/`](architecture/realized-training/) — durable realized-training evidence, plan-real comparison and capture contracts.
- [`architecture/monitoring/`](architecture/monitoring/) — monitoring, Training Response and Athlete Stats analytics/disclosure contracts.
- [`architecture/planning/`](architecture/planning/) — planning-domain contracts.
- [`architecture/platform/`](architecture/platform/) — platform/infrastructure contracts, including the supported [SQLite local lifecycle](architecture/platform/sqlite-local-operations.md), [identity/team-membership authority](architecture/platform/identity-and-team-membership.md), [authentication session lifecycle](architecture/platform/authentication-session-lifecycle.md) and [authorization capabilities/scopes](architecture/platform/authorization-capabilities-scopes.md).
- [`architecture/memberships.md`](architecture/memberships.md) — Epic 5 H1–H5 economic contract: temporal policy/terms/charges, auditable exceptions, append-only Payments, derived account/history projection and Coach/Athlete prior-debt experience.

### Monitoring baseline

- [`architecture/monitoring/athlete-stats-analytics.md`](architecture/monitoring/athlete-stats-analytics.md) — KAN-264 completed Athlete Stats architecture and disclosure baseline.
- [`architecture/monitoring/field-performance-and-execution-guidance.md`](architecture/monitoring/field-performance-and-execution-guidance.md) — Epic 4 canonical 1000 m evidence, lifecycle, RunningReference and safe execution/presentation contract.
- [`architecture/monitoring/systematic-volume-excess.md`](architecture/monitoring/systematic-volume-excess.md) — versioned external-volume persistence/review signal.
- [`architecture/monitoring/training-response-convergence.md`](architecture/monitoring/training-response-convergence.md) — coach-review convergence/triage boundary; explicitly not a physiological diagnosis.
- [`architecture/monitoring/readiness-assessment.md`](architecture/monitoring/readiness-assessment.md) — individual readiness evidence boundary inherited from Epic 2.

### Competitive baseline

- [`architecture/competitions/race-catalog.md`](architecture/competitions/race-catalog.md) — RaceEvent → RaceEdition → RaceCourse identity and course-demand contract.
- [`architecture/competitions/race-registration.md`](architecture/competitions/race-registration.md) — implemented KAN-281 registration lifecycle, participation/result, historical snapshot, persistence/isolation and Coach/Athlete disclosure contract.
- [`architecture/competitions/race-registration-boundary.md`](architecture/competitions/race-registration-boundary.md) — historical KAN-275 reservation that preceded the implemented contract.

## History

Completed epics are consolidated here. History explains evolution and prior decisions; current architecture/code remain authoritative for present behavior.

- [`history/epic-1.md`](history/epic-1.md) — foundational coach/group/planning workflow.
- [`history/epic-2.md`](history/epic-2.md) — planning automation, safe persistence and readiness evidence.
- [`history/epic-3.md`](history/epic-3.md) — realized training, plan-real monitoring, load/triage, Athlete Stats, competitive catalog/registration and action safety.
- [`history/epic-4.md`](history/epic-4.md) — canonical 1000 m evidence, RunningReference, execution guidance, factual evolution, lifecycle and safe Coach/Athlete integration.
- [`history/epic-5.md`](history/epic-5.md) — temporal membership economics, exceptions, payments, derived account state and Coach/Athlete debt experience.

## H7A — Authorship and audit

- [`handoffs/kan-772.md`](handoffs/kan-772.md) — KAN-772 merged SQLite H7A 0020–0025 physical-drift detection, clean disposable bootstrap and supported lifecycle idempotence evidence (PR #54, merge `70994015`).

- [`architecture/platform/h7a-authorship-audit.md`](architecture/platform/h7a-authorship-audit.md) — KAN-610 actor provenance, retained audit and limits of current H4A-based read authorization.

## Handoffs

- [`handoffs/kan-810.md`](handoffs/kan-810.md) — **KAN-810 current integrated handoff baseline**, regional numeric A1–A3 and operator PASS 6/6; KAN-809 is the preceding integrated baseline.

- [`handoffs/kan-809.md`](handoffs/kan-809.md) — **KAN-809 preceding integrated handoff baseline**, TDD runner preparation failures, PR #63 ordinary merge `a29170eecd4801990220ac552278e1c10a87e005`; post-merge `pn verify --db` PASS 6/6, documentation index reconciliation in progress.

- [`handoffs/kan-646.md`](handoffs/kan-646.md) — **KAN-646 current integrated handoff baseline**, Athlete Profile SELF biometrics and account settings, PR #62, merge `766cff4f942104e0576c508581c0cf8fd8a1ccf1`, with post-merge gate evidence and documented limits.

- [`handoffs/kan-790.md`](handoffs/kan-790.md) — **KAN-790/T5 integrated baseline**, PR #59 merged to `dev` (`e9f5f8276b4508e0fefdde7a7bd97787e27fd8d7`); PostgreSQL authorized Coach CREATE/GET/CONFIRM, SERIALIZABLE/CAS, H2/H3/H4A, reconciliation and evidence/limitations. Post-merge six-gate PASS on `5ac81c79...`; documentation-only follow-up gate pending on current documentation HEAD.

- [`handoffs/kan-784.md`](handoffs/kan-784.md) — historical and acceptance handoff for KAN-784/T4–T6; PR #59 merged, with SHA-scoped PostgreSQL and idempotence evidence.

- [`handoffs/kan-792.md`](handoffs/kan-792.md) — KAN-792 merged Competition Calendar Plan/Team reader (PR #58) and explicit KAN-798 High security blocker for five mutation entry points.

- [`handoffs/kan-688.md`](handoffs/kan-688.md) — KAN-688 Coach Templates H2/H3/H4A merged baseline, PR #57, SHA-scoped isolated SQLite and action composition evidence.

- [`handoffs/kan-778.md`](handoffs/kan-778.md) — KAN-778 integrated provisioning of Supabase Athlete B in local SQLite, operator acceptance evidence, no-write rerun and KAN-766/T8 remaining boundary.

`docs/handoffs/` is temporary operational state, not an archive. [`handoffs/current.md`](handoffs/current.md) records the latest integrated **KAN-810** regional numeric baseline (PR #64), following **KAN-809** TDD runner baseline (PR #63), following **KAN-646** Athlete Profile SELF baseline (PR #62), after **KAN-790/T5** authorized SQL snapshot baseline (PR #59), following the **KAN-792** Competition Calendar reader (PR #58, merge `7d11c885f827f62448f49c9fbed0dddbe81963cf`) and the independent KAN-798 writer security blocker, following **KAN-688** Coach Templates authority (PR #57, merge `02923d0facb66d8db6335d6348a4919158d19bf2`), with the preceding **KAN-778** acceptance Athlete B baseline (PR #55, merge `59e7b3ac`) with SHA-scoped evidence in [`handoffs/kan-778.md`](handoffs/kan-778.md). Earlier KAN-724 routing evidence is retained in [`handoffs/kan-724.md`](handoffs/kan-724.md). Previous KAN-606/H4C, KAN-739 Harness v2 and KAN-610/H7A baselines are retained in [`handoffs/kan-739.md`](handoffs/kan-739.md) and [`handoffs/kan-610.md`](handoffs/kan-610.md). Jira and remote `dev` determine actual integration state.

KAN-609/H6 is retained in [`handoffs/kan-609.md`](handoffs/kan-609.md) as historical integration evidence.

## H4C — Coach competition and official field-evidence authorization (merged)

- [`handoffs/kan-606.md`](handoffs/kan-606.md) — KAN-606/H4C merged baseline (PR #52, merge `8f27f6ec`), scope exclusions, focal RED/GREEN and SHA-scoped operator-reported `pn verify --db` PASS. Post-merge documentation verification is tracked separately.
- [`architecture/platform/authorization-capabilities-scopes.md`](architecture/platform/authorization-capabilities-scopes.md) — durable `competition.manage` TEAM-only and `field_evidence_1000m.manage` Coach enforcement contracts.


## KAN-724 — Effective audience routing (merged)

- [`handoffs/kan-724.md`](handoffs/kan-724.md) — KAN-724/T1–T8 H2 + validated active Team + effective H3 preset routing, localized login/logout, cross-shell redirects, fail-closed multi-Team selection and SHA-scoped candidate evidence. Merged in PR #53 to `dev` (`b3c04e8d`); retained as an earlier integrated operational handoff. KAN-757 canonical SQLite reviewer recovery and KAN-758 opt-in multi-Team acceptance fixture are part of the merged evidence; the base seed and H2 identity model remain unchanged.
- [`architecture/platform/authentication-session-lifecycle.md`](architecture/platform/authentication-session-lifecycle.md) — the underlying H2 session boundary remains authoritative; H3 capabilities and resource-level guards are unchanged.

## Verification runner

- [`architecture/platform/verification-runner.md`](architecture/platform/verification-runner.md) — KAN-568 `pn verify` contract, compact and verbose output, optional SQLite scenario gate, nonzero exit status and excluded remote Supabase operations.

## Agent harness

- [`agent-harness.md`](agent-harness.md) — Harness v2 current operational workflow plus the preserved historical `harness-eval-v1` evaluation record. `AGENTS.md` remains the normative operational authority.
- [`handoffs/kan-725.md`](handoffs/kan-725.md) — KAN-725 Harness v2 closure evidence; pre-merge candidate until the post-merge reconciliation publishes it as fresh-chat-safe.

## Current baseline

Epics 1–5 are complete through the KAN-464 closure branch. Epic 5 delivered the H1–H5 Membership billing contract: temporal team policy and athlete terms, immutable monthly charges without automatic proration, auditable H2 exceptions, append-only H3 payments, deterministic H4 account state/history and the shared H5 Coach/Athlete debt experience.

The final H5 blocking rule is precise: `blocked_for_prior_debt` is true only when at least one charge belongs to a civil month before the current civil month and H4 already derives that charge as `overdue`. A prior-month charge under a still-effective extension remains `pending` and does not block. A current-month overdue charge does not create prior-debt blocking. Settlement clears the block by recomputation.

KAN-464 closure evidence includes the H1–H5 cross-contract regression, focused persistence/isolation/UI suites, the full SQLite lifecycle scenarios, a local Supabase migration check and a successful remote Supabase verifier reporting H1/H2/H3 billing contracts OK with 45/45 application tables and 45/45 tables protected by RLS. Local `db:supabase:check` and remote `db:supabase:verify` remain distinct evidence classes.

The legacy `memberships` table is preserved but is not the authority for the new economic domain. Epic 5 adds no authentication/session/role/permission model, gateway/webhook/checkout model or generic settings framework. Differential training fees and other additional charges remain an explicit future extension and must not be represented as a second membership or by deforming `MonthlyCharge`.

KAN-473 — Functional + UX pre-beta consolidation — is completed and integrated. KAN-298 is the active phase. Within KAN-298, KAN-601 H1 is completed and establishes the internal identity / TeamMembership / AthleteProfile baseline. KAN-602 H2 is completed and provides the authenticated internal EPT User boundary. KAN-603 H3 is completed and integrated; it adds non-hierarchical TeamMembership capability presets, SELF/SPORTING_GROUP/TEAM scopes, reserved fail-closed ASSIGNED_ATHLETES, bounded temporary delegation, persisted grant lifecycle and the reusable authenticated H2→H3 authorization boundary. KAN-604 H4A, KAN-605 H4B, KAN-607 H5A and KAN-608 H5B are recorded Finalizada in Jira; H4A/H4B/H5A are already integrated in `dev`. KAN-608 H5B was merged into `dev` through PR #47 at `1b768b1496262f553f7afc25c70dea2abfd65e8b` (feature HEAD `ebf52e287cb4cb8e281f39acdc4303f5ef7f35f7`). H5B adds server-resolved Stats/physiology SELF reads, denying cross-Team/athlete reads and removing Profile fixture identity and invented physiology. Do not treat the PR branch as current `dev` runtime until merge is confirmed.

KAN-505, KAN-506, KAN-507 and KAN-508 are completed pre-auth baselines. KAN-538, KAN-568 and KAN-569 are also resolved. Their historical delivery evidence remains in the KAN-473 handoff/history, but they are not the current execution scope. KAN-359 and KAN-579 remain separately deferred and are not KAN-601 acceptance blockers. KAN-472 remains post-auth.

KAN-581 adds a post-Epic read-only Athlete Home economic disclosure over H4/H5. Home uses a server-side Buenos Aires civil cutoff, preserves team/athlete isolation, prioritizes H5 prior-month overdue debt, distinguishes normal/warning/danger/neutral without treating missing data as settled, resets the MobileShell presentation when leaving Home, and adds no access guard before KAN-298. Interactive acceptance covered ES/EN, light/dark, 360/390 px, 200% zoom, keyboard/focus/screen-reader behavior, Home/Profile navigation and BottomNavigationBar clearance. The notification bell remains deliberately outside KAN-581; a notification center requires its own event/persistence/read-state/permissions/UX contract.

Epic 5 is consolidated in [`history/epic-5.md`](history/epic-5.md). Its durable current contract is [`architecture/memberships.md`](architecture/memberships.md). The current execution checkpoint is [`handoffs/current.md`](handoffs/current.md), which records the integrated KAN-725 Harness v2 PR #49 baseline and its post-merge documentation reconciliation. The completed H1–H4B handoffs and KAN-473 handoff are historical navigation only; consult current `dev` and Jira for actual status.

Before starting the next story or phase, follow the fresh-chat bootstrap contract in `AGENTS.md`: current `dev` → this index → most recent relevant handoff → only relevant durable domain docs → focused code/tests → complete Jira issue/dependencies. Apply [`agent-harness.md`](agent-harness.md) as the workflow-discipline companion without treating historical chat context as project authority.

## Other documentation

- [`research/`](research/) — scientific/product research and rationale. Research informs contracts but is not automatically implementation scope.
- [`product/`](product/) — product-facing documentation.
- [`product/kan-577-accessibility-audit.md`](product/kan-577-accessibility-audit.md) — completed KAN-577/T8 Coach and Athlete responsive, zoom, keyboard, locale and visual hierarchy audit; verified targeted RED→GREEN fixes and full `pn verify --db` PASS. Parent KAN-508 integration and KAN-578/T9 remain separate.
- [`history/prebeta-consolidation.md`](history/prebeta-consolidation.md) — KAN-473/H1–H5 delivery and KAN-508/T9 acceptance matrix, dated operator gate evidence, post-auth KAN-579 deferral, and still-required PR/merge/post-merge verification.
- [`glossary/`](glossary/) — terminology.
- [`superpowers/`](superpowers/) — implementation plans/workflow artifacts; completed plans must be clearly treated as historical rather than pending work.

## Reading rule

For new work, read `AGENTS.md`, this index, the current epic/story handoff when one exists, the latest completed epic history when relevant, and only the durable domain documents required by the scope. Then reconcile them with focused current code/tests and the complete Jira issue. Retrieve additional detail just in time instead of preloading the repository or relying on chat history.

## Identity / KAN-601 closure baseline

- [`architecture/platform/identity-and-team-membership.md`](architecture/platform/identity-and-team-membership.md) — durable H1 authority, AthleteProfile identity, lifecycle and persistence boundaries.
- [`research/kan-601-persistence-evidence.md`](research/kan-601-persistence-evidence.md) — explicit PURE / SQLITE REAL / POSTGRESQL STATIC / POSTGRESQL REAL evidence matrix.
- [`handoffs/kan-601.md`](handoffs/kan-601.md) — final KAN-601 reconciliation matrix and closure candidate sequence.



## Authorization / KAN-603 closure baseline

- [`architecture/platform/authorization-capabilities-scopes.md`](architecture/platform/authorization-capabilities-scopes.md) — durable H3 capability, scope, delegation, persistence and effective-authorization contract.
- [`handoffs/kan-603.md`](handoffs/kan-603.md) — final KAN-603 reconciliation matrix and closure sequence.

## Authentication session / KAN-602 closure baseline

- [`architecture/platform/authentication-session-lifecycle.md`](architecture/platform/authentication-session-lifecycle.md) — durable H2 session/authentication contract.
- [`handoffs/kan-602.md`](handoffs/kan-602.md) — final KAN-602 reconciliation matrix and closure sequence.


## Coach H4A / KAN-604 closure baseline

- [`architecture/platform/authorization-capabilities-scopes.md`](architecture/platform/authorization-capabilities-scopes.md) — durable H3 plus completed H4A active-Team enforcement contract.
- [`handoffs/kan-604.md`](handoffs/kan-604.md) — KAN-604 reconciliation matrix and closure sequence.

## Athlete H5B / KAN-608 merged baseline

- [`architecture/h5b-athlete-stats-physiology-self.md`](architecture/h5b-athlete-stats-physiology-self.md) — H5B authenticated SELF Stats, 1000 m reference, Profile disclosure and explicit unknown/denied/error semantics.
- KAN-608 is a completed historical baseline. Current operational authority has advanced beyond H5B; consult Jira and merged PR #47 for historical H5B integration evidence.

## Athlete H6 / KAN-609 merged baseline

- [`architecture/h6-economic-authorization-athlete-debt-guard.md`](architecture/h6-economic-authorization-athlete-debt-guard.md) — H6 economic capabilities, reversible prior-debt SELF write guard and accepted DENY semantics.
- [`handoffs/kan-609.md`](handoffs/kan-609.md) — KAN-609/T1–T10 final evidence and integration handoff; PR #48 merged into dev.
- [`handoffs/current.md`](handoffs/current.md) — most recent operational baseline; KAN-724 follows independently.
