# KAN-854/T1 — Historical control recovery and experimental boundary

T0 GREEN operator-reported at `9cd182f8682d232a2cb834bcb47035edc6af2da5` for `pn tdd tests/scripts/kan-854-t0-comparison-contract.test.ts`; recorded Jira KAN-854 comment 14063. This establishes configuration characterization only, not any HTTP assertion.

## Historical B (preserved, not integrated)

The source-control branch `feat/KAN-849-pnpm-native-patch-candidate@5df5693f0ab5717b22bebcbea16110a7722d470a` contains `docs/handoffs/kan-849.md`. Functional patch commit `a3ca597e51752093fc8c49e623be19201e549b8b`, `patches/next@16.3.8.patch` SHA-256 `6405c9217c3f38afb8070d800f6c36459927ddc3ed7c8bfd62ba32d951af1912`, installed compiled router SHA-256 `53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3`. The historical test `tests/i18n/kan-849-http-reentry-causal-red.test.ts` exercises real Next dev HTTP `/`, `/dashboard/athletes`, `/es/dashboard/athletes`, `/en/dashboard/athletes` for 127.0.0.1/localhost; `kan-849-http-reentry-boundary.test.ts` tracks proxy reentry; `kan-849-authenticated-http-guards.test.ts` checks observable H2/H3/H4A and SQLite snapshots. A historical local GREEN does not automatically certify the present `dev` or future Next 16.4.3.

## Current gap and required adaptation

Those test/fixture files (`tests/i18n/kan-848-http-fixture.ts`, KAN-849 tests) are **not present on the current security branch** (GitHub checked by exact path). They are available on the historical branch and must not be silently transplanted as production behavior or automatically run against incompatible application revisions. In T1 prepare a small version-neutral HTTP harness using the existing historical fixture *as reference*, preserve historical source untouched, pin runtime build hashes, and separately validate that fixture assumptions still apply to the current application. Distinguish historical observed B from a new matched-fixture B; if equivalence cannot be established classify cross-commit comparisons INCONCLUSIVE.

## T1 run acceptance

- Every observed row records `variant`, app commit SHA, Next resolved version, exact compiled-router file hash or presence of native patch, command, Node/pnpm, hostname/bind, requested URL, method, status, Location, X-Action-Redirect, sanitized cookie summary and redirect chain. Never capture raw bearer values.
- A/B/C must share compatible application code, i18n/proxy config and fixture identity for causal framework claims. A historical branch with different application code is only a reference/control until parity is demonstrated.
- Prove real HTTP readiness, run bounded timeouts, separate experimental setup failure from framework regression. A 307 is not itself failure: distinguish intended auth/locale redirect from 307 self-loop, and inspect visible denial for auth.
- Do not claim T1 GREEN until a new operator run is recorded; do not run S3 dependency upgrade or modify `dev`.

## Next action

Implement/publish the version-neutral capture harness plus its focal test with Harness v2; then request only `pn tdd <test>`. Historical checkpoint remains available for audit without re-running the original tests.
