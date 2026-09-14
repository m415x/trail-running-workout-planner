# KAN-290 focused execution evidence

Date: 2026-09-13 (America/Buenos_Aires). Branch: `h-23-realized-training`.

## Reviewed remote baseline

Cloned the requested branch from GitHub at `2116e42`. Read the repository rules, current handoff, realized-training audit, capture contract and changes from KAN-286 through KAN-290 before editing. Relevant baseline commits:

- KAN-286: `0dfffeb`, `8c6fa66` — persistence mapping and evidence.
- KAN-287: `c14657c` — atomic durable repository.
- KAN-288: `e5a76c4`, `bfe1f00`, `9800945` — authoritative linkage.
- KAN-289: `b0111b9` — free workout coverage.
- KAN-290: `b644225` through `2116e42` — client contract, action and UI.

Identified missing occurrence time, INTEGER duration, two-decimal duration rounding, create masquerading as edit, and a reset that changed only local display state.

## Commands and results

Commands below ran from the checkout root. Direct Node entrypoints invoke the installed locked project tools; the host's pnpm wrapper attempted network verification even for offline/exec commands. Node 24.19.0, pnpm 12.4.1, Drizzle kit 0.31.10, SQLite 3.53.4.

| Command / probe | Observed result |
| --- | --- |
| `git clone --branch h-23-realized-training --single-branch https://github.com/m415x/trail-running-workout-planner.git trail-running-workout-planner` | Completed after network permission. |
| `pnpm install --frozen-lockfile --store-dir ../.pnpm-store` | Installed 873 packages; lockfile unchanged. |
| `node node_modules/drizzle-kit/bin.cjs generate --config=drizzle.sqlite.config.ts --name=baseline` | Generated SQLite baseline from pre-change schema (35 tables). |
| `node node_modules/drizzle-kit/bin.cjs generate --config=drizzle.sqlite.config.ts --name=realized_training_timing` | Generated rebuild; inspected and corrected SELECT of missing column to NULL. |
| `node node_modules/drizzle-kit/bin.cjs generate --config=drizzle.supabase.config.ts --name=realized_training_timing` | Generated 0014 + snapshot/journal, only two intended ALTER statements. |
| `git commit -m "feat(KAN-290): migrate realized occurrence time and fractional duration"` | `474fe78`: schemas and reviewed migrations versioned before local application. |
| `node node_modules/drizzle-kit/bin.cjs check --config=drizzle.sqlite.config.ts` | Exit 0. |
| `node node_modules/drizzle-kit/bin.cjs check --config=drizzle.supabase.config.ts` | Exit 0. |
| Fresh local `sqlite.db` initialized with reviewed `0000_baseline.sql` through better-sqlite3 | Completed; existing user databases were not modified. |
| `node --import tsx scripts/migrate-realized-training-timing-sqlite.ts` | Exit 0; local migration verified. |
| `node --import tsx db/seed.ts` | Exit 0. |
| `node --import tsx db/seed-race-catalog-fixtures.ts` | Exit 0. |
| SQL count + `PRAGMA table_info(workout_logs)` + `PRAGMA foreign_key_check` | 24 logs / 24 null occurrence times; duration REAL, performed_at nullable TEXT/no default; date/logged_at required; 0 FK violations. |
| `node --import tsx --test tests/realized-training/*.test.ts tests/readiness/*.test.ts` | **62 passed, 0 failed**, including real repository round-trip, sidecar failure rollback, legacy migration preservation and migration rollback/replay. |
| `node node_modules/next/dist/bin/next typegen` | Exit 0; generated required route types in the fresh checkout. |
| `node node_modules/typescript/bin/tsc --noEmit` | Exit 0 after route type generation and the migration helper typing correction. |
| Focused `node node_modules/eslint/bin/eslint.js` over changed TS/TSX files and realized-training modules/tests | Exit 0, no output (0 errors/warnings). |
| `node --import tsx db/supabase/verify.ts` | Exit 1: `SUPABASE_DIRECT_URL` is not configured. Remote migration was **not** attempted/applied. |

Focused lint targets: `app/actions/realized-training-actions.ts`, the changed workout components/hooks, `lib/realized-training`, `lib/readiness/realized-training.ts`, `tests/realized-training`, `db/schema.ts`, `db/seed.ts`, `db/supabase/schema.ts`, `db/supabase/verify.ts`, the SQLite migration helper/runner, `drizzle.sqlite.config.ts`, and the three changed training type files.

Initial sandboxed tool execution failed on Windows `uv_os_get_passwd` (ENOMEM); approved execution outside the restricted environment succeeded. Initial migration tests exposed incomplete test fixtures (user columns and athlete DNI), which were corrected before the final passing run. An initial typecheck also identified generated route types missing from the fresh checkout and a helper return type that required narrowing; these are resolved.

## Pending evidence and next work

- Supply the location of the existing project's `.env.local` without pasting credentials; then apply 0014 and run the strengthened Supabase verifier. No fresh 34/34 RLS or actual PostgreSQL decimal round-trip is claimed.
- Browser walkthrough and full story gate/build have not run. This is focused implementation evidence, not KAN-258 closure.
- Check manual capture, reload, known zero/unknown, seconds, rejected save/input retention and date/time across UTC midnight in the walkthrough.
- KAN-290 remains open pending deployment and manual evidence. See [timing contract](../architecture/realized-training-timing.md) for explicit limits and deferred tasks.
