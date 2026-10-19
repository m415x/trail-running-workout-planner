# KAN-646 — T4 read / T5 write biometric contract specification

Status: **PROPOSED, NOT IMPLEMENTED** (2026-10-15).
Baseline: `dev@4ca470c99af0f83720b5b7887b617d0cbc443255`; KAN-646 branch checkpoint before this document `f9aac9123a35154e06aabbcd51a11117d42bf2fc`.
KAN-790 owns its own branch, migrations, SQL snapshot architecture and PostgreSQL environments. No modifications to them from this document.

## Approved product principles
Only self-declared weight, height, maximum HR and resting HR. Self declarations are visible as such, never replace Coach references automatically, never mutate official tests, existing prescriptions or generated/realized sessions. H5B `physiology.self.read` is NOT biometrics read permission. No zones, VO2Max, medical records, admin identity or derived values.

## Proposed field limits (requires contract freeze before T5)
| kind | unit | min | max | precision |
|---|---|---|---|---|
| weight | kg | 20.0 | 350.0 | 1 decimal |
| height | cm | 100.0 | 250.0 | 1 decimal |
| max_hr | bpm | 60 | 240 | integer |
| rest_hr | bpm | 25 | 150 | integer |

Reject nonfinite, nonnumeric, out-of-range, unknown units, or excess precision (do not round silently). Check rest_hr < max_hr only for temporally compatible self-declared observations, not mixing professional/derived sources. These limits are not clinical diagnosis or already-approved baseline rules.

## H3 proposed catalog
- `physiology.biometric.self.read`: nondelegable, requiredScope self, basePresets athlete/assistant/coach/admin.
- `physiology.biometric.self.manage`: nondelegable, requiredScope self, same basePresets.
Each preset's authority concerns ONLY its own uniquely resolved AthleteProfile in the selected Team; no cross-athlete Coach access. Use H2 + validated active Team + effective H3 membership + unique active linked AthleteProfile, recheck at every request. No client-provided user/team/athlete identifiers. Deny anonymous/unlinked/revoked/ambiguous/expired/cross-team/inactive/deleted and capability conflicts. No writing anything on DENY. Preserve existing H5A/H5B behavior.

## T4: contract and read model only
Until a real authorized persistent source is available, return `unknown` or `unavailable`; no simulated measurements, no empty-as-zero. Proposed response `{status:'loaded',observations:{weight,height,maxHr,restHr}}` with each item either `{status:'available',value,unit,observedAt,recordedAt,source:'athlete_declared',observationId}` or `{status:'unknown'}`; outer `denied` and `error` separate. The source repository is a required dependency, not hardcoded fixtures in production. May implement/test pure read-selection logic with fixtures, but no production GREEN claiming actual disclosure without authorized persistence.

## Temporal and correction rules to freeze
- observedAt = effective observation timestamp supplied under validated anti-backdating/future policy; recordedAt = server-clock transaction time; recordedByUserId = H2 internal EPT User; source fixed athlete_declared.
- Corrections are append-only replacement events with supersedesObservationId; original rows immutable and retained; supersession restricted to same team/profile/kind, no loops or forks.
- Effective per-kind projection reads eligible leaf of a valid revision chain with observedAt <= cutoff; deterministic order observedAt DESC, recordedAt DESC, id ASC to avoid unstable ties.
- A historical correction changes the factual presentational profile according to query cutoff but never retroactively changes snapshots/sessions/prescriptions. Preserve recordedAt to distinguish what the system knew at a time from when measurement was taken.
- Idempotency requires server-checked immutable request key scoped to user/team/profile/operation and payload digest, unique constraint and transaction; same request/payload returns prior result, same key/different payload rejects.
- Atomic denial and atomic correction; optimistic concurrency on expected prior leaf for concurrent corrections. Reject a second fork/revision of the same superseded event.

## T5 physical schema proposal (NOT APPROVED)
Prefer append-only `athlete_biometric_observations` with id PK, team_id FK, athlete_profile_id FK, kind CHECK enum four values, value fixed precision integer scaled canonical units or explicit NUMERIC equivalent, unit CHECK by kind, observed_at, recorded_at, recorded_by_user_id FK, source CHECK athlete_declared, supersedes_observation_id nullable self FK, operation_key, request_digest, correction_reason nullable, and immutable base auditing fields. Physically append-only rows; revision state derived from supersession rather than mutating original.

SQL invariants: positive bounded scaled integer value/precision, valid kind/unit, immutable author/source/time, actor/profile/team linkage enforced in transactional repository, unique scoped operation key, unique supersedes_observation_id for linear corrections, indexes (team_id, athlete_profile_id,kind,observed_at DESC, recorded_at DESC,id) and (team_id, athlete_profile_id,recorded_at). FK and transactional same-subject correction assertions (FK alone does not ensure same team/profile). No cascade deletion of historical evidence through normal domain operations.

SQLite and PostgreSQL: use portable canonical integer scaling and per-dialect SQL migrations, transaction and indexing semantics separately tested; do not assume SQLite alone confirms PostgreSQL parity. No migration numbers assigned until coordination with KAN-790 and latest dev migration heads; reconcile Drizzle snapshots and test canonical migration history in both environments.

## Compatibility and test gates
Never insert fabricated PAM or HR into `physiology_records`; do not read/overwrite `athlete_profiles.physiology` legacy JSON; do not touch `field_performance_tests` or RunningReference. `heart-rate-reference` can compute age-predicted values under its own existing contract: do NOT silently promote it to measured self-declaration, Coach source or Profile disclosure. Keep the new self-declared projection independent from existing Coach evaluated HR references.

T4 tests: deny on H2/H3/Team ambiguity and unrelated athlete, allowed field-only output, individual unknown states, malformed/raw forbidden source exclusion, temporal cutoff, deterministic ordering, revision selection, error vs denied; no forged data in product UI.
T5 tests: each field min/max/precision/units; no float drift; backdate/future; no cross-team/cross-kind correction; no-write DENY; duplicate and conflicting idempotency key; concurrent correction fork; SQL constraints/rollback; PostgreSQL/SQLite parity; unchanged legacy and official evidence and sessions.

## Open material freeze decisions
1. Accept or revise exact numeric limits, precision and UTC vs civil-date observation representation, including backdating/future tolerance.
2. Confirm whether any correction may change observedAt (and resulting present-day selection) and whether late-recorded observations affect cutoff queries: distinguish as-of-observed from as-known-at.
3. Approve idempotency key ownership and per-athlete uniqueness versus per-user scoping; prefer operation scope user/team/profile with payload digest and conflict rejection.
4. Reserve SQLite/PG migration identifiers with KAN-790 owner immediately before T5 schema work; confirm whether dev has meanwhile advanced.
No T5 implementation, migration, capability catalog changes, or physiological writes are authorized by this proposal.
