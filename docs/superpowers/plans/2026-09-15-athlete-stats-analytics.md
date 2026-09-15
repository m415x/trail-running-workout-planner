# Athlete Stats Analytics Implementation Plan — Completed

> Historical implementation record for **KAN-264 / Historia 8**. Completed and verified on 2026-09-15. This file is no longer an active task list; use `docs/architecture/monitoring/athlete-stats-analytics.md` as the durable architectural baseline for subsequent work.

**Goal achieved:** A navigable athlete-facing Stats hub and detail experience backed by consumer-neutral Training Analytics and explicit athlete-safe projections.

**Architecture delivered:** Incremental C+B layering: existing domain evidence feeds domain-specific consumer-neutral analytics, which feed allowlisted Athlete Stats projections and then athlete-facing application/UI boundaries. Coach projections are not reused as Athlete contracts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Shadcn UI, next-intl ES/EN, Node test runner via tsx.

**Durable spec/baseline:** `docs/architecture/monitoring/athlete-stats-analytics.md`

## Completion evidence

- KAN-350 — consumer-neutral analytics primitives — completed.
- KAN-351 — domain-specific Training Analytics — completed.
- KAN-352 — Athlete Stats projections/disclosure — completed.
- KAN-356 — Athlete-facing actions and subject-scope boundary — completed.
- KAN-353 — Stats summary hub — completed.
- KAN-354 — Stats detail routes — completed.
- KAN-355 — cross-layer integration, i18n and responsive verification — completed.
- KAN-357 — real Athlete shell/responsive contract, incorporated into KAN-264 scope during implementation — completed.
- KAN-264 — Historia 8 — completed in Jira after evidence review.

Final local gate reported by the developer:

```text
pn test                 790/790 PASS (157 suites, 0 failures)
pn lint                 PASS
pn exec tsc --noEmit    PASS
pn build                PASS
pn i18n:check           PASS (452 aligned message leaves)
```

The final focused regressions additionally covered locale-neutral Stats summary presentation, Stats routes consuming the real `next-intl` namespace, ES/EN structural equivalence, known-zero/unknown/insufficient semantics, valid empty competition and exclusion of coach-only interpretation from Athlete projections.

## Delivered module map

The implementation follows these responsibility boundaries:

- `lib/analytics/shared/*` — explicit windows, comparisons and neutral shared analytics primitives.
- `lib/analytics/training/*` — realized distance/duration/elevation/frequency analytics and factual series.
- `lib/analytics/load/*` — descriptive load analytics over existing neutral evidence.
- `lib/analytics/adherence/*` — adherence composition preserving authoritative linkage/evidence semantics.
- `lib/analytics/competition/*` — factual competition context.
- `lib/athlete-stats/*` — explicit athlete-safe summary/detail projections and locale-neutral presentation models.
- `app/actions/*` — Athlete Stats application/read boundary.
- `app/[locale]/(mobile)/stats/*` — Stats hub plus Training, Load, Adherence and Competition details.
- `messages/en/athlete-stats/*`, `messages/es/athlete-stats/*` — localized Stats copy loaded through the real message-fragment registry.
- `tests/analytics/*`, `tests/athlete-stats/*` — focused, projection, route/i18n and semantic integration regressions.

## Constraints preserved

- Athlete Stats remains mobile-first.
- `unknown != 0`; missing evidence is not negative evidence; known zero remains zero.
- Analytics direction remains mathematical rather than evaluative.
- Athlete projections are allowlists and exclude coach-only Training Response/Readiness semantics.
- User-visible Stats copy is symmetric ES/EN and presentation models remain locale-neutral.
- No monolithic AnalyticsService, new training-load formula, prediction, diagnosis, injury-risk claim or automatic athlete recommendation was introduced.
- Subject authorization remains distinct from semantic disclosure.

## Task record

### Task 1: Consumer-neutral analytics primitives — KAN-350

- [x] Inspected existing evidence-state, date-window and comparison types before introducing contracts.
- [x] Added focused regressions for comparison, missing previous evidence, insufficient evidence and known explicit zero.
- [x] Implemented the minimum shared primitives required by Stats.
- [x] Kept trend direction neutral/mathematical.
- [x] Recorded implementation/evidence in Jira and finalized KAN-350.

### Task 2: Domain-specific Training Analytics — KAN-351

- [x] Reused authoritative realized-training, load, adherence/plan-vs-real and competition inputs.
- [x] Implemented Training metrics and comparison semantics without treating absent realized rows as missed workouts.
- [x] Preserved the existing neutral load model; no new load formula or Training Response triage.
- [x] Preserved adherence linkage/evidence semantics.
- [x] Implemented factual competition context including valid no-competition state.
- [x] Added focused analytics regressions and finalized KAN-351.

### Task 3: Athlete Stats projections — KAN-352

- [x] Added projection contract tests including exclusion of coach-only semantics.
- [x] Implemented explicit summary and detail Athlete projections.
- [x] Preserved periods, units and evidence states without exposing internal coach rule semantics.
- [x] Protected the allowlist against structural spreading/leakage.
- [x] Finalized KAN-352.

### Task 4: Athlete-facing actions and subject scope — KAN-356

- [x] Inspected and preserved the strongest subject-scope boundary available in the current infrastructure.
- [x] Added focused boundary tests.
- [x] Implemented summary/detail read boundaries without UI access to repositories/domain internals.
- [x] Kept technical failure separate from valid unknown/insufficient/empty results.
- [x] Finalized KAN-356.

### Task 5: Stats summary hub — KAN-353

- [x] Replaced the Stats placeholder with the mobile-first summary/navigation hub.
- [x] Added Training, Load, Adherence and Competition summaries with explicit evidence states.
- [x] Added detail navigation and behavioral regressions.
- [x] Migrated Athlete-facing copy to the real ES/EN i18n boundary.
- [x] Finalized KAN-353.

### Task 6: Stats detail routes — KAN-354

- [x] Implemented Training detail with factual metrics/comparisons/series.
- [x] Implemented descriptive Load detail without physiological interpretation.
- [x] Implemented Adherence detail preserving unknown outcomes separately from confirmed failures.
- [x] Implemented factual Competition detail with valid empty state.
- [x] Added navigation, textual meaning and focused route tests.
- [x] Finalized KAN-354.

### Task 7: Cross-layer verification and closure — KAN-355

- [x] Added durable semantic integration fixtures/regressions.
- [x] Covered known zero, unknown, insufficient, missing previous period and valid empty competition.
- [x] Proved coach-only Training Response/Readiness semantics are absent from Athlete projections.
- [x] Added ES/EN structural-equivalence and route-i18n regressions.
- [x] Made the Stats summary view-model locale-neutral and moved labels/pluralization to `next-intl`.
- [x] Verified the real Athlete shell/responsive behavior, including KAN-357 scope.
- [x] Ran and recorded the final local gate.
- [x] Finalized KAN-350..KAN-356, verified KAN-357, and finalized KAN-264.

## Handoff / next-story baseline

A subsequent story should start from the architectural baseline rather than reopening this implementation plan. It may rely on:

1. consumer-neutral Analytics separated from Athlete disclosure;
2. explicit Athlete allowlist projections;
3. established `/stats` summary and four detail routes;
4. durable evidence semantics (`known zero`, `unknown`, `insufficient`, valid empty);
5. real ES/EN message-fragment integration and locale-neutral Stats presentation models;
6. mobile-first Athlete shell behavior;
7. regression protection against coach-only semantic leakage.

Follow-up product/UX work discovered during Historia 8 is intentionally separate from completion of this plan: desktop BottomNavigationBar vs sidebar evaluation, user-controlled text scaling/accessibility settings, future custom Stats periods, and any Athlete-facing Training Response/Readiness disclosure.
