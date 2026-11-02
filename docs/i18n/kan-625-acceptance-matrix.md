# KAN-625 — ES/EN routing and Server Actions: acceptance matrix

**Status:** KAN-851/T5 premerge documentation; not integrated in dev. Product baseline 0a06fef4f166e1c15528a14324c2f50b3cf4cf44, Next.js 16.4.3, next-intl 4.13.7; Spanish default and localePrefix 'as-needed' preserved.

## Causal scope

KAN-625 originated from repeated HTTP 307 redirects affecting default Spanish routes and next-intl/Next rewrites on Next.js 16.3.8. KAN-849/T3 owns the product correction; KAN-850/T4 is regression acceptance, not a new routing fix. The available operator evidence does not independently isolate which Next.js layer emitted each original 307. Legitimate intermediate 307 responses are compatible with a finite, correct redirect chain.

## T4 acceptance matrix

| Scope | Jira comments | Finding and limit |
| --- | --- | --- |
| Anonymous ES/EN and cookies | 14572 | Terminal public/login chains, no infinite loop; manual Cookie headers cannot prove real persisted-cookie precedence. |
| H2 Coach authenticated ES/EN | 14577, 14590, 14592 | Protected HTTP 200, correct locale, no login bounce. |
| H3 Team valid, missing, invalid, revoked | 14580, 14583, 14585, 14586 | Focal identity/team acceptance; not exhaustive combinations. |
| H4A and HTTP no-write | 14573, 14597, 14598 | Product H4A planning.manage decision denied and SQLite unchanged; HTTP 500 not a causally demonstrated in-request H4A DENY or controlled user-facing error. Accepted nonblocking limit. |
| Refresh/cookies | 14589–14592 | Simulated refresh contract and observed real authentication-cookie change with continued authenticated access; token cryptographic rotation/new expiry not independently established. |
| Progressive HTML actions ES/EN | 14593–14594 | Authentic HTML form POST, HTTP 303, localized redirect, one workout inserted per operation; distinct from hydrated RSC. |
| Authenticated deep links / invalid Team | 14595–14596 | ES/EN deep GET HTTP 200; invalid-Team POST no-write HTTP 500, not a controlled error UX claim. |
| Hydrated React Server Action ES/EN | 14599 | Actual AthleteForm/updateAthlete POST, Next-Action, HTTP 200 text/x-component, X-Action-Redirect to /dashboard/athletes;push and /en/dashboard/athletes;push, final browser navigation confirmed. Independent snapshots: one athlete_profiles row changed per action, all other tables identical, SQLite integrity OK, FK 0. |
| Contractual disposition | 14600 | KAN-850/T4 Finalizada within documented evidence limits. |

## Operational fixture incident

Initial RSC ES mistakenly ran against disposable H4A fixture UKXg1d; the changed phone value was later found there and intended SQktEe was unchanged. Prior H4A snapshots remain historically valid, but UKXg1d is no longer its pristine H4A state and must not be reused for acceptance. The valid RSC-1 sequence used SQktEe, a copied temporary launcher validating exact temporary fixture identity, Coach identity/membership, preflight, and independent before/after snapshots. Local launcher and DevTools evidence are ignored artifacts, not CI. Never publish credentials, cookies, HAR or personal values.

## Separation of evidence

Versioned ordinary tests: 640f47b8044ffeb45731b5a66c89d64fe3dacaf4 (response oracles and runner isolation), ae8bf18daab5547288eee454982acfc58e9cfe5d (simulated proxy refresh). These do not implement or prove live Supabase acceptance. Operator-reported pn verify --db PASS 6/6 on ae8bf18d, total 357941 ms, is candidate local evidence, not postmerge CI. KAN-851 owns final documentation, PR/review/merge, integrated gates, Jira and operator-mediated worktree disposition.