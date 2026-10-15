# KAN-646/T5 — Secuencia única de integración aprobable (15/10/2026)

**Estado:** propuesta de coordinación, SIN habilitar RED físico, H3, schema, migraciones ni writers. KAN-790 mantiene ownership exclusivo de rama, contenedores y evidencias.

## Baselines remotos verificados
- dev: `4ca470c99af0f83720b5b7887b617d0cbc443255`, SQLite 0025, PG 0038.
- KAN-790: `ea3901775cc0b3164efb26e2c8e361c835cbca57`, ahead 266 / behind 0 vs dev, SQLite 0026, PG 0039 and 0040, Jira En curso.
- KAN-646: `f0540ca810df1fb510a3b156b59cd7bb5f2bf7ac`, ahead 20 / behind 0 vs dev, no Drizzle/schema migration changes, Jira En curso.
- No new migration numbers have been reserved.

## Policy freeze
- Write observedOn civil date between today-30 civil days and today inclusive, never in future; server computes today once from approved operational regional context per operation. No retrospective-window restriction on historical reads.
- recordedAt is server UTC timestamp. Reads use effectiveOn and knownAt independently; preserve as-known-at reconstruction.
- Max HR and resting HR are only paired when both active self-declared leaves at same query cutoff, same SELF source, and absolute civil-date difference <=30 days; then enforce restHr < maxHr. Otherwise show both individually with dates/provenance, without a validated pair or synthetic data.
- weight scaled x10 kg 200..3500, height x10 cm 1000..2500, max HR integer 60..240, resting HR integer 25..150. No silent rounding; these are operational, not clinical.
- Append-only corrections may amend value and observedOn; no in-place overwrite; one winning successor for each predecessor. Request-key uniqueness and canonical payload SHA-256; authenticate/authorize before even returning an idempotent replay.

## One recommended order: KAN-790 merges first
1. KAN-790 owner completes its TDD/gates, PR merge to dev and post-merge reconciliation. Do not cherry-pick, duplicate, or prematurely merge its migration subset into KAN-646.
2. Re-resolve remote dev and KAN-790 SHAs, review all intervening schema/migration/snapshot changes; verify canonical SQLite and PG journals and migration-head tests.
3. In independent KAN-646 checkout, preserve T1–T4 SHA checkpoints and integrate new dev (controlled merge or rebase per AGENTS/Harness), with explicit conflict inspection; do not force-push over others' work.
4. Only then choose new migration IDs, rebuild Drizzle snapshots for both dialects and freeze schema ownership. Candidate 0027/0041 is NOT a reservation and is invalid if history advances.
5. Add H3 SELF read/manage capabilities only as separately contracted product changes and server boundaries. Test explicit authorization before repository and before replay, cross-team/ambiguous/revoked/absent/inactive denied with no write.
6. Materialize T5 focal RED→GREEN on reconciled head; verify SQLite/PG constraints, concurrency, idempotency and rollback, and full regression gates as required. Keep sessions, snapshots, coach physiology/field evidence immutable.

## Contractual physical invariants
- independent append-only athlete_biometric_observations, PK id; restricted FK to Team, AthleteProfile and User, kind CHECK only weight/height/max_hr/rest_hr, unit mapping and scaled integer range by kind, source CHECK athlete_declared, observed_on civil date, recorded_at server UTC, actor and correction link.
- Unique nonnull supersedesObservationId, unique (team_id,athlete_profile_id,recorded_by_user_id,operation_key), secondary indexes on subject/kind/effective date/record time and correction linkage.
- Same team/profile/kind/revision-chain and live leaf must be checked atomically; immutable previous rows, reject forks/cycles, operation key conflict must not write. SQLite and PG must prove comparable effective constraints (CHECK/FK/unique/index/transaction).
- Do not write physiology_records, athlete_profiles.physiology, field_performance_tests, Coach references, prescriptions or generated/realized sessions.

## Entry gate for T5 RED
KAN-790 landed or equivalent common migration baseline explicitly certified; canonical journals and snapshots reconciled; new KAN-646 branch base SHA documented; migration IDs uniquely reserved; T5 schema and H3 boundaries reviewed; independently isolated SQLite/PG runners available; negative test matrix and recovery checkpoints recorded.

## Exit gate
Committed RED test with runner RED evidence; minimal code/schema/H3/writer with canonical GREEN including TypeScript, ESLint, i18n, SQLite/PG tests and migration-history audit; no-write-deny before/after; idempotent replay after reauth, conflicting payload and concurrent corrections; no side effects on official field tests, historic physiology or sessions; Jira checkpoint per SHA; full merge remains a later KAN-646 closure step.

## Recovery protocol
If head or migration numbers changed, abort before writing and re-anchor; never rename already integrated migrations. If merge/rebase conflicts arise, create a checkpoint and resolve exclusively inside KAN-646 checkout, preserve T1–T4 SHAs; if canonical journal/snapshot mismatch, stop RED and reconstruct from true dev state instead of manually fabricating history. If a migration was applied only to disposable local DB, discard and rebuild that isolated DB; never mutate KAN-790 or production databases. If transaction/concurrency guard fails, keep issue En curso, restore to known SHA/checkpoint and repeat canonical test after correction. Require explicit cross-owner coordination only if KAN-790 cannot merge first.
