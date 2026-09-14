# KAN-260 Adherence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Derive explainable athlete plan adherence from KAN-259 plan-real comparisons without treating unknown evidence as failure.

**Architecture:** `AthletePlanRealComparison` remains the authoritative read model. A pure adherence domain service derives coverage, frequency adherence and independent metric dimensions from it; server actions provide weekly/monthly projections and a short weekly trend; UI renders percentage only when coverage rules permit it. No planning or realized evidence is mutated and no adherence snapshot is persisted in v1.

**Tech Stack:** TypeScript 6, Next.js 16 server actions/components, next-intl, node:test/tsx.

**Spec:** Jira KAN-260 and `types/training/adherence.types.ts`.

## Global Constraints

- `unknown` never counts as non-completion.
- `unplanned_realized` never increases plan adherence.
- An adherence percentage is published only with explicit denominator, coverage and rule version.
- Insufficient data yields `insufficient_data` + `null`, never a fabricated 0%.
- Distance, duration, D+ and intensity remain independent dimensions; no opaque aggregate score.
- Planning-resolution limitations suppress conclusions for the affected window.
- No automatic plan mutation.

---

### Task 1: Versioned contract

**Files:** `types/training/adherence.types.ts`, `types/index.ts`

- [x] Define rule version/configuration, coverage, frequency and dimension result contracts.
- [x] Export contracts through the type barrel.

### Task 2: Eligibility and frequency derivation

**Files:** `lib/adherence/athlete-adherence.ts`, `tests/adherence/athlete-adherence.test.ts`

- [ ] Count eligible planned sessions, confirmed outcomes, unknown and free realized records.
- [ ] Compute coverage independently from adherence.
- [ ] Publish frequency adherence only when rule thresholds are met.

### Task 3: Dimension derivation

**Files:** `lib/adherence/athlete-adherence.ts`, `tests/adherence/athlete-adherence.test.ts`

- [ ] Derive comparable/matched/deviation/not-evaluated counts for each KAN-259 metric.
- [ ] Publish one percentage per metric only when its own sample threshold is met.

### Task 4: Weekly/monthly windows and trend

**Files:** `types/training/adherence.types.ts`, `lib/adherence/adherence-trend.ts`, `app/actions/adherence-actions.ts`, `tests/adherence/adherence-trend.test.ts`

- [ ] Support adherence for the existing weekly/monthly plan-real windows.
- [ ] Build a deterministic four-week trend from available weekly results only.
- [ ] Return `insufficient_data` when fewer than the configured minimum comparable windows exist.

### Task 5: Coach-facing presentation

**Files:** `features/athletes/components/AdherenceSummary.tsx`, `app/[locale]/dashboard/athletes/[athleteId]/training/page.tsx`, `messages/es.json`, `messages/en.json`

- [ ] Show frequency percentage together with coverage and denominator.
- [ ] Show unknown and free-session counts explicitly.
- [ ] Show independent dimension percentages and weekly trend without implying fitness/readiness.
- [ ] Show an explicit insufficient-data state instead of 0%.

### Task 6: Domain and longitudinal tests

**Files:** `tests/adherence/athlete-adherence.test.ts`, `tests/adherence/adherence-trend.test.ts`

- [ ] Cover high/low adherence, unknown-dominant windows, explicit non-completion and free sessions.
- [ ] Cover planning limitations, dimension samples, trend minimums and athlete/team isolation inherited from KAN-259 inputs.

### Task 7: Persistence decision, docs and final gate

**Files:** `docs/handoffs/kan-260-adherence.md`

- [ ] Document v1 as derived/read-only with no persistence because KAN-259 inputs plus rule version reproduce the result.
- [ ] Record boundaries with KAN-261/KAN-262.
- [ ] Run `pn test`, `pn lint`, `pn tsc`, `pn build` and walkthrough once all implementation is complete.
