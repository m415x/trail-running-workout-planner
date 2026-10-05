# Documentation index

Durable project documentation is organized by purpose. Start here rather than relying on chat history or an old implementation branch.

## Architecture

Domain and technical contracts that current implementation should preserve unless a story explicitly changes them.

- [`architecture/README.md`](architecture/README.md) — architecture index.
- [`architecture/competitions/`](architecture/competitions/) — competitive catalog, classification, planning/goal integration, registration and competitive-history contracts.
- [`architecture/realized-training/`](architecture/realized-training/) — durable realized-training evidence, plan-real comparison and capture contracts.
- [`architecture/monitoring/`](architecture/monitoring/) — monitoring, Training Response and Athlete Stats analytics/disclosure contracts.
- [`architecture/planning/`](architecture/planning/) — planning-domain contracts.
- [`architecture/platform/`](architecture/platform/) — platform/infrastructure contracts, including the supported [SQLite local lifecycle](architecture/platform/sqlite-local-operations.md) and [identity/team-membership authority](architecture/platform/identity-and-team-membership.md).
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

## Handoffs

`docs/handoffs/` is temporary operational state, not an archive. The current operational handoff is [`handoffs/kan-601.md`](handoffs/kan-601.md), covering the KAN-601 H1 identity/team-membership closure candidate. [`handoffs/kan-473.md`](handoffs/kan-473.md) remains recent pre-auth consolidation context only. Completed Epic 5 evolution is consolidated in [`history/epic-5.md`](history/epic-5.md).

## Verification runner

- [`architecture/platform/verification-runner.md`](architecture/platform/verification-runner.md) — KAN-568 `pn verify` contract, compact and verbose output, optional SQLite scenario gate, nonzero exit status and excluded remote Supabase operations.

## Agent harness

- [`agent-harness.md`](agent-harness.md) — `harness-eval-v1` context/tool discipline, behavioral evaluation and completed KAN-281/KAN-282 experiment record. `AGENTS.md` remains the operational authority.

Do not modify the published harness as incidental feature/epic bootstrap work. Any v2 change must be an explicit workflow decision based on the recorded experiment conclusions.

## Current baseline

Epics 1–5 are complete through the KAN-464 closure branch. Epic 5 delivered the H1–H5 Membership billing contract: temporal team policy and athlete terms, immutable monthly charges without automatic proration, auditable H2 exceptions, append-only H3 payments, deterministic H4 account state/history and the shared H5 Coach/Athlete debt experience.

The final H5 blocking rule is precise: `blocked_for_prior_debt` is true only when at least one charge belongs to a civil month before the current civil month and H4 already derives that charge as `overdue`. A prior-month charge under a still-effective extension remains `pending` and does not block. A current-month overdue charge does not create prior-debt blocking. Settlement clears the block by recomputation.

KAN-464 closure evidence includes the H1–H5 cross-contract regression, focused persistence/isolation/UI suites, the full SQLite lifecycle scenarios, a local Supabase migration check and a successful remote Supabase verifier reporting H1/H2/H3 billing contracts OK with 45/45 application tables and 45/45 tables protected by RLS. Local `db:supabase:check` and remote `db:supabase:verify` remain distinct evidence classes.

The legacy `memberships` table is preserved but is not the authority for the new economic domain. Epic 5 adds no authentication/session/role/permission model, gateway/webhook/checkout model or generic settings framework. Differential training fees and other additional charges remain an explicit future extension and must not be represented as a second membership or by deforming `MonthlyCharge`.

KAN-473 — Consolidación funcional y UX pre-beta del MVP — is the current epic and runs before KAN-298. KAN-504 H1 has completed its Coach-workflow consolidation: explicit Sporting group / Planning subgroup vocabulary, canonical group-transfer entry points, transactional Base-plan → Variant persistence/review, and a read-only RaceCourse → planning-impact projection based only on persisted catalog links. Its final story gate was GREEN across tests, lint, typecheck, i18n, production build, SQLite lifecycle and remote Supabase verification (45/45 application tables with RLS).

KAN-505 — H2 · Hacer explicable la generación semanal — is complete. It adds structured per-prescription generation provenance, Coach preview/detail explainability, historical persistence and Base/Variant-aware coordination without turning the weekly pattern into a rigid calendar or changing reconciliation/ownership semantics. KAN-506 — H3 · Completar i18n y definir el boundary regional del MVP — is complete on its story branch: Coach/Athlete MVP surfaces are localized ES/EN, language/presentation locale/operational timezone/currency are separated, temporal values distinguish civil dates/local planned date-times/absolute instants, and regional persistence remains deferred. KAN-507 — H4 · Definir Brand + UI Design System y arquitectura responsive — is complete on its story branch: Git-first Brand/UI foundations, semantic primitives, role-specific responsive architecture, WCAG technical baseline, PWA identity and the MapLibre-first cartographic contract are established. The MapLibre runtime fix explicitly serves its v6 worker assets under Next.js/Turbopack. KAN-508 — H5 · Aplicar patrones compartidos y cerrar la experiencia pre-beta — is in final T9 integration: the approved KAN-359 typography boundary preserves the 120% mobile / 100% desktop root and defers per-user preference; KAN-579 auditable manual-workout withdrawal is a distinct post-KAN-298 feature, no longer a T9 blocker. T9 operator-reported MapLibre and 12/12 cross-role manual checks were GREEN, and the candidate local `pn verify --db` was PASS (739943ms). PR #33 subsequently merged into `dev` at `36731f576ad9f17916ed2594af774499f24e978f`; operator confirmed the exact resulting `dev` HEAD and six-stage `pn verify --db` PASS (433188ms). Formal H5 Jira closure follows the evidence; KAN-473 epic status must acknowledge its two still-open but explicitly deferred direct children KAN-359 and KAN-579. KAN-538 repairs the SessionForm Base/Variant same-group planning-scope collision; see the current [`KAN-473 handoff`](handoffs/kan-473.md) for verification evidence. KAN-569 reconciles the two KAN-561 MapLibre benchmark tests with the existing loaded-style callback contract; the full `pn verify --db` gate and five browser checks are GREEN, with evidence in the current KAN-473 handoff. KAN-568 has delivered the optional `pn verify` aggregate gate runner and merged as PR #31. KAN-298 remains the phase after KAN-473; KAN-472 remains post-auth.

KAN-581 adds a post-Epic read-only Athlete Home economic disclosure over H4/H5. Home uses a server-side Buenos Aires civil cutoff, preserves team/athlete isolation, prioritizes H5 prior-month overdue debt, distinguishes normal/warning/danger/neutral without treating missing data as settled, resets the MobileShell presentation when leaving Home, and adds no access guard before KAN-298. Interactive acceptance covered ES/EN, light/dark, 360/390 px, 200% zoom, keyboard/focus/screen-reader behavior, Home/Profile navigation and BottomNavigationBar clearance. The notification bell remains deliberately outside KAN-581; a notification center requires its own event/persistence/read-state/permissions/UX contract.

Epic 5 is consolidated in [`history/epic-5.md`](history/epic-5.md). Its durable current contract is [`architecture/memberships.md`](architecture/memberships.md). The current execution baseline is [`handoffs/kan-473.md`](handoffs/kan-473.md), which now records the reconciled KAN-359 / KAN-579 boundaries and directs final KAN-508 T9 integration while preserving KAN-298 as the next phase after KAN-473.

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
