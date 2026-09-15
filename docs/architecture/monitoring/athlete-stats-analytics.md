# Athlete Stats Analytics

## Purpose

KAN-264 introduces an athlete-facing Stats experience without turning coach decision models into athlete UI contracts. The architecture uses an incremental **C+B** approach:

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

## Incremental analytics scope

KAN-264 adds only the analytical capabilities required by Stats v1. It must not introduce a monolithic `AnalyticsService` or attempt to anticipate a complete future analytics platform.

Shared primitives should cover only genuinely common semantics such as:

- explicit current and previous analysis windows;
- neutral metric comparison;
- mathematical trend direction;
- evidence availability/coverage, reusing durable existing semantics where possible.

Domain-specific modules remain independent:

- **Training:** realized distance, duration, elevation gain and frequency.
- **Load:** descriptive evolution using existing neutral load evidence; no new load formula and no Training Response triage.
- **Adherence:** adherence and plan-vs-real using authoritative linkage semantics.
- **Competition:** factual relevant/upcoming competition context.

Units remain explicit in domain-facing contracts.

## Analysis windows

Stats v1 uses a product-defined default period in the UI. The UI does not expose arbitrary period selection yet.

Analytics nevertheless receives explicit windows rather than embedding assumptions such as "last 7 days" inside metric calculators. Current and previous windows must be identifiable so a future period selector can reuse the same analytical contracts.

## Evidence semantics

Analytics and projections must preserve distinctions among:

- **available:** a value or comparison is evaluable from known evidence;
- **insufficient:** some evidence exists but the requested comparison/trend cannot be responsibly evaluated;
- **unknown:** the required evidence is not known;
- **empty:** a domain may validly have no entity, for example no upcoming competition;
- **error:** the application failed to retrieve or compute the result for technical reasons.

Exact enum/type names must be aligned with existing durable contracts before adding new ones. KAN-264 must not create a competing evidence-state model.

No realized row is not automatically a missed workout. A missing previous period must not become a `-100%` comparison. Known zero must not become unknown.

## Athlete disclosure boundary

Athlete Stats Projections define explicit read contracts for:

- `/stats` summary;
- `/stats/training`;
- `/stats/load`;
- `/stats/adherence`;
- `/stats/competition`.

Athlete-safe v1 information includes factual realized metrics, neutral comparisons/directions, evidence state, analysis period, factual adherence/plan-vs-real information, and factual competition context.

The following must not cross automatically into athlete-facing contracts:

- Training Response `priority`, `review`, triage or internal reason codes;
- coach acknowledgement/review state or private notes;
- coach-facing Readiness interpretation;
- internal escalation rules;
- automatic training modifications or recommendations;
- diagnostic, injury-risk or probabilistic claims.

Athlete-facing Training Response and Readiness are intentionally deferred to KAN-349 for separate product/scientific review.

## Subject scope and authorization

Semantic disclosure and identity authorization are separate concerns.

Athlete projections decide what kind of information is athlete-facing. The application/repository boundary must also decide which athlete the current subject is authorized to read. Do not trust an arbitrary client-provided athlete identifier when existing infrastructure can resolve stronger scope.

If authenticated current-athlete resolution is not yet available, KAN-264 must document and preserve that limitation rather than inventing a fixed or fictional authenticated actor.

## Stats information architecture

`/stats` is a summary and navigation hub, not a dense all-in-one dashboard.

```text
/stats
├── /stats/training
├── /stats/load
├── /stats/adherence
└── /stats/competition
```

The summary communicates, where meaningful:

1. current value/state;
2. comparison or mathematical trend;
3. evidence availability;
4. navigation to deeper context.

Detail surfaces provide progressive disclosure and must not merely repeat enlarged summary cards.

### Training detail

Explains realized distance, duration, D+, frequency, period comparisons and genuine temporal series when the underlying evidence supports a series. Do not invent charts from aggregate-only values.

### Load detail

Shows descriptive load evolution, comparison and evidence gaps. It must not expose Training Response priority/review or turn load evidence into physiological conclusions.

### Adherence detail

Combines adherence with plan-vs-real where existing contracts support it. Authoritative session linkage remains required; absence of a workout log is not automatically non-adherence.

### Competition detail

Shows factual relevant/upcoming competition context. No readiness assessment, predicted performance, expected finish time or race-fitness conclusion is introduced by Stats v1.

## Localization and explanation

Analytics produces structured semantic data, not localized strings. Athlete projections preserve athlete-safe structured semantics. ES/EN message catalogs own localized explanation and UI owns rendering.

Athlete wording must not add interpretation that the source did not establish. For example, a neutral increasing trend may be rendered as "increased" but not automatically as "improved".

## Responsive product strategy

Responsive composition is role-driven:

- **Athlete-facing surfaces are mobile-first.** Mobile portrait is the primary composition; behavior must deliberately adapt to mobile landscape, tablet and desktop without introducing a separate information architecture.
- **Coach-facing surfaces are desktop-first.** Dense desktop workflows are primary; they must deliberately adapt to tablet, mobile landscape and mobile portrait while preserving decision context and action safety.

KAN-264 is athlete-facing, so `/stats` and all detail routes use the mobile-first strategy.

Visual meaning must never depend exclusively on color, arrows or charts. Textual values/explanations remain available and accessible.

## Verification strategy

Testing is layered:

1. focused analytics tests prove neutral calculations and evidence semantics;
2. athlete-projection tests prove allowlisted disclosure and exclusion of coach-only semantics;
3. contract tests preserve zero/unknown/insufficient/error distinctions;
4. semantic E2E tests exercise `domain fixtures -> analytics -> athlete projection`;
5. UI/i18n tests verify navigation, states, ES/EN equivalence and non-interpretive wording;
6. final manual responsive walkthrough starts with mobile portrait, then mobile landscape, tablet and desktop.

Remote-first implementation uses focused validation while tasks are in progress. Unless an earlier run is required to unblock implementation, the complete local gate is requested once KAN-264 implementation is complete:

```text
pn test
pn lint
pn exec tsc --noEmit
pn build
```

Additional environment-specific verification is added only if implementation discovers a relevant boundary.

## Out of scope

KAN-264 does not include:

- athlete-facing Training Response or Readiness (KAN-349);
- arbitrary/custom period selection in Stats UI;
- new physiological metrics or training-load formulas;
- global performance/readiness scores;
- automated athlete recommendations;
- prediction of competition performance;
- a generic all-purpose analytics platform.
