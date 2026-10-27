# KAN-854/S2 — Test inventory and retention policy (candidate, 2026-10-26)

## Rationale

A `pn verify --db` run reported 3443 tests, 3434 PASS, 9 FAIL. Seven persistent experimental HTTP/provenance cases failed under ordinary runner, plus one Chrome CDP preflight (which subsequently passed isolated) and one **unrelated** Drizzle Kit SQLite schema push test (not yet diagnosed). TypeScript/lint/docs PASS were operator-reported separately. **No integral GREEN.**

The feature branch introduces **63** `tests/i18n/kan-854-*.test.ts` files and **one** `tests/scripts/kan-854-t0-comparison-contract.test.ts`, as well as one KAN-853 baseline test. Ordinary `scripts/test-runner.ts` discovers every `.test.ts` under tests and batches ordinary tests under Node's default concurrency. The existing PostgreSQL-lane segregation does not automatically isolate Next dev/Chrome/network experiments.

## Inventory by reproducibility and contract

| Test group (relative to tests/i18n) | Contract and evidentiary purpose | Laboratory requirements | Retention classification |
|---|---|---|---|
| `kan-854-http-capture-chain`, `kan-854-http-observation-contract`, `kan-854-authenticated-contract-preflight`, `tests/scripts/kan-854-t0-comparison-contract` | T0/T1 deterministic validation of capture, sanitization, mandatory variant attributes | No live Next/Supabase expected; inspect each before regression designation | **Ordinary regression candidates** |
| `kan-854-b-historical-parity`, `kan-854-b-disposable-router-patch`, `kan-854-b-executable-runtime`, `kan-854-c-isolated-install`, `kan-854-real-app-preflight`, `kan-854-real-app-snapshot` | B/C package/patch provenance, tracked-source parity, isolated runtime integrity | Historical Git object, exact package resolution or isolated package install; may require network | **Laboratory / preflight, not unconditional product regression** |
| `kan-854-b-http-complete-fixture`, `kan-854-b-server-router-provenance`, `kan-854-c-server-router-provenance`, `kan-854-localhost-bind`, `kan-854-real-app-anonymous-http`, `kan-854-host-authority-matrix`, `kan-854-ipv4-complete-fixture`, `kan-854-t1-real-next-http-smoke` | T1/B/C real-app 307, Host and router module resolution | Fresh Next dev + full app snapshot, loopback bind, cold webpack compile, disposable DB/auth as applicable | **Explicit HTTP experimental lane; preserve historical outcomes, not ordinary gating without bounded readiness** |
| `kan-854-t3-*` | T3 SSR identity fixture, capability DENY, SQLite isolation, provisioning | Some deterministic isolated DB tests; some live Supabase; must classify by actual fixture | **Split: deterministic local guards ordinary; live Auth/provisioning laboratory** |
| `kan-854-t4-b-*`, `kan-854-t4-authenticated-get`, `kan-854-t4-browser-readiness`, `kan-854-t4-chrome-cdp-preflight`, `kan-854-t4-options-causal-preflight`, `kan-854-t4-real-session-form-cdp`, `kan-854-t4-session-domain-fixture`, `kan-854-t4-session-form-preflight` | T4 H2/H3/H4A, real React hydration, FormData, Server Action RSC, CDP | Many use Next dev/Chrome isolated profiles, real dedicated Supabase, exact SQLite snapshots; cumulative resource cost | **Keep deterministic fixture/contract regressions; explicit laboratory lane for browser/runtime, including historic intermediate probes** |
| `kan-854-t5-c-unpatched-authenticated-http`, `kan-854-t5-c-get-matrix` | T5 C authenticated route matrix and real Server Action, observed self-loop | Next 16.4.3 isolated package install, exact SQLite acceptance clone, dedicated Auth, cold compile, Chrome for POST test | **Explicit T5 laboratory characterization only; not stable product regression** |
| `tests/scripts/kan-853-pnpm-lockfile-baseline` | S1 package lockfile audit baseline | Exact committed manifest/lockfile | **Independent S1 contract; not subject to S2 disposal** |

**Inventory interpretation:** patterns above are a classification of purpose, not an assertion that every similarly named test has been individually executed or proved deterministic. An experiment's source may contain explicit assertions and remain valuable as opt-in laboratory evidence without acting as a release-grade regression.

## Exact failed cases and independently observed cause

- `kan-854-b-http-complete-fixture` (both hosts): `EXPERIMENT_INCONCLUSIVE: cannot characterize IPv4 bind` at 166; source captured timeout on `/` (60-second request budget) while `/es` completed login 200.
- `kan-854-b-server-router-provenance` (both): same at 195; server's loaded **raw** B router hash `3605d2d716026e4929feaddf1317f98af5cce8e5286c4c557d855c76b4c0ce9b`; normalized patch hash `53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3`. Identity assertion passed before failed HTTP requirement.
- `kan-854-c-server-router-provenance` (`localhost`): same `EXPERIMENT_INCONCLUSIVE`; `127.0.0.1` **PASS**, router hash `943b2883b0562139db6a2f4950db3b7396057c4c39209dfdfa9d6b09a4b851e9`.
- `kan-854-localhost-bind`: identical `/` timeout; `/es` login terminal. `kan-854-real-app-anonymous-http` 127 IPv4 successfully observed 307 `Location: /` for GET `/`, and `/es → / → /` loop (PASS characterization).
- `kan-854-t4-chrome-cdp-preflight`: full runner FAIL, but isolated CDP_READY Chrome/154.0.8037.98 PASS. Contention is **hypothesis**, not proven.
- Drizzle Kit isolated SQLite push: independent prior baseline test; exact file/line/error **still unknown**. Never exclude, skip, reinterpret, or modify until independently diagnosed.

## Causal findings retained

C Next.js 16.4.3 **unpatched** emitted 307 `Location: /` upon GET `/` to IPv4 `127.0.0.1`; this is exact self-redirect evidence. Emitting component is **not** identified. B historically patched 16.3.8, in authenticated `localhost` retained H2/H3/H4A and RSC POST. C authenticated `localhost` 10 GET routes terminal; Server Action response headers 200 but `ERR_ABORTED` and `loadingFinished:false` remain INCONCLUSIVE. Real refresh not exercised. `createSession` writer blocked by **KAN-858**, independent H4B issue. Full A/B/C table and source SHA are in [T5 matrix](kan-854-t5-causal-matrix.md).

## Initial narrow implementation — candidate (2026-10-26)

The ordinary runner `scripts/test-runner.ts` now uses an **exact-name, fail-closed set of five laboratory-only files**: `kan-854-b-http-complete-fixture`, `kan-854-b-server-router-provenance`, `kan-854-c-server-router-provenance`, `kan-854-localhost-bind` and `kan-854-t4-chrome-cdp-preflight` (each with `.test.ts`). These are preserved and can still be run with `pn tdd tests/i18n/<filename> --verbose`; no result is silently counted as PASS. Proof test: `tests/scripts/kan-854-lab-lane-classification.test.ts` checks exact paths, Windows separators, negative paths, and known/unknown ordinary regressions. Implementation commits: `918cc0b2ce0aca0c2870fc4d422dc9982f82b1b0`, `a2ca24cbfd5ff8b70fb4f4996e2e3d4e372634fc`.

This **does not blanket-exclude** other `kan-854-*.test.ts` files: real-app anonymous HTTP, new C GET matrix, deterministic contracts, H2/H3/H4A, etc. stay in the ordinary gate. The policy's larger inventory is a taxonomy, **not** an exclusion list. Runner `pn test:pg` and annual lanes stay unmodified. The first post-change functional gate is **pending**; a transient/expected RED may still appear in retained experiments, which must be resolved explicitly rather than silently ignored.

## Gate policy (initial proposal, partially applied)

1. Keep deterministic unit/contract/fixture tests in the ordinary gate; do not hide a real regression behind test filenames.
2. Any Next/Chrome/auth experimental lane must have an **explicit opt-in invocation** (e.g., existing `pn tdd path` or a dedicated script), preserved test source and bounded phase readiness plus per-request timeouts. Do not merely increase global timeout to mask a genuine loop.
3. Register a narrow, reviewed test-runner classification with tests for discovery/filtering semantics **only after** identifying the set of lab-only tests and checking all deterministic regressions remain in ordinary gate.
4. Preserve observational logs and Jira provenance instead of requiring repeated historical HTTP exploration to pass each full verification.
5. Diagnose Drizzle Kit completely and independently before any exclusion or code alteration. Follow `pn verify --db` on a precise candidate SHA, then docs gate, PR/CI, merge and postmerge reconciliations.

## Reduced integration candidate — 2026-10-27

This section supersedes the earlier **experimental-branch implementation** and pending-diagnosis wording above for the clean S2 integration candidate only. Historical data above remains as evidence of how the original laboratory tree evolved; it must not be read as the present branch inventory.

- Clean candidate branch: `feat/KAN-854-s2-reduced-integration` from integrated `dev@7db8331b23f8770db8169b8b0d3d91d978d463fd`; initial recoverable SHA `a626e018844b569dcff5e9cb45955c18c2f2cd3e`. The original experimental PR #73 and ref `2724544094789c440d4faa94063db1761daa2459` are retained unchanged.
- Integrated KEEP consists of the causal/control/acceptance/handoff documentation, the required HTTP-capture helper, and **four** autonomous tests: `kan-854-t0-comparison-contract`, `kan-854-http-capture-chain`, `kan-854-http-observation-contract`, and `kan-854-t3-integrated-deny-boundaries`.
- No historical Chrome/CDP/Next live-runtime tests or P1-dependent fixture tests are included. No `scripts/test-runner.ts` change or `kan-854-lab-lane-classification.test.ts` is included: there are no retained excluded laboratory files requiring special test discovery rules. The Drizzle Kit Windows path-with-spaces test fix was already integrated through KAN-853/PR #74 and is **not** independently replayed in S2.
- Earlier T3 negative/atomicity/real-provisioner and T4 domain/preflight candidates were reclassified as history-only after verifying their `KAN854_EPT_FIXTURE_DB` / P1 and browser/runtime dependencies (Jira KAN-854 comment 14424). Do not claim they are autonomous CI regressions. Their historical source/results remain recoverable in PR #73.
- Operator reported `pn tdd` GREEN for the four retained tests following the initial clean candidate (Jira comment 14449). The operator did not provide an independent local HEAD printout or full transcript; avoid assigning unwarranted exact-SHA certainty. **Full six-gate verification, final docs checker, security scan and PR review of the reduced candidate remain pending**.
- Do not extrapolate prior `pn verify --db` PASS on experimental SHA `272454409...` to this new tree; its coverage and source set differ. No Next/Zod/package/lockfile change is introduced in S2. Do not start KAN-855/S3 until S2 formally closes.
