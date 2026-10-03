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

## Approved decomposition and next gates

- **KAN-585 (T3)**: local laboratory, independent cluster approval, canonical source inventory and real diagnostic probe. Only close with focused evidence and durable documentation reconciled.
- **KAN-584 (T2)**: mutation guardrails, also a prerequisite for any migration operation.
- **KAN-598 (T3b)**: controlled application of the 29 canonical Drizzle migrations against verified empty local PostgreSQL, **requiring separate explicit operator authorization before DDL**. Blocked by KAN-585 and KAN-584.
- **KAN-599 (T3c)**: physical Drizzle journal/hash reconciliation, negative paths, controlled transaction rollback and explicitly authorized repeat reconstruction. Blocked by KAN-598.
- **KAN-586 (T4)**: distinct physical schema, constraints, indexes, foreign keys and structural RLS verification, blocked by KAN-599.

Do not treat approval of this task reorganization, a GREEN unit test or successful read-only probe as permission to apply SQL migrations, seeds or reset the database. Maintain the broader KAN-566 boundaries: no production, cloud, personal data, real athletes, pre-auth authorization claims or replacement migration system.
