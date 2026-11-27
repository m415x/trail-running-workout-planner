# KAN-885 — Local acceptance Next.js launcher (Windows/Git Bash)

## Purpose and boundary

Run the **unchanged Next.js application** locally against one **existing, independently prepared, disposable** SQLite database. `pn acceptance:dev` is **not** a database initializer, migration runner, seeder, Supabase account creator, or identity provisioner. It performs structural/integrity read-only preflight and starts Next on loopback. Real H2 Supabase SSR login and H1/H3/H4A application authorization remain in production application boundaries.

## Preconditions

- Windows 11 / Git Bash in the KAN-885 worktree; Next.js stopped and chosen port available.
- Dependencies installed according to the repo's normal setup.
- Worktree-local, ignored `.env.local` populated **by the authorized operator** with the correct public Supabase Auth configuration and whatever other approved runtime configuration is needed. Next reads `.env.local` during startup. Do not commit secrets or automatically copy another worktree's full environment.
- An accredited canonical SQLite under an OS-temp `trail-running-sqlite-base-seed-*/sqlite.db` directory, migrated/seeded externally as needed. Never select any worktree's operational `sqlite.db` or a fixture with stale migration journal. The launcher does not upgrade a stale fixture.

## Start / restart

From the worktree, run:

```bash
pn acceptance:dev --db "C:/Users/<operator>/AppData/Local/Temp/trail-running-sqlite-base-seed-<fixture>/sqlite.db"
```

On successful explicit selection, the canonical disposable path is saved to the ignored worktree-local `.acceptance-dev.local.json`. Subsequent terminals may use `pn acceptance:dev` without `--db`; each startup repeats the SQLite preflight. `--port 4173` optionally selects another available loopback port (default: 3000). `pn acceptance:dev --help` is side-effect-free. Next binds `localhost` to avoid the observed Next 16 / next-intl numeric-host redirect loop; browse via `http://localhost:3000` for the default port.

Stop interactively with **Ctrl+C**. The Windows runner terminates its owned child tree; do not use blanket `taskkill` or clean unrelated processes. Check the actual terminal, process tree and port on failure before retrying.

## Authentic acceptance identities

An unauthenticated visitor is redirected to localized login. A real Supabase account **without an EPT ExternalIdentityLink in the selected SQLite** receives the expected `unlinked` rejection; this is not a launcher failure. For a positive Coach dashboard smoke, use a separate fixture and existing, approved KAN-855 tools **outside the launcher**: `scripts/kan-855-disposable-ssr-fixture.ts`, followed by read-only `scripts/kan-855-provision-authenticated-ept.ts verify`, explicit authorized `apply`, and post-apply `verify`. That provisioner requires the already verified **dedicated** Supabase Auth test account and its guarded temporary target; it does not create a Supabase account. Never log IDs, credentials, session cookies or tokens. Never use protected KAN-879 assets or substitute synthetic H4B subjects for real Supabase authentication.

## Safety and evidence

Preflight checks the approved temporary location, physical schema, migration metadata and SQLite integrity. It does not verify that an arbitrary login will be authorized. Saving the selection does not persist a subject or credentials. No seeding/migrations/identity mutation occur inside the launcher. Inspect ignored files before any worktree retirement; preserve the fixture, `.env.local`, local selection and relevant evidence as operator-owned resources.

KAN-885 operator acceptance (2026-11-27): real Next launch and restart without repeated `--db`; localized login; genuine Supabase authentication with expected H1 unlinked DENY on a fresh schema-only fixture; separate KAN-855 fixture provisioned with verified dedicated identity and successful EPT login reported. Ctrl+C left port 3000 available and the four observed worktree Node PIDs absent. Acceptance and developer SQLite files preserved their exact SHA-256 across a start/stop cycle with no residual WAL/SHM. Local comprehensive `pn verify --db` reported six PASS stages after two test-only contractual corrections. This is operator evidence, not postmerge CI; explicit Coach dashboard URL and HTTP status were not captured in the provided record.

## Deferred developer-experience work (outside KAN-885)

Worktree bootstrap currently needs manual environment configuration, independently prepared disposable SQLite, canonical migrations/seed and explicit identity provisioning. Investigate an **idempotent opt-in first-time bootstrap** separately; do not silently copy secrets or SQLite, or expand `pn acceptance:dev` into provisioning.
