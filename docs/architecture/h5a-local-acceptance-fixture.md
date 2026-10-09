# KAN-607 — Local second Athlete acceptance fixture

`scripts/provision-kan607-second-athlete.ts` is a **regenerable local acceptance fixture**, not an enrollment API, migration, production user provisioner or default seed. It operates only on the disposable, already-seeded `sqlite.db`, and checks Team and group prerequisites. The source contains fixed test-specific User EPT, ExternalIdentityLink, TeamMembership, AthleteProfile, Supabase subject, email, Team and group identifiers. **None is a product contract or a legitimate authority shortcut.** All runtime H5A permissions still require authenticated H2 actor, valid active Team/TeamMembership, SELF capability and own linked AthleteProfile.

Operational behavior:
- Run `pn exec tsx scripts/provision-kan607-second-athlete.ts` for a read-only dry run; absent state reports no changes, complete state reports already provisioned.
- Run `pn exec tsx scripts/provision-kan607-second-athlete.ts --apply` **only** against the intended disposable local seeded DB to create all four linked rows atomically. Repeating the command on an intact fixture is idempotent.
- Partial, drifted or colliding rows fail closed. CI, production and `SQLITE_SCENARIO_MODE` are expressly rejected.
- Recreate disposable seeded acceptance state rather than manually mapping unknown accounts by email or reusing fixture IDs in application code. Do not invoke this script as deployment/normal product provisioning.
- Manual ALLOW → DENY → ALLOW exercises temporarily change only the fixture membership, then restore it; verify the other athlete's session and data remain isolated.

Absence of realized-training delete is separate product debt, outside KAN-607/H5A, and must not be retrofitted into this fixture.
