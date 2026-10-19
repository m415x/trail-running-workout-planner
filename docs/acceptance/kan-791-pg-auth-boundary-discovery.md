# KAN-791/T6-D — Server-owned identity backend discovery

## Runtime graph (verified on feat/KAN-789-authorized-snapshot-sql)
- POST login: `app/actions/auth-actions.ts` -> Supabase `signInWithPassword` -> `authenticateEptLogin` -> `readSupabaseServerSessionState` (H2 verified) -> `resolveAuthenticatedEptIdentity` with `createExternalIdentityLookup` (currently SQLite) -> `resolveNextServerAudience` (currently SQLite Active Team and TeamMembership) -> `resolveAudienceLoginDestination`.
- Existing GET /login: `readEptSessionAccessState` -> same lookup, same audience, `resolveExistingSessionLogin`.
- Dashboard parent layout: `requireAuthenticatedEptSession` -> same lookup; `resolveNextServerAudience` -> `resolveCoachShellAudience` -> `createCoachNavigationNextServerProjection` (currently SQLite H4A evidence).
- Active Team: `createActiveTeamNextServerContext` -> shared `createActiveTeamServerContext` -> `resolveActiveTeamContext`; membership loader is currently SQLite. Cookie is a selection hint, membership validated every request. Logout invokes `clear()`.
- PostgreSQL review leaf already verifies Supabase claims and User EPT/ExternalIdentityLink and current TeamMembership inside the same PostgreSQL transaction, before H4A/CAS.
- `proxy.ts` carries Supabase auth refresh and locale; it is not an alternative EPT identity repository.

## Contract-compatible minimum
1. A *single server-only*, deployment-configured identity backend selector (e.g. `EPT_IDENTITY_BACKEND=sqlite|postgres`). Missing setting retains SQLite. Invalid setting fails closed, never silently falls back.
2. Reuse `resolveAuthenticatedEptIdentity`, `authenticateEptLogin`, `readEptSessionAccessState`, `resolveActiveTeamContext`, `resolveAudienceDestination` and existing server-side Supabase Auth untouched.
3. Inject backend-consistent providers for ExternalIdentityLink/User, TeamMembership, Active Team and H4A Coach navigation evidence. Avoid a PostgreSQL-only login that is followed by SQLite-backed DashboardLayout.
4. PostgreSQL reads must validate current non-deleted records and scope with the existing H1/H3/H4A semantics. PostgreSQL errors and unlinked subjects are terminal for that request: no SQLite fallback.
5. No client-controlled backend parameters/cookies. A cookie can identify a Team only after current backend membership is checked. Existing logout clears it.
6. PG-only Coach acceptance must use the same backend consistently in login, existing-session entry, dashboard shell and review leaf. Other SQLite deployments remain unchanged.

## Security/compatibility checks
- Supabase H2 remains authoritative; email alone cannot link User EPT.
- No synthetic tokens, forged cookies, extra login route, blanket permissions, or dual-write to SQLite.
- Existing `createCoachNavigationNextServerProjection` currently consumes SQLite H4A source; it requires a PostgreSQL-backed evidence source (or fail-closed navigation) rather than leaking SQLite navigation evidence into a PG session.
- Existing shared Active Team context is reused, with only its membership loader parameterized.
- Keep PG fixture intact: 53/239, fingerprint 9287b13bf294a4e920398f401b4bb95d7a587aaa03e657a60c7392e90c95eeed.

## RED→GREEN sequence
- A: Pure selector and server integration call-site contract, invalid config DENY, SQLite regression.
- B: PostgreSQL lookup & team membership/audience SQL with real PG disposable tests, revoked/missing/wrong Team.
- C: Dashboard H4A navigation and existing-session/login/logout tests on selected backend.
- D: Dedicated authentic Supabase Coach provisioning and browser HTTP walkthrough (separate fixtures, no SKIP).
