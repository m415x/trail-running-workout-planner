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

Do not use deletion of `sqlite.db` as the normal upgrade procedure. Do not use `db:push` as a substitute for the supported lifecycle.

To verify the current database directly, run:

```bash
pn db:sqlite:verify
```

## Seed operations

Seeding is optional and separate from schema bootstrap.

```bash
pn db:seed:base
pn db:seed:race-catalog
pn db:seed:realized-training
pn db:seed:plan-real
pn db:seed
```

The composable feature fixtures live under `db/seeds/`. Automated verification also exercises focused `groups` and `competitions` feature seeds in isolation, which keeps prerequisites explicit and allows empty-state testing without implicitly loading the full fixture set.

The three specialized commands retain walkthrough data for the race catalog, realized training and plan-real comparison. Their implementation is also owned under `db/seeds/`; they are not obsolete root-level seed scripts.

## Verification gate

Run the aggregate SQLite gate with:

```bash
pn db:sqlite:check
```

It executes seven isolated temporary-database scenarios: empty bootstrap, full seed, representative partial seeds, representative legacy upgrade to HEAD, existing-data preservation, fresh-versus-upgraded schema drift detection, and safe rerun at HEAD.

A successful migration command alone is not sufficient evidence of a healthy local database. The verifier checks physical schema invariants in addition to migration metadata.

## Recovery from an inconsistent database

If the canonical upgrade rejects the database as unrecognized or inconsistent:

1. Stop and preserve the existing `sqlite.db`; do not delete or overwrite it.
2. Run `pn db:sqlite:verify` and retain the reported mismatch.
3. Compare the physical schema and migration metadata with the reviewed state classes in [the SQLite upgrade-state audit](../../research/sqlite-upgrade-state-audit.md).
4. If the database matches a reviewed legacy state, use `pn db:sqlite:upgrade`. If it does not, treat it as an unsupported state: back up/export required application data and investigate the mismatch before any schema mutation.
5. After reconciliation, run `pn db:sqlite:verify`; use `pn db:sqlite:check` when validating changes to the lifecycle itself.

The runner intentionally rejects contradictory metadata/physical-schema states rather than guessing which representation is authoritative.
