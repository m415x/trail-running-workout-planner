# Plan-versus-realized comparison audit

Story: KAN-259 — Compare planned versus realized training  
Task: KAN-299 — Audit the existing plan-real comparison  
Branch: `h-23-realized-training`

## Objective

Identify the existing planning and realized-training boundaries that KAN-259 can reuse, the projections that must not become domain authority, and the missing contract required for a reliable longitudinal comparison.

This audit does not change product behavior.

## Current sources

### Applicable planning

`resolveAthletePlanningOnDate()` already defines the authoritative dated selection policy:

1. reconstruct the athlete sporting group on the requested date from group history;
2. select one applicable cohort membership;
3. prefer an applicable cohort planning variant;
4. otherwise fall back to the applicable group base plan;
5. return explicit `none` or `conflict` results instead of selecting ambiguous data.

`getAthletePlanningResolutionOnDate()` provides the SQLite application boundary used by the coach-facing realized-training calendar. It applies current development-team isolation before loading memberships and base plans.

`resolveAthleteIntegralPlanningOnDate()` extends the same selection with a validated H11 review aggregate. KAN-259 does not need to create another plan-selection policy.

### Realized evidence

KAN-258 established the durable realized-training boundary:

- `workout_logs` remains the performed-training entity;
- `workout_log_evidence` carries provenance and known metric fields;
- `RealizedTrainingRecord` preserves `known` versus `unknown`, including ambiguous legacy zero;
- `sessionId` plus explicit session-link provenance is the only authoritative plan-real link;
- free/unplanned activity remains valid with `sessionId = null`;
- deduplication uses persisted or stable source identity, never date/title/metric similarity;
- repository reads require athlete and team scope.

KAN-259 must consume this boundary without introducing a parallel realized model.

## Current product projections

### Coach realized-training calendar

`getRealizedTrainingCalendarForAthleteAction()`:

- reads durable evidence for one athlete and date range;
- loads candidate prescribed sessions;
- resolves the applicable plan independently for each date;
- retains sessions belonging to the resolved plan;
- associates evidence only by exact `sessionId`;
- exposes unplanned record IDs separately.

This is useful application-query groundwork, but its output is a calendar status projection rather than a comparison contract. It currently reduces linked evidence to `completed`, `partial` or no matched outcome.

### Athlete home calendar

`useHomeTab()` reconciles the weekly schedule with durable evidence for the current development athlete. It also uses exact session IDs for matched evidence and treats records without a session link as orthogonal unplanned activity.

The home calendar is a UI projection and must not become the reusable coach comparison service.

### Realized history

`RealizedTrainingHistory` displays normalized realized metrics, provenance, limitations and corrections. It contains useful formatting patterns but has no planned operands and performs no comparison.

## Gaps

### No comparison result contract

There is no reusable result that represents:

- `matched`;
- `deviation`;
- `known_not_completed`;
- `unplanned_realized`;
- `unknown`.

The existing calendar `missed` state can describe a past prescribed day without linked evidence. Under KAN-259 rules, absence of evidence must remain `unknown`; `known_not_completed` requires explicit negative evidence.

### Planned and realized metrics use different shapes

Prescriptions expose planned distance, duration, elevation gain and intensity fields. Realized evidence exposes distance, duration, elevation gain, average heart rate and RPE as known/unknown metrics.

A comparison boundary must explicitly map only compatible dimensions and retain:

- planned operand;
- realized operand;
- unit;
- evaluation state;
- absolute difference;
- relative difference when mathematically defined;
- reason when a dimension is not evaluated.

A missing operand cannot be converted to zero. A relative difference is undefined when the known planned baseline is zero.

### Provenance is not carried through comparison

Calendar status output exposes a record ID but not the realized source, limitations, plan source, cohort, plan ID or authoritative linkage evidence. The longitudinal service must preserve enough context to explain what was selected and compared.

### Range resolution is repeated per date

The current calendar calls the application plan-resolution boundary once per candidate date. This is correct but not yet a reusable longitudinal query. KAN-259 should centralize the range projection while continuing to resolve historical applicability per date.

### No comparison-specific UI

The coach athlete detail currently shows the calendar and realized history. It does not show planned and realized operands side by side, valid deltas, non-evaluated dimensions or plan-resolution conflicts.

## Reuse decisions

1. Reuse `resolveAthletePlanningOnDate()`; do not create a second cohort/group fallback policy.
2. Reuse the KAN-258 realized repository and `RealizedTrainingRecord`.
3. Reuse exact `sessionId` linkage only when `hasAuthoritativeSessionLink()` is true.
4. Keep calendar/home status reconciliation as UI behavior, not comparison authority.
5. Keep comparison derived and read-only. It must not mutate planning, logs or evidence.
6. Preserve separate metric dimensions. KAN-259 does not calculate adherence, training load or systematic-excess alerts.
7. Treat plan-resolution `none` and `conflict` as explicit range/session limitations.
8. Preserve free realized activity as `unplanned_realized` rather than matching it heuristically.

## Required next contract

KAN-304 must define a pure comparison model before repository/UI work. It should include:

- comparison and metric evaluation states;
- explicit units and metric names;
- planned and realized operands;
- absolute and relative deltas with defined nullability;
- plan source and IDs;
- realized record provenance and limitations;
- explicit reasons for unknown/non-comparable results.

## Recommended implementation sequence

1. KAN-304: define the pure comparison contract.
2. KAN-300: expose reusable dated/range plan resolution without changing selection policy.
3. KAN-301: implement the pure per-session comparator.
4. KAN-302/KAN-303: compose the scoped longitudinal query and isolation.
5. KAN-306: add the coach-facing comparison view.
6. KAN-305/KAN-307: cover domain, planning resolution, range queries and isolation.
7. KAN-308: fixtures, durable documentation, handoff, walkthrough and final gate.
