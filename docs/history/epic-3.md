# Epic 3 — Individual Monitoring, Training Load and Competitive Catalog

Status: complete.

## Purpose

Epic 3 turned the individual-evidence boundaries prepared in Epic 2 into durable product flows and added a normalized competitive catalog. Its central question was whether the product could observe what an athlete actually did, compare that evidence with applicable planning, derive explainable monitoring signals, and expose useful longitudinal information without converting uncertainty into false certainty or turning monitoring into automatic coaching.

The delivered scope grew from the original eight stories to ten:

```text
KAN-257  competitive catalog
KAN-258  durable realized training
KAN-259  plan-versus-realized comparison
KAN-260  adherence
KAN-261  estimated internal training load
KAN-262  systematic external-volume excess
KAN-263  Training Response convergence / coach triage
KAN-264  Athlete Stats / Training Analytics
KAN-281  race registration and factual participation history
KAN-282  shared action-safety and unsaved-change protection
```

The durable architecture documents remain the authority for current contracts. This history records the meaningful evolution and the boundaries that subsequent epics may assume.

## H1 / KAN-257 — normalize the competitive catalog

KAN-257 replaced duplicated event-per-distance concepts with the hierarchy:

```text
RaceEvent -> RaceEdition -> RaceCourse
```

Stable event identity is separated from a temporal edition and from the concrete selectable course. Distance and positive elevation gain are original course facts; elevation density and kilometer-effort are derived. Course classification is system- and version-aware rather than assuming historical classification codes remain current.

The catalog integrates with planning through accepted snapshots instead of becoming live authority over historical plans. `CompetitionEntry` remains plan-scoped competitive data and `TrainingGoal` remains a separate concept.

A course profile describes competition demand; it does not certify individual difficulty, readiness or physiological state.

Durable contract: `docs/architecture/competitions/race-catalog.md` and the related competition architecture documents.

## H2 / KAN-258 — make realized training durable

KAN-258 converted the Epic 2 H12 evidence boundary into a real capture and persistence flow.

The existing local-only workout logging behavior was not accepted as evidence. The delivered flow reuses `workout_logs` plus `workout_log_evidence`, preserves provenance and known/unknown metric semantics, and treats `sessionId` as the only authoritative planning link.

Core rules:

- planned training is not realized training;
- no realized row is unknown, not a missed workout;
- explicit zero and unknown are different facts;
- a realized record may be unplanned with `sessionId = null`;
- date, title and similar metrics never establish linkage or deduplication identity;
- corrections are traceable rather than silent destructive replacement;
- source + source activity identity is reserved for sources that actually provide stable identity.

This story established the durable evidence source reused by every later monitoring story.

Durable contracts: `docs/architecture/realized-training/`.

## H3 / KAN-259 — compare planned and realized evidence without inventing outcomes

KAN-259 created a reusable longitudinal plan-versus-realized comparison boundary instead of treating calendar UI state as domain authority.

Applicable planning is resolved historically by athlete/date using the existing cohort-variant-first and group-base-fallback policy. Realized evidence is associated only through authoritative session linkage.

The comparison preserves explicit states such as:

- `matched`;
- `deviation`;
- `known_not_completed` only when explicit negative evidence exists;
- `unplanned_realized`;
- `unknown`.

Compatible dimensions are evaluated independently with explicit units and operands. Missing operands remain non-evaluable, and relative differences are not manufactured where the baseline makes them undefined.

The comparison is derived and read-only: it does not mutate planning or realized evidence.

Durable starting audit: `docs/architecture/realized-training/plan-real-comparison-audit.md`; current code/tests are authority for the completed contract.

## H4 / KAN-260 — adherence becomes an evidence-qualified projection

KAN-260 derives adherence from the KAN-259 comparison rather than rereading raw logs.

Frequency adherence v1 uses only confirmed outcomes:

```text
confirmedCompleted = matched + deviation
confirmedOutcomes  = matched + deviation + known_not_completed
frequencyAdherence = confirmedCompleted / confirmedOutcomes
coverage           = confirmedOutcomes / eligiblePlannedSessions
```

Rule v1 publishes adherence only with at least two confirmed outcomes, at least 60% coverage, and no planning-resolution limitation in the evaluated window. Otherwise the result is `insufficient_data`; absence of evidence never becomes 0% adherence.

Distance, duration, elevation gain and intensity remain independent dimensions. No synthetic adherence score combines them.

Trend is also evidence-qualified: v1 uses weekly windows and requires enough publishable weeks before returning a direction.

Adherence is calculated on demand rather than persisted as a derived snapshot. The rule/version boundary preserves reproducibility and leaves snapshot persistence for a future requirement that actually needs historical publication locking or materially different performance characteristics.

Adherence is not readiness, fitness, training quality or training load.

## H5 / KAN-261 — estimated internal load remains an explainable estimate

KAN-261 introduced versioned training-load v1:

```text
internalLoadAU = durationMin × sessionRpe
```

The unit is AU (arbitrary units). It must not be presented as energy, power, measured physiological stress, injury risk, fitness, fatigue or readiness.

The default rule is `srpe-duration-v1`, with explicit parameters including 7-day short-term and 42-day long-term exponential time constants and a 42-day minimum reliable warm-up. These are MVP heuristics/conventions, not universal physiological constants.

Daily evidence distinguishes `known_load`, `confirmed_rest`, `unknown_load` and `no_evidence`. Unknown/no-evidence days are never converted to zero. In v1 an unknown day breaks longitudinal continuity and starts a new warm-up segment when reliable observations resume.

Distance and D+ remain external context and do not multiply sRPE load.

Derived load is calculated on demand rather than persisted. This prevents stale snapshots after realized-training corrections while the current scale makes deterministic recomputation practical.

Scientific rationale remains in `docs/research/training-load-fitness-fatigue-scientific-foundations.md`.

## H6 / KAN-262 — systematic excess is a review signal, not a diagnosis

KAN-262 detects persistent realized external volume above prescribed volume across consecutive evaluable microcycles.

Distance, duration and elevation gain are evaluated independently. Unplanned realized activity contributes to actual realized volume but never increases planned volume. Unknown or insufficient microcycles break continuity instead of being bridged to manufacture persistence.

Version `systematic-volume-v1` distinguishes `within_plan`, `isolated_excess`, `systematic_excess` and `insufficient_data`. Its attention levels are operational workflow states, not medical-risk categories.

The signal remains derived. A human acknowledgement may be persisted separately so the reviewed snapshot and human action remain auditable without freezing or rewriting the underlying evidence.

Durable contract: `docs/architecture/monitoring/systematic-volume-excess.md`.

## H7 / KAN-263 — Training Response composes signals for coach triage

KAN-263 introduced `training-response-convergence-v1` as a composition layer over existing semantic monitoring signals.

It does not recalculate source metrics. Systematic external volume and internal-load signals can act as independent evidence; adherence is contextual in v1. Convergence requires compatible evidence periods before independent signals can raise the workflow attention to `priority`.

The output is deliberately operational:

- `none`, `info`, `review`, `priority` describe coach-review attention;
- `priority` does not mean physiological severity;
- insufficient evidence survives as an explicit limitation;
- association does not become causation;
- the model does not diagnose fatigue, injury, overreaching, overtraining or illness;
- the model does not estimate injury probability;
- the model does not automatically modify planning.

This boundary is especially important for later physiology work: Training Response is monitoring/triage over training evidence, not a physiological assessment.

Durable contract: `docs/architecture/monitoring/training-response-convergence.md`.

## H8 / KAN-264 — Training Analytics and Athlete Stats

KAN-264 established a consumer-neutral analytics layer followed by an explicit athlete-facing disclosure boundary:

```text
domain evidence
  -> Training Analytics
  -> Athlete Stats Projections
  -> athlete application/actions
  -> /stats
```

Stats v1 covers Training, Load, Adherence and Competition. Analytics can aggregate, compare explicit windows and expose mathematical trend direction, but it does not redefine source facts or coach decisions.

The athlete projection is an allowlist, not a coach projection with fields removed. Coach triage/review state, private notes, readiness interpretation, automatic recommendations and diagnostic/probabilistic claims do not cross automatically.

The story reinforced several reusable semantics:

- `unknown != 0`;
- missing evidence is not negative evidence;
- insufficient evidence must not fabricate trend/comparison;
- increasing/decreasing is mathematical direction, not improving/worsening;
- technical failure is distinct from valid unknown/insufficient/empty states;
- association is not causation.

Athlete-facing Training Response and Readiness were deliberately deferred.

Durable contract: `docs/architecture/monitoring/athlete-stats-analytics.md`.

## H9 / KAN-281 — effective race registration and factual competitive history

KAN-281 implemented the `RaceRegistration` boundary reserved during KAN-257.

A registration is an effective individual fact scoped by team + athlete + concrete race course. It is not a goal, planning entry, readiness decision or realized-training record.

Registration lifecycle (`registered | cancelled`) is separate from participation evidence (`unknown | started | finished | dnf | dns`). Missing participation evidence remains unknown. Result fields are factual and nullable; nominal course distance is never substituted for actual covered distance.

Historical event/edition/course facts are snapshotted so later catalog edits do not rewrite accepted history. Same-edition course change is an explicit mutation rather than a second registration.

Coach and Athlete surfaces consume separate projections. Athlete information architecture places upcoming effective registrations under Plan -> Competition and historical factual participation/results under Stats -> Competition. This placement does not couple registration to planning.

Final KAN-281 evidence reported 908/908 tests, TypeScript clean, lint at 0 errors / 7 warnings, build green, Supabase migration check green, 36/36 application tables with RLS, and completed Coach/Athlete walkthroughs.

Durable contract: `docs/architecture/competitions/race-registration.md`.

## H10 / KAN-282 — shared action safety

KAN-282 closed the epic with a cross-cutting UI safety policy rather than feature-specific confirmations.

The three action levels are:

1. ordinary / low risk — no confirmation;
2. significant / error-prone — contextual Level 2 confirmation;
3. destructive / high impact — reinforced Level 3 confirmation.

`ConfirmActionDialog` is the shared explicit-action primitive. Unsaved form changes use a separate reusable dirty-form/navigation guard because leaving a dirty form is not equivalent to confirming a button action.

Delivered adoption includes athlete deactivation, race-registration cancellation, race-course change and Athlete Edit dirty-form protection. Activation/reactivation remain direct where the policy classifies them as lower risk.

KAN-282 also completed the second `harness-eval-v1` story. The post-experiment record lives in `docs/agent-harness.md`; the harness must not be silently changed as part of later feature work.

Durable contract: `docs/architecture/platform/ux-action-safety.md`.

## Cross-epic principles reinforced during Epic 3

### Observed, planned and derived data remain different facts

Planning cannot stand in for realized evidence. Derived adherence/load/triage outputs cannot become new observations. Race registration and race result facts do not become realized training automatically.

### Unknown is first-class

Missing evidence is never silently converted into zero, missed training, DNS/DNF, normality or reassurance. Explicit zero remains a known value when supported by evidence.

### Derivations require provenance and versioned semantics

Adherence, load, systematic excess and convergence expose their rule/version boundaries. Derived values remain reproducible from authoritative evidence where practical rather than being persisted merely for convenience.

### Monitoring is not physiology

Training load and Training Response are estimates/operational interpretations over training evidence. They do not establish measured physiological state. This boundary must be preserved when physiology is introduced later.

### Human decisions remain separate

Coach acknowledgement/review is a separate fact from an automatic assessment. Monitoring does not silently mutate accepted planning.

### Consumer-neutral analytics precedes athlete disclosure

Shared analytics may be neutral without being safe for every audience. Athlete-facing contracts explicitly allowlist what crosses the disclosure boundary.

### Historical identity and snapshots matter

Catalog entities use stable identities, while accepted historical facts are snapshotted where later source edits must not rewrite history.

### Isolation is end-to-end

Team/athlete scope remains mandatory through repositories, application boundaries and Supabase RLS. UI filtering is not authorization.

### Action safety is proportional to consequence

Confirmation is not applied to every write. Significant and destructive operations receive appropriate barriers, while dirty-form protection is handled by its own reusable navigation contract.

## Deliberate deferrals

Epic 3 closed without absorbing the following follow-up work:

- **KAN-342** — research subjective longitudinal athlete-response signals before incorporating RPE/Feeling semantics into broader monitoring.
- **KAN-349** — evaluate athlete-facing Training Response and Readiness separately from the Stats v1 disclosure baseline.
- **KAN-360** — athlete registration intention with coach review; distinct from effective `RaceRegistration`.
- **KAN-374** — reject future athlete dates of birth.
- **KAN-375** — complete ES/EN migration on untouched legacy athlete surfaces.
- organizer/device/platform integrations, official race ranking/position, performance prediction and automatic plan mutation remain outside the delivered epic unless a later Jira story explicitly scopes them.
- authentication/tenant resolution remains a later platform concern; Epic 3 does not spread temporary development identities into new domain contracts.

These items are not evidence that Epic 3 acceptance remains incomplete.

## Persistence and verification evolution

Epic 3 extended the durable evidence and competition boundaries while preserving SQLite and PostgreSQL/Supabase alignment. By KAN-281 the reported Supabase inventory was 36/36 application tables with RLS.

Story-level closure evidence was recorded in Jira and the architecture/handoff documents at the time each story closed. In particular:

- KAN-281 reported 908/908 tests, clean TypeScript, build green, migration check green and 36/36 Supabase tables with RLS.
- KAN-282 reported a green full test/lint/typecheck/build gate plus focused/manual action-safety walkthroughs.

Those are historical story gates. Epic closure must record any separate final `dev` gate only after it actually runs.

## Closure state

KAN-257 through KAN-264, KAN-281 and KAN-282 are complete in Jira, including their direct subtasks. No direct KAN-3 child remains outside Done at the time of closure review.

Epic 3 is functionally complete. Its final administrative transition is performed only after this history/index consolidation and a fresh final gate on the current `dev` integration baseline.

The next epic must reconstruct its stories from current code, durable architecture and this completed history rather than assuming the preliminary future scope still matches the system. In particular, physiology work must reuse existing PAM/HR/intensity infrastructure where applicable while preserving the boundary between observed physiological measurements, derived references, monitoring analytics and coach-owned planning.
