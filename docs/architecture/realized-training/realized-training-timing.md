# Realized training timing — KAN-290

## Contract

- `workout_logs.date` remains the explicit analysis day (`YYYY-MM-DD`) used by H12. It is not recomputed from UTC `performedAt` or entry time.
- `performedAt` / `performed_at` is the actual occurrence instant, stored as canonical ISO UTC text in both SQLite and PostgreSQL, consistent with the existing text timestamp convention. Storage is nullable, with no default or historical backfill.
- `loggedAt` remains the server-generated entry instant. It never substitutes for a missing occurrence instant.
- New manual capture requires an explicit-offset occurrence timestamp. The dialog starts empty, converts the entered device-local date/time to UTC, and rejects invalid calendar values. Legacy projections remain readable and normalize absent occurrence time to `null`.
- Duration is `REAL` in SQLite and `double precision` in PostgreSQL. Capture uses hours * 60 + minutes + seconds / 60 without rounding to two decimal places. Floating-point representation is expected; no integer truncation is allowed.
- The existing atomic log + evidence boundary remains authoritative for known/unknown metrics. An empty duration stays unknown; an explicitly entered zero is known. Neither date nor metric similarity creates Session linkage.

## Migration procedure

PostgreSQL: generated `drizzle/supabase/0014_realized_training_timing.sql` widens duration and adds nullable text. No backfill, destructive rewrite, policy change, or default was added. Generate/check are offline evidence, not proof of remote application.

SQLite previously used `push` and targeted migrations without a generated journal. `drizzle/sqlite/0000_baseline.sql` and its snapshot capture the pre-change schema; `0001_realized_training_timing.sql` is the generated delta. Metadata is generated, never manually edited. This chain is separate from PostgreSQL's journal. The existing SQLite/PostgreSQL total-table inventory differs (35 vs 34); this change does not attempt unrelated schema reconciliation.

SQL review found that Drizzle 0.31.10 copied the newly added `performed_at` column from the old SQLite table during its rebuild. The reviewed SQL changes that SELECT expression to `NULL`; otherwise SQLite can reject the query or interpret the quoted identifier as a literal. Snapshots/journal were not patched.

For an existing SQLite database at the old schema:

```sh
pnpm db:migrate:realized-training:sqlite
```

The targeted runner executes the reviewed delta atomically, disables foreign keys **before** BEGIN to avoid cascading deletion of evidence during DROP, checks referential integrity before commit, and restores the previous connection setting. Replay on the current schema is a no-op; unexpected/partial schemas are rejected. Do not apply the new baseline to an existing push-managed database. Retain a backup before upgrading a populated development database.

For a fresh SQLite database, `pnpm db:push` creates the current schema. `pnpm db:generate:sqlite` maintains the separate migration history for future changes. The base seed explicitly leaves occurrence time null; its historical fixture metrics are not upgraded into observed evidence.

PostgreSQL deployment, once the existing project's server-only `.env.local` is configured:

```sh
pnpm db:check:supabase
pnpm db:migrate:supabase
pnpm db:verify:supabase
```

The verifier now checks the four timing columns as well as the existing 34-table/RLS inventory. No credentials or real remote application evidence were available during this implementation session.

## Capture UI

The dialog captures actual date/time, preserves seconds, displays localized save failures, retains inputs on failure, and guards concurrent clicks. Clearing the form does not imply deleting a persisted record. The card reloads captured status for the server-resolved athlete and exact Session ID; captured sessions no longer reopen a create-only dialog as an apparent edit operation. Capture stays disabled until persisted state can be checked.

This remains a create flow. Auditable correction/deletion belongs to KAN-292; full history/detail, stable retry identity, and broader tenant/authentication work remain their existing tasks. The server reuses the current athlete resolver, which still uses the application's existing development identity; this change does not claim production authentication. The reload guard is not server-side deduplication and does not solve concurrent tabs or an uncertain network response after commit.

Device-local time uses the browser's timezone. Explicit timezone selection and daylight-saving overlap disambiguation are not implemented. `date` remains the selected analysis day even when the occurrence timestamp has another local or UTC date.
