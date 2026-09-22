# SQLite upgrade-state audit

KAN-424 defines the state-recognition contract for the canonical SQLite upgrade
runner. Migration execution belongs to KAN-425.

## Evidence

The repository currently has three SQLite evolution paths:

1. A versioned Drizzle chain in `drizzle/sqlite`, currently `0000` through
   `0005`.
2. Historical imperative migration scripts exposed as independent package
   commands.
3. `db:push`, which mutates the physical schema without establishing the same
   versioned migration history as the canonical chain.

The field-performance sequence demonstrates why physical schema and migration
bookkeeping must be verified together: `0003` creates
`field_performance_tests`, `0004` rebuilds it while adding the event foreign
key, and `0005` adds `recorded_by_user_id`.

Therefore a successful migration command is not, by itself, evidence that an
existing local database matches HEAD.

## Supported state classes

- **fresh**: no application schema. Bootstrap with the canonical versioned
  chain. Seeding is separate and optional.
- **versioned**: migration metadata and the observed physical schema are
  mutually consistent with a known point in the canonical chain. Apply pending
  migrations and verify HEAD.
- **legacy push-managed**: an existing database has no trustworthy canonical
  history but its physical shape matches a specifically recognized historical
  state produced by `db:push` or a reviewed one-off migrator. Preserve data,
  reconcile that known shape, establish canonical state, then verify HEAD.
- **unrecognized/inconsistent**: metadata and physical schema disagree, or the
  physical shape does not match a reviewed legacy state. Reject automatic
  mutation and direct the developer to the documented recovery path.

## Representative upgrade fixtures

Automated verification must cover at least:

1. a fresh empty database;
2. a canonical versioned database behind HEAD;
3. a recognized legacy/push-managed database with existing application data;
4. a deliberately inconsistent database whose migration metadata claims a
   newer state than its physical schema.

The fourth fixture is the regression model for the KAN-407 incident class. For
field performance, a concrete detectable mismatch is metadata at/after
`0005` while `field_performance_tests.recorded_by_user_id` is absent.

## Safety invariants

The supported mechanism must not delete `sqlite.db` as a normal upgrade
strategy. Existing application data must survive supported upgrades. A rerun
at HEAD must be safe. Unknown or contradictory states must fail before
destructive mutation. Schema bootstrap must remain independent from seeds so
empty-state UI can be exercised intentionally.
