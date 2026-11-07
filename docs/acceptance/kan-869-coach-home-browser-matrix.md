# KAN-869/T6 — Coach Home browser acceptance checklist

**Status (2026-11-06):** PARTIAL REAL-BROWSER PASS + FORMALLY ACCEPTED, NARROW T6 DEFERRALS. The original protocol remains recorded below. Contractual acceptance permits controlled T6 closure and then T7 integration gates, **not** a claim that deferred browser scenarios passed or that Beta Coach is ready.

## Preconditions and safe data

1. Use the current `feat/KAN-644-coach-operational-home` worktree; do not switch/modify a shared developer database for this walkthrough.
2. Start the app using the existing project runtime and an **authorized, nonpersonal Coach H2 session**, H3 selected Team, effective H4A permissions. Reuse an established acceptance identity/fixture if its session can be bootstrapped legitimately; do not forge cookies/session, bypass production guards, or claim an authenticated walkthrough from a synthetic unit test.
3. Record actual Team, actor role, Plan IDs/group names, locale and fixture source **without publishing credentials or personal data**. Have a Plan with a current microcycle and a Plan-owned future CompetitionEntry (and optionally a variant and another Team to test isolation). Do not create a fabricated competition just to satisfy screenshot copy.
4. Capture branch HEAD, browser/version, viewport, local application origin and exact outcome for each scenario.

## Acceptance matrix

| Scenario | Steps | Expected |
| --- | --- | --- |
| Coach ES | Log in as Coach, choose valid Team, open `/es/dashboard` | No fictional KPIs/identity; active-athlete read and Plan/group/Competition values correspond to fixture; civil dates are es-AR |
| Coach EN | Change to English and open `/en/dashboard` | All sections/states translated; civil dates en-US, same Plan and Competition ownership |
| Team isolation | Select another authorized Team or use a Coach lacking scope | Never expose prior Team's athletes, Plan or Competition; DENY not shown as 0/empty |
| Empty | Use an authorized Team with no data | Empty states, no fabricated values and no hidden Competition CTA |
| Error | Reproduce a real controlled read failure only in a disposable test environment | Error state not silently empty/zero; no partial data leak |
| Loading | Throttle network via browser developer tools on a disposable test environment | Loading state announced, eventual state consistent |
| Mobile | Viewport 375×812 and 320×700 | Sections do not overlap, crop, or cause unexpected horizontal scroll |
| Desktop | Viewport 1280×800 | Cards/grid readable and no empty dead-link destinations |
| Light/dark | Switch theme with app control | Text contrast, borders and focus outlines remain perceptible |
| Keyboard | Tab/Shift+Tab/Enter through Plan links and navigation | Correct tab order, visible focus and actions work without mouse |
| Zoom 200% | Browser zoom 200% on desktop | No clipped content or inaccessible actions, no horizontal scrolling of essential content |
| Focus/announcements | Load each status and use keyboard to reach links | `role=status` and labels are meaningful; no focus trap |
| Hidden route | Inspect rendered Home anchors | No `/dashboard/competitions` link; visible Plan links correspond to authorized navigation |
| Refresh/reentry | Refresh Home while authenticated then log out | Server reads remain guarded; anonymous access never shows Coach data |

## Evidence to record

For every row: PASS/FAIL/BLOCKED, environment, exact observed behavior and (if available) sanitized screenshot or browser log. Never mark PASS from code inspection. Where an authenticated browser/session is unavailable, mark **BLOCKED** with cause and keep T6 open. Defects require targeted RED→GREEN before the T6 walkthrough is repeated.

## Tooling assessment (2026-11-04)

`package.json` has no Playwright/Cypress/WebDriver dependency or E2E browser script. Existing `tests/training-response/training-response-e2e.test.ts` is domain-level, **not a real browser test**. `scripts/kan-855-h4a-readonly-acceptance.ts` uses disposable SQLite to verify capability resolution but does not create a web session. Therefore no browser/UX PASS is claimed and no new dependency is installed solely for this checklist. If real browser automation is desired later, approve a separate tooling task with disposable fixtures and a real authenticated H2 path.


## Evidence reconciliation — 2026-11-06 (KAN-869/T6)

**Scope:** `feat/KAN-644-coach-operational-home` at `7192113b448df12a98302300a8b1c24e06d09a93`. All browser findings below were manually reported by the operator; they are not automated E2E results. Jira `14676`–`14694` preserve staged setup and outcomes. The authentic Supabase Coach was linked to disposable SQLite EPT user `kan855-ssr-authenticated-coach` for `team_1`; no credentials are recorded.

### Actual browser/contract evidence

| Original area | Observed outcome | Evidence and limitations |
| --- | --- | --- |
| Authenticated Coach ES + desktop/dark | **PASS — browser screenshot** | Jira `14681`: 7 active athletes, 2 authorized Plans (M1/S2), current and following microcycles, Competition **EMPTY**. Matching read-only Team A fixture inventory `14680` (7 athletes, 2 Plans, 20 microcycles, 0 CompetitionEntries, FK=0). |
| EN, light theme, 375×812 / 320×700, keyboard/focus, 200% zoom, Plan link and return | **PASS — manual operator confirmation** | Jira `14682`; no individual HAR/screenshots for every subcase. |
| Authenticated refresh, Slow 3G loading, reentry, logout protection, new login | **PASS — manual operator confirmation** | Jira `14683`, B1–B5. Network throttle is not a controlled persistence fault. |
| Competition with no entries | **PASS — browser EMPTY** | Real Plan-owned CompetitionEntry count is zero. Do not represent this as an upcoming-Competition PASS. |
| H3 invalid_context / denied audience | **PASS — actual browser negative** | Dedicated SQLite deny copy preserved 7 athletes/2 Plans but disabled the authentic Coach's only active membership; H3 pure resolver reported `invalid_context` and browser showed `Acceso no disponible`, no protected data. Jira `14689`–`14693`. Initial screenshot showed old data before controlled Next restart; probable runtime DB mismatch, **not conclusively diagnosed** (Jira `14691`–`14692`). H3 resolver evidence and browser evidence are distinct. |

### Contractual disposition — formally accepted for T6 only

| Original requirement | Evidence / disposition status | Reason for deferral or missing proof | Existing contractual owner / dependency | Future acceptance condition |
| --- | --- | --- | --- | --- |
| Authentic Team A → B → A browser switching, no data bleed | **BLOCKED; deferred for T6 only, NOT PASS** | No real Team selector is exposed in `DashboardShell` or `AppSidebar`; existing `selectActiveTeamAction` is not a browser UI. KAN-758 multi-Team fixture binds a **synthetic** H4B actor, not the real KAN-855 Supabase Coach. | **H3 ownership:** KAN-604/KAN-660; acceptance-fixture precedent KAN-758; navigation ownership KAN-682/KAN-692/KAN-694. These are historic closed tasks, not reopened work assignments. A new scoped UI/acceptance delivery must be explicitly scheduled if this remains a beta release criterion. | Genuine authenticated Coach has valid membership and appropriate capabilities in both Teams; legitimate selector; A→B→A with distinct data and no stale Team leakage observed via real browser and Server Action authorization. |
| H3 `selection_required` with multiple valid memberships | **PENDING browser; deferred for T6 only, NOT PASS** | Current authentic actor has only one membership in accredited Team A fixture. Existing resolver contract/tests are **not** visual acceptance. | KAN-604/KAN-660 (H3 semantics), KAN-758 (multi-Team fixture precedent); depends on same authentic multi-Team setup as previous row. | Two active applicable memberships for the **same** authenticated EPT actor, no selected Team; actual browser shows selection-required or secure unavailable state without protected reads. |
| Partial H4A capabilities / denied feature access in browser | **PENDING browser; deferred for T6 only, NOT PASS** | A Coach with only `team_membership.manage` denied was checked in pure read-only H4A; not an authenticated browser feature walkthrough with a partial-grant or alternate preset actor. | KAN-606/KAN-654/KAN-658 H4A capability/preset contract; KAN-682/KAN-691/KAN-692 navigation projection. Requires genuine effective actor/membership and scoped UI route. | Browser-visible correct feature inclusion/omission and server-side DENY with authenticated actor and explicit partial capability; no protected data or incorrect EMPTY. |
| Future Plan-owned CompetitionEntry, correct Team/Plan and course link | **BLOCKED; deferred for T6 only, NOT PASS** | Disposable C-Competition copy has 2 active Plans and 0 `RaceEvent`, `RaceEdition`, `RaceCourse`; `CatalogCompetitionForm` cannot select a course. `db/seeds/race-catalog-fixtures.ts` is NOT focal (also writes Goals, Macrocycle, Entries). `saveRaceCatalog` CRUD authorization is not accredited; do not use it as a fixture preparer. | **Catalog CRUD ownership:** KAN-257/KAN-276/KAN-280 (historical, closed). **Plan calendar ownership:** KAN-798/KAN-829/KAN-867 (distinct writers/readers). The `saveRaceCatalog` writer authorization risk needs a **separate scoped security disposition**; no duplicate corrective issue presumed. | Independently authorize catalog CRUD ownership/access, use accredited disposable catalog fixture or legitimate controlled producer; then genuine Coach creates Plan-owned upcoming CompetitionEntry via authorized action and browser shows authorized Plan event, not generic catalog item. |
| Operational read **error** visual distinct from EMPTY/DENY | **BLOCKED; narrowly scoped browser-error exception ACCEPTED for T6 only, NOT browser PASS** | `createCoachHomeAthleteCountReader` and Competition reader have focal tests verifying `error` and no misleading `empty`, but no approved runtime fault-injection for a real browser; no corruption, schema drop, or production guard modification allowed. | KAN-865/KAN-866/KAN-867 reader contracts; KAN-869 UX acceptance owner. A future disposable fault-injection harness, if warranted, requires separately approved scope. | If later required, controlled temporary reader fault with genuine authenticated browser, observable `error` state, no data leak, and clean recovery; contractual reader tests alone remain non-visual evidence. |

**Formal authority:** Explicit auditor-approved disposition received on 2026-11-06, applicable **only to KAN-869/T6 closure and KAN-644 integration**. All five deferrals retain original statuses (BLOCKED or PENDING, NOT PASS). This decision does **not** waive the Beta Coach or real-data gates.

### Active follow-up and release controls

| Active Jira vehicle | Real status verified | Responsibility and limits |
| --- | --- | --- |
| KAN-566 — disposable Coach functional acceptance | In Progress | Functional Coach walkthrough and eventual genuine multi-Team/Competition-positive fixture planning as scoped and authorized there. The historical KAN-758 synthetic actor cannot prove authentic multi-Team browser behavior. No selector or new fixture automatically authorized by this disposition. |
| KAN-298 — identity, authentication and authorization | In Review | H2/H3/H4A/tenant isolation and partial-capability security contract; authentic multi-Team, `selection_required` and partial-capability beta acceptance remain unsatisfied. A closed historical task is not a new open delivery. |
| KAN-567 — real-data beta operational/security gate | To Do | **Do not start real-data beta** until multi-Team isolation, partial-role acceptance, catalog-writing authorization, operational/RLS/backups and other independent KAN-567 prerequisites are explicitly accredited. KAN-566/KAN-298/KAN-472 remain dependencies according to its own contract. |

**Missing independent corrective vehicle:** `saveRaceCatalog()` in `app/actions/race-catalog-actions.ts` has no established H2/H3/H4A writer guard inside its Server Action. Prior ownership KAN-257/KAN-276/KAN-280 is historical/Done; KAN-798 covers **CompetitionEntry writers only**. **Minimal new-issue proposal, NOT CREATED:** “Secure global Race Catalog CRUD Server Action authorization”, initially a discovery of product-level owner/policy, followed by server-side fail-closed guards for create/update/archive and abuse tests (anonymous, wrong actor, unauthorized Team/preset, no mutation on deny), without misusing `competition.manage` for global catalog. No HTTP exploitation was demonstrated. Treat as a release-blocking risk until independently resolved or ruled out with evidence; do not use the unsafe writer to manufacture a fixture.

**Proposed follow-up granularity:** KAN-566 and KAN-298 can carry planning/discovery/validation of authentic multi-Team, `selection_required` and partial roles within their **existing** scopes, subject to their own approved refinements. If actual selector implementation or dedicated automated acceptance exceeds those scopes, create a separately approved small story; no such issue is created here. KAN-567 governs beta release decisions, rather than becoming the implementation owner of catalog CRUD. Positive future Plan-owned CompetitionEntry remains deferred and must be demonstrated with an accredited safe fixture and authorized writer. No new product runtime fault-injection is demanded for the T6 exception.

### T6 exception and administrative exit

**ACCEPTED FOR T6 ONLY:** preserve authentic Team A and H3 `invalid_context` browser PASS; maintain Team A→B→A BLOCKED, H3 `selection_required` browser PENDING, partial H4A browser PENDING, future CompetitionEntry browser BLOCKED; accept narrowly the absence of controlled visual-error injection while preserving reader-contract tests. Do not reinterpret any of these deferred states as PASS.

The explicit acceptance authorizes **controlled administrative closure of KAN-869/T6 once** this document and Jira are reconciled and active follow-up is logged. Then KAN-870/T7 may begin AC-by-AC audit, full gates, docs/handoff, PR, CI, merge and postmerge under its own contract. **KAN-644 is not Beta Coach ready merely because T6/T7 close.** No full `pn verify --db` gate has been run during this disposition.
