# KAN-601 Persistence Evidence Matrix

This matrix consolidates persistence verification evidence for KAN-601 without converting static or synthetic checks into claims about real PostgreSQL execution.

| Class | Scope | Evidence | Status |
| --- | --- | --- | --- |
| PURE | Identity and lifecycle invariants expressed as focused tests and structural contracts | tests/identity/kan-616-external-identity-migration.test.ts; tests/identity/kan-617-team-membership-migration.test.ts; tests/identity/kan-619-history-preservation.test.ts | verified |
| SQLITE REAL | Historical upgrade, preservation, rerun and drift detection against disposable SQLite databases | tests/athletes/kan-615-sqlite-preservation-upgrade.test.ts; tests/athletes/kan-615-sqlite-operational-rerun.test.ts; tests/athletes/kan-615-sqlite-applied-column-drift.test.ts | verified |
| POSTGRESQL STATIC | Generated schema and SQL contracts reviewed without connecting to a live PostgreSQL database | tests/athletes/kan-615-postgres-static-migration.test.ts; tests/identity/kan-616-external-identity-migration.test.ts; tests/identity/kan-617-team-membership-migration.test.ts | verified |
| POSTGRESQL REAL | Live migration/application against an authorized PostgreSQL environment | Not executed in KAN-620. KAN-566/C14 remains out of scope and blocked. | pending |

## SQLite lifecycle coverage

The existing KAN-615 verifier set provides the required historical lifecycle evidence instead of introducing a parallel verification path.

- upgrade — tests/athletes/kan-615-sqlite-preservation-upgrade.test.ts
- preservation — tests/athletes/kan-615-sqlite-preservation-upgrade.test.ts
- rerun — tests/athletes/kan-615-sqlite-operational-rerun.test.ts
- drift — tests/athletes/kan-615-sqlite-applied-column-drift.test.ts

The broader KAN-615 SQLite suite also covers metadata, FK, index, routing, partial-state, rollback and preflight scenarios. KAN-620 records that evidence; it does not replace those tests with a new migration runner.

## Identity persistence coverage

- tests/identity/kan-616-external-identity-migration.test.ts verifies the versioned ExternalIdentityLink persistence contract.
- tests/identity/kan-617-team-membership-migration.test.ts verifies TeamMembership persistence and fail-closed transition semantics.
- tests/identity/kan-619-history-preservation.test.ts verifies non-destructive lifecycle behavior, stable IDs, cross-team isolation and preservation of sporting/economic/audit references.

## Evidence boundary

POSTGRESQL STATIC means schema/SQL inspection only.

POSTGRESQL REAL remains pending until an expressly authorized environment and operation are available. Static checks, generated SQL, snapshots, SQLite lifecycle tests and synthetic fixtures must not be reported as GREEN, PASS or verified PostgreSQL real execution.

No PostgreSQL migrations are applied by KAN-620. KAN-566 and KAN-598/C14 remain untouched.
