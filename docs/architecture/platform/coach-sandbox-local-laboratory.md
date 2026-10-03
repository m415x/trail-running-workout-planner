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

## Approved decomposition and next gates

- **KAN-585 (T3)**: local laboratory, independent cluster approval, canonical source inventory and real diagnostic probe. Only close with focused evidence and durable documentation reconciled.
- **KAN-584 (T2)**: mutation guardrails, also a prerequisite for any migration operation.
- **KAN-598 (T3b)**: controlled application of the 29 canonical Drizzle migrations against verified empty local PostgreSQL, **requiring separate explicit operator authorization before DDL**. Blocked by KAN-585 and KAN-584.
- **KAN-599 (T3c)**: physical Drizzle journal/hash reconciliation, negative paths, controlled transaction rollback and explicitly authorized repeat reconstruction. Blocked by KAN-598.
- **KAN-586 (T4)**: distinct physical schema, constraints, indexes, foreign keys and structural RLS verification, blocked by KAN-599.

Do not treat approval of this task reorganization, a GREEN unit test or successful read-only probe as permission to apply SQL migrations, seeds or reset the database. Maintain the broader KAN-566 boundaries: no production, cloud, personal data, real athletes, pre-auth authorization claims or replacement migration system.
