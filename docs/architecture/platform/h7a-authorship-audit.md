# KAN-610/H7A — authorship and retained audit contract

## Authority and scope
H7A records the authenticated EPT H2 actor who performed sensitive operations; it does **not** confer authority. Existing H3/H4/H5 authorization remains separately mandatory. In particular, KAN-606/H4C retains ownership of Coach-specific competition/test capability design and enforcement; no parallel grant or inferred capability is introduced here. Client-supplied actor IDs are never audit authority.

## Accepted invariants
- Coach 1000 m create, correction and review resolve actor H2 at the server action. The legacy creation writer also resolves H2 and replaces client actor input. Missing actor produces denial before mutation.
- New evidence and corrected replacement rows carry the authenticated recorder ID. Review writes `reviewedByUserId` together with the review state and timestamp, conditional on active `pending_review`; replay cannot rewrite attribution.
- Recorded actor and reviewer are separate facts. Historic records with nullable actor IDs remain *unknown*, not mapped by email/name or inferred; invalidated revisions remain retained.
- TestEvent author FK is nullable for legacy rows but uses `ON DELETE RESTRICT` for known creators; 1000 m reviewer FK also uses `ON DELETE RESTRICT`. SQLite 0024/0025 and Supabase 0037/0038 SQL/journals/snapshots represent these changes.
- Operational histories may exclude invalidated data; the dedicated Coach audit history includes it, ordered deterministically and scoped to the authorized athlete. The Server Action delegates through `getAthleteById`, which presently enforces H2 plus H4A `athlete.admin.manage` on the athlete's Team. This reuse is **not** proof of H4C-specific permissions.
- A denied athlete lookup prevents repository reads. The repository selects by the resolved athlete ID; application projection also filters rows to that ID. Read errors must not become success. Historical audit projection does not mutate persistence.

## Verification and limits
- T1–T8: KAN-726–KAN-733 focal RED/GREEN acceptance and SHA evidence in Jira.
- T7: SQLite migration/retention/integrity and fresh-vs-upgraded schema-drift gate `pn db:sqlite:check` reported GREEN on candidate `599cc6456921a9366ddf1c0767983e1838111d42`.
- T8: `tests/authorization/kan-610-historical-audit*.test.ts` checks retained/inactive/unknown provenance, bound authorization, server integration, SQLite isolation, failure handling and cross-athlete filtering. Final failure-safety test `a503362c5744df5e7885269d4c1f6267497cb80f` reported GREEN directly when run through `pn tdd:red`.
- The full `pn verify --db`, documentation check, PR and integration SHAs are closure evidence to be recorded separately in [KAN-610 handoff](../../handoffs/kan-610.md). A static Supabase migration contract is not a claim that a remote Supabase migration was executed.
