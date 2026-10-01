# KAN-577 — T8 residual accessibility and usability audit

Status: **IN PROGRESS** (2026-10-01). Scope: KAN-508 T8. Branch: `feat/KAN-508-prebeta-ux-consolidation`.

## Scope and guardrails

- Audit representative Coach and Athlete MVP flows, both ES/EN, light/dark, keyboard, mobile/tablet/desktop, zoom and increased text. Only **bounded, demonstrated residual defects** qualify for T8 implementation. UX fixes owned by T2–T7 stay attributed to their owner, and do not become T8 refactors by default.
- Root font-size stays **120% mobile** and **100% from 640px**. KAN-359 remains open; preference/persistence or root changes require a new approved decision.
- Preserve KAN-569 MapLibre rendering/worker/style lifecycle and H1–H5 membership economics. No architecture or generic UI-state rewrites.
- `pn verify --db`, final T9 browser benchmark and merge belong to **KAN-578 (T9)**; they have not been executed here.
- Source observations below are NOT a claim of actual WCAG compliance, browser testing, 200% zoom testing or an observed defect.

## Evidence legend

- **SOURCE**: inspected implementation at current branch (recheck before editing).
- **USER VISUAL**: screenshots and behavior manually reported in KAN-576; scoped to that journey and observed browser state.
- **TO VERIFY**: browser/device evidence missing; no pass/fail judgment.
- **NO-OP**: source does not independently establish a residual defect.

## Source-backed residual matrix

| Flow / owner | Source evidence (2026-10-01) | What must be checked in browser | Audit state |
| --- | --- | --- | --- |
| Athlete bottom navigation / T3 | `components/layout/BottomNavigationBar.tsx`: four destinations, token caption size, `min-h-[var(--size-ept-touch-target)]`, `focus-visible:ring-2` | ES/EN label wrapping at 360/390px and 200% zoom; focus location and visible ring with Tab/Shift+Tab; no fifth destination or horizontal overflow | SOURCE; TO VERIFY |
| Athlete Home, Plan, Stats, Profile / T3 | T1 inventory documents localized cards, existing disclosure and 4-destination IA; corrected Plan guidance in T3 | Real data and empty/error states; portrait mobile and desktop 1280px; labels, content order, scroll accessibility, focus and contrast in both themes | SOURCE; TO VERIFY |
| Coach navigation and Groups, Planning, Sessions / T2 | T1 inventory and existing responsive composition; calendar already has period views and group filter | At 1280, 768 and narrow mobile check readable actions, card boundaries, horizontal overflow, zoom 200%, keyboard operation | SOURCE; TO VERIFY |
| Coach planning cohorts / T2 | `app/[locale]/dashboard/cohorts/page.tsx`: responsive grid, planned-variant title inside `<span className='truncate'>` and side-by-side badge/title | With realistically **long** variant and cohort names, 200% zoom and 360px viewport, confirm whether text becomes inaccessible or obscures status/actions; don't treat intentional truncation as failure without lost required information | SOURCE; TO VERIFY |
| Coach athletes list / T2/T6 | `features/athletes/components/AthletesTable.tsx`: data table, explicit actions names; `max-w-48 truncate` cohort link; T6 avoided speculative pagination | 200% zoom and narrow viewport: inspect table overflow, reachability of actions and link's complete accessible name; record actual team/dataset size before recommending filtering | SOURCE; TO VERIFY |
| Coach Membership and Athlete account status / T4 | `AthleteMembershipStatus.tsx`: `min-w-0`, `break-words`, prior-debt `role='alert'`; Coach payment fields received `aria-label` ES/EN | Verify long ARS amounts/currencies, dates, field labels, validation errors and keyboard navigation at 360px/200% zoom, dark/light; do not modify charge/debt derivation | SOURCE; TO VERIFY |
| RouteMapCard and elevation / T7 | `RouteMapCard.tsx`: `role='status'` loading, `h-60` map, `grid grid-cols-3 gap-2` for metrics; ES/EN localized; elevation profile localized | In EN and ES at mobile width confirm metrics remain readable, selector opens/closes with keyboard, popups contrast, credits native and collapsed initially; optional elevation/unavailable track state needs owner T7 decision/evidence before any edit | SOURCE; TO VERIFY |
| MapLibre first style switch and credits / T7 | KAN-576 comments 11169–11170: user browser GREEN after F5 for first Standard→Topographic and Standard→Satellite; later focused test+lint GREEN. Native attribution open/close was user-confirmed | T9 full benchmark and repeat under alternative styles/viewport/theme still pending; do not equate local validation with all environments | USER VISUAL (narrowly scoped); T9 TO VERIFY |
| Shared feedback / T5 | Source uses existing Cards/Alerts, error and success announcements across key flows; no demonstrated universal repeated state flaw | Check actual displayed error/success announcements; do not create global abstraction unless repeatable cross-feature issue is found | SOURCE; NO-OP pending browser |

## Reproducible browser walkthrough for operator

Use the **current feature branch** and actual Coach/Athlete accounts with non-sensitive test data. Record **route, locale, theme, viewport, zoom, reproduction, expected versus actual, and screenshot** for each failure. Do not write PASS for an unperformed check.

**Round A — highest-risk compact composition**

1. Set viewport to **360 × 780** CSS px, then **390 × 844**; ES and EN; inspect Athlete Home→Plan→Stats→Profile. Scroll each screen, check bottom navigation visibility, text legibility, clipping and hidden content. Tab and Shift+Tab through interactive controls; confirm visible focus and no keyboard trap.
2. On Athlete Home, inspect RouteMapCard with a real loaded track: choose Topographic and Satellite after independent F5 reloads; select via layer icon, press Escape, open/close the native attribution, inspect both marker popups (start/finish). Also check `Elevation profile` heading and metric values at 360px; record absent/partial elevation separately instead of fabricating fixture data.
3. In Coach Membership, inspect long amounts/dates, error announcements, payment fields and responsive wrapping at 360px and 390px. Keep billing state unchanged unless a test fixture allows safe mutations.

**Round B — increased text and Coach hierarchy**

4. At **768px and 1280px** use ES and EN, light and dark. Inspect Coach cohorts with long variant titles, AthletesTable with long emails/cohort names, Planning, Groups and Sessions controls.
5. Repeat the pages at browser **200% zoom**, with special attention to horizontal overflow, essential controls disappearing, unannounced truncation, focus-visible indicators, accessible control names and contrast. Evaluate the effective CSS viewport after zoom rather than assuming physical window width remains unchanged.
6. Exercise keyboard-only navigation (Tab, Shift+Tab, Enter/Space, Escape) on nav, accordions, menus, forms, map layer picker and dialogs. Record behavior and focus restoration.

**Round C — residual resolution**

7. For each reproduced defect create one row below with finding → source → minimal fix/no-op → RED → GREEN → browser recheck. If it belongs to T2/T3/T4/T7, reconcile Jira ownership before editing. Stop if a fix changes global root scaling/persistence or protected economic/MapLibre contracts.
8. For checks without defects record the performed route/locale/theme/viewport and operator evidence. No blanket WCAG conformance claim.

## Confirmed findings / disposition

| ID | Evidence and repro | Source owner | Fix/no-op and commit | Focused check | Browser recheck |
| --- | --- | --- | --- | --- | --- |
| T8-00 | Source-only initial audit; no independently reproduced residual defect yet | T8 | **No code change** | Not applicable | TO VERIFY |
| T7-MAP-01 | KAN-576 user reported first basemap style switch losing track; F5 → first Topographic/Satellite cases later GREEN in browser | T7 / KAN-576 | Deferred retry changed from additional `style.load` to current-style `idle`; commits 32b15f8b, f0b040d3 | Operator confirmed focused tests and lint GREEN in KAN-576 | USER VISUAL: first-change cases GREEN; broad T9 verification pending |
| T7-ATTR-01 | Attribution default-open and layout refinements; native-size/closed state user confirmed | T7 / KAN-576 | Preserve native control and initial closed state; commits 83491966, bdbe0427 | Operator reported focused triple GREEN | USER VISUAL: attribution opens/closes; T9 cross-theme pending |

## Exit conditions / next handoff

T8 may move to **En revisión** only after performed browser evidence for representative corrected and unaffected flows is written here (or each remaining omission explicitly deferred with owner/rationale), and every reproduced T8 defect has bounded TDD and screenshot recheck. At T9 execute `pn verify --db`, full representative ES/EN light/dark browser walkthrough and map benchmark, reconcile project docs and Jira, create PR, merge to `dev`, and run required post-merge verification.

Updated 2026-10-01. This document is an **audit plan and evidence ledger**, not a completion certificate.

## Approved product change discovered during T8: KAN-579

User screenshots from Athlete Home's realized-training dialog established that **Limpiar formulario** was intended to *delete the saved realized workout*, not clear unsaved edit fields. The earlier draft-clear fix (commit `e81525b3`) is **not accepted as the requested behavior** and must be superseded/reconciled by KAN-579; do not report it as completion of deletion. Initial date/time autofill is a separate T8 GREEN fix (commit `6271925d`).

The user approved a new, standalone story **KAN-579 — Eliminar con auditoría un entrenamiento realizado desde Home**: a compact icon-only trash button in edit mode, localized accessible name ES/EN, confirmation, authenticated manual-evidence-only soft deletion with durable audit (no physical purge), unchanged prescription and recalculated Home/history/stats/readiness. Creation mode has no delete action. KAN-579 relates to KAN-577 and **blocks KAN-578 T9** until implementation/verification or an explicit rescope decision. The issue owns domain/persistence/security decisions and TDD; T8 is not authorized to improvise them.

2026-10-01: story and links recorded in Jira; **no server deletion implementation or migration performed**. The remaining independent self-assessment i18n/RPE display audit may proceed within T8. Historical known-zero RPE must not be recast as unknown without a product/domain decision.

## T8 Athlete Home dialog — verified focused gates (2026-10-01)

- **Automatic occurrence datetime**: operator reported GREEN for focused test and lint after commit `6271925d`. New registration initializes from the device-local clock at dialog opening; existing edits retain historic `performedAt`. Independent browser date/time recheck is not asserted here.
- **Draft clearing is NOT record deletion**: user explicitly rejected the interpretation of `Limpiar formulario`; the provisional draft-clearing commit `e81525b3` is **not** accepted as completing the requested function. Supersession belongs to **KAN-579** with confirmed soft delete and audit. The provisional control may still be visible until that story lands.
- **Self-assessment localization**: ES/EN translation of title, question and five feeling labels applied (commits `1adfd1d8`, `4c4f2e37`, `c103ef9e`, `68e6408b`). RPE 1–10, one UI action to clear to unrecorded, and no historical RPE 0 summary badge (commits `aab9ab02`, `5cc11a52`). Original capture conversion semantics of persisted `known: 0` are unchanged.
- **Actual visual regression and repair**: user screenshot proved the unrecorded RPE slider unusable. The shared Slider renders thumbs per `value.length`; `value={[]}` yielded no thumb. Focused RED was confirmed; repair commit `008aca45` uses `value={[sliderValue]}` while retaining visual unrecorded state until explicit selection.
- **GREEN**: operator subsequently reported `green` for `pn tdd tests/workouts/rpe-unrecorded-slider-thumb.test.ts tests/workouts/self-assessment-i18n-unassessed-rpe.test.ts`, `pn lint` and `pn i18n:check`. Counts were not supplied; do not invent them. **Browser recheck confirmed**: operator explicitly reported `navegador green` after the slider repair, following requested ES/EN selection → clear walkthrough. This confirms the exercised browser scenario, not an exhaustive device, theme, keyboard, or 200%-zoom accessibility audit.

### Next browser evidence gates

1. Athlete Home RPE: ES/EN select → clear was operator-confirmed browser GREEN. Preserve this evidence; focused separate keyboard-only, touch-only, contrast and zoom-specific checks remain part of the broader T8 audit.
2. Repeat at mobile width 360/390, dark/light and 200% zoom; check five feeling buttons for focus and clipping. Log actual viewport, language, theme and repro evidence.
3. Continue other representative Coach/Athlete T8 screens in the preceding matrix. Do not move T8 into review on focused technical GREEN alone. KAN-579 remains a real blocking dependency of T9.

## T8 Coach session generation and calendars — focused checkpoints (2026-10-01)

- **Session generation i18n:** operator confirmed GREEN for `pn tdd tests/sessions/sessions-i18n-ui.test.ts tests/sessions-calendar-i18n.test.ts`, `pn lint` and `pn i18n:check`. Source updates: generation preferences and selected weekly role `da62e611`, microcycle types `d6fdc71b`, generated-session preview `9e4e1688`, ES/EN messages `7b38dd63` / `3129478f`. The independent post-fix browser locale walkthrough has not been reported.
- **Monthly mobile 7-column access:** operator confirmed focused tests/lint/i18n GREEN after RED and implementation commits `717857f7`, `2dcf53b1`, `f45eb707`. The full seven-column month grid remains horizontally scrollable, now labeled as a keyboard-focusable region with a mobile-only ES/EN swipe hint. Post-fix browser swipe through Sunday and keyboard navigation **still require visual/operator confirmation**.
- **Weekly card overflow:** operator screenshots show long session title/type badges visibly overlapping the seven-day calendar columns on a narrow viewport. Current `SessionCalendarCard.tsx` uses `flex items-start justify-between` with a `shrink-0` type badge, which can exceed the fixed day width. Focused RED prepared as `tests/sessions/week-view-overflow.test.ts` (commits `0419e57a`, `6621643b`); **RED confirmed by operator; GREEN subsequently confirmed** for `pn tdd tests/sessions/week-view-overflow.test.ts tests/sessions-calendar-i18n.test.ts` and `pn lint` (no test counts provided). Implementation commits `3e73345f` and `8ba1d5ec` stack the localized badge beneath the title; apply `min-w-0`, `break-words` and `overflow-wrap:anywhere` to prevent long titles/location/notes from exceeding the card. Session identity, link focus and seven-day calendar remain unchanged. **Browser recheck remains pending** for weekly and shared monthly compact cards at mobile widths and 200% zoom.
