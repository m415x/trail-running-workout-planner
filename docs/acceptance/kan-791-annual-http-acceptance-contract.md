# KAN-791/T6 — Annual HTTP acceptance contract (preparation, not execution)

## Evidence boundary
- KAN-790/T5 gate: **PASS 6/6**, exact SHA `9b95481d470f2deeffcecae8fcf65c2da28bd082`, Jira KAN-790 comment `13211`. Never carry this gate onto later commits.
- T5 PostgreSQL transactional tests are real and fail if `KAN789_PG_URL` is absent. They **do not** constitute Next/React HTTP acceptance.
- Existing `scripts/measure-kan-789-annual-snapshot.ts` produces **212 events**, a pure capacity measurement. It is not the historical 239-session scenario or HTTP evidence.

## T6 reproducible fixture (new deterministic 239, not historical reconstruction)
1. Use the existing disposable PostgreSQL acceptance instance; no additional Docker service. Provide `KAN789_PG_URL` for tests and configure `SUPABASE_DATABASE_URL` on the running Next application to the same isolated database. No production data or personal Coach account.
2. Provision an isolated authentic Supabase-authenticated Coach H2 subject, EPT external identity linkage and active Team H3 membership, and effective `planning.manage` H4A for the target Group and complete shared-event audience. Document the auth fixture provisioning and teardown; no production bypass.
3. Create one annual Plan with exactly **53 consecutive microcycles** and the effective strategies, frequency/pattern, templates, competition sources and active Plan→Group→Team lineage read by production PG CREATE. The deterministic source facts must yield **239 actual session events** after `generateWeeklySessionProposals` + `groupSharedSessionEvents`. Verify the count from the *production* generation output, not from array padding, mocked results or an overridden count.
4. Record fixture manifest (seed version, SQL row totals, expected generation keys, server input digest, explanation stage counts and expected 239 events) and fail the test on any mismatch. The fixture is **representative**, unless independent evidence recovers the historical source facts.

## Required browser + HTTP walkthrough (RED/GREEN)
1. Use the **real** `SessionGenerationPreview` form in a real Next server under the authenticated Coach cookies/session. Obtain its actual serialized Next Server Action reference using the browser/React form; never forge action identifiers or emulate the serialized request.
2. Baseline SQL snapshot of sessions, prescriptions, generation audit and review_snapshots; record request/response status, request size and diagnostic logging.
3. Submit **CREATE explicitly**. Verify no HTTP 413, response/redirect and exactly one opaque active snapshot. SQL compare before/after: no generated sessions or prescription mutations at CREATE.
4. Navigate GET by snapshotId; verify no HTTP 413; read full original server-generated proposal and explanations; verify 239 event identities, per-prescription explanations and limits. Repeat GET and compare SQL state, TTL and snapshot status byte-for-byte (read-only).
5. Submit **CONFIRM via actual UI** with only planId, locale and snapshotId (no `proposal` or `generationExplanations`). Verify request and response, no 413 and actual SQL consumption + 239 corresponding durable events (or documented shared-event count semantics), prescription counts and audit rows, plus read-after-write from a fresh DB connection.
6. Repeat CONFIRM and verify CAS/idempotence; deliberately test expired/stale/revoked H2/H3/H4A and rollback with SQL before/after; no duplicates or partial mutations. Test Base and Variant independently, including distinct scope and identity.
7. Capture bounded anonymized traces and machine-checkable SQL digests; fail rather than SKIP if any required environment, auth or source is unavailable. Keep evidence separate from unrelated `KAN-798` and `KAN-646`.

## Gate, PR and integration
- Run a **fresh** `pn verify --db -v` on candidate commit; record exact SHA and complete 6/6 report. Confirm walkthrough in the same candidate tree.
- Review diff/security/coverage; update durable handoffs; run `pn docs:handoff:check`; open PR and record PR head SHA; review before merge.
- After merge, record merge commit, run documented post-merge verification and update Jira KAN-790/KAN-791/KAN-784. No transitive claim that an earlier gate covers later SHAs.
- Do **not** change `bodySizeLimit` or deploy new Docker infrastructure without causal need.

## Open checkpoints
- T5.5 functional Coach integration is currently supported by structural tests and PG runtime tests **separately**, not an end-to-end Next HTTP test. T5 remains open until its own functional representative condition is met; T6 walkthrough is expected to supply stronger evidence.
- No HTTP 413 result, 239-event SQL fixture result, browser login evidence or SQL read-after-write result exists at the time of this document.
