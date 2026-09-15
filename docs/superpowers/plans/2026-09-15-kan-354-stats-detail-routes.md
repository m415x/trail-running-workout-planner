# Athlete Stats Detail Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build four progressive-disclosure Athlete Stats detail routes using only athlete-safe factual evidence and genuine temporal series.

**Architecture:** Keep the existing C+B dependency direction. Extend consumer-neutral analytics/projections only where a genuine source series already exists, then map the athlete-safe detail projection into small presentation view models and four server-rendered routes sharing a detail shell. Never synthesize chart points from aggregate summaries.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript 6, Tailwind CSS 4, Shadcn UI, next-intl ES/EN, Node test runner via tsx.

**Spec:** `docs/architecture/monitoring/athlete-stats-analytics.md`

## Global Constraints

- Work on `h-28-athlete-stats-analytics`; the completed KAN-264 story merges to `dev`.
- Athlete UI is mobile-first and must remain usable in mobile portrait, mobile landscape, tablet and desktop.
- `unknown != 0`; missing evidence is not negative evidence; known zero remains zero.
- Comparisons are mathematical direction only; never label increasing/decreasing as improving/worsening.
- Athlete disclosure remains an explicit allowlist; no Training Response/Readiness, coach triage, recommendations, diagnosis, risk or prediction.
- New/touched UI copy must be symmetric ES/EN and live in message catalogs.
- Charts/series are rendered only from genuine temporal observations already present in authoritative sources.
- Full repository gate remains deferred to KAN-355 unless an earlier local run is required to unblock implementation.

---

## File/Module Map

- `lib/analytics/training/training-series.ts` — factual realized-training points grouped by actual record date; no interpolation.
- `lib/analytics/load/load-analytics.ts` — preserve the existing KAN-344 load trend as consumer-neutral temporal evidence instead of exposing only `latest`.
- `lib/athlete-stats/athlete-stats-projections.ts` — allowlist training/load series into details only; summary contract stays compact.
- `lib/athlete-stats/athlete-stats-detail-view.ts` — pure presentation model for metric values, comparisons, evidence states, adherence counts and competition facts; no localized prose.
- `app/[locale]/(mobile)/stats/_components/*` — shared detail shell and visual primitives.
- `app/[locale]/(mobile)/stats/{training,load,adherence,competition}/page.tsx` — four server-rendered routes consuming `view: 'details'`.
- `messages/{es,en}/athletes/stats.json` — Stats hub/detail copy.
- `i18n/message-fragments.ts`, `i18n/messages.ts` — register the new symmetric message fragment.
- `tests/analytics/*`, `tests/athlete-stats/*`, `tests/i18n/*` — focused contracts.

---

### Task 1: Preserve genuine temporal evidence

- [ ] Add RED tests proving training series uses actual record dates, preserves unknown metrics as null and does not invent missing dates.
- [ ] Implement the minimum factual training-series projection.
- [ ] Add RED load-analytics assertions proving existing `AthleteTrainingLoadState.trend` is preserved as a neutral series.
- [ ] Extend load analytics with the existing trend without deriving a second load formula.
- [ ] Add projection RED tests proving series cross only the athlete detail allowlist and do not expand the summary contract.
- [ ] Extend `AthleteStatsProjectionInput` / `AthleteStatsDetails` minimally and keep coach-only fields excluded.
- [ ] Record the contract change in KAN-354.

### Task 2: Pure detail presentation models

- [ ] Add RED tests for available, known zero, unknown, insufficient and non-evaluable comparison states.
- [ ] Build Training view data with current value, previous value/delta when evaluable, evidence counts and optional genuine series.
- [ ] Build Load view data with short-term/long-term/balance values, coverage and genuine trend points only.
- [ ] Build Adherence view data with adherence, coverage, eligible planned sessions, confirmed outcomes and unknown sessions; unknown sessions remain unevaluated, not failures.
- [ ] Build Competition view data with primary/intermediate factual entries and valid empty state.
- [ ] Ensure view models contain structured display inputs, not coach interpretation or prediction.

### Task 3: Symmetric Stats localization

- [ ] Add `messages/es/athletes/stats.json` and `messages/en/athletes/stats.json` with the same key shape.
- [ ] Include route titles, back navigation, period labels, metric labels, evidence states, neutral comparison wording, adherence explanation and competition empty state.
- [ ] Register the fragment in `message-fragments.ts` and both branches of `i18n/messages.ts`.
- [ ] Add focused ES/EN structural-equivalence and non-interpretive wording tests.
- [ ] Move touched Stats hub hard-coded copy into the same namespace so KAN-353 is brought forward incrementally rather than leaving a second localization path.

### Task 4: Shared detail shell and Training route

- [ ] Add a locale-aware back-to-Stats header with visible 28-day period and technical-error state.
- [ ] Add Training route using `getCurrentAthleteStatsAction({ ...period, view: 'details' })` and explicit detail narrowing.
- [ ] Render four metric cards with evidence-aware comparisons.
- [ ] Render a temporal visualization only when genuine series has sufficient points; always retain textual values/evidence as the accessible meaning.
- [ ] Add focused structural/behavior tests without coupling to incidental Tailwind classes.

### Task 5: Load and Adherence routes

- [ ] Add Load route with neutral short-term/long-term/balance values, coverage and genuine trend series.
- [ ] Do not expose `semanticSignal`, Training Response priority or physiological conclusions.
- [ ] Add Adherence route with percentage/state, coverage and plan-vs-real counts.
- [ ] Explain unknown sessions as unevaluated evidence; never count them as missed workouts.
- [ ] Add focused behavior tests for insufficient evidence and known zero.

### Task 6: Competition route and KAN-354 gate

- [ ] Add Competition route with primary and intermediate competitions, date, distance and D+ only.
- [ ] Render no competition as a valid factual empty state.
- [ ] Confirm no readiness, expected finish time, fitness conclusion or prediction appears in projection/view/UI.
- [ ] Review all four routes for mobile-first composition and locale-aware back navigation.
- [ ] Request focused local validation for KAN-354 (`pn tsc`, relevant analytics/athlete-stats/i18n tests); leave full `pn test`/lint/build gate for KAN-355.
- [ ] Record exact evidence in Jira and resolve KAN-354 only after focused validation and manual route walkthrough are complete.
