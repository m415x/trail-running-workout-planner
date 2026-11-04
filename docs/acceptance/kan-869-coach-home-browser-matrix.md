# KAN-869/T6 — Coach Home browser acceptance checklist

**Status:** PENDING real-browser evidence. This is an executable manual acceptance protocol, **not** a PASS claim.

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
