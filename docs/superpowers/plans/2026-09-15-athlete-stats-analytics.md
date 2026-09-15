# Athlete Stats Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a navigable athlete-facing Stats hub and detail experience backed by consumer-neutral Training Analytics and explicit athlete-safe projections.

**Architecture:** Use incremental C+B layering: existing domain evidence feeds small domain-specific consumer-neutral analytics modules, which feed allowlisted Athlete Stats projections and then athlete-facing application/UI boundaries. Preserve domain independence and evidence semantics; do not reuse coach projections as athlete contracts.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind CSS 4, Shadcn UI, next-intl ES/EN, Node test runner via tsx.

**Spec:** `docs/architecture/monitoring/athlete-stats-analytics.md`

## Global Constraints

- Work from `h-28-athlete-stats-analytics`, created from `dev`; merge the completed story back into `dev`.
- Athlete Stats is mobile-first: mobile portrait primary, then mobile landscape, tablet and desktop.
- `unknown != 0`; missing evidence is not negative evidence; known zero remains zero.
- Analytics exposes neutral mathematical direction, never `improving/worsening` unless an existing domain contract explicitly establishes that semantic.
- Athlete projections use allowlists and must not expose coach-only Training Response/Readiness semantics.
- New/touched user-visible copy is symmetric ES/EN.
- Do not add a monolithic AnalyticsService, new training-load formula, prediction, diagnosis, injury-risk claim or automatic athlete recommendation.
- Do not invent authenticated current-athlete identity if the current platform cannot resolve it.
- During implementation use focused remote-first validation; request the complete local gate only at story end unless an earlier run is required to unblock work.

---

## File/Module Map

Exact filenames should follow existing repository naming conventions discovered immediately before each task. The intended responsibilities are:

- `lib/analytics/shared/*` — explicit windows, comparisons, neutral trends/evidence primitives where existing durable types cannot be reused.
- `lib/analytics/training/*` — realized distance/duration/D+/frequency analytics.
- `lib/analytics/load/*` — descriptive load evolution over existing neutral load evidence.
- `lib/analytics/adherence/*` — adherence and plan-vs-real analytical composition without redefining linkage semantics.
- `lib/analytics/competition/*` — factual relevant/upcoming competition context.
- `lib/athlete-stats/*` or established equivalent — allowlisted summary/detail projections.
- `app/actions/*` — athlete-facing read/action boundary following existing project conventions.
- `app/[locale]/(mobile)/stats/*` — summary hub and detail routes.
- `messages/en/*`, `messages/es/*` — localized athlete-facing Stats copy.
- `tests/analytics/*`, `tests/athlete-stats/*` or established equivalent — focused and semantic E2E regressions.

Do not create a file solely because it appears in this map; first inspect analogous current files and reuse established structure when it preserves the responsibilities above.

---

### Task 1: Consumer-neutral analytics primitives — KAN-350

**Interfaces:**
- Consumes: existing evidence/coverage semantics and explicit domain units.
- Produces: explicit current/previous windows, neutral comparisons and trend/evidence primitives required by domain analytics.

- [ ] Inspect existing evidence-state, date-window and comparison types before introducing any new contract.
- [ ] Write focused failing tests for current+previous comparison, missing previous evidence, insufficient evidence and known explicit zero.
- [ ] Implement the minimum shared primitives required by those tests.
- [ ] Ensure trend direction remains mathematical (`increasing/stable/decreasing/unknown` or existing equivalent), not evaluative.
- [ ] Run only the focused primitive tests if remote execution is available; otherwise defer execution unless blocked.
- [ ] Commit with KAN-350 scope and record implementation/evidence in Jira.

### Task 2: Domain-specific Training Analytics — KAN-351

**Interfaces:**
- Consumes: Task 1 primitives plus existing realized-training, load, adherence/plan-vs-real and competition domain contracts.
- Produces: consumer-neutral analytics for Training, Load, Adherence and Competition.

- [ ] Inspect current source contracts/actions/tests for each domain and document which are authoritative inputs.
- [ ] Write focused tests for realized distance, duration, D+, frequency and comparison semantics.
- [ ] Implement Training analytics without treating absent realized rows as missed workouts.
- [ ] Write focused tests for neutral load evolution and implement it without a new load formula or Training Response triage.
- [ ] Write focused tests for adherence/plan-vs-real and preserve authoritative linkage semantics.
- [ ] Write focused tests for factual competition context, including valid no-competition empty state.
- [ ] Run focused analytics tests if available/necessary; do not run the full suite yet.
- [ ] Commit with KAN-351 scope and record evidence in Jira.

### Task 3: Athlete Stats projections — KAN-352

**Interfaces:**
- Consumes: Task 2 consumer-neutral analytics.
- Produces: allowlisted `AthleteStatsSummary` and detail projection contracts (exact names aligned to repository conventions).

- [ ] Write projection contract tests first, including explicit exclusion of coach-only fields/semantics.
- [ ] Implement summary projection for Training, Load, Adherence and Competition.
- [ ] Implement detail projections for each domain.
- [ ] Preserve periods, units, evidence state and athlete-useful explanation inputs without exposing internal coach rule codes.
- [ ] Verify that extending a coach-facing object cannot automatically extend athlete output.
- [ ] Run focused projection tests if available/necessary.
- [ ] Commit with KAN-352 scope and record evidence in Jira.

### Task 4: Athlete-facing actions and subject scope — KAN-356

**Interfaces:**
- Consumes: Task 3 athlete projections and existing identity/team/repository boundaries.
- Produces: application/server read APIs for the Stats hub and detail routes.

- [ ] Inspect current athlete/mobile identity and team-scope resolution before designing action signatures.
- [ ] Write focused tests for the strongest subject isolation the current infrastructure can actually guarantee.
- [ ] Implement summary/detail read boundaries without allowing UI access to repositories/domain internals.
- [ ] Separate technical failures from valid unknown/insufficient/empty results.
- [ ] If current-athlete authentication is not resolvable, document the exact limitation instead of inventing an actor.
- [ ] Run focused boundary tests if available/necessary.
- [ ] Commit with KAN-356 scope and record evidence/limitations in Jira.

### Task 5: Stats summary hub — KAN-353

**Interfaces:**
- Consumes: Task 4 summary read boundary.
- Produces: `/stats` mobile-first summary/navigation UI.

- [ ] Replace the legacy placeholder with a server/client composition consistent with current mobile routes.
- [ ] Add ES/EN message keys before hard-coding any new user-visible copy.
- [ ] Render the visible default period and Training, Load, Adherence and Competition cards.
- [ ] Each card must expose current value/state, comparison/trend only when evaluable, evidence state and detail navigation.
- [ ] Implement distinct loading, available, empty/unknown/insufficient and technical-error presentation.
- [ ] Add behavioral tests for card presence, navigation and evidence semantics; avoid brittle Tailwind-class assertions.
- [ ] Check mobile-first structure in code; defer full manual responsive walkthrough to story closure.
- [ ] Commit with KAN-353 scope and record evidence in Jira.

### Task 6: Stats detail routes — KAN-354

**Interfaces:**
- Consumes: Task 4 detail read boundaries.
- Produces: `/stats/training`, `/stats/load`, `/stats/adherence`, `/stats/competition`.

- [ ] Implement Training detail with realized metrics/comparisons and only genuine temporal series supported by source evidence.
- [ ] Implement Load detail as descriptive evolution without triage or physiological interpretation.
- [ ] Implement Adherence detail using existing adherence and authoritative plan-vs-real semantics.
- [ ] Implement Competition detail as factual context with a valid no-competition empty state.
- [ ] Provide natural navigation back to `/stats` and accessible textual meaning for arrows/charts/visual trends.
- [ ] Keep all copy symmetric ES/EN.
- [ ] Add focused route/component behavior tests.
- [ ] Commit with KAN-354 scope and record evidence in Jira.

### Task 7: Cross-layer verification and closure — KAN-355

**Interfaces:**
- Consumes: Tasks 1-6.
- Produces: semantic E2E evidence, durable documentation, final responsive evidence and story closure.

- [ ] Add semantic E2E fixtures/tests for `domain evidence -> analytics -> athlete projection`.
- [ ] Cover known zero, unknown, insufficient, missing previous period and valid empty competition.
- [ ] Prove coach-only Training Response/Readiness semantics are absent from athlete-facing contracts/output.
- [ ] Add/extend ES/EN structural-equivalence tests and sensitive wording assertions where useful.
- [ ] Update durable architecture/docs with implementation reality and any discovered limitation.
- [ ] Request the final local gate: `pn test`, `pn lint`, `pn exec tsc --noEmit`, `pn build` plus any relevant verifier discovered during implementation.
- [ ] Record exact local results in Jira; do not claim commands that were not run.
- [ ] Perform final manual responsive walkthrough: mobile portrait first, then mobile landscape, tablet and desktop.
- [ ] Resolve all KAN-350..KAN-356 subtasks only when their evidence is complete.
- [ ] Resolve KAN-264 only after all acceptance evidence is recorded.
- [ ] Create the story PR targeting `dev`, verify mergeability, and merge only after the final gate/closure evidence is green.
