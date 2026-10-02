# KAN-473 — pre-auth MVP experience consolidation (H1–H5)

Status: H5 KAN-508 **integration candidate** (2026-10-02); not yet merged to `dev`, so this record is not a completed-epic claim. Jira KAN-473 and KAN-508 remain `En curso` until the T9 integration gate and post-merge verification are accepted.

## Authority and scope

KAN-473 consolidates already-delivered MVP functions, planning and athlete/coach journeys, explanatory UI, ES/EN presentation, responsive accessibility and cartography **before** KAN-298 establishes authenticated identity/authorization. H1–H4 are KAN-504, KAN-505, KAN-506 and KAN-507; H5 is KAN-508. The authoritative contracts remain the source, tests, `docs/architecture/`, and Jira AC. This history records delivery/reconciliation, not a new functional specification.

- H1 / KAN-504: Coach workflows for Sporting group vs Planning subgroup, group membership entry points, explicit Base plan -> planning subgroup variant lineage and persisted RaceCourse planning-impact context without changing cross-group ownership.
- H2 / KAN-505: structured generation explanations persisted with the planned prescription, including which rules/preferences prevailed, without treating weekly patterns as fixed constraints.
- H3 / KAN-506: ES/EN localization and separation of language, presentation locale, operational time zone and economic currency; regional setup, user configuration and permanent authorization are separate future work.
- H4 / KAN-507: Git-first Brand/design tokens and semantic primitives, Coach desktop-first and Athlete mobile-first responsive architecture, MapLibre minimum single-color track/attribution/fit benchmark. Figma optional reference; Storybook not required by DoD.
- H5 / KAN-508: transversal application in navigation, Coach/Athlete pages, Membership legibility and management disclosures, state/feedback, localized guidance, competition layout, responsive focus/keyboard/touch checks, plus live map benchmark. T1–T8 KAN-570..577 are Finalizada in Jira. T8 full report: [T8 accessibility audit](../product/kan-577-accessibility-audit.md).

## T9 acceptance evidence on the unmerged H5 branch

Current integration branch: `feat/KAN-508-prebeta-ux-consolidation` → target `dev`; as of the pre-PR read, GitHub reported 156 commits ahead, zero behind and 78 changed files. This is a branch comparison, not a tested post-merge baseline.

- **Manual MapLibre browser validation**, operator reported GREEN on 2026-10-02: initial track/markers, independent pan and zoom, Standard/Topographic/Satellite style switch preservation, fitBounds and resize, provider attribution access and repeat interaction, representative ES/EN/viewports. Jira KAN-578 comment 11250. No automated browser E2E claim.
- **Functional Coach/Athlete/Membership walkthrough**, operator reported **12/12 GREEN**, no observations on 2026-10-02. Coach 4 checks covered group context, base/variant lineage, session explainability and history. Athlete 4 checks covered Home day/week + realized, Plan/Competitions, Stats, Profile/keyboard/mobile. Membership 4 checks covered terms/no-terms, due/payment/currency, management/history disclosures and H4/H5 state scenarios through existing domain tests when historical fixtures were absent. Jira KAN-578 comment 11252. No synthetic past-due UI evidence claim.
- **Final pre-PR full local verification**, operator report on 2026-10-02: `pn verify --db` **PASS**; tests 65333ms, TypeScript 181856ms, ESLint 104127ms, build 346632ms, i18n 1142ms, SQLite 40853ms, total 739943ms. This is the six-stage local SQLite gate; **it does not prove remote PostgreSQL/Supabase migration/RLS verification**. No KAN-508 schema migration was introduced by T9.

## Acceptance-criteria reconciliation and limitations

| Original KAN-508 acceptance dimension | Evidence / disposition |
| --- | --- |
| Coach shared hierarchy / patterns | T1–T8 implementation and Coach 4/4 T9 walkthrough, GREEN. |
| Athlete Home, Plan, Stats and Profile across mobile/tablet/desktop | H4 foundations, T8 responsive/zoom/keyboard matrix, Athlete 4/4 T9 walkthrough, GREEN for representative viewports. |
| KAN-358 navigation | Athlete bottom navigation and keyboard/mobile validation delivered through H4/H5; do not create a second navigation authority. |
| KAN-359 typography boundary | Existing mobile/desktop root scaling retained (120% mobile / 100% at >=640px), with semantic hierarchy, 200% zoom and overflow checks. Per-user scale selection/persistence and replacement of root system **remain open KAN-359**, not an H5 completion requirement. |
| Membership H1–H5 | T8 single authoritative account projection, legible management and economic history, currency formatting; Membership 4/4 T9 checks; domain status tests represent historical due/prior-debt scenarios. |
| Loading/empty/error/success and feedback | Focused T1–T8 changes, T8 audit and T9 cross-role walkthrough; no newly reported reproducible blocker. |
| Responsive overflow and keyboard/touch | T8 audit at 360/390px + 200% browser zoom and T9 representative navigation/walkthrough. Not a certified WCAG or comprehensive assistive-tech audit. |
| Map renderer | MapLibre retained. Operator real-browser benchmark and structural regression suite GREEN; no Leaflet migration or altitude gradient. |
| Whole-app ES/EN and closure gate | T8 ES/EN checks, T9 acceptance and full local six-stage `pn verify --db` PASS. |
| Delivery and integration | **Pending** PR into `dev`, merge and verified `dev` gate; Jira statuses remain open. |

## Deliberately deferred: no beta-ready assertion

KAN-579 (athlete withdrawal of a manually captured workout, with authenticated actor, append-only audit and soft delete) was discovered in KAN-577 after original KAN-473/KAN-508/T9 AC were defined; it is a **new capability**, not an original H5 acceptance blocker. Its original issue-link 10130 blocking KAN-578 was removed after approved historical reconciliation (2026-10-02). KAN-579 **remains Tareas por hacer** and is blocked by KAN-298 through link 10136; link 10129 to KAN-577 is preserved. `source='manual'` only records capture method, not proof that the athlete authored it. No provisional authentication or removal implementation was introduced in H5.

KAN-298 (authenticated identity, scope, roles/permissions and RLS contract), KAN-472 (post-auth mock data cleanup), KAN-359 (typographic per-user preference), KAN-580 (quick individual payments), KAN-581 (athlete economic shell signals), and other separate research/issues retain their own scopes. **KAN-473 closure establishes pre-auth UX consolidation only, not beta readiness**: subsequent authenticated, database/security, migration and smoke gates remain mandatory before a controlled beta.

## Integration completion condition

This record must be revisited after PR/merge and post-merge verification; only then may T9, KAN-508 and conditionally KAN-473 close under `AGENTS.md`. Record the PR and merged `dev` SHA and final local check explicitly, or state any unresolved exception. Do not alter the issue's acceptance criteria implicitly through this document.
