# Identity and team membership

This document is the durable KAN-601 / H1 contract for EPT identity, organizational membership and athlete administration.

## Authorities and identities

### User

`User` is the stable internal EPT identity. It is independent from any external authentication provider.

A User can exist without an external identity link. Creating an AthleteProfile must not create a User merely to satisfy persistence.

### ExternalIdentityLink

`ExternalIdentityLink` maps one verified external provider subject to one internal User.

Invariants:

- association is explicit and unique by provider + subject;
- linkage is never inferred automatically from email, DNI or athlete administrative data;
- linking an external identity grants no organizational preset by itself;
- historical legitimate User IDs remain stable.

### TeamMembership

`TeamMembership` is the sole organizational preset authority for a User inside a Team.

Invariants:

- authority is scoped by User + Team;
- one User may have memberships in multiple Teams;
- validity is explicit as `[effectiveFrom, effectiveUntil)`;
- inactive/deleted memberships do not authorize;
- ambiguous simultaneous applicable memberships fail closed;
- `users.role` is legacy data and must not be used as an authorization fallback;
- capabilities, delegated scopes and session/authentication mechanics remain outside H1 and belong to later KAN-603/KAN-602 work.

### AthleteProfile

`AthleteProfile` is the sporting/administrative subject inside one Team.

Invariants:

- AthleteProfile may exist with `userId = null`;
- administrative first name, last name and contact email are sport-owned AthleteProfile data;
- linked Users are optional identity linkage, not the source of truth required for athlete administration;
- at most one AthleteProfile may exist for one non-null `(userId, teamId)`;
- multiple profiles with `userId = null` are valid;
- inactive profiles remain part of the uniqueness/history contract;
- one User may have independent AthleteProfiles across Teams.

## Administrative consumers

Athlete creation and editing persist AthleteProfile administration without manufacturing credentials or internal identities.

Shared administrative read models expose AthleteProfile-owned names/contact and explicit provenance/absence. Lists, detail/edit forms, group assignment, cohort/planning consumers and adjustment review must tolerate nullable User linkage.

No consumer may silently fall back to a linked User as organizational authority or treat a missing User as a missing athlete.

## Lifecycle and historical preservation

Organizational and athlete deactivation are non-destructive.

- revoking a TeamMembership closes/deactivates that membership only;
- AthleteProfile activation changes are scoped by both athlete and Team;
- cross-Team mutation or transfer is rejected;
- User, AthleteProfile and stable IDs are preserved;
- sporting, economic and audit references remain attached to the original AthleteProfile;
- no lifecycle operation may simulate a Team transfer by rewriting `teamId`.

## Persistence

### SQLite

The supported SQLite path is:

```text
legacy origin
  -> canonical migrations through 0015
  -> dedicated AthleteProfile identity executor at 0016
  -> later canonical migrations
  -> current HEAD
```

The 0016 entry is a protected canonical anchor, not an assumption that the journal ends at 0016. Later legitimate migration suffixes must remain compatible with upgrade, preservation, drift and rerun verification.

### PostgreSQL

PostgreSQL evidence for H1 is static only: schema, generated migrations, snapshots and referential contracts are reviewed/versioned.

Real PostgreSQL migration/application is intentionally not executed by KAN-601. Static verification must never be described as real PostgreSQL GREEN evidence.

## Evidence classes

- **PURE** — domain/structural tests that do not require a database lifecycle.
- **SQLITE REAL** — disposable real SQLite lifecycle execution.
- **POSTGRESQL STATIC** — generated schema/SQL/snapshot inspection without a live database.
- **POSTGRESQL REAL** — pending/not authorized for H1.

The detailed persistence matrix lives in `docs/research/kan-601-persistence-evidence.md`.

## Deferred boundaries

H1 does not implement:

- login, recovery, token/cookie/session lifecycle (KAN-602);
- capabilities, delegated scopes or permission editor (KAN-603);
- RLS authorization policy;
- invitation linking/bootstrap policy decisions;
- KAN-566/C14 or real PostgreSQL application;
- unrelated next-intl/KAN-625 work.
