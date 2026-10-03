# KAN-566 / T2 — Fail-closed sandbox mutation guard contracts

Status: **focused guard contracts verified**; there is still **no approved executable migration, seed, or reset CLI**.

## Boundary and safe defaults

KAN-584 provides a library boundary for a syntactically allowlisted, **local-only** PostgreSQL destination. These adapters accept dependency-injected operations; they are not operational authority for production or even for local DDL. The actual physical target must be independently confirmed before a mutation is permitted.

The recognized operation labels are `migrate` and `seed`; a request must include exactly matching `confirmation` **before** reading identity, opening or reserving a connection (depending on the adapter). A bare `confirmation: 'migrate'` string is a guard against accidental cross-operation calls **not an authorization token, proof of user consent or independent trust signal**. Callers must not construct it automatically from `operation` and claim operator permission. Explicit human approval for migration/rebuild remains separate.

All `reset` requests are rejected, even with a plausible confirmation. Unrecognized operations and cloud targets are denied, with no production URL fallback. The local reserved postgres.js adapter checks the provided independent physical pin with a query on its reserved session and releases/ends the connection in a `finally` path. Its query relies on a session marker and an independently supplied pin, but these contracts are tested with fake connections; a matching string from a callback alone is not proof of a real physical target.

This project has an independently executed **read-only** live probe in KAN-585: `pn db:sandbox:probe` returned `verified=true freshJournal=true` against local Supabase PostgreSQL (Jira 11351). That does not establish that any mutation adapter has executed on the live server. `db:supabase:migrate` is an existing generic command and **not** a certified sandbox-safe entrypoint.

## Focused evidence (operator)

On 2026-10-02, the operator reported GREEN for `pn tdd` over these six focused suites:

- `tests/sandbox/kan-584-mutation-confirmation.test.ts`
- `tests/sandbox/kan-584-operation-guard.test.ts`
- `tests/sandbox/kan-584-command-boundary.test.ts`
- `tests/sandbox/kan-584-verified-connection.test.ts`
- `tests/sandbox/kan-584-pinned-session.test.ts`
- `tests/sandbox/kan-584-postgres-reserved-driver.test.ts`

`pn tdd` runs focused tests and TypeScript checking. Commit at verification: `0153fe283dbce21c61aaadafe950bf24208c26d7`. Jira evidence: KAN-584 comment 11355.

## Follow-on ownership and gates

- **KAN-598 / T3b:** construct a **specific, reviewed** local Drizzle executor that uses the canonical 29 migrations and the already verified physical identity, preflight checks, transaction boundary and fresh journal. No DDL until the operator **separately approves** that exact execution after negative tests and SQL review. The generic callback guards here cannot replace that operational permission.
- **KAN-599 / T3c:** physical journal/hash and rollback/repeat evidence; any second reconstruction requires its own approval.
- **KAN-587 / T5:** later synthetic seed integration (no real data), subject to safe destination/operation and explicit authorization.
- **KAN-589 / T7:** bounded audited application-object reset; no generic schema reset and no managed Supabase schema deletion.
- **KAN-586 / T4:** schema, FK, indexes, checks and structural RLS validation, **not** a claim of functional auth/RLS before KAN-298.

No cloud project was created, and no migration, seed, reset or other PostgreSQL DDL was executed as part of the T2 focused GREEN evidence.
