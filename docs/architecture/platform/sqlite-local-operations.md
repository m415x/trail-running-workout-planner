# SQLite local operations

KAN-407 defines one supported local SQLite lifecycle. Schema bootstrap and upgrade are independent from fixture seeding so the application can be exercised against a genuinely empty database.

## Bootstrap and upgrade

Run:

```bash
pn db:sqlite:upgrade
```

The same command owns both cases:

- on a fresh database, it creates the current schema and establishes canonical Drizzle migration metadata;
- on a recognized legacy or versioned database, it preserves application data, reconciles the supported history, applies pending migrations and verifies the resulting schema.

Do not use deletion of `sqlite.db` as the normal upgrade procedure. Do not use `db:sqlite:push` as a substitute for the supported lifecycle.

To verify the current database directly, run:

```bash
pn db:sqlite:verify
```

## Seed operations — KAN-832 candidate (not yet integrated)

Seeding is optional and independent of schema upgrades. All mutable progressive commands are **fail-closed** unless `SQLITE_SCENARIO_MODE=1`, `SQLITE_SEED_DISPOSABLE_ACK=1`, `SQLITE_DATABASE_PATH` identifies an existing SQLite in a recognized OS-temp `trail-running-sqlite-base-seed-*` workspace, and `TSX_TSCONFIG_PATH` locates the project tsconfig. The shared KAN-834 guard rejects the canonical developer `sqlite.db`, missing accreditation and non-disposable destinations. The scenario verifier creates its own isolated workspaces; do **not** run these commands directly on a recovered development or acceptance database.

| Command | Result |
| --- | --- |
| `pn db:seed:init` | Minimal structural Team |
| `pn db:seed:base` | Init plus ungrouped sample athletes; no groups, plans or effective sessions |
| `pn db:seed:plan` | Base plus groups, cohorts, base/variant plans and strategies; no effective sessions/prescriptions |
| `pn db:seed:demo` | Historical full `db/seed.ts` compatibility fixture; sessions and H4B shared S2/M1 prescriptions |
| `pn db:seed:acceptance` | Explicit staged demo plus local H4B actor provisioning with one accredited SQLite target; not Supabase authentication |
| `pn db:seed` | Rich historical composition: demo, race-catalog, realized-training and plan-real |
| `pn db:seed:acceptance:multiteam` | Separate explicit opt-in KAN-758 scenario, never implicit in demo/acceptance/rich |

The three rich complement scripts use the same shared accreditation guard. `db:seed:acceptance` copies the accredited target into another recognized disposable workspace and applies demo then H4B there; it publishes only after both succeed. The existing H4B collision, Team, group, memberships, identity and idempotence validations remain; production and CI are forbidden. A foreign Supabase subject string in local fixture data is **not** proof of a real Supabase account or authenticated session. The legacy provisioner retains its separate non-scenario invocation path for historical tooling; never invoke it as a substitute for accredited public acceptance.

**Intentional breaking change:** previous `db:seed:base` was the historical monolithic seed; its equivalent is now `db:seed:demo`. Historical `db:sqlite:check` base-seed coverage deliberately still targets `db/seed.ts` to preserve the legacy H4B fixture. `db:seed` remains the richer composition, not an alias for minimal base.

## Verification gate

Run the aggregate SQLite gate with:

```bash
pn db:sqlite:check
```

It executes nine isolated temporary-database scenarios: empty bootstrap, full seed, canonical base-seed regression, representative partial seeds, representative legacy upgrade to HEAD, existing-data preservation, fresh-versus-upgraded schema drift detection, safe rerun at HEAD, and recovery when the physical schema already verifies at HEAD but canonical migration metadata is only partially recorded.

The base-seed scenario executes the real `db/seed.ts` entrypoint and protects the current planning-fixture ownership contract, including the regression against multiple active microcycles for one group/date.

For that partial-metadata HEAD state, the canonical runner first verifies the physical schema. Only a database that already satisfies the HEAD verifier is allowed to have the missing canonical metadata reconciled; otherwise the normal migration path remains authoritative.

A successful migration command alone is not sufficient evidence of a healthy local database. The verifier checks physical schema invariants in addition to migration metadata.

## Pre-beta disposable developer database and H7A physical audit

KAN-772 extends the normal SQLite verifier to fail closed on H7A 0020–0025 physical author-column, FK, CHECK and index drift, alongside canonical applied-migration hash checks. The `empty` scenario now runs the same audit on a newly generated isolated database; `rerun` checks H7A physical integrity and unchanged migration rows before/after the second officially supported upgrade. `pn db:sqlite:check` remains the authoritative nine-scenario gate, including supported legacy upgrades and preservation.

During pre-beta, the developer's own `sqlite.db` is **disposable** only after an explicitly announced and approved regeneration. No verifier, routine command or test may delete it automatically. Do not modify historical migrations or invent migration metadata to conceal drift. Supported upgrades must continue preserving real data within their documented contract. Before beta, production-grade historical-data recovery requires a separately approved design and acceptance criteria.

## Recovery from an inconsistent database

If the canonical upgrade rejects the database as unrecognized or inconsistent:

1. Stop and preserve the existing `sqlite.db`; do not delete or overwrite it.
2. Run `pn db:sqlite:verify` and retain the reported mismatch.
3. Compare the physical schema and migration metadata with the reviewed state classes in [the SQLite upgrade-state audit](../../research/sqlite-upgrade-state-audit.md).
4. If the database matches a reviewed legacy state, use `pn db:sqlite:upgrade`. If it does not, treat it as an unsupported state: back up/export required application data and investigate the mismatch before any schema mutation.
5. After reconciliation, run `pn db:sqlite:verify`; use `pn db:sqlite:check` when validating changes to the lifecycle itself.

The runner intentionally rejects contradictory metadata/physical-schema states rather than guessing which representation is authoritative.
