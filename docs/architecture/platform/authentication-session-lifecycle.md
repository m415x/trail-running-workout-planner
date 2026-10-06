# Authentication session lifecycle

This document is the durable KAN-602 / H2 contract for Supabase Auth session handling and EPT identity resolution.

## Boundary and authority

KAN-602 authenticates an external Supabase subject and resolves it to the stable internal EPT User through `ExternalIdentityLink`.

The H2 boundary is deliberately separate from organizational authorization:

- Supabase Auth proves the external subject/session.
- `ExternalIdentityLink` maps that subject to one internal User.
- KAN-602 does not decide TeamMembership presets, capabilities, delegated scopes or RLS policy.
- KAN-603 remains the authority for capability/scope authorization.
- Email, DNI and AthleteProfile administrative data are never used to infer an identity link.

## Server-side session states

The server-side session contract distinguishes:

- `anonymous` — no session is present;
- `expired` — the auth provider reports an expired session;
- `revoked` — the provider no longer recognizes the session;
- `invalid` — malformed, ambiguous or unverifiable session state;
- `verified` — claims and current user agree on the external subject.

Expired, revoked and invalid states fail closed.

A verified external subject is then resolved to the EPT identity states:

- `unlinked` — valid Supabase identity but no active unique `ExternalIdentityLink`;
- `authenticated` — valid Supabase identity linked to exactly one active internal User;
- `invalid` — ambiguous or inconsistent linkage.

A verified but unlinked account is not an authenticated EPT user.

## Cookies, refresh and proxy

The Next.js proxy is responsible for preserving the Supabase cookie refresh lifecycle while delegating locale routing to next-intl.

The proxy is not the authorization authority. Protected Server Components and Server Actions re-evaluate the server-side H2 boundary.

Cookie mutation during Server Component rendering may be unavailable; proxy refresh remains the supported rotation boundary.

## Login and logout

Login:

1. validate credentials through Supabase Auth;
2. validate the requested return path as an internal path for the active locale;
3. resolve the resulting external subject through `ExternalIdentityLink`;
4. allow EPT access only when the identity is linked and valid;
5. reject unlinked/invalid identities without granting application access.

Return paths reject external URLs, protocol-relative paths, encoded slash/backslash escape attempts and cross-locale paths.

Logout terminates the Supabase session and returns to the localized login surface.

## Password recovery

Recovery is email-based through Supabase Auth and is intentionally non-enumerative.

The recovery flow:

1. accepts a localized recovery request;
2. uses the localized callback to exchange the recovery code for a session;
3. requires proof that the current session was established through the recovery method;
4. updates the password;
5. signs the recovery session out;
6. returns the user to login.

Password recovery does not create an `ExternalIdentityLink`, infer linkage from email/DNI, or grant EPT access automatically.

A normal password session cannot be reused as recovery proof.

## Protected application surfaces

Coach and Athlete application trees are protected by Server Component layouts.

For protected pages:

- `authenticated` renders the application shell;
- `unlinked` routes to the localized `/auth/unlinked` surface;
- `anonymous` and invalid session states redirect to localized login with a safe return path.

Server Actions use a fail-closed H2 guard independently of the page/layout boundary so direct invocation cannot bypass session validation.

The H2 action guard returns authenticated User identity internally. Existing action result contracts may adapt denial to their established error shape rather than widening unrelated UI contracts.

## Localization

Login, logout, recovery and unlinked-account surfaces are available in ES/EN.

Locale handling and return-path validation must preserve the current locale and must not create cross-locale open redirects.

## Evidence boundary

KAN-602 evidence is split by class:

- pure/focused tests for state classification, identity resolution, safe return paths and recovery semantics;
- structural/integration tests for Next.js/Supabase wiring;
- the real Supabase Auth verifier for provider-backed session evidence where configured;
- the story closure gate `pn verify --db` for the complete local application candidate.

Mocked tests and real Supabase Auth evidence are not interchangeable and must be reported separately.

## Deferred boundaries

KAN-602 does not implement:

- TeamMembership/capability/scope authorization (KAN-603);
- RLS authorization policy;
- invitation/first-link bootstrap policy (KAN-612);
- PostgreSQL application authorization or KAN-566/C14;
- post-auth product flows assigned to KAN-472;
- generic auth-provider portability.
