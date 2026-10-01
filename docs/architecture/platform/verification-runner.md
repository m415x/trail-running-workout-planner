# Local verification gates — KAN-568

The supported optional closure tool is `pn verify`. It complements, but does not change, focused RED→GREEN with `pn tdd:red <test-file>` and `pn tdd <test-file>`. Unlike focused TDD, `pn verify` is intended for **story-level validation**, after the implementation is ready.

## Modes

| Command | Gates / presentation |
| --- | --- |
| `pn verify` | Sequential `pn test`, `pn tsc`, `pn lint`, `pn build`, `pn i18n:check`. Compact, bounded failure excerpts and per-stage timing. |
| `pn verify -v` / `pn verify --verbose` | Same gates with full inherited stdout/stderr while each command runs; final summary remains visible. |
| `pn verify --db` | Default gates plus `pn db:sqlite:check` after i18n. |
| `pn verify --db -v` | All local gates, full verbose output. |

The orchestrator completes all selected stages even when one fails, then returns exit status `1` when any stage failed and `0` only when all succeeded. Unsupported flags (including `--supabase`) yield a usage error and exit `2` without launching stages.

## Local SQLite scope

`--db` **reuses** the existing `db:sqlite:check` script as-is. Its maintained scenario matrix covers `empty`, `full-seed`, `base-seed`, `partial-seed`, `upgrade`, `preservation`, `drift`, `rerun`, and `partial-metadata-head`. Consult [SQLite local operations](sqlite-local-operations.md) for authoritative upgrade and fixture boundaries.

The verifier does not bootstrap, seed, upgrade or migrate the user's live SQLite database on its own. The opted-in existing SQLite scenario runner may create temporary databases/fixtures according to its documented lifecycle; review that runner when changing its scenarios.

## Remote services and evidence

`pn verify` never calls `db:supabase:migrate`, `db:supabase:verify` or any remote deployment operation. Do not treat its success as proof that remote Supabase schema migrations, RLS, security or deployment have passed. Obtain separate, environment-specific remote evidence when a story requires it; never infer that `--db` checks Supabase.

Likewise a compact PASS means only that invoked commands exited successfully; it does not substitute for manual Coach/Athlete journeys or E2E verification that a story explicitly requires.

## Diagnostics and Windows/Bash

The CLI runs the package manager in sequence. When `npm_execpath` identifies pnpm's JS launcher, it invokes that launcher with the running Node executable to avoid Windows shell ambiguity. Otherwise it uses the local `pnpm` executable with the necessary Windows command handling. Normal output is captured and summarized; only bounded matching error lines, fallback tail text, or a no-output diagnostic are printed for failed stages. Use `-v` to observe all command output for diagnosis. The local operator uses Bash, but the runner must also support the underlying Windows process environment.

## Regression / operational follow-ups

- `tests/tooling/verification-runner.test.ts`: options, selected gates, PASS/FAIL, durations.
- `tests/tooling/verification-cli.test.ts`: CLI wiring, no change to TDD, return codes.
- `tests/tooling/verification-stage-process.test.ts`: Windows/Linux launch and failure evidence.
- `tests/tooling/verification-diagnostics.test.ts`: bounded excerpts and empty/no-pattern fallback.

**KAN-473 close blocker:** KAN-569 must resolve the two pre-existing MapLibre KAN-561 benchmark failures. Until then, a red `pn verify` test phase truthfully reports the failing full test suite; it is not a KAN-568 CLI defect. KAN-508 follows KAN-568 and retains its independent KAN-359 typography contract issue.
