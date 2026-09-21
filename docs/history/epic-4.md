# Epic 4 — Field Performance Evidence and Safe Execution Guidance

Status: complete and integrated into `dev`.

## Purpose

Epic 4 introduced a safe field-performance baseline around the coach's repeatable 1000 m track test without turning observed performance into unsupported physiological measurement.

The epic separates observed evidence, deterministic derivatives, running-reference resolution, execution guidance, factual evolution and consumer-specific presentation. It preserves the planning, realized-training, monitoring, Training Response and Athlete Stats authorities established earlier rather than creating a parallel physiology model.

Delivered stories:

```text
KAN-376  canonical 1000 m field-test evidence
KAN-377  effective-date RunningReference
KAN-378  versioned execution guidance
KAN-379  factual 1000 m history/evolution
KAN-380  Coach/Athlete integration, TestEvent/review lifecycle and safe presentation
```

All five stories and KAN-4 are Finalizada in Jira. Current architecture and code remain authoritative; this history records the evolution and baseline later work may assume.

## H1 / KAN-376 — canonical 1000 m evidence

KAN-376 made `1000m_track` the only supported field-test protocol in Epic 4 v1. Canonical evidence records athlete, performed time, fixed 1000 m distance, elapsed seconds, notes and provenance.

Pace and average speed are deterministic derivatives, not independently authoritative measurements. Evidence is append-oriented: new observations append history and correction invalidates/supersedes the original and appends a replacement rather than silently overwriting it.

Only explicit valid legacy 1000 m observations may be promoted. Ambiguous legacy physiology is not reinterpreted.

A 1000 m result does not directly measure PAM/MAS, VO2max, threshold, HRmax, resting HR or blood-pressure-derived physiology. Missing physiology remains unknown.

## H2 / KAN-377 — temporal RunningReference

KAN-377 introduced `RunningReference`, resolved on demand from canonical eligible evidence for an explicit effective date.

Resolution returns `available | unknown`. The applicable observation is the latest eligible observation at or before the effective date using deterministic ordering. Future observations cannot affect an earlier effective date.

The reference preserves source evaluation identity and observed facts plus deterministic pace/speed. It is not persisted as a second authority and resolution is read-only.

The model is intentionally not bitemporal: later correction/invalidation can change which currently canonical evidence resolves for a historical effective date. Reconstructing prior system-time knowledge remains outside the contract.

## H3 / KAN-378 — prescription intent versus execution guidance

KAN-378 established that Z1-Z5 and explicit quality percentages are different prescription systems.

An explicit quality percentage can produce deterministic pace/speed guidance from an applicable RunningReference when execution context supports transfer from level-track evidence. Z1-Z5 does not imply a percentage of the 1000 m reference.

RPE and Talk Test may support zone execution. Heart-rate guidance may be displayed only when explicit athlete HR evidence exists, or later from a validated sensor source. The system does not fabricate BPM from Z1-Z5, age defaults, the 1000 m result or another proxy.

The legacy `ZONE_PAM_PERCENTAGES` / zone-to-PAM-pace path was not promoted into the new policy. The 1000 m reference must not be represented as measured PAM/MAS.

## H4 / KAN-379 — factual history and evolution

KAN-379 added a consumer-neutral `Track1000mEvolution` projection over canonical eligible evidence.

Active observations are ordered deterministically. Invalidated observations remain durable history but are excluded from active evolution; replacements participate normally.

Evolution preserves observed elapsed time and deterministic pace/speed. Latest-versus-previous comparison exposes mathematical delta and direction. Lower elapsed time is faster, higher is slower and equal is stable; those statements do not imply fitness, readiness, adaptation or training effectiveness.

Zero or one eligible observation remains insufficient for a comparison; no trend is fabricated.

## H5 / KAN-380 — safe Coach and Athlete integration

KAN-380 completed the product flow and strengthened lifecycle/provenance.

Official evidence is tied to a stable TestEvent. Execution context is `official | self_directed`; recorder role and recorder user identity are independent provenance dimensions. Review lifecycle is `pending_review | accepted | rejected`. Active accepted evidence is analytically eligible; pending, rejected and invalidated evidence is excluded. Legacy rows without lifecycle metadata are accepted by construction.

Coach surfaces can register official evidence, review pending self-directed evidence and inspect factual history/evolution. Athlete surfaces can register self-directed evidence and inspect a compact safe projection.

Corrections remain append-only replacements. Review changes lifecycle metadata rather than rewriting observed performance.

### Variable-terrain execution

Manual validation exposed a legacy presentation problem: Trail/Hills sessions could show level-running pace-oriented values as if they were athlete execution targets.

Epic 4 therefore established:

- Z1-Z5 remains valid prescription intent on Trail/Hills/positive grade.
- Level-track pace/speed derived from RunningReference is not presented as an execution target on variable terrain.
- Trail/hill execution is effort-led; RPE/Talk Test may support it.
- Coach notes carry context-specific instructions such as prioritizing effort over pace.
- New Trail/Hills sessions seed an editable effort-over-pace coach note.
- Legacy group `durationMin` and its mechanically derived average pace/speed are not presented as individual athlete targets on variable terrain.

The persisted group prescription was not redefined. Its longer-term duration semantics remain deferred.

## Persistence, security and isolation

SQLite remains the current runtime repository for Epic 4 field-performance actions. Supabase/PostgreSQL maintains the corresponding schema/migration/RLS deployment contract.

Field-performance persistence aligns on TestEvent, execution context, recorder provenance, review lifecycle, fixed distance and elapsed-time evidence. No canonical pace/speed/PAM/HR value is persisted as a second observation authority.

Application boundaries resolve owned/self athlete scope before evidence reads and mutations. Cross-athlete evidence is not exposed through correction/review paths. Supabase RLS covers field-performance evidence and TestEvents, but is not described as protecting SQLite runtime calls.

At final KAN-380 closure the reported Supabase verifier baseline was 38/38 application tables with RLS on 38/38.

## Cross-epic principles reinforced

- **Evidence, derivatives and interpretation are different facts.** Observed elapsed time is evidence; pace/speed are arithmetic derivatives; RunningReference is a temporal projection; execution guidance is policy.
- **Unknown remains first-class.** Missing HR or other physiology stays unknown. Z1-Z5 does not manufacture BPM.
- **Planning remains coach-owned.** New evidence and analytics do not silently rewrite accepted planning.
- **Monitoring remains distinct from physiology.** Training Load, Training Response and Readiness retain their earlier boundaries.
- **Terrain changes pace transferability, not intensity intent.** Variable terrain can invalidate a flat pace target without invalidating the prescribed Z1-Z5 effort.
- **History is append-oriented.** Corrections preserve prior observed facts and append replacements.

## Research and durable architecture

Research rationale, including variable-terrain evidence:

- `docs/research/epic-4-field-physiology-and-intensity-guidance.md`

Current durable implementation contract:

- `docs/architecture/monitoring/field-performance-and-execution-guidance.md`

Research explains rationale; architecture defines current truth; this history records Epic 4 evolution.

## Deliberate deferrals and next-baseline debt

Epic 4 closed without absorbing:

- **KAN-407** — stabilize SQLite local migration/idempotency and upgrade-path reliability after a local database required recreation following `no such table: field_performance_tests`.
- Complete ES/EN migration on untouched legacy surfaces, including KAN-375 athlete-surface debt and confirmed SessionForm hard-coded copy.
- Localize the workout-type selector.
- Resolve session microcycle automatically from selected date.
- Replace misleading `pam_percentage` / `pamPercentage` / “Porcentaje PAM” semantics with a truthful intensity/reference contract. A 1000 m result must not be relabeled as measured PAM/MAS.
- Define constrained selectable quality percentages as a product/domain decision rather than unrestricted numeric input.
- Define group `durationMin` semantics for Trail/Hills before treating it as an athlete estimate. Any athlete-specific trail estimate requires explicit evidence and uncertainty semantics.
- Multi-protocol field testing and device/sensor ingestion.
- **KAN-374** — reject future athlete dates of birth remains independent validation debt.

These deferrals are not Epic 4 acceptance failures. They are part of the baseline to evaluate before the next product epic.

## Final verification baseline

KAN-380's final human-operated closure gate on 2026-09-21 reported:

- `pn test` — GREEN: 1098/1098 tests, 202 suites, 0 failures.
- `pn lint` — 0 errors / 9 documented baseline warnings.
- `pn tsc` — GREEN.
- `pn build` — GREEN.
- `pn i18n:check` — 532 ES/EN message leaves aligned.
- `pn db:check:supabase` — GREEN.
- `pn db:verify:supabase` — GREEN: 38/38 application tables and 38/38 RLS.

Manual closure validation covered Coach desktop physiology, Athlete mobile Stats, Trail/Hills session-note behavior and final Athlete Home Trail presentation.

PR #13 merged KAN-380 into `dev`; remote `dev` was verified identical to merge commit `f79a244b64ed84cf2d7065abb14fd543f3f05526` before Jira closure.

This is historical verification evidence, not a claim that later `dev` commits reran the same gate.

## Closure state

KAN-4 and KAN-376 through KAN-380 are Finalizada in Jira.

Epic 4 is functionally and administratively complete. Its per-story handoffs are superseded by this history plus durable architecture/research and should not be used as an archive.

The next epic must be reconstructed from current `dev`, this completed history, relevant architecture and current Jira. Legacy cleanup should distinguish presentation/i18n debt, domain-contract debt, persistence/migration debt and documentation/hygiene debt instead of treating all legacy code as one undifferentiated refactor.
