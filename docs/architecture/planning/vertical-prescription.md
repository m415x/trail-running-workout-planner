# Vertical prescription v1 — KAN-593

## Authority and meaning

One nullable, versioned homogeneous VerticalBlock per GroupSessionPrescription (Session + microcycleId). The optional primary objective is explicit, never inferred from legacy distance. A block describes direction, positive integer repetitions, D+/D- per repetition with independent provenance and derived totals. All integer metrics are safe, nonnegative and bounded by the supported persistence range; null means unknown, zero is observed/prescribed zero. Complete quantifies the session D+ when known; partial is a subtotal included in, not added to, the independent session D+ total. Known partial subtotal never substitutes for unknown total. No geometrical or physiological certainty is inferred.

## Persistence and Coach

SQLite 0029 / PostgreSQL 0043 add nullable primary_objective and vertical_block_json; legacy rows remain null and elevation_gain is unchanged. JSON v1 validates runtime shape and 4096 UTF-8 byte limit; absent, corrupt and unsupported are distinct. Opaque data is preserved on unrelated edits, not interpreted. Authorization is owned by H2/H3/H4A boundaries and exact Team/Group/Plan scope, not by client fields. Coach editing uses manual/generated_modified ownership, audited transactional mutation, independent objective and block, explicit clear and safe template conflict. Existing track references require authority; adoption of new tracks is deferred. ES/EN labels, RPE/Talk Test, duration and recovery retain existing contracts.

## Athlete, generation and H12

Dated Variant-first/Base fallback selects one applicable Plan; no sparse per-Session fallback. T5 resolves exact sourcePrescriptionId and current revision, preserves omission/reschedule and detects conflicts. Individual complete dose takes precedence; an incompatible group block is reference only. H6 regeneration preserves manual/generated_modified, keys and shared Session audiences, fails closed on unexpected explicit vertical data in generated rows reached by a mutation. Known contribution is separate from incomplete weekly aggregate; null is not zero. H12 shares a scoped reader behind separate Coach and SELF authorization boundaries, uses T5 planned operands and authoritative Session linkage to realized evidence, compares independent distance/duration/D+ only when known, never uses block subtotal as total. Relative delta at zero is undefined; partial performed status does not erase known metrics. Conflict/omission/unknown do not create fake evidence or writes. No new adherence/physiology formulas, D- or repetitions realized, automatic vertical generation or extended individual editor.

## Evidence and limits

See [story handoff](../../handoffs/kan-593.md) and [T8 acceptance matrix](../../acceptance/kan-593-t8-matrix.md). PG acceptance uses real caller-owned transactions and TEMP relations only; no production migration, RLS or beta certification. The ordinary six-gate verification excludes the dedicated PG lane; use the explicit guarded focused files. Do not reuse the KAN-791 or KAN-646 database for this story.
