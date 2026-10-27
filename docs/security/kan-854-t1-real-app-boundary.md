# KAN-854/T1 — Real application routing boundary after neutral HTTP smoke

Evidence: operator GREEN on `pn tdd tests/i18n/kan-854-t1-real-next-http-smoke.test.ts` at `feat/KAN-852-dependency-security@7522643bb509cba3af10b64ac43fc3c892a29193` (Jira KAN-854 comment 14076). This establishes a real Next.js 16.3.8 HTTP redirect with a *neutral fixture* and `--webpack`, **not** the actual application routing or causal A/B/C.

Source inspected in the current security branch:
- `i18n/routing.ts`: `locales: ['es','en']`, `defaultLocale: 'es'`, `localePrefix: 'as-needed'`.
- `i18n/request.ts`: `getRequestConfig`, request locale validation and `loadMessages`.
- `proxy.ts`: `refreshSupabaseProxySession` before `createMiddleware(routing)` and `carryAuthRefreshIntoResponse`, matcher excluding API/static.
- `lib/auth/supabase-proxy.ts`: Supabase config from NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY; verified refresh sets response cookies and no-store headers.
- `next.config.ts`: actual `withNextIntl(withPWA(nextConfig))` config, PWA disabled in development.
- `app/[locale]/layout.tsx`: actual server locale validation and provider, includes Next font and application styling.

**Next execution boundary:** build a disposable **real-application** HTTP scenario by serving an unchanged checkout/application source with isolated dist directory and data dependencies, not a synthesized copy of `next-intl` or authorization logic. The test must first preflight configuration, auth, active-Team fixture, distinct ports, Next/router SHA and artifacts. Abort as ERROR PREPARATION if required Supabase identity/SQLite or runtime constraints are missing. Host 127.0.0.1/localhost, GET public/ES/EN/dashboard, no-follow 307 chain; then authenticated H2/H3/H4A + token refresh in distinct cut. Use same app SHA and scenarios per variant; historical KAN-849 fixture is design reference only, not present in the current security branch.

The prior neutral fixture must never be reported as an end-to-end regression of `next-intl`, an authorization GREEN, or evidence for Next 16.4.3. The next technical cut must be published and tested before claiming real-app HTTP readiness. No product dependency update, no PR/merge/global gate.
