# Epic 3 — Competitive catalog handoff

## Status

Epic 3 Story 1, **KAN-257**, is complete. Its implementation branch is `h-22-race-catalog`, ending at [18a01f1](https://github.com/m415x/trail-running-workout-planner/commit/18a01f16960cfb035f3e4ac1a6fc6e4f68a1f548). The [GitHub comparison from the Epic 2 merge](https://github.com/m415x/trail-running-workout-planner/compare/9266f8f18e7ddedeefcfeb45a445063b0e026480...18a01f16960cfb035f3e4ac1a6fc6e4f68a1f548) contains 89 commits, with no divergence.

This handoff is recorded on `h-23-realized-training`. Its baseline before this documentation change is `d8e9f57077d064d3f7a0bb2c90d73029c6ca5de4`: five KAN-284/KAN-285 commits after the catalog closure. Those KAN-258 changes are not part of KAN-257.

This replaces the Epic 2 operational handoff; Epic 2 history remains in [epic-2.md](../history/epic-2.md). Architecture documents remain the durable domain authority. Task references below reconstruct delivered boundaries from GitHub documents/commits, not a fresh certification of every Jira subtask status.

## Durable outcome

```text
RaceEvent → RaceEdition → RaceCourse
                            ├→ explicit selection → CompetitionEntry snapshot
                            ├→ explicit selection → TrainingGoal snapshot
                            └→ reserved future RaceRegistration target
```

- One event supports multiple editions and concrete courses without duplicating the event per distance. Opaque IDs define identity; labels, years and nominal distance do not.
- Stable branding belongs to the event; dates, organizer and host location to the edition; distance, D+, modality and specific start schedule/location to the course. Ancestry cannot be changed through ordinary editing.
- Distance is positive when known; D+ is non-negative and may explicitly be zero. Missing measurements remain `null`; decimals are preserved.
- Modality is explicit, including road, trail, skyrunning, vertical kilometer and extensible other values. Density never infers modality.
- Density and kilometer-effort are derived descriptors. H10 and the catalog share the kilometer-effort primitive; it is not a universal training-load or readiness score.
- External classifications carry system, dimension, version and provenance. Multiple systems/versions can coexist. Only an implemented exact version can derive/verify a code. Contradictory product-derived values are errors; source/manual mismatches are warnings. Historical XXS–XXL is not presented as current ITRA truth.
- H8 compatibility, H10 competitive treatment and H12 individual readiness remain separate. Catalog selection proves neither registration nor preparation.

See [catalog](../architecture/race-catalog.md) and [classification](../architecture/race-classification.md).

## Catalog and consumer integration

Dashboard > Competitions delivers search, event/edition/course creation, detail, editing and archival, with ES/EN copy. Empty events/editions remain discoverable. Detail exposes original profile, derived descriptors and existing versioned classifications; edits preserve classification/provenance metadata.

A shared selection policy requires active event, published edition/course, matching ancestry, known distance and no deleted ancestor. Unknown D+ is allowed. Server actions re-read the hierarchy, validate ancestry/revisions and reject stale or unavailable selections.

Planning keeps `CompetitionEntry` ownership, A/B/C priority and the existing calendar rules; `CompetitionContext` consumes plan-owned fields. Athlete goals keep their own date/name/distance/D+ snapshot. Consumer snapshot and optional catalog link are persisted atomically in SQLite. Catalog edits/archive never silently refresh accepted plans, macrocycle targets or goals. Manual/legacy consumers remain valid without a link; no similarity-based backfill invents identity.

Final product fixes exposed athlete goals including drafts, added competition edit/cancel controls, derived catalog goal titles server-side and aligned the goal summary layout. A goal is not an entry/registration.

See [planning](../architecture/race-catalog-planning.md) and [TrainingGoal](../architecture/race-catalog-training-goals.md).

## Persistence

SQLite and PostgreSQL schemas add:

- `race_events`, `race_editions`, `race_courses`;
- `competition_entry_race_courses`, `training_goal_race_courses`.

The shared catalog has no fabricated team owner. Team/athlete checks remain on consumers. Provenance stores product/external origin and provider/external ID, with a unique provider + external ID per hierarchy table.

Sidecars persist only `race_course_id`; ancestry is resolved from the catalog. Parent/course FKs restrict physical deletion; deleting a consumer cascades only its link. Archive/logical deletion preserves history. Location/modality/classifications use JSON/JSONB; original metrics remain numeric.

[0013_bent_jackal.sql](../../drizzle/supabase/0013_bent_jackal.sql), its generated snapshot and journal were versioned in `6880428`. It adds five tables without destructive rewrites of H1–H12. The [persistence evidence](../architecture/race-catalog-persistence.md), finalized in `a0af95b`, records Drizzle generation, SQL inspection, successful Supabase application and **34/34 application tables + 34/34 with RLS**. The inventory correction `2e6a21d` includes all application tables; do not interpret 34 as simply the old handoff's 28 plus five.

RLS enablement is infrastructure evidence, not proof of catalog authorization policies for a future direct-client write path. Current product actions use SQLite; PostgreSQL schema verification does not claim an implemented PostgreSQL catalog runtime. Data API remains intentionally disabled.

## Task and commit traceability

Representative implementation anchors; the comparison above preserves the full sequence, including fixes and test-harness updates.

| Boundary / task documented in GitHub | Representative commits |
| --- | --- |
| Event/edition/course identities | `cd9d9a8`, `915eb5e` |
| Metadata ownership — KAN-266 | `2df7879`, `64656fb` |
| Original profile and explicit modality | `6c7e68f`, `73ca0b4`, `2f13e30`, `5d11705` |
| Derived demand — KAN-269 | `1999f46`, `534f845`, `ebb8eca` |
| Classification research/model — KAN-270/271 | `ddaaed0`, `53f2098`, `b7dd5db`, `b09ddec` |
| Coherence/versioned rule — KAN-272 | `7fd21f0`, `8ad8af0`, `a1aa121` |
| Planning snapshot — KAN-273 | `b3e25f8`, `c8a9929`, `8a32a13` |
| Goal snapshot — KAN-274 | `93fee1d`, `d3d3fb8`, `8bac6d7` |
| Future registration boundary — KAN-275 | `bc10690`, `9195252` |
| Persistence/CRUD/search — KAN-276 | `0bdb487`, `06a5750`, `57a5092`, `6880428`, `a0af95b` |
| Multidistance regression scenarios and seed fixtures | `051e605`, `2f56bd6`, `5baf113` |
| Product maintenance and selection — KAN-280 | `fb9a340`, `5383fc9`, `c62af50`, `6e12b52` |
| Deferred UX safety policy — KAN-282 | `ed3ccfe`, `b9ef77c` |
| Catalog goal title/summary fixes — KAN-283 | `41a7002`, `c47ba38`, `18a01f1` |

## Final validation evidence

- GitHub versions nine race-catalog test files covering primitive profiles, modality, derivation, classification/coherence, selection into planning/goals, forms and multidistance scenarios. Scenarios include independent editions, equal-distance/different-profile courses and immutable planning snapshots. Existing persistence harnesses were updated for the catalog schema.
- Supabase application/security verification is recorded as **34/34 tables and 34/34 with RLS** in the architecture evidence above. This documentation task did not rerun the database verifier.
- The complete story gate remains `pn test`, `pn lint`, `pn exec tsc --noEmit`, `pn build`, relevant DB verification and the manual walkthrough. GitHub sources inspected for this reconstruction do not contain a complete final execution report or numerical test result for KAN-257. Do not reuse Epic 2's 557 tests / 11 warnings as KAN-257 results.
- At closure SHA, GitHub Actions returned no workflow runs. The Vercel status is `success` with description **Canceled by Ignored Build Step**; this is not proof of a successful build/test gate.
- The UX debt document records findings from the KAN-280 walkthrough, and subsequent commits record fixes. They do not establish a fresh final manual sign-off. Any exact local gate output/sign-off should be recovered from original execution evidence before citing it.
- This handoff is a documentation-only reconstruction of an already completed story; it does not reopen implementation or claim new test execution.

## Next

Continue **KAN-258** on `h-23-realized-training`, preserving the existing realized-training boundary. The current [flow audit](../architecture/realized-training-flow-audit.md) and KAN-285 capture contract belong to that next story. Durable capture, evidence persistence and authoritative Session linkage must preserve H12's known/unknown/known-zero rules rather than create a parallel realized-training model.

Relevant follow-ups retained after KAN-257:

- **KAN-282:** shared destructive/lifecycle confirmation and dirty-form navigation protection; see [UX action safety](../architecture/ux-action-safety.md). Recording the debt did not implement the policy.
- **Future registration:** explicit team + athlete → concrete RaceCourse target only; lifecycle, persistence, payments, bibs, results and deduplication remain future scope. See [registration boundary](../architecture/race-registration-boundary.md).
- **Catalog evolution:** provider provenance reserves import identity but does not implement external synchronization. Explicit refresh/review of accepted consumer snapshots, additional exact classification rules and future catalog access policies need their own scope.
- Keep delivery remote-first, use focused checks while implementing, and capture the full gate plus walkthrough evidence at the next story closure.
