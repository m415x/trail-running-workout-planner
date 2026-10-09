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


## H4A Coach administrative enforcement (KAN-604)

KAN-604 is the first downstream vertical enforcement of the H3 boundary for Coach-side AthleteProfile and Sporting Group administration.

The active Team is operational context, not authority:

- H2 continues to resolve only the authenticated internal `userId`;
- the server resolves the active Team from current TeamMembership evidence and the `ept_active_team` cookie when present;
- the cookie stores only a Team identifier, is `HttpOnly`, `SameSite=Lax`, `Path=/` and secure in production;
- the cookie never grants membership, preset or capability authority and is revalidated on every resolution;
- exactly one applicable TeamMembership may auto-resolve the Team;
- multiple applicable memberships without an explicit validated selection fail closed;
- stale, malformed, cross-user or otherwise invalid Team context fails closed;
- Team selection is accepted only after server-side H2 identity resolution and membership validation.

H4A uses the H3 capabilities `athlete.admin.manage` and `sporting_group.admin.manage` with TEAM scope. Preset names are not checked by H4A callers.

Resource identifiers remain locators, not authority. Detail/update/lifecycle operations derive the stored resource Team before H3 evaluation, so an active Team cannot make a cross-Team AthleteProfile or Sporting Group accessible.

Mixed Athlete/Group reads and Athlete→Sporting Group movement require both capabilities. The movement action derives `changedByUserId` from the authenticated H2 User, validates both stored resource Teams and destination activity before mutation, and delegates the final write to the existing atomic group-assignment boundary.

`returnContext` is navigation-only input. It cannot affect actor, Team, capability, ownership or selected resource and an inconsistent value must not turn an otherwise authorized operation into an authorization denial.

KAN-604 does not introduce a second application session, a client-authoritative Team store, a generic permission editor, or a complete multi-Team UX.

## H5B SELF Stats and physiology contract (KAN-608 / T1)

H5B adds **two dedicated non-delegable SELF-only read capabilities**: `stats.self.read` and `physiology.self.read`. Both are explicit in ATHLETE, ASSISTANT, COACH and ADMIN base presets, but every call must jointly prove valid H2 internal User, currently active Team and TeamMembership, the requested capability and a unique active owned AthleteProfile in that Team. The preset is never authority to read another athlete. An absent or ambiguous profile fails closed with internal `no_profile`; missing rights yield denied, never an empty dataset. A client-provided athleteId, userId, teamId or resource ID is never sporting subject authority.

- `stats.self.read`: only the athlete's own athlete-safe Stats projections, including realized training, descriptive load, adherence, factual competition context, periods, derived aggregates, longitudinal trends and counts. All projected metrics are protected information. Neutral analytics and internal Coach read models do not acquire SELF authority transitively.
- `physiology.self.read`: **positive disclosure allowlist only**. The initial allowlist is the athlete's current RunningReference (source evaluation identity, protocol, performed date, fixed distance and observed elapsed seconds); accepted and active, temporally eligible `1000m_track` factual evolution/history (performed date, evaluation identity, elapsed seconds and official/self-directed classification); and deterministic pace/speed calculations from those eligible observations. No later-dated, rejected, pending-review or invalidated evidence is eligible for RunningReference/evolution disclosure. A missing reference remains `unknown`, never zero.

The allowlist was checked against current SQLite `field_performance_tests` (athleteId, performedAt, protocol, distanceM, elapsedTimeSec, lifecycle, executionContext, provenance, notes) and the existing Athlete /stats 1000 m presentation. The legacy `physiology_records` table also persists `pamTimeSec`, `pamPaceFormatted`, `pamSpeedKmh`, `maxHr`, `restHr`, `thresholdHr`, `weightKg`, `heightCm`, testType and notes; AthleteProfile has physiology/medical JSON. **None of these additional legacy physiology or medical fields is included** without an independently verified explicit Athlete disclosure contract. Existing Profile tab hardcodes physiology values and HR zones; those values are not authoritative evidence and must not become H5B projections by convenience. T7 will reconcile its real source/UI without broadening this allowlist silently.

`physiology.read` remains Coach-only and never substitutes for `physiology.self.read`; `field_evidence_1000m.manage` remains separate Coach authority. H5B read capabilities authorize no writes: not official 1000 m creation/modification/review/invalidation, TestEvents management, authorship or `recordedByUserId`, and not audit/H7A. The legacy Athlete /stats registration form is **not legitimized** by these read capabilities. Any disputed official-write authority stays deferred to H4C/H7A; no provisional grant is introduced.

The H5B response boundary must preserve `denied` != valid `loaded/empty` != `error`, and `unknown`/`insufficient` != zero. Authorization precedes all raw and derived reads, including aggregates. Source failure must not reveal internal details to the Athlete. Enforcement in actions/repositories and UI follows in KAN-608 T2–T8: T1's catalog declaration is **not** evidence that production Stats and physiology reads are already secured.

## Deferred boundaries

H3 does not implement:

- remaining Coach/Athlete vertical enforcement after completed H4A KAN-604 (KAN-605 through KAN-608);
- economic blocking rules (KAN-609);
- cross-domain sensitive-operation audit (KAN-610);
- PostgreSQL RLS/effective-actor enforcement (KAN-611);
- invitations or first-ADMIN bootstrap (KAN-612);
- impersonation;
- a generic permission editor;
- a new actor-to-athlete assignment domain.
