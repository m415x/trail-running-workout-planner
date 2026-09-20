# Athlete Stats Analytics

## Status

**KAN-264 / Historia 8 completed and verified on 2026-09-15.**

The implementation establishes the athlete-facing Stats baseline described below. KAN-350 through KAN-356 are complete. KAN-357, incorporated into KAN-264 scope during implementation for the real Athlete shell/responsive contract, is also complete.

Final reported local verification:

- `pn test` — 790/790 tests passed across 157 suites, 0 failures.
- `pn lint` — passed.
- `pn exec tsc --noEmit` — passed.
- `pn build` — passed.
- `pn i18n:check` — passed; 452 message leaves aligned ES/EN.
- Athlete responsive walkthrough — approved across the target form factors exercised during the story.

This document is now the durable baseline for subsequent Athlete Stats work rather than an implementation proposal.

## Purpose

KAN-264 established an athlete-facing Stats experience without turning coach decision models into athlete UI contracts. The architecture uses an incremental **C+B** approach:

1. **C — consumer-neutral Training Analytics** derives longitudinal aggregations, comparisons, trends, series and evidence availability from existing domain evidence.
2. **B — Athlete Stats Projections** explicitly allowlist which analytical information is appropriate for athlete-facing surfaces.

Training Analytics does not own new training facts and does not replace existing domain contracts.

## Dependency direction

```text
domain evidence
    ↓
consumer-neutral Training Analytics
    ↓
Athlete Stats Projections
    ↓
athlete-facing application/actions boundary
    ↓
/stats hub and detail routes
```

Coach-specific models remain a separate consumer path. Athlete projections must never be implemented as coach projections with selected fields removed.

## Core invariants

- `unknown != 0`.
- Missing evidence is not negative evidence.
- Insufficient evidence must not fabricate a comparison or trend.
- A known explicit zero remains zero.
- Analytics is not a coach decision.
- Mathematical direction is not physiological interpretation: `increasing` does not mean `improving`; `decreasing` does not mean `worsening`.
- Association does not establish causation.
- Athlete projection is an allowlist, not a filtered coach projection.
- Training Analytics may be consumer-neutral without being directly user-safe; athlete disclosure occurs at the Athlete Stats Projection boundary.
- Technical failure is distinct from valid `unknown`, `insufficient`, or empty domain state.

These invariants are regression-protected by focused analytics/projection tests and the semantic Athlete Stats integration fixture.

## Implemented analytics scope

Stats v1 contains the analytical capabilities required by Historia 8. It does not introduce a monolithic `AnalyticsService` or attempt to anticipate a complete future analytics platform.

Shared primitives cover genuinely common semantics such as explicit current/previous analysis windows, neutral metric comparison, mathematical trend direction and evidence availability/coverage.

Domain-specific modules remain independent:

- **Training:** realized distance, duration, elevation gain and frequency.
- **Load:** descriptive evolution using existing neutral load evidence; no new load formula and no Training Response triage.
- **Adherence:** adherence and plan-vs-real using authoritative linkage semantics.
- **Competition:** factual relevant/upcoming competition context.

Units remain explicit in domain-facing contracts.

## Analysis windows

Stats v1 uses a product-defined default period in the UI. The UI does not expose arbitrary period selection yet.

Analytics receives explicit windows rather than embedding assumptions such as "last 7 days" inside metric calculators. Current and previous windows remain identifiable so a future period selector can reuse the analytical contracts without redesigning the calculation boundary.

## Evidence semantics

Analytics and projections preserve distinctions among:

- **available:** a value or comparison is evaluable from known evidence;
- **insufficient:** some evidence exists but the requested comparison/trend cannot be responsibly evaluated;
- **unknown:** the required evidence is not known;
- **empty:** a domain may validly have no entity, for example no upcoming competition;
- **error:** the application failed to retrieve or compute the result for technical reasons.

No realized row is automatically a missed workout. A missing previous period does not become a `-100%` comparison. Known zero does not become unknown.

The semantic integration regression explicitly protects known zero, unknown metrics, insufficient load/adherence evidence, missing previous-period comparison and valid empty competition.

## Athlete disclosure boundary

Athlete Stats Projections define explicit read contracts for:

- `/stats` summary;
- `/stats/training`;
- `/stats/load`;
- `/stats/adherence`;
- `/stats/competition`.

Athlete-safe v1 information includes factual realized metrics, neutral comparisons/directions, evidence state, analysis period, factual adherence/plan-vs-real information, and factual competition context.

The following do not cross automatically into athlete-facing contracts:

- Training Response `priority`, `review`, triage or internal reason codes;
- coach acknowledgement/review state or private notes;
- coach-facing Readiness interpretation;
- internal escalation rules;
- automatic training modifications or recommendations;
- diagnostic, injury-risk or probabilistic claims.

Athlete-facing Training Response and Readiness remain outside this baseline and require their own product/scientific disclosure review before reuse.

## Subject scope and authorization

Semantic disclosure and identity authorization remain separate concerns.

Athlete projections decide what kind of information is athlete-facing. The application/actions boundary decides which subject the current caller may read. Subsequent stories must preserve this separation and must not weaken subject scope by accepting an arbitrary client-provided athlete identifier where a stronger server-side scope exists.

## Stats information architecture

`/stats` is implemented as a summary and navigation hub rather than a dense all-in-one dashboard.

```text
/stats
├── /stats/training
├── /stats/load
├── /stats/adherence
└── /stats/competition
```

The summary communicates current value/state and evidence availability, with comparison/trend only where evaluable, and provides navigation to deeper context.

### Training detail

Shows realized distance, duration, elevation gain, frequency, period comparisons and factual temporal series where source evidence supports a series. Charts are not fabricated from aggregate-only values.

### Load detail

Shows descriptive load evolution and evidence gaps without exposing Training Response priority/review or turning load evidence into physiological conclusions.

### Adherence detail

Uses adherence and authoritative plan-vs-real semantics. Unknown outcomes remain distinct and are not counted as confirmed failures.

### Competition detail

Shows factual competition context and treats no competition as a valid empty state. Stats v1 does not add readiness assessment, predicted performance, expected finish time or race-fitness conclusions.

## Localization boundary

Analytics and Athlete Stats projections produce structured semantic data, not localized strings. The summary view-model is locale-neutral (`key`, `value`, `unit`, state). ES/EN message catalogs own localized labels, explanations and session pluralization; Stats routes consume the `stats` namespace through `next-intl`.

The message-fragment loader registers `athlete-stats/stats` explicitly for both locales. Structural equivalence and non-interpretive wording are regression-protected, and the final i18n gate reported 452 aligned message leaves.

## Responsive product strategy

Responsive composition is role-driven:

- **Athlete-facing surfaces are mobile-first.** Mobile portrait is the primary composition; mobile landscape, tablet and desktop adapt the same information architecture.
- **Coach-facing surfaces are desktop-first.** Dense desktop workflows are primary and adapt downward while preserving decision context and action safety.

KAN-264 implemented the Athlete shell and Stats surfaces using the mobile-first strategy. KAN-357 was folded into the story scope to ensure the real Athlete shell participated in the responsive walkthrough rather than validating isolated Stats cards only.

Visual meaning does not depend exclusively on color, arrows or charts; textual values/explanations remain available.

## Verification baseline

The completed test strategy is layered:

1. focused analytics tests prove neutral calculations and evidence semantics;
2. athlete-projection tests prove allowlisted disclosure and exclusion of coach-only semantics;
3. contract tests preserve zero/unknown/insufficient/error distinctions;
4. semantic integration tests exercise the Athlete projection boundary with durable edge-state fixtures;
5. UI/i18n tests verify Stats navigation, locale-neutral view models, ES/EN equivalence and non-interpretive wording;
6. manual responsive walkthrough validates the Athlete composition across target form factors.

Final Historia 8 gate reported on 2026-09-15:

```text
pn test                 790/790 PASS (157 suites)
pn lint                 PASS
pn exec tsc --noEmit    PASS
pn build                PASS
pn i18n:check           PASS (452 aligned message leaves)
```

Future changes to Analytics, Athlete projections, Stats i18n or Athlete shell responsiveness should treat this as the regression baseline.

## Handoff to subsequent stories

Subsequent work may assume the following foundations exist and are stable unless deliberately changed with tests and documentation:

- consumer-neutral domain analytics are separate from athlete disclosure;
- Athlete Stats projections are explicit allowlists;
- `/stats` plus Training, Load, Adherence and Competition details are established routes;
- evidence states preserve known zero, unknown, insufficient and valid empty semantics;
- Stats localization is ES/EN through the real message-fragment loader;
- Stats presentation/view models do not own localized copy;
- Athlete composition is mobile-first and uses the real Athlete shell;
- coach-only interpretation must not leak through structural spreading or reuse of coach projections.

Deliberately deferred/non-blocking follow-up areas discovered during Historia 8 include:

- evaluate whether the desktop Athlete shell should continue using `BottomNavigationBar` or evolve to a sidebar/navigation pattern;
- provide an Accessibility settings area capable of user-controlled text scaling instead of relying on global/mobile CSS compensation;
- expose arbitrary/custom Stats period selection only in a dedicated future product slice;
- any Athlete-facing Training Response/Readiness interpretation requires separate disclosure/product/scientific design rather than being inferred from the neutral analytics added here.

These are follow-up concerns, not incomplete acceptance criteria for KAN-264.

## Historical out-of-scope boundary

Historia 8 intentionally did not include:

- athlete-facing Training Response or Readiness;
- arbitrary/custom period selection in Stats UI;
- new physiological metrics or training-load formulas;
- global performance/readiness scores;
- automated athlete recommendations;
- prediction of competition performance;
- a generic all-purpose analytics platform.


## Epic 4 factual 1000 m evolution extension

KAN-379 extends consumer-neutral analytics with a factual longitudinal projection of canonical `1000m_track` evidence. It does not change the Athlete Stats disclosure baseline or add a user-facing surface.

- Active field-test history is the evidence authority; invalidated observations remain durable but are excluded from the active series.
- The series preserves evaluation identity, performed date, protocol and observed elapsed time. Pace and average speed are reproducible arithmetic derivations only.
- Latest-versus-previous comparison uses the shared `compareAnalyticsMetric()` primitive. With fewer than two active observations the comparison is not evaluable and preserves insufficient-data semantics rather than inventing zero.
- Mathematical `decreasing` for elapsed time means only a lower elapsed time. It is not a claim of improved fitness, readiness, VO2max, PAM/MAS or physiological adaptation.
- The application read boundary resolves athlete ownership before evidence is queried. Analytics does not weaken team/athlete isolation and does not mutate planning, Training Response or field-test evidence.
- No schema or migration is introduced: series, derived pace/speed and comparison deltas are reconstructible from canonical evidence.

Coach/Athlete Stats presentation of this information remains a subsequent product concern (KAN-380).
