# KAN-646 — T4/T5 biometric contract proposal (NOT APPROVED)

Baseline dev `4ca470c99af0f83720b5b7887b617d0cbc443255`; T2/T3 candidate `9f0c0d40dc8dd8556ea426111e27155732766565`. Contract-only design. No migration, writer, RED or schema changes authorized by this document.

## Authority
H2 user -> H3 active Team and effective membership -> exactly one active owned AthleteProfile. Existing `physiology.self.read` is ONLY a positive allowlist for accepted field-test evidence; never read raw biometrics or authorize writes by analogy. Proposal requires separately named explicit SELF biometrics read and manage capabilities in H3 catalog/presets, including revoked membership and multi-Team deny. Server chooses subject; form submits only approved values.

## Field allowlist
SELF read/write candidates: weightKg (kg), heightCm (cm), maxHr (bpm), restHr (bpm). Each is an independent observation, not a 1000m test. Do not expose thresholdHr, PAM, medical, BMI, VO2Max, zones, email, DNI, group, team, admin fields, athlete identity mapping, or derived values.

## Physical model proposed, not frozen
Prefer append-only athlete biometric observations with immutable observationId, teamId, athleteProfileId, kind, value, unit, observedAt, recordedAt, recordedByUserId, source='athlete_declared', optional supersedesObservationId, status/invalidatedAt and reasons as approved. SQLite/PG migrations, FK and indexes require separate KAN-790 schema coordination and security review; reject partial writes and client-controlled provenance.

Historical `physiology_records` mandates PAM time/pace plus HR and is not a suitable partial SELF observation writer. `athlete_profiles.physiology` lacks per-field history, provenance and height. `field_performance_tests` owns official 1000m evidence and must not be updated by Profile.

## Effective selection
Do not implement latest-write-wins across evaluated and SELF sources. Suggested initial rule: display self-declared values only as labeled declarations; do not replace Coach-evaluated authoritative references or affect generated/realized sessions. Per-kind observedAt <= query cutoff; recordedAt immutable; tie-break and effective corrections to be specified and tested. No backdating privilege or retroactive session mutation.

## Validation freeze pending
Require finite numeric values, explicit units, safe bounded ranges to be signed off, decimal precision and normalization, timestamps valid and not future outside approved tolerance. For paired known HR values check restHr < maxHr; cross-source relationship must not cause fabricated measurements. Owner/auth check before persistence and atomic no-write DENY.

## T4/T5 acceptance
T4: explicit SELF biometrics read boundary, allowlisted only, source/time/state, denied/unknown/error; multi-Team, revocation, stale active Team. T5: separate SELF manage boundary, append-only immutable history, no-cross-Team/no-change-on-deny, unsupported field injection, invalid values, correction/replay/race and unchanged official evidence/legacy physiology and sessions. Commit focal RED and GREEN with canonical runner evidence. Requires contract approval before starting.

## Coordination gate
Before modifications to `db/schema.ts`, migrations, H3 capabilities, PostgreSQL compatibility, compare both HEADs of `dev` and KAN-790, reserve migration IDs and ownership, and approve source precedence and field validation ranges. No KAN-790 branch/DB/containers touched.
