# KAN-566 / T3 — Local Supabase laboratory and Drizzle preflight

Status: **diagnostic preflight verified; migration replay not started**.

## Scope and authority

The Coach sandbox is restricted to a disposable local Supabase CLI/Docker PostgreSQL instance. Its direct URL is fixed to `127.0.0.1:54322/postgres`; production and cloud destinations are **not accepted** by the local diagnostic path. A syntactically local URL by itself does not prove a safe physical destination.

Drizzle SQL files and metadata under `drizzle/supabase/` are the single canonical migration source. At this checkpoint the repository has **29 existing PostgreSQL SQL migrations**. No separate Supabase CLI migration sequence is created, and no canonical migration/journal file should be regenerated or hand-edited as part of this laboratory.

An operator-approved local file at `.coach-sandbox-local/approved-cluster.json` carries the PostgreSQL physical cluster identifier. It is deliberately **not versioned** and is read independently of any database query. Never print its contents, the identifier, credentials or connection strings in logs or Jira. The local probe matches the approved pin against `pg_control_system().system_identifier`; the transaction-local `app.coach_sandbox_marker` is only an additional session check, **not an identity authority**.

## Diagnostic-only operator procedure

1. Verify that the environment is the intended local disposable Supabase CLI/Docker installation. Confirm the independent approval file belongs to the intended cluster; after recreation/replacement, explicitly reapprove the new physical identifier before any database operation.
2. Ensure the local sandbox is running, then execute from the repository root:

   ```bash
   pn db:sandbox:status
   pn db:sandbox:probe
   ```

3. An expected successful probe prints:

   ```text
   Local sandbox probe: verified=true freshJournal=true
   ```

4. The probe validates the fixed local destination, loads the independently approved pin, opens an installed postgres.js/Drizzle transaction, verifies the physical identity, sets and reads back a **transaction-local** marker, then queries `to_regclass('drizzle.__drizzle_migrations')`. Its result proves that the specified journal was **absent at probe time**. It does not prove that the whole schema is empty or that future migrations will succeed.
5. Any failure stops the procedure. The CLI accepts **no arguments**, does not accept URL overrides, and sanitizes underlying errors.

## Evidence classes and limitations

- Operator-reported focused `pn tdd` suites including typecheck: GREEN after the syntax correction at `65c7902321587ef52cce415fb0831fc281da7ce5`. Jira evidence: KAN-585 comment 11350.
- Operator-reported **real local PostgreSQL probe**: `verified=true freshJournal=true`. Jira evidence: KAN-585 comment 11351.
- Existing source inventory guards check journal, file names, SQL bytes/hashes and filesystem types before opening the guarded migration transaction; source recheck is point-in-time and **does not eliminate filesystem TOCTOU**.
- **Operator-reported refreshed read-only diagnostic (2026-10-03):** `tsx scripts/coach-sandbox-status-cli.ts` -> `Local sandbox status: available`; `tsx scripts/coach-sandbox-probe-cli.ts` -> `Local sandbox probe: verified=true freshJournal=true`. Jira KAN-598 comment **11406**. These verify a pinned local cluster and absent Drizzle journal at probe time, **not** total schema emptiness, migration readiness at a later time, or authorization for DDL.
- **Not executed**: application of the 29 migrations, physical journal/hash verification after application, rollback/replay, seed insertion, reset, cloud operations or a schema/RLS functional verifier.

## KAN-598 / T3b — Canonical migration review checkpoint (2026-10-03)

This checkpoint is **remote source inspection only**. It is not a migration run, a live
PostgreSQL preflight, a GREEN of the full KAN-598 acceptance criteria, or permission
to perform DDL.

- Branch inspected: `feat/KAN-566-coach-supabase-sandbox` from its then-current remote HEAD. The repository's canonical `dev` remains the bootstrap baseline; no changes to `drizzle/supabase` are authorized in T3b.
- The version 7 PostgreSQL journal `drizzle/supabase/meta/_journal.json` lists **29 contiguous indices (0–28)**. Every referenced `0000_…` through `0028_…` SQL file was retrieved and reviewed by filename and significant DDL statements. All journal entries declare statement breakpoints.
- The reviewed SQL includes application tables, indexes, foreign keys, ALTER TABLE operations and RLS activation. The inspection did not identify `CREATE INDEX CONCURRENTLY`, `CREATE EXTENSION` or a separate transaction-management statement demanding out-of-transaction execution. **This observation is not a runtime SQL validity guarantee**, and does not establish no unexpected statement exists.
- The installed migration-bundle guard checks journal/file coverage, symlink and ancestor path boundaries, full SQL source correspondence with Drizzle's installed reader, SHA-256 values consumed by Drizzle, statement order and an immediate pretransaction SQL reread. These protections are point-in-time and do not eliminate filesystem TOCTOU or establish signed Git provenance. This review **did not independently compute the 29 hashes**.
- Before migration, the transaction boundary must match the independently pinned physical PostgreSQL system identifier, establish/read a transaction-local marker, reject a preexisting Drizzle journal and application table name collisions, and pass the same Drizzle transaction session to its canonical migrator. The absence of `drizzle.__drizzle_migrations` alone does not prove a completely empty schema.
- `runInstalledLocalCanonicalMigration` wires the independent pin/intent documents to a mandatory runtime `authorizeExecution` gate (fail-closed when absent, false or throwing), then the migration-specific postgres.js driver and guarded runner. A callback returning `true` is a software gate, **not independent evidence of human consent**. `runCoachSandboxMigrationCli` currently only validates an injected `--apply` callback: **there is no user-facing executable migration command or package.json migration alias**. It must not be represented as an executable procedure.

### Mandatory operational approval boundary

Before anybody can invoke the installed migration path against the local cluster:

1. Reconcile the actual local checkout/branch and SQL journal against the reviewed Git SHA; rerun applicable focused gates for any code changes. Do not equate a past synthetic GREEN with a fresh runtime check.
2. Establish that the target is the intended disposable Supabase CLI/Docker installation, with local-only endpoint and separately approved physical cluster pin. Independently recheck the live cluster identity and fresh target at execution time; stop on any mismatched pin, existing journal, application-table collision, filesystem drift or unexpected managed-object overlap.
3. Review the exact application operation and effects: **apply only the existing 29 Drizzle SQL migrations** to a fresh local PostgreSQL target, without generating SQL, seeding, resetting, changing Supabase-managed schemas, using cloud/production or importing real athlete data.
4. Obtain a **separate explicit human go/no-go for that specific DDL execution** after presenting this scope, target, safety checks and failure/rollback limitations. `--apply`, an `approvedByOperator` JSON field and prior TDD approvals are not evidence of this consent.
5. Only after approval, make the operational entrypoint available through an independently reviewed bounded procedure. Never run generic `pn db:supabase:migrate` for the sandbox by default. On failure, stop and capture sanitized diagnostics; do not auto-reset or retry.
6. Record actual operator-local/agent/CI results faithfully in **KAN-598**, including the migrator result, migration count and any errors, without printing cluster identifiers, passwords or connection URLs. T3b does not certify post-application hashes, replay or transaction rollback on a real cluster: those are expressly owned by KAN-599/T3c and need separate authorization when they mutate the database.

TDD evidence for the T3b setup is in individual **KAN-598/C04–C12 RED/GREEN** Jira comments; C12 operator-reported GREEN is in Jira comment **11400**. The GREEN assertions are from operator-reported focused tests/typecheck, not from a live DDL exercise. The operator's full `pn verify --db` was **PASS on 2026-10-03** after C13 restored safe phase-specific preflight errors (Jira KAN-598 comment **11404**): Tests 53023ms, TypeScript 11076ms, ESLint 25087ms, Build 21446ms, i18n 450ms, SQLite 40356ms; total 151438ms. An earlier full gate FAIL (three KAN-585 preflight assertions) was explicitly recorded in Jira **11402**, not erased; C13 correction commit `2f8d4d67bca021a7f786ccb49c4cf2cb47e6102e` and implementation Jira **11403**. `pn verify --db` includes SQLite scenarios but does **not** include Supabase migration. A new authorized read-only local probe may be run immediately before requesting a separately approved DDL operation; neither a prior probe nor this full PASS constitutes operator authorization to migrate. Subsequent execution must be separately evidenced.

## KAN-598/C14 — Blocked operational composition (2026-10-03)

**Status: RED recorded, implementation and GREEN pending.** The synthetic
`tests/sandbox/kan-598-bounded-operational-composition.test.ts` was committed
at `6b6740b26594017417f66f16d67d4544a9a8af72`; the operator reported
`pn tdd:red tests/sandbox/kan-598-bounded-operational-composition.test.ts`
as RED (Jira KAN-598 comment **11409**). A subsequent attempt to add the
corresponding operational composition module was blocked by the execution
tool's security control: **no such module was committed, and GREEN has not
been observed**. This is a delivery blocker, not a failed PostgreSQL migration.

Preserve the following boundary while the implementation is pending:

- Do **not** publish a package script, `main()`, executable migration command,
  environment-selected database URL, cloud override, reset or automatic retry.
- CLI syntax `--apply`, two trusted local JSON documents and a callback
  returning `true` are **not independent proof of human consent**. Explicit
  human go/no-go for the specific 29-migration DDL operation remains separate,
  before its execution.
- The tested composition design is a **synthetic seam only**; passing a future
  unit test would not establish live PostgreSQL transaction compatibility,
  absence of unrelated preexisting objects, or safe real rollback.
- Before advancing beyond the current checkpoint, resolve the tool/security
  blocker through an authorized review path rather than working around it.
  Once legitimately implemented, request focused GREEN, then rerun the
  aggregate gate for subsequent changes. Keep the first real DDL execution
  strictly withheld until its own authorization.

## KAN-598 — Installed Drizzle nested-transaction compatibility risk (2026-10-03)

**Static compatibility concern investigated with synthetic GREEN (C15); live PostgreSQL execution not established.** Static inspection of the
version-tagged upstream sources for `drizzle-orm@0.45.2` identified a
plausible mismatch, **not a reproduced runtime failure**:

1. Our `createInstalledPostgresJsDrizzleMigrationHost` in
   `lib/sandbox/drizzle-migration-host.ts` opens `database.transaction` and
   passes `tx._.session` to the canonical `PgDialect.migrate`.
2. Upstream `PgDialect.migrate` creates the Drizzle schema/journal using
   `session.execute` and then invokes `session.transaction` for the SQL
   migration loop.
3. Upstream `PostgresJsSession.transaction` invokes `this.client.begin`,
   whereas `PostgresJsTransaction.transaction` invokes a
   `this.session.client.savepoint`. The postgres.js `TransactionSql` type
   declares `savepoint`, not `begin`.

Consequently passing an already transaction-scoped Drizzle **session**, rather
than using the transaction object's savepoint interface, may fail at runtime
when the real migrator attempts to begin a nested transaction. Existing focused
suites inject synthetic `dialect.migrate` callbacks and therefore do not prove
the installed migrator's nested transaction works. Successful TypeScript,
SQLite and read-only local probe results cannot resolve this.

Before enabling a migration entrypoint: inspect the *installed*, lockfile-
resolved Drizzle/postgres.js code and types, design a compatibility regression
that executes no DDL or database calls, and reconcile the correct Drizzle
transaction/savepoint ownership without replacing canonical migration hash/
journal handling. Obtain a fresh focused GREEN and full regression gate.
Live migration/rollback verification still requires separate explicit human
authorization; do not test the hypothesis by applying DDL without it.

Sources inspected:
- `drizzle-team/drizzle-orm`, tag `0.45.2`,
  `drizzle-orm/src/pg-core/dialect.ts` and
  `drizzle-orm/src/postgres-js/session.ts`.
- `porsager/postgres`, `types/index.d.ts`, `Sql.begin` vs
  `TransactionSql.savepoint`.

C15 operator-reported focused tests/typecheck subsequently reached **GREEN** (Jira KAN-598 comment **11420**) after correcting the installed Drizzle host to delegate nested `session.transaction` to the outer Drizzle transaction's savepoint path (commit `0e55c7e2`), correcting the synthetic nested `tx.execute` test fixture (`f038424c`), and isolating the unrelated missing C14 module from TypeScript compilation (`522f62aa`). The test uses the real installed `PgDialect.migrate` with an in-memory client, **not** a physical PostgreSQL transaction; no migration/rollback guarantee is asserted.

Jira: KAN-598 comments **11411**, **11420**, independent of the
C14 tool-security hold. C14 still RED. No actual migration or PostgreSQL write occurred.

## Approved decomposition and next gates

- **KAN-585 (T3)**: local laboratory, independent cluster approval, canonical source inventory and real diagnostic probe. Only close with focused evidence and durable documentation reconciled.
- **KAN-584 (T2)**: mutation guardrails, also a prerequisite for any migration operation.
- **KAN-598 (T3b)**: controlled application of the 29 canonical Drizzle migrations against verified empty local PostgreSQL, **requiring separate explicit operator authorization before DDL**. Blocked by KAN-585 and KAN-584.
- **KAN-599 (T3c)**: physical Drizzle journal/hash reconciliation, negative paths, controlled transaction rollback and explicitly authorized repeat reconstruction. Blocked by KAN-598.
- **KAN-586 (T4)**: distinct physical schema, constraints, indexes, foreign keys and structural RLS verification, blocked by KAN-599.

Do not treat approval of this task reorganization, a GREEN unit test or successful read-only probe as permission to apply SQL migrations, seeds or reset the database. Maintain the broader KAN-566 boundaries: no production, cloud, personal data, real athletes, pre-auth authorization claims or replacement migration system.

## KAN-598/C16–C18 — Drizzle namespace preflight (2026-10-03)

The read-only `inspectCoachSandboxDrizzleNamespace` inspects `pg_catalog.pg_class` joined to `pg_catalog.pg_namespace` for existing relations in the `drizzle` namespace, rejecting nonempty or malformed results and sanitizing driver errors. It runs within `runVerifiedCanonicalDrizzleTransaction` after the absent-journal check and before public application-table collision checks and `PgDialect.migrate`, using the existing verified transaction query. This is a **bounded relation-catalog check**, not a proof that all PostgreSQL object classes or other namespaces are empty.

Operator-reported focused `pn tdd` GREEN (including TypeScript): C16 helper tests (Jira 11425), C17 structural ordering tests (Jira 11427), and C18 fake-transaction negative-behavior tests (Jira 11429). C18 confirms the mock migrator is never invoked and the public relation query is not reached on occupied `drizzle` relations. No real PostgreSQL transaction, rollback, migration, or schema security condition has been verified by these tests. The complete gate has **not** been rerun for these commits.

**Blocking constraint remains unchanged:** C14 operational composition has a recorded RED and was stopped by a tool security control (Jira 11410). The missing module has not been implemented; do not bypass this control through an alternate entrypoint. KAN-598 must remain in progress without enabling migration execution. Explicit approval for physical DDL is separate and has not been given.

## KAN-598/C14 — Stage A security review (2026-10-03)

**Approval scope:** non-operational source review and synthetic tests only. This does
not approve a migration entrypoint, PostgreSQL mutation, DDL, a new runner, or a
workaround for a tool restriction. C14 remains RED/blocked and KAN-598 remains
in progress.

### Rejection record and limits of knowledge

- **Attempted operation:** create `scripts/coach-sandbox-migration-operation.ts`
  as an operational composition module (not a request to execute SQL).
- **Reported mechanism:** the prior agent's file-writing/execution tool was
  rejected by a provider security control, as recorded in Jira KAN-598
  comments 11409–11410.
- **Exact tool/API name, invocation/request ID, original rejection message,
  policy rule and remediation channel:** **not available in the retained
  Jira/repository evidence**. Do not infer an enforcement reason or invent a
  review ticket/approval.
- **Confirmed aftermath:** no module committed, no executable entrypoint,
  C14 test RED, no real migrations applied. This is a tool-authorization
  blocker, not evidence of a defective PostgreSQL migration.
- **Legitimate review route:** have the owner/operator who encountered the
  rejection retrieve the original tool error (tool name, timestamp, request
  identifier, redacted message, policy/permission category if disclosed),
  then request review through the tool provider's officially supported
  administrator/security/support escalation channel. Require an explicit
  disposition covering that exact operation. No alternate tool, path, file
  name or delegate may be used to bypass the rejection.

### Stage A non-operational findings

- C14 uses a deliberately missing runtime-loaded module; it is not evidence
  that the intended module exists or that migration composition is safe.
- Existing `runInstalledLocalCanonicalMigration` requires a runtime
  `authorizeExecution` callback in addition to independently checked
  local documents. Even a callback returning true is *not* operator consent.
- The destination parser requires local `127.0.0.1:54322/postgres` and
  rejects unsafe variations. A syntactically valid URL does not identify
  the physical cluster; the independently approved PostgreSQL system ID
  and same-transaction preflight are still mandatory.
- C14's old `postgres:postgres` test fixture password was changed to
  `fixture-not-a-secret` (synthetic, never a real credential). This preserves
  host/port/database endpoint checks without normalizing a default password.
- `tests/sandbox/kan-598-stage-a-nonoperational-contracts.test.ts`
  adds static and pure negative contract assertions for destination
  restrictions, missing C14 entrypoint, declared runtime authorization and
  absence of a direct import-time driver invocation. Such checks cannot
  prove an entire module dependency graph has no import side effects.
  **Execution result remains pending** until the operator runs the focused
  test. Do not record GREEN or RED without that execution.
- The C14 dynamic-import tests remain RED until the blocked operation is
  separately resolved. Do not rewrite them to pass using a stand-in module.

### Future operational authorization dossier (prepared, not submitted)

- **Target:** a disposable Supabase CLI/Docker PostgreSQL instance reached
  at `127.0.0.1:54322/postgres`; independently pinned system identifier
  must be checked at execution time, without recording its secret/identity
  value in public evidence. This document does not assert current live state.
- **Proposed effect:** apply exactly the 29 existing Drizzle migrations
  indexed 0–28 in `drizzle/supabase/meta/_journal.json` to a verified empty
  application migration target. No schema regeneration, alternative CLI
  migration chain, cloud, production, seeds, reset or real athlete records.
- **Preflight before DDL:** verify checkout Git SHA and migration bytes;
  canonical journal/filesystem inventory and hashes; independent cluster
  approval; fixed destination and connected physical identity; transaction
  marker; absent migration journal; empty Drizzle relation catalog;
  no application table name collisions; supported nested savepoint semantics.
  Failure must be sanitized, stop the attempt and require diagnosis rather
  than retry/reset automatically.
- **Recovery limitations:** synthetic checks do not certify transactional
  rollback of all PostgreSQL DDL, Supabase-managed objects, full-catalog
  emptiness, journal integrity after migration or safe repetition. T3c
  KAN-599 owns physical journal/hash/rollback/repeat evidence.
- **Separate authorizations required:** (1) provider-authorized disposition
  of the blocked file operation; (2) explicit operator go/no-go for the
  exact cluster/29-migration DDL execution **after fresh preflight**.
  Neither has been established here. There is no authorized operational
  procedure to execute now.
- **Evidence classes:** Stage A static/synthetic tests are distinct from
  physical local PostgreSQL integration and from remote/cloud execution;
  no inference across classes is permitted.
