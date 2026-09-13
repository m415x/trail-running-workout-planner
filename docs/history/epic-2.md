# Epic 2 — Planning Automation

Status: complete.

## Purpose

Epic 1 proved the basic coach workflow. Epic 2 asked whether that workflow could be automated **without removing coach ownership**.

The resulting architecture is not autonomous coaching. It separates coaching intent, generated proposals, protected/manual state, review, persistence and individual evidence so automation remains explainable and reversible.

```text
planning intent
→ load/progression/volume/D+/intensity
→ reusable session structure
→ generated sessions + provenance
→ planning cohorts
→ category-distance advisory
→ competition context
→ taper/recovery proposals
→ integral review + safe persistence
→ individual realized-training readiness assessment
```

## H1–H5 — make planning intent explicit

H1 introduced load strategy as domain data instead of hidden generator behavior. H2 made progression, recovery/deload and hierarchy targets deterministic. H3 established distance and elevation gain as related but separate trail-running load dimensions. H4 made intensity method-aware (HR zone versus PAM percentage) rather than a generic scalar. H5 introduced reusable workout/session templates as structural inputs subordinate to planning authority.

The durable lesson was the separation between **what the plan intends** and **what values a generator produces**. Templates and generators assist planning; they do not become the authority over accepted coach decisions.

## H6 — session generation becomes controlled reconciliation

H6 generated shared `Session` events plus group-specific `GroupSessionPrescription` values from planned microcycles. Weekly frequency moved to session-generation preferences rather than load strategy because those concepts answer different questions.

Fixed/geographical workloads consume weekly targets before flexible work. Planning intensity remains authoritative over template convenience.

Most importantly, H6 introduced stable generation identity and ownership:

```text
generated          → regeneration may replace
generated_modified → preserve
manual             → preserve
```

`sharedEventKey` and `generationKey` make regeneration deterministic/idempotent. Generation is pure; persistence/reconciliation is a separate boundary.

## H7 — planning cohorts without changing sporting identity

Planning cohorts allow a temporary subset of a sporting group to follow a plan variant without changing the athlete's stable category/level or base group. Membership is dated. Athlete resolution uses the applicable cohort variant first and the group base plan as fallback.

This established a reusable distinction between **sporting classification** and **temporary planning audience**.

## H8 — category-distance compatibility is advisory

H8 made sporting-category versus competition-distance compatibility explicit, but deliberately advisory. A category compatible with a distance does not prove individual readiness, and an unusual distance does not automatically reassign an athlete/group or rewrite planning.

This boundary later remains separate from H10 competitive treatment and H12 readiness evidence.

## H9 — planning intent and competitive calendar

H9 removed a major coupling: `goalType = race` no longer owns competitive behavior. Planning purpose and competitive context are distinct.

`CompetitionEntry` became the live plan-scoped competitive source with date, distance, optional D+, A/B/C priority and lifecycle. A base plan and a cohort variant may own independent calendar snapshots. `CompetitionContext` is the pure periodization projection; persistence entities do not leak into generator policy.

Taper behavior follows an active primary competition rather than a legacy race label. `Macrocycle.targetRace*` remains an accepted historical snapshot, not the live calendar. Legacy race fields survive only behind an isolated compatibility adapter.

## H10 — local competitive adjustment, taper and recovery

H10 replaced coarse taper heuristics with an explicit competitive-adjustment domain.

Course demand and training load remain separate. `courseEffortKm = distanceKm + elevationGainM / 100` is only a course-demand signal, never a universal training-load/readiness formula. Volume and D+ stay independent.

The H10 pipeline is:

```text
CourseProfile → CompetitionDemandAssessment
PreCompetitionLoadContext → TaperDecision
→ priority-specific local proposal
→ RecoveryDecision
→ CompetitionImpactWindow
→ protected-state reconciliation
→ coach review
→ local patches/audit
```

A/B/C expresses planning importance, not physiological cost. Taper duration is modeled in days. Race-week prescribed training is separate from competition exposure. Recovery includes acute recovery/re-entry and preserves unresolved physiological demand even when competitions overlap.

Generated competitive changes remain proposal-first; manual/protected coach state cannot be silently overwritten.

## H11 — integral review and safe persistence

H11 composed H6–H10 instead of redefining them. `IntegralPlanningReview` became the pre-persistence aggregate for hierarchy, sessions, prescriptions, competitions, provenance and conflicts.

Stable reconciliation identity is distinct from draft UUID identity. Macro/meso/micro use plan-scoped logical positions; generated Sessions/prescriptions retain H6 keys. If an already-persisted generated entity keeps its H6 key but changes UUID, H11 treats it as an identity conflict rather than a duplicate create or ordinary update.

Every reconciled write carries exact team/group/plan/cohort/lineage scope. Isolation is checked at review, diff, reconciliation and persistence.

The PostgreSQL boundary adds async transactions, canonical idempotency/replay, source/result review revisions, plan-scoped locking and stale rejection. Equivalent double submit commits once plus replay; distinct decisions from the same stale revision cannot silently last-write-win; partial failure rolls back writes/audits/journal/revision.

A real Supabase probe validated commit/replay, stale rejection, rollback and isolation. The final H11 local gate passed 518/518 tests, lint at the known 11-warning baseline, TypeScript and production build, followed by manual walkthrough.

## H12 — realized preparation versus competition demand

H12 closes Epic 2 by adding **individual advisory evidence** without turning the planning system into an automatic race-clearance engine.

### Realized training boundary

The audit found that `workout_logs` is the only durable candidate for performed training, while the existing athlete logging UI historically only toggled local React state and prefilled prescribed values. H12 therefore refuses to infer realized exposure from plans/UI state.

Core rules:

- planned is not realized;
- no record means unknown, not zero/missed;
- zero is known only with evidence that it was explicitly recorded;
- legacy/default zeros may remain ambiguous;
- plan-versus-real comparisons require explicit authoritative `sessionId` linkage;
- same date/metrics never prove duplication;
- stable persisted ID or explicit source + source activity ID is required for automatic deduplication.

`RealizedTrainingRecord` normalizes provenance, quality and per-metric `known/unknown` state before any analysis.

### Data sufficiency and preparation summary

H12 separates overall observation continuity from per-metric coverage. Missing D+ does not invalidate trustworthy volume/duration evidence, but the D+ dimension remains unknown.

`RecentPreparationSummary` represents explicit windows/coverage for volume, duration, elevation gain, frequency, realized intensity evidence, long run and continuity.

### Competition target and separation from H8/H10

The evaluated competition comes from the athlete's applicable planning context: dated cohort variant first, group-base fallback. H12 does not invent an athlete race-registration model. If there is no unambiguous primary A, the coach must select an applicable competition explicitly.

Three questions remain independent:

1. H8 — is category ↔ distance usual/compatible?
2. H10 — how should competition affect planning/taper/recovery?
3. H12 — what mismatches do this athlete's recent realized records show against the demand?

An athlete can therefore have an unusual H8 distance while showing sustained recent preparation; neither result overwrites the other.

### Versioned readiness policy and indicators

`ReadinessPolicy` is versioned/configurable product policy, not medical truth. Initial thresholds are explicitly policy values subject to coach validation.

Indicators cover continuity, reliable plan-versus-real adherence, next-session jumps, long-run concentration and separate race distance/D+ exposure. Comparability must be explicit (`workout_id`, session type or coach selection); hidden similarity heuristics are rejected.

Long-run concentration requires complete enough weekly evidence; incomplete distance coverage does not produce a misleading percentage.

### Competition phase

H12 reuses H10 `CompetitionImpactWindow` and distinguishes preparation, taper, race, acute recovery/recovery and re-entry. Deliberate reductions during taper/recovery are not automatically treated as insufficient preparation; suppression behavior is policy-controlled rather than a blanket exception.

### Assessment semantics and coach review

The result is not `prepared: true/false`:

```text
insufficient_data
or
assessed + ReadinessAlert[]
```

Insufficient evidence stops evaluation before a false positive confirmation. Zero alerts means only that the evaluated rules found no mismatch in available data.

Each alert carries cause, dimension, period, observed/reference values, units, criterion/threshold, rule version and limitations. The coach can acknowledge the result or mark planning for review, but that decision is persisted separately and does not automatically mutate planning.

### H12 persistence and isolation

Migration `0012_clammy_firedrake.sql` adds:

- `workout_log_evidence` — sidecar evidence preserving source/field-known semantics without destructively rewriting legacy logs;
- `readiness_evaluations` — reproducible snapshots of athlete scope, competition demand, preparation, policy/version and result;
- `readiness_reviews` — separate human decision/audit history.

Supabase verification after migration reports **28/28 application tables and 28/28 with RLS**. Team + athlete isolation remains mandatory at application/repository boundaries as well as database security.

## Cross-epic principles discovered during Epic 2

### Coach ownership

Automation may generate and propose; accepted/manual/protected coach state is not silently replaced.

### Stable identity and idempotency

Regeneration/retry needs logical identity independent from transient draft IDs. Repeating an accepted operation must not duplicate domain state.

### Unknown is a domain value

Missing information is not zero. Absence of evidence is not evidence of a negative event. This applies to course D−, realized training metrics and other partial inputs.

### Explainable/versioned policy

Configurable heuristics must expose units, windows, thresholds and version. Historical evaluations need snapshots sufficient to explain their original result.

### Human and automatic decisions are separate facts

Generated proposals, automatic assessments and coach decisions retain distinct provenance/audit semantics.

### Isolation is end-to-end

Team/group/cohort/plan/athlete scope must survive domain projection, reconciliation and persistence; UI filtering alone is not a security boundary.

### Evidence-based delivery

A schema check is not proof of remote migration. A remote build is not proof of a local test suite. A test not executed is not reported as passing. Epic 2 increasingly formalized focused checks during implementation plus a complete story gate and manual walkthrough at closure.

## Persistence evolution

Epic 2 extended both SQLite/local domain storage and the parallel PostgreSQL/Supabase target. Important Supabase milestones include competition calendar persistence (H9), historical target race date, and H12 readiness/evidence/review storage.

Generated Drizzle migrations and metadata are versioned together. SQL is reviewed before application, and remote verification confirms both expected tables and RLS.

## Closure state

H1–H12 are complete.

Final H12 evidence:

- Supabase H12 schema applied and verified at **28/28 tables + 28/28 RLS**;
- `pn test`: **557/557 pass**, 104 suites, 0 fail;
- `pn lint`: **0 errors / 11 warnings**, matching the approved baseline;
- `pn exec tsc --noEmit`: **OK**;
- `pn build`: **OK**;
- functional/manual walkthrough: **confirmed satisfactory**.

Epic 2 is closed. The next step is to re-review the originally proposed Epic 3 against the completed H6–H12 architecture rather than assuming its earlier scope is still correct.
