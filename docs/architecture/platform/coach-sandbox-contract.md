# KAN-566 — Coach PostgreSQL sandbox destination contract

Status: T1 draft, 2026-10-02. This document does **not** assert that an external sandbox exists or that a real PostgreSQL server has been authenticated.

## Authority and isolation

- Follow `AGENTS.md` and `docs/agent-harness.md`; development integration is `dev`.
- The primary local application runtime remains SQLite. The production-reserved Supabase destination is never an allowable sandbox target.
- A separate Free project is a future **option**, not an allocated resource: the available project quota, prices and billing must be checked, then its creation approved separately.
- T1 adds a **pure inspection** boundary at `lib/sandbox/sandbox-destination.ts`. It performs no database operation and never logs a connection string or password.
- In T2, **before** any migration, seed or reset, require an independent, authenticated physical-project identity check and authorization for the exact operation. A matching URL or mutable environment variable alone is **not** proof of project identity. Refuse operations if identity cannot be established. The allowlist must come from trusted server-only configuration.

## Approved target descriptor candidates

| Kind | Endpoint contract | Approval boundary |
| --- | --- | --- |
| Local | `postgresql://postgres:<secret>@127.0.0.1:54322/postgres` | Accept structural inspection; Docker/CLI and PostgreSQL identity checks belong to T2/T3 |
| Cloud | PostgreSQL direct endpoint `db.<approved-ref>.supabase.co:5432/postgres?sslmode=require` with explicit exact project ref allowlist | No remote provisioning/connection/mutation authorized yet |
| Anything else | Rejected | Never fall back to production or an implicit default |

The inspector produces a non-secret descriptor without the original URL. It does not return a reusable authenticated connection, nor does it enable data mutations.

## Threat cases

- Missing kind/URL; unknown kind; noncanonical local host or port; unexpected database or username.
- Hostname suffix tricks, project-ref mismatch, unsupported URL parameters, TLS downgrade and query-string injection.
- Production credentials presented as an allegedly local sandbox; errors must never include secrets.
- Runtime environment variables cannot bypass T2 checks. No browser-side or `NEXT_PUBLIC_` credentials.

## Operational staging

1. **T1:** Pure syntax and allowlist inspection, documented rejection contract; focused tests.
2. **T2:** Trusted authorization, server-only secrets, actual destination identity verification, action-specific fail-closed mutation guards, negative tests.
3. **T3:** Isolated Supabase CLI/Docker lifecycle and existing Drizzle migration journal (no second application migration authority).
4. **T4/T5:** Physical PostgreSQL verification and explicitly synthetic deterministic seed.
5. **T6/T7:** Only Group list/create/edit/reload and restricted logical reset; all other Coach/Athlete PostgreSQL coverage remains unverified.

An operation requiring a cloud instance must stop until quota, pricing, target identity and explicit provisioning authorization are obtained. There is no automatic cloud project delete and no broad managed-schema reset.

## T2 local-only mutation gate — implementation stage (KAN-584)

`authorizeSandboxMutation` rejects all cloud mutations, all resets and
unknown operation names before invoking any caller-supplied mutation. Only
`migrate` and `seed` are recognized **for the local sandbox**, and each must
pass both URL inspection and an identity callback reporting the exact expected
database name, local environment marker and absent cloud project reference.
Connection/driver errors are normalized so passwords cannot appear in
diagnostics. Negative tests explicitly check non-execution on mismatches.

**Limitations:**
- The physical identity callback is injectable for tests; it is not yet wired
  to a real, authenticated PostgreSQL connection. No physical identity query
  or actual migrate/seed is claimed as executed in this stage.
- The callback that observes identity and the callback that mutates must be
  wired against the **same verified connection/transaction** in T3. Do not
  assemble independent connections and treat this guard as sufficient to
  prevent time-of-check/time-of-use mismatches.
- The existing direct `db:supabase:migrate` command is **not** intercepted by
  this function. Until guarded CLI integration is implemented and tested,
  operators must not execute direct database-changing commands against any
  cloud endpoint under the KAN-566 pilot.
- The local Supabase CLI port shown here is an explicitly authorized *target
  shape* for the pilot, not proof of a currently running local stack.
- Reset remains denied regardless of any confirmation text until T7 defines
  and tests a bounded object allowlist, actual destination identity and
  operation-specific confirmation. No cloud deletion or managed-schema reset.

## T2 command boundary (KAN-584)

`scripts/coach-sandbox-db.ts` exports `runCoachSandboxOperation` as a **library boundary**, not as an executable CLI. It rejects missing URLs, resets and unknown operations before forwarding to the connection-bound identity guard. There is no production or cloud fallback and no database operation is run by importing this file. The pre-existing `pn db:supabase:migrate` script is unchanged and **not secured by this boundary**. Creating a working migration or seed command requires a separately reviewed physical identity mechanism and integration; do not execute the legacy direct migration command as a Coach sandbox operation.

## T2 pinned PostgreSQL identity validator

`verifyLocalSandboxPhysicalIdentity` now compares a query-provided database name, local sandbox marker and PostgreSQL cluster system identifier against a separately trusted pin. An absent pin is rejected **before** the query; mismatches and database driver errors fail closed without echoing connection details. The cluster identifier must be independently obtained and approved, not copied from the target query response. Tests use an injected identity reader: **no actual SQL query, running local Supabase, or secured Drizzle CLI entrypoint is implied**. Those integration boundaries remain pending under T2/T3. Existing production deployment commands are unchanged.
