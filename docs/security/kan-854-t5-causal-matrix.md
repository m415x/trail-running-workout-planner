# KAN-854/S2 — T5 causal comparison and closure handoff (2026-10-26)

**Status:** evidence consolidated; closure/integration gates **NOT YET ATTESTED**. Experimental branch `feat/KAN-852-dependency-security`, base `dev@dfbd0018b4b9d19f9764df054535da24bf032de0` (comparison at preparation time). Do not infer approval of S3 upgrade or production rollout.

## Scope, environments, and provenance

All experiments use a disposable tracked application copy, disposable SQLite clone (source fixture immutable SHA-256 `758dc1f1f3e49bccef9bd092219018974901f8392cdb0af062c1fd2158755615`), dedicated real Supabase acceptance identity/cookies redacted, authentic Next server and HTTP on Windows/Git Bash, and `next dev --webpack`. No production dependency, lockfile or DB mutation.

| Variant | Package/patch | Compiled router SHA-256 | Provenance |
|---|---|---|---|
| A | Next 16.3.8, unpatched current baseline | Exact runtime router hash and equivalent authenticated A matrix **not supplied in T5** | `dev` / KAN-853 S1; prior T1 neutral fixtures are not full app parity |
| B | Next 16.3.8; historic patch from `5df5693f0ab5717b22bebcbea16110a7722d470a`; patch SHA-256 `6405c9217c3f38afb8070d800f6c36459927ddc3ed7c8bfd62ba32d951af1912` | `53083187795bda3c82cbfc1245928ac6cfe64a371bf6a05f5167ccf0fb5139c3` | matched disposable app, `tests/i18n/kan-854-t4-b-consolidated-boundary-trace.test.ts`; test instrumentation only in runtime copy |
| C | Next 16.4.3, **no historical patch**, installed into disposable `.tmp` runtime | `943b2883b0562139db6a2f4950db3b7396057c4c39209dfdfa9d6b09a4b851e9` | `tests/i18n/kan-854-t5-c-unpatched-authenticated-http.test.ts`; `kan-854-t5-c-get-matrix.test.ts` |

`eslint-config-next` is **not upgraded/validated** in this experimental test; S3 must independently pin/validate it and frozen-lockfile consistency. Isolated npm installation is not an S3 package-lock/frozen-install gate. Direct B–C comparison uses same copied application and authenticated source fixtures; differences in Next version, patched router and its installation procedure are deliberately explicit.

## Executed evidence and definitive status matrix

| Surface / exact scope | A (unpatched 16.3.8) | B (16.3.8 historical patched) | C (16.4.3 unpatched) |
|---|---|---|---|
| Runtime/router provenance | Historical baseline only; **INCONCLUSIVE** for comparable authenticated matrix | **PASS** patch/router hashes | **PASS** package 16.4.3, router SHA, no patch |
| `localhost` authenticated GET `/dashboard/sessions/new` | **INCONCLUSIVE** matched evidence missing | **PASS**, 200 terminal | **PASS**, 200 terminal |
| `localhost` root/default ES, EN, dashboard, login (ten GET paths) | **INCONCLUSIVE** | **PARTIAL**, authenticated route evidence only; no identical ten-path B run asserted | **PASS**, 10/10 terminal, finite 307 chains, no loops |
| `127.0.0.1` root `/`, default ES `/es` | Historical KAN-625 evidence of 307 self-loop in older dev; **not identical A fixture** | Historical KAN-849 GREEN from its own controlled branch; **not a rerun of this exact matrix** | **FAIL**, redirect-cycle detection on `/` (307) and `/es` (307, 307); exact Location/self-target and 307 emitter **unproven** |
| `127.0.0.1` `/en` and remaining GET matrix | **INCONCLUSIVE** | **INCONCLUSIVE** exact matched run | **INCONCLUSIVE**, `/en` timed out, later paths not executed |
| Real SSR identity and H3/H4A on session form | **INCONCLUSIVE** comparable run | **PASS** authenticated, team resolved, groupSameTeam and H4A planning.manage allowed | Authenticated SSR and form **PASS**; server-side H3/H4A C decision **not instrumented separately** |
| React date / microcycle FormData | **INCONCLUSIVE** | **PASS** group/microcycle received by server | **PASS** client DOM, FormData |
| Authentic Server Action POST RSC headers `localhost` | **INCONCLUSIVE** | **PASS**, correlated HTTP 200, `loadingFinished:true` | **PASS** headers HTTP 200; **INCONCLUSIVE** completion (`net::ERR_ABORTED`, `loadingFinished:false`) |
| Persisted `createSession` success and redirect | **BLOCKED** by product validation debt | **BLOCKED**, 0→0 session/prescription | **BLOCKED**, 0→0; **KAN-858** |
| Cookie/refresh | **NO ACCREDITED refresh** | Cookie presence/session continuity observed; refresh **NOT exercised** | `NEXT_LOCALE` cookie **names** in GET matrix; refresh **NOT exercised** |

C `localhost` route matrix exact paths: `/`, `/es`, `/en`, `/dashboard`, `/es/dashboard`, `/en/dashboard`, `/dashboard/sessions/new`, `/login`, `/es/login`, `/en/login`. Examples: `/` 307→`/es/dashboard` 307→`/dashboard` 200; `/en` 307→`/en/dashboard` 200. All ten terminate; no authentication token or cookie value emitted. In C `127.0.0.1`, Next HTTP readiness and Supabase authentication both PASS, then initial session form reentry returned 307, `/` and `/es` were classified loop by URL-visited guard, `/en` ended with timeout. The guard does **not** identify the component that emitted 307 and does **not** prove an exact self-redirect without Location header evidence. `DEP0190` is an isolated npm-shell warning and not a demonstrated Next runtime vulnerability.

## Independent product blocker

KAN-854 Jira comment **14354** and KAN-858 record a **preexisting H4B team-scope defect**. In `app/actions/session-actions.ts`, `validatePrescriptionReferences()` compares persisted Group Team against `CURRENT_TEAM_ID='team_1'` after H3/H4A has authorized the true Team; for other Teams this returns `groupNotFound`. KAN-858 is retained independently and related to KAN-675/T9, KAN-676/T10, KAN-680/T14. No S2 fix; do not treat missing persistence as Next regression.

## Causal decision for KAN-855/S3

**16.4.3 unpatched alone does not eliminate the observed 127.0.0.1 redirect loop.** Candidate Next.js `16.4.3` remains viable **conditionally**, proven for authenticated `localhost`, not certified for loopback or release.

S3 shall first identify the exact 307 emitter from bounded Location/Host/forwarded-host and rewrite evidence, using authentic HTTP; then implement the minimum compatible repair if necessary. Preserve `localePrefix:'as-needed'`, `defaultLocale:'es'`, canonical ES/EN, H2/H3/H4A and auth cookie/refresh behavior. **Do not blindly port** the Next 16.3.8 patch. Require RED/GREEN HTTP both hosts and locales, Next/eslint-config-next precise versions, frozen lockfile, build/TS, auth/refresh and rollback. Stop/escalate if compatible correction needs a material architectural decision; KAN-858 remains independently blocked.

## Execution and exit-gate honesty

Evidence: historical patch/router identity `5df5693f0ab5717b22bebcbea16110a7722d470a`; B consolidated test commit `62e33a91c1703a343e5a40211049070a33f7fb70`; C authenticated test `c7e6e7a1dc955f7b21608685712af6e9baacccf7`; C GET matrix baseline `48a4ac5436669747411cf1c9bf9e025249f87d57`, loopback stage instrumentation `3989d2e82f9ccd606c4276d7285b16b984f2fd6a`. Jira KAN-854 comments `14354`, `14366`, `14367`, `14371`, `14374`, `14376`. Outcomes above come from operator-shared runner logs, **not** an attested full candidate gate. The latest C 127 test exited failed/timeout; a FAIL-routing finding is not global suite GREEN.

**Unmet closure prerequisites:** verify focused runner Node and TypeScript outcomes on exact candidate SHA, check the very large experiment-only diff against Harness v2 retention requirements (no secrets/fixture credentials in repo, no redundant brittle tests), run applicable full `pn verify --db` if contractually required, `pn docs:handoff:check` on docs SHA, perform PR review/CI/merge only with accredited gates, check post-merge exact SHA and then update current integrated handoff/Jira state. Do not mark S2 Finalizada or S3 unblocked for implementation before this evidence. Preserve historical branches and local test materials.
