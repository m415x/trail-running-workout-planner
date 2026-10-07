# Authorization capabilities and scopes

This document is the durable KAN-603 / H3 contract for capability presets, authorization scopes and bounded delegation.

## Authority boundary

H3 composes existing H1 and H2 authority without replacing either one.

- Supabase Auth/H2 proves the external session and resolves one internal EPT User.
- TeamMembership/H1 is the sole organizational preset authority for that User inside one Team.
- users.role is legacy data and is not an authorization fallback.
- AthleteProfile is the sporting subject inside a Team. A preset does not make a User a sporting subject.
- All authorization is Team-first and fails closed on absence, ambiguity or cross-Team access.

## Presets and capabilities

The TeamMembership presets are ATHLETE, ASSISTANT, COACH and ADMIN.

Presets are independent, explicit capability bundles. They are not hierarchical. A capability may have multiple explicit base presets; there is no single base preset and no implicit inheritance.

Key consequences:

- ASSISTANT may receive administrative/economic capabilities without planning, physiology or official 1000 m evidence authority.
- COACH owns the ordinary sporting authority defined by its capabilities/scopes, but not structural security administration.
- ADMIN owns structural membership/preset/delegation administration but does not automatically inherit Coach sporting capabilities.
- Any User, regardless of preset, requires a linked AthleteProfile in the same Team before sporting SELF authority can exist.

Capabilities are non-delegable by default. Structural capabilities are always non-delegable.

## Executable scopes

H3 implements three executable scopes:

- SELF — only the AthleteProfile linked to the authenticated User in the same Team, and resources whose ownership derives from that profile.
- SPORTING_GROUP — resources covered by one explicitly authorized Sporting Group in the same Team.
- TEAM — resources covered by the capability across the same Team. TEAM never creates a capability that is otherwise absent.

All scope evaluation occurs after Team identity/isolation has been established.

## Reserved ASSIGNED_ATHLETES scope

ASSIGNED_ATHLETES is reserved but intentionally has no executable authorization semantics in KAN-603.

KAN-655 reconstruction established that the current durable model has no explicit continuing actor → AthleteProfile authority relation. Existing relations are not substitutes:

- AthleteProfile.groupId means athlete → Sporting Group.
- PlanningCohortMembership means athlete → Planning Cohort.
- PlanningCohortMembership.assignedByUserId records provenance of an assignment operation; it does not grant continuing authority over that athlete.

Therefore:

- KAN-603 does not create a new actor-to-athlete assignment relation merely to activate this scope;
- ASSIGNED_ATHLETES always fails closed in H3;
- T3/T4/T5 must not assume the scope is usable;
- future activation requires an explicit durable actor → AthleteProfile authority contract approved outside this bounded H3 decision.

## Delegation

Delegations are temporary grants of concrete capabilities. A grant never changes TeamMembership preset.

- only capabilities explicitly allowlisted as delegable may be granted;
- ADMIN may grant non-structural capabilities that are explicitly delegable inside the Team;
- COACH may grant only explicitly delegable sporting capabilities within authority held by the Coach as base authority;
- ASSISTANT and ATHLETE cannot grant delegations in the H3 baseline;
- authority received through a grant cannot be redelegated;
- a grant cannot widen its own scope, validity or domain.

At minimum, TeamMembership/preset management, capability/delegability administration, first-ADMIN bootstrap, impersonation, audit/authorship mutation, economic-rule bypass and RLS/security authority are structural and non-delegable.

H3 introduces no generic per-user DENY overrides.

## Effective precedence

The authorization decision is resolved in this order:

1. valid H2 authenticated User;
2. one applicable, non-ambiguous TeamMembership for the requested Team;
3. requested resource belongs to that Team;
4. capability is present in the preset's explicit base capability set;
5. sporting SELF authority is added only when the User has a linked AthleteProfile in that Team;
6. valid, current and non-revoked grants may add explicitly delegable authority;
7. one executable scope covers the requested resource;
8. later domain-specific rules may still deny the operation;
9. otherwise allow.

Any missing or inconsistent authority produces deny.

ASSIGNED_ATHLETES at step 7 always produces deny while reserved.

## Persisted grant lifecycle

H3 persists authorization grants as historical, non-destructive records.

A persisted grant records:

- beneficiary User and Team;
- one concrete capability;
- one executable scope plus its target when the scope requires one;
- mandatory finite `effectiveFrom` / `effectiveUntil` validity;
- granting User and reason;
- optional complete revocation metadata.

The physical schema enforces that `effectiveUntil > effectiveFrom`, SPORTING_GROUP has a target, SELF/TEAM do not, and revocation metadata is either wholly absent or wholly present. Revocation does not delete or overwrite the original grant evidence.

SQLite migration `0019` and PostgreSQL migration `0032` are the canonical H3 persistence additions. KAN-603 closure treats SQLite lifecycle execution as real local evidence and PostgreSQL migration consistency as static evidence only; it does not claim remote PostgreSQL application or H7B RLS.

## Reusable effective authorization boundary

The reusable H3 decision is split deliberately into two layers:

- the pure effective resolver composes TeamMembership, capability preset, AthleteProfile SELF identity, grants and scope coverage;
- the authenticated boundary accepts the H2 `RequireAuthenticatedActionResult` and injects the authenticated internal EPT `userId` into that resolver.

Caller-facing H3 input has no actor/user field. Anonymous, unlinked or invalid H2 states deny before H3 evaluation. This prevents a client-selected actor identifier from becoming authorization authority.

KAN-603 provides this reusable boundary but does not exhaustively migrate Coach/Athlete vertical consumers. That enforcement belongs to the downstream H4/H5/H6 stories named below.

## Deferred boundaries

H3 does not implement:

- exhaustive Coach/Athlete vertical enforcement (KAN-604 through KAN-608);
- economic blocking rules (KAN-609);
- cross-domain sensitive-operation audit (KAN-610);
- PostgreSQL RLS/effective-actor enforcement (KAN-611);
- invitations or first-ADMIN bootstrap (KAN-612);
- impersonation;
- a generic permission editor;
- a new actor-to-athlete assignment domain.
